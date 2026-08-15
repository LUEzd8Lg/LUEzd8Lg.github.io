/**
 * Worldview Archive · 后端服务
 * ============================================================
 * 功能：
 *   1. 静态托管前端（index.html / *.css / *.js / data/ 图片）
 *   2. 短信 / 邮件 验证码发送（mock + 真实双通道）
 *   3. 用户注册 / 登录
 *   4. 用户投稿（LV.2 以上）
 *
 * 启动：
 *   cd server
 *   npm install
 *   cp .env.example .env   # 填入真实配置
 *   npm start              # http://localhost:3000/
 * ============================================================
 */
require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const mammoth = require('mammoth');

const { sendSms, sendEmail } = require('./services/notifier');

// -------- 配置 --------
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(__dirname, process.env.DATA_DIR)
  : null;
const ARCHIVE_DATA_DIR = process.env.ARCHIVE_DATA_DIR
  ? path.resolve(__dirname, process.env.ARCHIVE_DATA_DIR)
  : path.resolve(__dirname, '..', 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(__dirname, process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '..', 'data', 'uploads');
const CODE_TTL = (parseInt(process.env.CODE_TTL_SEC) || 300) * 1000;
const SEND_COOLDOWN = (parseInt(process.env.SEND_COOLDOWN_SEC) || 60) * 1000;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT_PER_IP) || 100;
const DEFAULT_LEVEL = process.env.DEFAULT_LEVEL || 'LV.2';
const JWT_SECRET = process.env.JWT_SECRET || 'wva-dev-secret-change-me-please-9f3b8c';
const JWT_EXP = process.env.JWT_EXP || '12h';
const ADMIN_CONTACT = (process.env.ADMIN_CONTACT || 'admin').trim();
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// 分类 → 实际 JSON 文件映射（相对 ARCHIVE_DATA_DIR）
const CATEGORY_FILES = {
  anomalies:  ['anomalies-urban.json', 'anomalies-rural.json', 'anomalies-nether.json',
               'anomalies-cosmic.json', 'anomalies-classic.json'],
  organizations: ['organizations.json'],
  eras:       ['eras.json'],
  deities:    ['deities.json'],
  timelines:  ['timelines.json']
};
// 单个分类写回时使用的默认文件（新增 / 编辑 / 删除都写在这个主文件里）
const CATEGORY_MAIN_FILE = {
  anomalies:    'anomalies-urban.json',
  organizations:'organizations.json',
  eras:         'eras.json',
  deities:      'deities.json',
  timelines:    'timelines.json'
};

// -------- 文件存储：如果 DATA_DIR 配置了就用 JSON 持久化 --------
function loadStore(name, fallback) {
  if (!DATA_DIR) return fallback;
  const fp = path.join(DATA_DIR, `${name}.json`);
  try {
    if (!fs.existsSync(fp)) return fallback;
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.error(`[store] load ${name} failed:`, e.message);
    return fallback;
  }
}
function saveStore(name, data) {
  if (!DATA_DIR) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[store] save ${name} failed:`, e.message);
  }
}

let codes      = loadStore('codes', {});      // { contactKey: { code, exp, ip } }
let users      = loadStore('users', []);      // [ { contact, passHash, level, role, createdAt } ]
let submissions = loadStore('submissions', []); // [ { id, category, status, ... } ]
let sendLog    = loadStore('sendLog', {});    // { ip: [ timestamps... ] }
let sendAt     = {};                          // { contactKey: lastSentTimestamp }

// ---------- 启动时：确保管理员账号存在 ----------
(function ensureAdmin() {
  const adminKey = normContact(ADMIN_CONTACT);
  const existing = users.find(u => normContact(u.contact) === adminKey);
  if (existing) {
    if (existing.role !== 'admin') { existing.role = 'admin'; persistAll(); }
    return;
  }
  const builtIn = {
    contact: ADMIN_CONTACT,
    passHash: hashPass(ADMIN_PASS),
    level: 'LV.9',
    role: 'admin',
    createdAt: Date.now(),
    builtIn: true
  };
  users.unshift(builtIn);
  persistAll();
  console.log(`[admin] 内置管理员已就绪：${ADMIN_CONTACT}（请在 .env 修改 ADMIN_PASS）`);
})();

// ---------- 老投稿兼容：旧 submissions 没有 status 的补 pending ----------
(function fixSubmissionStatus() {
  let dirty = false;
  for (const s of submissions) {
    if (!s.status) { s.status = 'pending'; dirty = true; }
  }
  if (dirty) persistAll();
})();

function persistAll() {
  saveStore('codes', codes);
  saveStore('users', users);
  saveStore('submissions', submissions);
  saveStore('sendLog', sendLog);
}
setInterval(persistAll, 15_000).unref();

// -------- 工具 --------
const RE_PHONE = /^1[3-9]\d{9}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normContact(c) { return (c || '').trim().toLowerCase(); }
function isPhone(c) { return RE_PHONE.test(c); }
function isEmail(c) { return RE_EMAIL.test(c); }
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0]
      || (req.headers['x-real-ip'])
      || req.socket.remoteAddress
      || 'unknown';
}
function jsonReply(res, code, data) {
  res.status(code).json(data);
}
function hashPass(p) {
  return crypto.createHash('sha256').update(p + '::WVA_SALT_2026').digest('hex');
}
function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ---- JWT ----
function signToken(user) {
  return jwt.sign(
    { sub: normContact(user.contact), role: user.role || 'user', level: user.level, iat: Date.now() },
    JWT_SECRET,
    { expiresIn: JWT_EXP }
  );
}
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const t = authHeader.slice(7);
  try { return jwt.verify(t, JWT_SECRET); } catch (_) { return null; }
}
// ---- 权限中间件 ----
function requireLogin(req, res, next) {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) return jsonReply(res, 401, { ok:false, msg:'未登录或会话已过期' });
  const user = users.find(u => normContact(u.contact) === payload.sub);
  if (!user) return jsonReply(res, 401, { ok:false, msg:'账号不存在' });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  const payload = verifyToken(req.headers.authorization);
  if (!payload) return jsonReply(res, 401, { ok:false, msg:'未登录或会话已过期' });
  if (payload.role !== 'admin') return jsonReply(res, 403, { ok:false, msg:'需要管理员权限' });
  const user = users.find(u => normContact(u.contact) === payload.sub);
  if (!user || user.role !== 'admin') return jsonReply(res, 403, { ok:false, msg:'需要管理员权限' });
  req.user = user;
  next();
}

// ---- 档案读写 ----
function readJsonIfExists(fp, fallback) {
  try {
    if (!fs.existsSync(fp)) return fallback;
    const raw = fs.readFileSync(fp, 'utf8');
    // 兼容 data/merged.js：文件不是 JSON 就跳过
    if (/\.json$/.test(fp)) return JSON.parse(raw);
    return fallback;
  } catch (e) {
    console.error('[archive] readJson failed', fp, e.message);
    return fallback;
  }
}
function listArchiveCategory(catId) {
  const files = CATEGORY_FILES[catId] || [];
  const all = [];
  for (const f of files) {
    const fp = path.join(ARCHIVE_DATA_DIR, f);
    const arr = readJsonIfExists(fp, []);
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === 'object') all.push(Object.assign({ _srcFile: f, _cat: catId }, item));
      }
    }
  }
  return all;
}
function findEntry(catId, entryId) {
  const files = CATEGORY_FILES[catId] || [];
  for (const f of files) {
    const fp = path.join(ARCHIVE_DATA_DIR, f);
    const arr = readJsonIfExists(fp, []);
    if (!Array.isArray(arr)) continue;
    const idx = arr.findIndex(x => String(x.id) === String(entryId));
    if (idx >= 0) return { srcFile: f, arr, idx, item: arr[idx], filePath: fp };
  }
  return null;
}
function writeArchiveFile(fileName, arr) {
  const fp = path.join(ARCHIVE_DATA_DIR, fileName);
  if (!fs.existsSync(ARCHIVE_DATA_DIR)) fs.mkdirSync(ARCHIVE_DATA_DIR, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(arr, null, 2), 'utf8');
}
function genEntryId(catId, payload) {
  // 用现有编号前缀 + 自增，没 code 的就用 SUB-{cat}-NNN
  const existing = listArchiveCategory(catId);
  if (payload && payload.code) return String(payload.id || payload.code);
  const prefix = catId === 'anomalies'    ? 'UAR-'
              : catId === 'organizations'? 'ORG-'
              : catId === 'eras'         ? 'ERA-'
              : catId === 'timelines'    ? 'TL-'
              : catId === 'deities'      ? 'DEI-'
              : 'ENT-';
  let n = existing.length + 1;
  while (existing.some(x => String(x.id) === `${prefix}${String(n).padStart(3,'0')}`)) n++;
  return `${prefix}${String(n).padStart(3,'0')}`;
}

// ---- DOCX 上传：Multer ----
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
ensureDir(UPLOAD_DIR);
const docxStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ym = new Date().toISOString().slice(0,7).replace('-', '/'); // 2026/08
    const d = path.join(UPLOAD_DIR, ym);
    ensureDir(d);
    cb(null, d);
  },
  filename: (req, file, cb) => {
    const rnd = crypto.randomBytes(6).toString('hex');
    const cleanName = (file.originalname || 'upload').replace(/[^\w.\-]+/g, '_').slice(0,60);
    cb(null, `${Date.now()}-${rnd}-${cleanName}`);
  }
});
const multerDocx = multer({
  storage: docxStorage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const lower = (file.originalname || '').toLowerCase();
    if (!lower.endsWith('.docx')) return cb(new Error('仅支持 .docx 文件'));
    cb(null, true);
  }
}).single('doc');

// 图片上传 multer（用于投稿编辑器插入本地图片）
const multerImage = multer({
  storage: docxStorage,  // 复用同一存储策略（data/uploads/YYYY/MM/）
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype || '')) return cb(new Error('仅支持图片文件'));
    cb(null, true);
  }
}).single('image');

// -------- Express --------
const app = express();
if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN.split(','), credentials: true }));
} else {
  app.use(cors());
}
app.use(express.json({ limit: '2mb' }));

// 简单请求日志
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ← ${clientIp(req)}`);
  }
  next();
});

// ============================================================
//  API 1：发送验证码  POST /api/send-code
//  body: { contact: '手机号或邮箱' }
// ============================================================
app.post('/api/send-code', async (req, res) => {
  try {
    const { contact } = req.body || {};
    const key = normContact(contact);
    if (!key) return jsonReply(res, 400, { ok:false, msg:'请输入手机号或邮箱' });
    if (!isPhone(key) && !isEmail(key))
      return jsonReply(res, 400, { ok:false, msg:'请输入有效的手机号或邮箱' });

    // 频率：同目标冷却
    if (sendAt[key] && (Date.now() - sendAt[key]) < SEND_COOLDOWN) {
      const sec = Math.ceil((SEND_COOLDOWN - (Date.now() - sendAt[key])) / 1000);
      return jsonReply(res, 429, { ok:false, msg:`发送过于频繁，请 ${sec}s 后再试` });
    }
    // 频率：同 IP 每日上限
    const ip = clientIp(req);
    const today = new Date().toDateString();
    sendLog[ip] = (sendLog[ip] || []).filter(t => new Date(t).toDateString() === today);
    if (sendLog[ip].length >= DAILY_LIMIT) {
      return jsonReply(res, 429, { ok:false, msg:'今日发送次数已达上限' });
    }

    const code = genCode();
    codes[key] = { code, exp: Date.now() + CODE_TTL, ip };
    sendAt[key] = Date.now();
    sendLog[ip].push(Date.now());
    persistAll();

    let provider;
    let sendResult;
    if (isPhone(key)) {
      provider = process.env.SMS_PROVIDER || 'mock';
      sendResult = await sendSms({ phone: key, code, provider });
    } else {
      provider = process.env.EMAIL_PROVIDER || 'mock';
      sendResult = await sendEmail({ to: key, code, provider });
    }

    if (!sendResult.ok) {
      // 真实通道失败：保留验证码但返回错误，不删除（用户可能要求重试）
      console.error(`[notifier] ${provider} failed:`, sendResult.msg);
      return jsonReply(res, 502, { ok:false, msg: sendResult.msg });
    }

    const isMock = provider === 'mock';
    return jsonReply(res, 200, {
      ok: true,
      mock: isMock,
      provider,
      // mock 模式把验证码返回给前端显示；真实模式不返回
      code: isMock ? code : undefined,
      msg: isMock
        ? `演示模式：验证码为 ${code}（配置 .env 后将真实发送）`
        : `验证码已发送至 ${key}，请查收（${CODE_TTL/60000|0} 分钟有效）`
    });
  } catch (e) {
    console.error('[send-code] uncaught:', e);
    jsonReply(res, 500, { ok:false, msg:'服务器内部错误' });
  }
});

// ============================================================
//  API 2：注册  POST /api/register
//  body: { contact, code, password }
// ============================================================
app.post('/api/register', (req, res) => {
  try {
    const { contact, code, password } = req.body || {};
    const key = normContact(contact);
    if (!key) return jsonReply(res,400,{ok:false,msg:'请输入手机号或邮箱'});
    if (!code) return jsonReply(res,400,{ok:false,msg:'请输入验证码'});
    if (!password || password.length < 6) return jsonReply(res,400,{ok:false,msg:'密码至少 6 位'});

    const rec = codes[key];
    if (!rec) return jsonReply(res,400,{ok:false,msg:'请先发送验证码'});
    if (Date.now() > rec.exp) return jsonReply(res,400,{ok:false,msg:'验证码已过期'});
    if (rec.code !== String(code).trim()) return jsonReply(res,400,{ok:false,msg:'验证码不正确'});

    if (users.find(u => normContact(u.contact) === key))
      return jsonReply(res,409,{ok:false,msg:'该手机号/邮箱已注册，请直接登录'});

    const user = {
      contact: contact.trim(),
      passHash: hashPass(password),
      level: DEFAULT_LEVEL,
      role: 'user',
      createdAt: Date.now()
    };
    users.push(user);
    delete codes[key]; // 注册成功后验证码失效
    persistAll();

    return jsonReply(res,201,{
      ok: true,
      token: signToken(user),
      user: { contact: user.contact, level: user.level, role: user.role }
    });
  } catch (e) {
    console.error('[register] uncaught:', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误'});
  }
});

// ============================================================
//  API 3：登录  POST /api/login
//  body: { contact, password }
//  新增：同时支持 admin 登录，返回 JWT token 与 role
// ============================================================
app.post('/api/login', (req, res) => {
  try {
    const { contact, password } = req.body || {};
    const key = normContact(contact);
    if (!key || !password) return jsonReply(res,400,{ok:false,msg:'请输入账号和密码'});

    const u = users.find(u => normContact(u.contact) === key);
    if (!u) return jsonReply(res,401,{ok:false,msg:'账号不存在，请先注册'});
    if (u.passHash !== hashPass(password)) return jsonReply(res,401,{ok:false,msg:'密码错误'});

    return jsonReply(res,200,{
      ok: true,
      token: signToken(u),
      user: { contact: u.contact, level: u.level, role: u.role || 'user' }
    });
  } catch (e) {
    console.error('[login] uncaught:', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误'});
  }
});

// ============================================================
//  API 3.1：用已登录的 token 换自己资料  GET /api/me
// ============================================================
app.get('/api/me', requireLogin, (req, res) => {
  jsonReply(res, 200, {
    ok: true,
    user: {
      contact: req.user.contact,
      level:   req.user.level,
      role:    req.user.role || 'user',
      createdAt: req.user.createdAt
    }
  });
});

// ============================================================
//  API 4：投稿  POST /api/submit
//  支持登录 token（Authorization: Bearer <token>）或兼容旧 body.authorContact
//  提交后状态 = pending，不会立即出现在公开档案列表
// ============================================================
app.post('/api/submit', requireLogin, (req, res) => {
  try {
    const b = req.body || {};
    const user = req.user;
    const lvNum = parseInt((user.level || '').match(/\d/)?.[0] || '0');
    if (lvNum < 2) {
      return jsonReply(res,403,{ok:false,msg:`当前等级 ${user.level} 无投稿权限（需 LV.2 以上）`});
    }
    if (!b.title || !b.title.trim()) return jsonReply(res,400,{ok:false,msg:'请输入标题'});
    if (!b.body || !b.body.trim()) return jsonReply(res,400,{ok:false,msg:'请输入正文'});

    const id = 'SUB-' + String(submissions.length + 1).padStart(4,'0');
    const s = {
      id,
      title: b.title.trim(),
      category: b.category || 'anomalies',
      class: b.class || 'neutral',
      code: b.code || '',
      summary: b.summary || '',
      body: b.body,
      tags: Array.isArray(b.tags) ? b.tags : String(b.tags||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean),
      source: b.source || '',
      img: b.img || b.cover || '',
      cover: b.cover || b.img || '',
      author: user.contact,
      authorLevel: user.level,
      status: 'pending',
      at: Date.now()
    };
    submissions.unshift(s);
    persistAll();
    return jsonReply(res,201,{
      ok:true,
      msg: '投稿已提交，等待管理员审核',
      submission: s
    });
  } catch (e) {
    console.error('[submit] uncaught:', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误'});
  }
});

// ============================================================
//  API 4.1：DOCX 上传并解析  POST /api/submit/upload-docx
//  multipart/form-data, 字段名 doc = .docx 文件
//  返回 { ok, html, text, images: [{src, filename, contentType}], titleSuggest }
// ============================================================
app.post('/api/submit/upload-docx', requireLogin, (req, res) => {
  multerDocx(req, res, async (err) => {
    if (err) return jsonReply(res, 400, { ok:false, msg: err.message || '文件上传失败' });
    if (!req.file) return jsonReply(res, 400, { ok:false, msg:'请选择 .docx 文件' });
    try {
      // 把 UPLOAD_DIR 里保存的绝对路径映射为前端可访问的相对 URL：
      //   绝对：${UPLOAD_DIR}/2026/08/xxx.png
      //   相对项目根：data/uploads/2026/08/xxx.png
      //   URL：/data/uploads/2026/08/xxx.png
      const relFromRoot = (absPath) => {
        const root = path.resolve(__dirname, '..');
        const rel = path.relative(root, absPath).split(path.sep).join('/');
        return '/' + rel;
      };
      const convertImage = mammoth.images.inline(function(image) {
        return image.read().then(function(buffer) {
          const ym = new Date().toISOString().slice(0,7).replace('-', '/');
          const d = path.join(UPLOAD_DIR, ym);
          ensureDir(d);
          const ext = image.contentType.split('/')[1] || 'png';
          const rnd = crypto.randomBytes(6).toString('hex');
          const fname = `img-${Date.now()}-${rnd}.${ext}`;
          const fpath = path.join(d, fname);
          fs.writeFileSync(fpath, buffer);
          const url = relFromRoot(fpath);
          return { src: url };
        });
      });
      const result = await mammoth.convertToHtml({ path: req.file.path }, {
        convertImage: convertImage
      });
      const txtResult = await mammoth.extractRawText({ path: req.file.path });
      const html = (result.value || '').replace(/\r?\n/g, '\n')
        // Word 里的段落<p>本来就会换行；再加一点用户要的"自动换行"：行长度超过 80 字符的纯文本行，强制软换行
        .split('\n').map(line => {
          if (/^\s*</.test(line) || /<[a-z][^>]*>/i.test(line)) return line;
          // 纯文本行，按 80 中文宽度软切（\n + 空格缩进）
          const max = 80;
          if (line.length <= max) return line;
          let out = '';
          for (let i = 0; i < line.length; i += max) out += (i ? '\n  ' : '') + line.slice(i, i + max);
          return out;
        }).join('\n');
      const text = (txtResult.value || '').replace(/\r?\n/g, '\n');
      const firstLine = text.split('\n').map(s => s.trim()).find(s => s.length > 0) || '';
      const titleSuggest = firstLine.slice(0, 40);
      jsonReply(res, 200, {
        ok: true,
        html,
        text,
        titleSuggest,
        warnings: (result.messages || []).map(m => m.message).slice(0, 20),
        srcFile: req.file.path,
        srcUrl: relFromRoot(req.file.path)
      });
    } catch (e) {
      console.error('[docx] parse failed:', e);
      jsonReply(res, 500, { ok:false, msg: 'DOCX 解析失败：' + (e.message || '未知错误') });
    }
  });
});

// ============================================================
//  API 4.2：图片上传  POST /api/submit/upload-image
//  multipart/form-data, 字段名 image = 图片文件
//  返回 { ok, url }
// ============================================================
app.post('/api/submit/upload-image', requireLogin, (req, res) => {
  multerImage(req, res, (err) => {
    if (err) return jsonReply(res, 400, { ok:false, msg: err.message || '图片上传失败' });
    if (!req.file) return jsonReply(res, 400, { ok:false, msg:'请选择图片' });
    const root = path.resolve(__dirname, '..');
    const rel = path.relative(root, req.file.path).split(path.sep).join('/');
    jsonReply(res, 200, { ok:true, url: '/' + rel, filename: req.file.filename });
  });
});

// ============================================================
//  API 6：注销账号  DELETE /api/account
//  body: { contact, password, confirm: true }
//  行为：从 users 删除；关联投稿保留，作者改为 "已注销用户" 留痕
// ============================================================
app.delete('/api/account', (req, res) => {
  try {
    const { contact, password, confirm } = req.body || {};
    const key = normContact(contact);
    if (!key || !password) return jsonReply(res,400,{ok:false,msg:'请输入账号和密码'});
    if (!confirm) return jsonReply(res,400,{ok:false,msg:'请确认注销操作'});

    const idx = users.findIndex(u => normContact(u.contact) === key);
    if (idx < 0) return jsonReply(res,404,{ok:false,msg:'账号不存在'});
    const u = users[idx];
    if (u.passHash !== hashPass(password)) return jsonReply(res,401,{ok:false,msg:'密码错误，无法注销'});

    // 执行删除
    users.splice(idx, 1);
    // 关联投稿留痕（不删作品，只改作者标记）
    let sc = 0;
    submissions.forEach(s => {
      if (normContact(s.author) === key) {
        s.author = '(已注销用户)';
        s.authorLevel = s.authorLevel || 'LV.2';
        s.deleted = true;
        sc++;
      }
    });
    // 清掉该账号对应的验证码
    delete codes[key];
    delete sendAt[key];
    persistAll();

    return jsonReply(res,200,{
      ok: true,
      msg: sc > 0
        ? `账号已注销，共保留 ${sc} 篇投稿（作者置为已注销）`
        : `账号已注销`
    });
  } catch (e) {
    console.error('[delete-account] uncaught:', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误'});
  }
});

// ============================================================
//  API 5：拉取投稿列表（调试/扩展用） GET /api/submissions?limit=50
//  权限：管理员能看全部（带 status/body/summary），普通登录只能看自己公开元数据
// ============================================================
app.get('/api/submissions', (req, res) => {
  const adminPayload = verifyToken(req.headers.authorization);
  const isAdmin = adminPayload && adminPayload.role === 'admin';
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  let list = submissions.slice(0, limit);
  if (req.query.status) list = list.filter(s => s.status === req.query.status);
  if (req.query.category) list = list.filter(s => s.category === req.query.category);

  let out;
  if (isAdmin) {
    out = list.map(s => Object.assign({}, s));
  } else {
    const selfKey = adminPayload ? adminPayload.sub : null;
    out = list
      .filter(s => s.status === 'approved' || (selfKey && normContact(s.author) === selfKey))
      .map(s => ({
        id: s.id, title: s.title, category: s.category, class: s.class,
        summary: s.summary, author: s.author, authorLevel: s.authorLevel,
        status: s.status, at: s.at
      }));
  }
  jsonReply(res,200,{ ok:true, total: out.length, list: out });
});

// ============================================================
// =========== 管理员路由 /api/admin/* =====================
// ============================================================

// ---------- 审核：列表 ----------
app.get('/api/admin/submissions', requireAdmin, (req, res) => {
  const status = req.query.status; // pending / approved / rejected / all
  let list = submissions.slice();
  if (status && status !== 'all') list = list.filter(s => s.status === status);
  if (req.query.category) list = list.filter(s => s.category === req.query.category);
  list.sort((a,b) => (b.at||0) - (a.at||0));
  jsonReply(res, 200, { ok:true, total: list.length, list });
});

// ---------- 审核：通过 / 打回 ----------
// body: { status: 'approved'|'rejected', note?: string, patch?: {category, class, code, title, summary, img, tags} }
// 如果 approved：
//   - 如果 patch 里有 category：投到目标分类，否则按原 category
//   - 在 anomalies/organizations 对应 JSON 里 push 一条新 entry
//   - 生成 id：SUB-SUB-xxxx（或使用 code）
app.post('/api/admin/submissions/:id/review', requireAdmin, (req, res) => {
  try {
    const sid = req.params.id;
    const sidx = submissions.findIndex(s => s.id === sid);
    if (sidx < 0) return jsonReply(res, 404, { ok:false, msg:'投稿不存在' });
    const s = submissions[sidx];
    const { status, note, patch } = Object.assign({ status: null, note: '', patch: {} }, req.body || {});
    if (!['approved','rejected'].includes(status))
      return jsonReply(res,400,{ok:false,msg:'status 必须为 approved 或 rejected'});

    let mergedEntry = null;
    if (status === 'approved') {
      const targetCat = (patch && patch.category) || s.category || 'anomalies';
      if (!CATEGORY_MAIN_FILE[targetCat])
        return jsonReply(res,400,{ok:false,msg:`未知分类: ${targetCat}`});

      const title = (patch && patch.title) || s.title;
      const id = genEntryId(targetCat, Object.assign({}, s, patch || {}));
      mergedEntry = {
        id,
        title,
        code:    (patch && patch.code)    || s.code    || '',
        class:   (patch && patch.class)   || s.class   || 'neutral',
        summary: (patch && patch.summary) || s.summary || (s.body || '').replace(/[#*>\[\]\(\)]/g,'').slice(0, 80),
        tags:    (patch && Array.isArray(patch.tags)) ? patch.tags : (s.tags || []),
        img:     (patch && (patch.img || patch.cover)) || s.img || s.cover || '',
        source:  s.source || '',
        content: s.body || '',
        body:    s.body || '',
        author:  s.author,
        fromSubmissionId: s.id,
        approvedAt: Date.now(),
        approvedBy: req.user.contact
      };
      // 写入目标主文件
      const file = CATEGORY_MAIN_FILE[targetCat];
      const fp = path.join(ARCHIVE_DATA_DIR, file);
      const arr = readJsonIfExists(fp, []);
      if (!Array.isArray(arr)) return jsonReply(res,500,{ok:false,msg:`档案文件损坏：${file}`});
      arr.push(mergedEntry);
      writeArchiveFile(file, arr);
      s.approvedEntry = { cat: targetCat, file, id, title: mergedEntry.title };
    }

    s.status = status;
    s.reviewBy = req.user.contact;
    s.reviewAt = Date.now();
    s.reviewNote = note || '';
    if (patch) s.patch = patch;
    persistAll();

    jsonReply(res, 200, {
      ok: true,
      submission: s,
      mergedEntry: mergedEntry || undefined
    });
  } catch (e) {
    console.error('[admin:review]', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误：'+(e.message||'')});
  }
});

// ---------- 管理员：档案列表（读真实 JSON）----------
app.get('/api/admin/entries/:cat', requireAdmin, (req, res) => {
  const cat = req.params.cat;
  if (!CATEGORY_FILES[cat]) return jsonReply(res,400,{ok:false,msg:'未知分类'});
  const list = listArchiveCategory(cat);
  jsonReply(res, 200, { ok:true, total: list.length, list });
});

// ---------- 管理员：新增档案 ----------
app.post('/api/admin/entries/:cat', requireAdmin, (req, res) => {
  try {
    const cat = req.params.cat;
    if (!CATEGORY_FILES[cat]) return jsonReply(res,400,{ok:false,msg:'未知分类'});
    const p = Object.assign({}, req.body || {});
    p.id = String(p.id || genEntryId(cat, p));
    if (!p.title || !p.title.trim()) return jsonReply(res,400,{ok:false,msg:'必须填标题'});
    if (!p.content && !p.body) p.body = '';
    p.content = p.content || p.body || '';
    p.body = p.body || p.content || '';

    const file = CATEGORY_MAIN_FILE[cat];
    const fp = path.join(ARCHIVE_DATA_DIR, file);
    const arr = readJsonIfExists(fp, []);
    if (!Array.isArray(arr)) return jsonReply(res,500,{ok:false,msg:`档案文件损坏：${file}`});
    if (arr.some(x => String(x.id) === String(p.id)))
      return jsonReply(res, 409, { ok:false, msg:'同分类下已存在相同 id 的档案' });
    arr.push(p);
    writeArchiveFile(file, arr);
    jsonReply(res, 201, { ok:true, entry: p, file });
  } catch (e) {
    console.error('[admin:add]', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误：'+(e.message||'')});
  }
});

// ---------- 管理员：编辑档案 ----------
app.put('/api/admin/entries/:cat/:id', requireAdmin, (req, res) => {
  try {
    const cat = req.params.cat;
    const id  = req.params.id;
    if (!CATEGORY_FILES[cat]) return jsonReply(res,400,{ok:false,msg:'未知分类'});
    const hit = findEntry(cat, id);
    if (!hit) return jsonReply(res,404,{ok:false,msg:'档案不存在'});
    const p = Object.assign({}, hit.item, req.body || {});
    // 避免改 id 冲突
    if (String(p.id) !== String(id)) {
      const collision = findEntry(cat, p.id);
      if (collision && collision.filePath !== hit.filePath) return jsonReply(res,409,{ok:false,msg:'新 id 已被占用'});
    }
    p.content = p.content || p.body || '';
    p.body    = p.body    || p.content || '';
    hit.arr[hit.idx] = p;
    writeArchiveFile(hit.srcFile, hit.arr);
    jsonReply(res,200,{ ok:true, entry:p, file: hit.srcFile });
  } catch (e) {
    console.error('[admin:edit]', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误：'+(e.message||'')});
  }
});

// ---------- 管理员：删除档案 ----------
app.delete('/api/admin/entries/:cat/:id', requireAdmin, (req, res) => {
  try {
    const cat = req.params.cat;
    const id  = req.params.id;
    if (!CATEGORY_FILES[cat]) return jsonReply(res,400,{ok:false,msg:'未知分类'});
    const hit = findEntry(cat, id);
    if (!hit) return jsonReply(res,404,{ok:false,msg:'档案不存在'});
    const [removed] = hit.arr.splice(hit.idx, 1);
    writeArchiveFile(hit.srcFile, hit.arr);
    jsonReply(res, 200, { ok:true, removed, file: hit.srcFile });
  } catch (e) {
    console.error('[admin:del]', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误：'+(e.message||'')});
  }
});

// ---------- 管理员：用户列表 / 提拔 / 删除 ----------
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const list = users.map(u => ({
    contact: u.contact,
    level: u.level,
    role: u.role || 'user',
    createdAt: u.createdAt,
    builtIn: !!u.builtIn
  }));
  jsonReply(res, 200, { ok:true, total: list.length, list });
});

// body: { role: 'admin' | 'user', level?: 'LV.2' | 'LV.3' ... }
app.post('/api/admin/users/:contact/update', requireAdmin, (req, res) => {
  try {
    const key = normContact(req.params.contact);
    const u = users.find(x => normContact(x.contact) === key);
    if (!u) return jsonReply(res, 404, { ok:false, msg:'用户不存在' });
    if (u.builtIn && (req.body && req.body.role) && req.body.role !== 'admin')
      return jsonReply(res, 403, { ok:false, msg:'内置管理员不可撤销，请修改 .env 重新指定' });
    const b = req.body || {};
    if (b.role) u.role = (b.role === 'admin') ? 'admin' : 'user';
    if (b.level) u.level = String(b.level);
    persistAll();
    jsonReply(res, 200, { ok:true, user: { contact: u.contact, level: u.level, role: u.role || 'user' } });
  } catch (e) {
    console.error('[admin:userUpdate]', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误'});
  }
});

// body: { confirm: true }
app.delete('/api/admin/users/:contact', requireAdmin, (req, res) => {
  try {
    const key = normContact(req.params.contact);
    if (normContact(req.user.contact) === key)
      return jsonReply(res, 400, { ok:false, msg:'不能删除自己' });
    const idx = users.findIndex(x => normContact(x.contact) === key);
    if (idx < 0) return jsonReply(res, 404, { ok:false, msg:'用户不存在' });
    const u = users[idx];
    if (u.builtIn)
      return jsonReply(res, 403, { ok:false, msg:'内置管理员不可删除，请修改 .env 重新指定' });
    users.splice(idx, 1);
    let sc = 0;
    submissions.forEach(s => {
      if (normContact(s.author) === key) {
        s.author = '(已注销用户)';
        s.authorLevel = s.authorLevel || 'LV.2';
        s.deleted = true;
        sc++;
      }
    });
    persistAll();
    jsonReply(res, 200, { ok:true, msg: `已删除用户（关联 ${sc} 篇投稿留痕）` });
  } catch (e) {
    console.error('[admin:userDel]', e);
    jsonReply(res,500,{ok:false,msg:'服务器内部错误'});
  }
});

// -------- 静态托管：先 /，再找项目根 ../ --------
const ROOT = path.resolve(__dirname, '..');
app.use('/', express.static(ROOT, {
  index: ['index.html'],
  extensions: ['html'],
  maxAge: 0
}));

// 单页回退：任何未匹配请求返回 index.html（保证 SPA hash 路由）
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(56));
  console.log(`  🗂️  Worldview Archive Server 已启动`);
  console.log(`     🌐 前端：  http://localhost:${PORT}/`);
  console.log(`     🔌 API：   http://localhost:${PORT}/api/send-code`);
  console.log(`     📨 短信：  ${process.env.SMS_PROVIDER || 'mock'}  邮件：${process.env.EMAIL_PROVIDER || 'mock'}`);
  console.log(`     💾 存储：  ${DATA_DIR ? 'JSON文件 '+DATA_DIR : '内存(重启丢失)'}`);
  console.log('═'.repeat(56) + '\n');
});
