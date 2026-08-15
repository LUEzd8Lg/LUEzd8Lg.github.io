/* ===========================================================================
   世界观察档案库 · 应用主脚本 v2
   视觉：绝密档案库 / 机密文档管理系统
   =========================================================================== */

(() => {
  'use strict';

  // ============ 动态光标跟随效果 ============
  const CursorFX = (() => {
    const fx = document.createElement('div');
    fx.className = 'cursor-fx';
    fx.innerHTML = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="#d4af37" stroke-width="0.8" opacity="0.6">
        <circle cx="20" cy="20" r="18" stroke-dasharray="3 2"/>
        <circle cx="20" cy="20" r="12"/>
        <line x1="20" y1="0" x2="20" y2="6"/>
        <line x1="20" y1="34" x2="20" y2="40"/>
        <line x1="0" y1="20" x2="6" y2="20"/>
        <line x1="34" y1="20" x2="40" y2="20"/>
      </g>
      <rect x="15" y="15" width="10" height="10" fill="none" stroke="#d4af37" stroke-width="1"/>
      <circle cx="20" cy="20" r="2" fill="#d4af37"/>
      <circle cx="20" cy="2" r="1.5" fill="#d4af37"/>
    </svg>`;
    document.body.appendChild(fx);

    let mx = -100, my = -100;
    let cx = -100, cy = -100;
    let rafId = null;
    let active = false;
    let mode = 'default';

    function loop() {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      fx.style.transform = `translate(${cx}px, ${cy}px)`;
      if (Math.abs(mx - cx) > 0.5 || Math.abs(my - cy) > 0.5) {
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    }

    function onMove(e) {
      mx = e.clientX;
      my = e.clientY;
      if (!active) {
        active = true;
        fx.classList.add('active');
      }
      if (!rafId) rafId = requestAnimationFrame(loop);

      // 检测悬停元素类型
      const el = document.elementFromPoint(e.clientX, e.clientY);
      let newMode = 'default';
      if (el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || el.isContentEditable || tag === 'select') {
          newMode = 'text';
        } else if (el.closest('a, button, [role="button"], [onclick], .card, .doc-card, .ec, .atab, .abtn, .sb-tool, .tag-chip, .mm-node, input[type="checkbox"], input[type="radio"], label[for], summary')) {
          newMode = 'pointer';
        } else if (el.closest('[disabled], :disabled, .disabled')) {
          newMode = 'default';
        }
      }
      if (newMode !== mode) {
        fx.classList.remove(mode);
        mode = newMode;
        if (mode !== 'default') fx.classList.add(mode);
      }
    }

    function onLeave() {
      fx.classList.add('hidden');
      active = false;
    }
    function onEnter() {
      fx.classList.remove('hidden');
    }
    function onDown() {
      fx.style.transition = 'none';
      fx.style.opacity = '0.8';
      setTimeout(() => { fx.style.transition = ''; }, 100);
    }

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('mousedown', onDown);

    // 鼠标离开窗口时隐藏
    window.addEventListener('blur', onLeave);
    window.addEventListener('focus', onEnter);

    return { fx };
  })();

  const DATA = window.ARCHIVE_DATA;
  const view = document.getElementById('view-container');

  let CAT_MAP = Object.fromEntries(DATA.categories.map(c => [c.id, c]));
  function rebuildCatMap() { CAT_MAP = Object.fromEntries(DATA.categories.map(c => [c.id, c])); }
  const CLASS_NAMES = Object.fromEntries(DATA.classLegend.map(c => [c.code, c.name]));

  function getEntries(catId) { return DATA[catId] || []; }
  function findEntry(catId, id) { return (DATA[catId] || []).find(e => e.id === id); }

  function allEntries() {
    const out = [];
    for (const cat of DATA.categories) {
      for (const e of (DATA[cat.id] || [])) {
        out.push({ ...e, _cat: cat.id });
      }
    }
    return out;
  }

  function computeStats() {
    const counts = {};
    let total = 0;
    for (const cat of DATA.categories) {
      const n = (DATA[cat.id] || []).length;
      counts[cat.id] = n;
      total += n;
    }
    return { counts, total };
  }

  function statsCounts() { return computeStats().counts; }
  function statsTotal()  { return computeStats().total; }

  // ============ Auth 模块 ============
  const AUTH_KEY = 'wa_auth_v1';
  const USERS_KEY = 'wa_users_v1';
  const CODES_KEY = 'wa_codes_v1';
  const SUBMIT_KEY = 'wa_submissions_v1';
  const TOKEN_KEY = 'wa_jwt_v1';
  const ENTRIES_KEY = 'wa_entries_overrides_v1'; // 管理员档案 CRUD 持久化
  const CATS_KEY = 'wa_categories_v1';           // 管理员栏目/子分组 CRUD 持久化
  const DISMISSED_NOTICES_KEY = 'wa_dismissed_notices_v1'; // 已关闭的审核通知
  const FAV_KEY = 'wa_favorites_v1';          // 收藏/书签
  const COMMENT_KEY = 'wa_comments_v1';       // 评论
  const LOG_KEY = 'wa_admin_logs_v1';         // 管理员操作日志
  const THEME_KEY = 'wa_theme_v1';            // 主题 (dark / light)
  const READ_KEY = 'wa_read_progress_v1';     // 阅读进度
  const DRAFT_KEY = 'wa_submit_draft_v1';     // 投稿草稿箱

  // ============ SVG 图标库 ============
  const ICO = {
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18,22 12,18 6,22 7.5,14.5 2,9.5 9,9"/></svg>',
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18,22 12,18 6,22 7.5,14.5 2,9.5 9,9"/></svg>',
    starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18,22 12,18 6,22 7.5,14.5 2,9.5 9,9"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 22,20 2,20"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12,20h9"/><path d="M16.5,3.5a2.1,2.1,0,0,1,3,3L7,19l-4,1,1-4Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 16,14"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M19,21l-7-5-7,5V5a2,2,0,0,1,2-2h10a2,2,0,0,1,2,2Z"/></svg>',
    bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M19,21l-7-5-7,5V5a2,2,0,0,1,2-2h10a2,2,0,0,1,2,2Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M23,19a2,2,0,0,1-2,2H3a2,2,0,0,1-2-2V8a2,2,0,0,1,2-2H6l2-3h8l2,3h3a2,2,0,0,1,2,2Z"/><circle cx="12" cy="13" r="4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="22" y1="20" x2="2" y2="20"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M19,21H5a2,2,0,0,1-2-2V5A2,2,0,0,1,5,3H16l5,5V19A2,2,0,0,1,19,21Z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>',
    hexagon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 22,12 12,22 2,12"/></svg>',
    burst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 14,8 20,6 16,11 22,14 16,15 18,21 12,17 6,21 8,15 2,14 8,11 4,6 10,8"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><polyline points="12,9 12,13 15,15"/><line x1="9" y1="2" x2="15" y2="2"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12,2L4,5v6c0,5.5,3.8,10.7,8,12c4.2-1.3,8-6.5,8-12V5L12,2z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M1,12s4-8,11-8s11,8,11,8s-4,8-11,8s-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/></svg>'
  };
  function ico(name, size) {
    const s = size || 14;
    return `<span class="ico" style="display:inline-flex;width:${s}px;height:${s}px;vertical-align:middle">${ICO[name] || ''}</span>`;
  }

  // ============ 事件总线：跨模块通知数据变更 ============
  const Bus = {
    listeners: {},
    on(evt, fn) { (Bus.listeners[evt] = Bus.listeners[evt] || []).push(fn); },
    emit(evt, payload) { (Bus.listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) {} }); }
  };

  // ============ 收藏模块 ============
  const Favorites = {
    _all() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(FAV_KEY, JSON.stringify(d)); },
    _key() {
      const a = Auth.get();
      return (a && a.user) ? String(a.user) : '__guest__';
    },
    list() {
      const all = Favorites._all();
      return all[Favorites._key()] || [];
    },
    has(cat, id) {
      return Favorites.list().some(f => f.cat === cat && f.id === id);
    },
    toggle(cat, id, entry) {
      const all = Favorites._all();
      const k = Favorites._key();
      let list = all[k] || [];
      const idx = list.findIndex(f => f.cat === cat && f.id === id);
      let added = false;
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.unshift({
          cat, id,
          title: entry?.title || '',
          summary: entry?.summary || '',
          code: entry?.code || '',
          at: Date.now()
        });
        added = true;
      }
      all[k] = list;
      Favorites._save(all);
      Bus.emit('favorites:changed', { cat, id, added });
      return { added, count: list.length };
    }
  };

  // ============ 评论模块 ============
  const Comments = {
    _all() { try { return JSON.parse(localStorage.getItem(COMMENT_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(COMMENT_KEY, JSON.stringify(d)); },
    _k(cat, id) { return `${cat}:${id}`; },
    list(cat, id) {
      const all = Comments._all();
      return (all[Comments._k(cat, id)] || []).sort((a, b) => a.at - b.at);
    },
    add(cat, id, text) {
      if (!text || !text.trim()) return null;
      const all = Comments._all();
      const k = Comments._k(cat, id);
      const list = all[k] || [];
      const a = Auth.get();
      const c = {
        id: 'C' + Date.now() + Math.floor(Math.random() * 1000),
        author: (a && a.user) || '匿名',
        authorLevel: (a && a.lvl) || 'LV.1',
        text: text.trim(),
        at: Date.now(),
        deleted: false
      };
      list.push(c);
      all[k] = list;
      Comments._save(all);
      Bus.emit('comments:changed', { cat, id, comment: c });
      return c;
    },
    remove(cat, id, cid) {
      const all = Comments._all();
      const k = Comments._k(cat, id);
      const list = all[k] || [];
      const idx = list.findIndex(c => c.id === cid);
      if (idx < 0) return false;
      list[idx].deleted = true;
      list[idx].deletedAt = Date.now();
      list[idx].deletedBy = (Auth.get() && Auth.get().user) || 'admin';
      all[k] = list;
      Comments._save(all);
      Bus.emit('comments:changed', { cat, id, removed: cid });
      return true;
    }
  };

  // ============ 管理员操作日志 ============
  const AdminLogs = {
    KEY: LOG_KEY,
    all() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } },
    _save(arr) { localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(-500))); },
    record(kind, detail) {
      if (!Auth.isAdmin()) return;
      const a = Auth.get();
      const arr = AdminLogs.all();
      arr.unshift({
        id: 'L' + Date.now(),
        kind,
        detail: detail || '',
        at: Date.now(),
        by: (a && a.user) || 'admin'
      });
      AdminLogs._save(arr);
      Bus.emit('logs:changed', { kind });
    },
    clear() { AdminLogs._save([]); },
    list() { return AdminLogs.all(); },
    types() { return [...new Set(AdminLogs.all().map(l => l.kind))].sort(); }
  };

  // ============ 主题切换 ============
  const Theme = {
    KEY: THEME_KEY,
    get() { return localStorage.getItem(THEME_KEY) || 'dark'; },
    set(t) {
      const v = t === 'light' ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, v);
      document.documentElement.classList.toggle('theme-light', v === 'light');
      Bus.emit('theme:changed', v);
      return v;
    },
    init() {
      const t = Theme.get();
      document.documentElement.classList.toggle('theme-light', t === 'light');
    }
  };

  // ============ 阅读进度记忆 ============
  const ReadProgress = {
    KEY: READ_KEY,
    _all() { try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(READ_KEY, JSON.stringify(d)); },
    _k(cat, id) { return `${cat}:${id}`; },
    save(cat, id, scrollTop, offsetPct) {
      const a = Auth.get();
      if (!a) return;
      const all = ReadProgress._all();
      const key = `${a.user}|${ReadProgress._k(cat, id)}`;
      all[key] = { scrollTop, offsetPct: Math.min(100, Math.max(0, offsetPct || 0)), at: Date.now() };
      ReadProgress._save(all);
    },
    get(cat, id) {
      const a = Auth.get();
      if (!a) return null;
      const all = ReadProgress._all();
      const key = `${a.user}|${ReadProgress._k(cat, id)}`;
      return all[key] || null;
    },
    clear(cat, id) {
      const a = Auth.get();
      if (!a) return;
      const all = ReadProgress._all();
      const key = `${a.user}|${ReadProgress._k(cat, id)}`;
      delete all[key];
      ReadProgress._save(all);
    },
    list() {
      const a = Auth.get();
      if (!a) return [];
      const all = ReadProgress._all();
      const prefix = `${a.user}|`;
      return Object.entries(all)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => {
          const [, ck] = k.split('|');
          const [cat, id] = ck.split(':');
          return { cat, id, ...v };
        });
    },
    clearAll() {
      const a = Auth.get();
      if (!a) return;
      const all = ReadProgress._all();
      const prefix = `${a.user}|`;
      Object.keys(all).forEach(k => { if (k.startsWith(prefix)) delete all[k]; });
      ReadProgress._save(all);
    }
  };

  // ============ 投稿草稿箱 ============
  const SubmitDraft = {
    KEY: DRAFT_KEY,
    _k() {
      const a = Auth.get();
      return (a && a.user) ? String(a.user) : '__guest__';
    },
    get() {
      try {
        const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        return all[SubmitDraft._k()] || null;
      } catch { return null; }
    },
    save(data) {
      try {
        const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        all[SubmitDraft._k()] = { ...data, at: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
        Bus.emit('draft:saved', { at: Date.now() });
        return true;
      } catch { return false; }
    },
    clear() {
      try {
        const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        delete all[SubmitDraft._k()];
        localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
      } catch {}
    }
  };

  const Auth = {
    get() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } },
    set(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); },
    clear() {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(TOKEN_KEY);
    },

    // JWT token
    getToken() { return localStorage.getItem(TOKEN_KEY) || ''; },
    setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, String(t)); else localStorage.removeItem(TOKEN_KEY); },

    role() { const a = Auth.get(); return (a && a.role) ? a.role : (a && a.user === 'admin' ? 'admin' : 'user'); },
    isAdmin() { return Auth.role() === 'admin'; },

    // 用户库
    getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; } },
    saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); },
    findUser(contact) {
      const c = contact.trim().toLowerCase();
      return Auth.getUsers().find(u => u.contact.toLowerCase() === c);
    },
    // 删除本地用户 + 投稿留痕
    deleteAccountLocal(contact, password) {
      const u = Auth.findUser(contact);
      if (!u) return { ok:false, msg:'账号不存在' };
      if (u.pass !== btoa(password)) return { ok:false, msg:'密码错误，无法注销' };
      const users = Auth.getUsers().filter(x => x.contact.toLowerCase() !== contact.toLowerCase());
      Auth.saveUsers(users);
      // 投稿留痕
      const subs = Submissions.get();
      let sc = 0;
      subs.forEach(s => {
        if ((s.author||'').toLowerCase() === contact.toLowerCase()) {
          s.author = '(已注销用户)';
          s.deleted = true;
          sc++;
        }
      });
      localStorage.setItem(SUBMIT_KEY, JSON.stringify(subs));
      Auth.clear();
      return {
        ok: true,
        fallback: true,
        msg: sc > 0 ? `账号已注销，保留 ${sc} 篇投稿（作者置为已注销）` : '账号已注销'
      };
    },

    // 验证码（5 分钟有效期）
    generateCode(contact) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codes = Auth.getCodes();
      codes[contact.trim().toLowerCase()] = { code, exp: Date.now() + 5*60*1000 };
      localStorage.setItem(CODES_KEY, JSON.stringify(codes));
      return code;
    },
    getCodes() { try { return JSON.parse(localStorage.getItem(CODES_KEY) || '{}'); } catch { return {}; } },
    verifyCode(contact, code) {
      const k = contact.trim().toLowerCase();
      const c = Auth.getCodes()[k];
      if (!c) return { ok:false, msg:'请先发送验证码' };
      if (Date.now() > c.exp) return { ok:false, msg:'验证码已过期，请重新发送' };
      if (c.code !== code.trim()) return { ok:false, msg:'验证码不正确' };
      return { ok:true };
    },

    // 注册
    register(contact, password) {
      if (Auth.findUser(contact)) return { ok:false, msg:'该手机号/邮箱已注册' };
      const users = Auth.getUsers();
      users.push({
        contact: contact.trim(),
        pass: btoa(password),
        at: Date.now()
      });
      Auth.saveUsers(users);
      return { ok:true };
    },

    // 登录
    login(contact, password) {
      const u = Auth.findUser(contact);
      if (!u) return { ok:false, msg:'账号不存在，请先注册' };
      if (u.pass !== btoa(password)) return { ok:false, msg:'密码错误' };
      Auth.set({ user: u.contact, lvl:'LV.2', at:Date.now(), guest:false });
      return { ok:true };
    },

    // 游客
    guest() {
      Auth.set({ user:'游客', lvl:'LV.1', at:Date.now(), guest:true });
    },

    // 权限
    isLv(n) {
      const a = Auth.get(); if (!a) return false;
      const map = { 'LV.1':1,'LV.2':2,'LV.3':3,'LV.4':4,'LV.5':5,'LV.9':9 };
      return (map[a.lvl] || 0) >= (map[n] || 0);
    },
    canSubmit() { return Auth.isLv('LV.2'); },
    isGuest() { const a = Auth.get(); return a && a.guest; },
    identity() {
      const a = Auth.get();
      if (!a) return '访客 LV.1';
      return `${a.user} · ${a.lvl}`;
    }
  };

  // ============ API 层（优先走后端 Node.js，不通降级 localStorage mock）============
  const API = {
    _authHeaders() {
      const t = Auth.getToken();
      if (!t) return {};
      return { 'Authorization': `Bearer ${t}` };
    },
    async _fetch(path, opts = {}) {
      try {
        const headers = Object.assign(
          {},
          { 'Content-Type': 'application/json' },
          API._authHeaders(),
          (opts.headers || {})
        );
        const reqOpts = Object.assign({
          headers,
          credentials: 'same-origin'
        }, opts.method ? { method: opts.method } : {});
        if (opts.body) reqOpts.body = JSON.stringify(opts.body);
        const res = await fetch(path, reqOpts);
        const ct = res.headers.get('content-type') || '';
        // 静态服务器返回非 JSON（如 404 纯文本）→ 视为后端未启动
        if (!ct.includes('application/json')) {
          return { ok: false, _fetchError: true, msg: '后端未启动，已切换至离线模式' };
        }
        const json = await res.json().catch(() => ({}));
        json._httpStatus = res.status;
        return json;
      } catch (e) {
        return { ok: false, _fetchError: true, msg: '后端未启动，已切换至离线模式' };
      }
    },
    async sendCode(contact) {
      const r = await API._fetch('/api/send-code', { method:'POST', body:{ contact } });
      if (r._fetchError) {
        // 降级：本地 mock 生成验证码（跟之前一模一样的逻辑）
        const code = Auth.generateCode(contact);
        return { ok:true, mock:true, fallback:true, code, msg:`演示模式(降级)：验证码为 ${code}` };
      }
      return r;
    },
    async register(contact, code, password) {
      const r = await API._fetch('/api/register', { method:'POST', body:{ contact, code, password } });
      if (r._fetchError) {
        // 降级：localStorage 注册
        const vc = Auth.verifyCode(contact, code);
        if (!vc.ok) return vc;
        const reg = Auth.register(contact, password);
        if (!reg.ok) return reg;
        Auth.set({ user: contact, lvl:'LV.2', at:Date.now(), guest:false, role:'user' });
        return { ok:true, fallback:true };
      }
      if (r.ok && r.user) {
        if (r.token) Auth.setToken(r.token);
        Auth.set({ user: r.user.contact, lvl: r.user.level, at: Date.now(), guest:false, role: r.user.role || 'user' });
      }
      return r;
    },
    async login(contact, password) {
      const r = await API._fetch('/api/login', { method:'POST', body:{ contact, password } });
      if (r._fetchError) {
        // 降级：localStorage 登录；如果 contact === 'admin' && password === 'admin123' 就解锁前端管理员
        if (String(contact).trim() === 'admin' && password === 'admin123') {
          Auth.setToken('');
          Auth.set({ user: 'admin', lvl:'LV.9', at:Date.now(), guest:false, role:'admin' });
          return { ok:true, fallback:true, user:{contact:'admin', level:'LV.9', role:'admin'}};
        }
        return Auth.login(contact, password);
      }
      if (r.ok && r.user) {
        if (r.token) Auth.setToken(r.token);
        Auth.set({ user: r.user.contact, lvl: r.user.level, at: Date.now(), guest:false, role: r.user.role || 'user' });
      }
      return r;
    },
    async submit(payload) {
      const body = Object.assign({}, payload);
      const r = await API._fetch('/api/submit', { method:'POST', body });
      if (r._fetchError) {
        // 降级：localStorage 投稿
        if (!Auth.canSubmit()) return { ok:false, msg:'需 LV.2 以上权限' };
        if (!payload.title || !payload.body) return { ok:false, msg:'标题和正文必填' };
        const saved = Submissions.add(payload);
        return { ok:true, fallback:true, submission: saved };
      }
      return r;
    },
    // DOCX 文件上传解析（multipart/form-data，字段名 doc = file）
    async uploadDocx(file) {
      try {
        const data = new FormData();
        data.append('doc', file);
        const headers = Object.assign({}, API._authHeaders());
        const res = await fetch('/api/submit/upload-docx', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: data
        });
        const json = await res.json().catch(() => ({}));
        json._httpStatus = res.status;
        if (json.ok) return json;
        // 后端不通 → 前端 mammoth.js 浏览器端降级解析
        if (!window.__mammothFailed && !json._fetchError && res.status !== 404) return json;
        return await API._docxFallbackBrowser(file);
      } catch (e) {
        return await API._docxFallbackBrowser(file);
      }
    },
    // 本地图片上传 → 返回可用的 <img src>
    async uploadImage(file) {
      // 先尝试后端上传
      try {
        const data = new FormData();
        data.append('image', file);
        const headers = Object.assign({}, API._authHeaders());
        const res = await fetch('/api/submit/upload-image', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: data
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.ok && json.url) return { ok: true, url: json.url, fallback: false };
        }
      } catch (e) { /* 降级 base64 */ }
      // 降级：转 base64 data URI
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ ok: true, url: reader.result, fallback: true });
        reader.onerror = () => resolve({ ok: false, msg: '图片读取失败' });
        reader.readAsDataURL(file);
      });
    },
    // 浏览器端 mammoth.js 解析 DOCX（base64 嵌入图片）
    async _docxFallbackBrowser(file) {
      if (!window.mammoth) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
          s.onload = () => res();
          s.onerror = () => { window.__mammothFailed = true; rej(new Error('mammoth.js 加载失败')); };
          document.head.appendChild(s);
        }).catch(() => null);
      }
      if (!window.mammoth) return { ok:false, msg:'后端未启动且 mammoth.js CDN 无法加载，暂无法解析 DOCX（可直接把文字粘到正文框）' };
      const buf = await file.arrayBuffer();
      // 尝试带图片提取的解析，如果 images API 不可用则降级为纯文本解析
      let result;
      const opts = {};
      // 安全检查：mammoth.images.dataUri 在部分浏览器版中可能不存在
      try {
        if (window.mammoth.images && typeof window.mammoth.images.dataUri === 'function') {
          opts.convertImage = window.mammoth.images.dataUri();
        }
      } catch (_) { /* 忽略，走默认 */ }
      try {
        result = await window.mammoth.convertToHtml({ arrayBuffer: buf }, opts);
      } catch (e) {
        // 如果带图片解析失败，重试不带 convertImage
        result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
      }
      let text = '';
      try {
        const txt = await window.mammoth.extractRawText({ arrayBuffer: buf });
        text = (txt.value || '').replace(/\r?\n/g, '\n');
      } catch (_) { text = (result.value || '').replace(/<[^>]+>/g, ''); }
      const html = (result.value || '');
      const firstLine = text.split('\n').map(s => s.trim()).find(s => s.length > 0) || '';
      const imgCount = (html.match(/<img\s/gi) || []).length;
      return {
        ok: true,
        fallback: true,
        html, text,
        titleSuggest: firstLine.slice(0, 40),
        imageCount: imgCount,
        warnings: (result.messages || []).map(m => m.message).slice(0, 20),
        msg: imgCount > 0
          ? `浏览器端解析完成 · 提取文字 ${text.length} 字 · 图片 ${imgCount} 张（base64 嵌入）`
          : `浏览器端解析完成 · 提取文字 ${text.length} 字`
      };
    },
    async fetchSubmissions(limit = 100) {
      const r = await API._fetch(`/api/submissions?limit=${limit}`, { method:'GET' });
      if (r._fetchError) {
        return { ok:true, fallback:true, total: Submissions.get().length, list: Submissions.get() };
      }
      return r;
    },
    async deleteAccount(contact, password) {
      const r = await API._fetch('/api/account', { method:'DELETE', body:{ contact, password, confirm:true } });
      if (r._fetchError) {
        return Auth.deleteAccountLocal(contact, password);
      }
      if (r.ok) Auth.clear();
      return r;
    },

    // ============ 管理员专用 API（全部走 requireAdmin 中间件）============
    _adminFetch(path, opts) {
      return API._fetch(path, opts);
    },
    async adminListSubmissions(status = 'pending', category = '') {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (category) qs.set('category', category);
      const r = await API._adminFetch(`/api/admin/submissions?${qs.toString()}`, { method:'GET' });
      if (r._fetchError) return API._adminLocalFallback('subs', { status, category });
      return r;
    },
    async adminReview(subId, status, { note = '', patch = null } = {}) {
      const r = await API._adminFetch(`/api/admin/submissions/${encodeURIComponent(subId)}/review`, {
        method:'POST',
        body: { status, note, patch }
      });
      if (r._fetchError) {
        // 降级：在 localStorage 中更新投稿状态
        const updated = Submissions.update(subId, {
          status: status,
          reviewNote: note || '',
          reviewedAt: Date.now()
        });
        if (!updated) return { ok:false, msg:'未找到投稿' };
        // 如果通过审核，把投稿内容作为新档案加入对应分类
        let mergedEntry = null;
        if (status === 'approved' && patch) {
          const cat = patch.category || updated.category || 'anomalies';
          const entry = {
            id: patch.id || updated.id,
            title: patch.title || updated.title,
            class: patch.class || updated.class || 'neutral',
            summary: patch.summary || updated.summary || '',
            body: patch.body || updated.body || '',
            content: patch.body || updated.body || '',
            tags: patch.tags || updated.tags || [],
            source: patch.source || updated.source || '',
            img: patch.cover || updated.cover || ''
          };
          LocalEntries.add(cat, entry);
          mergedEntry = { ...entry, cat };
        }
        // 操作日志 + 通知
        AdminLogs.record(status === 'approved' ? 'submission:approve' : 'submission:reject',
          `${subId} · ${updated.title || ''}${note ? ' · 备注:' + note : ''}`);
        Bus.emit('submissions:reviewed', { id: subId, status, note });
        Bus.emit('stats:refresh');
        return { ok:true, fallback:true, submission: updated, mergedEntry };
      }
      if (r.ok) {
        AdminLogs.record(status === 'approved' ? 'submission:approve' : 'submission:reject',
          `${subId}${note ? ' · 备注:' + note : ''}`);
        Bus.emit('submissions:reviewed', { id: subId, status, note });
        Bus.emit('stats:refresh');
      }
      return r;
    },
    async adminListEntries(cat) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}`, { method:'GET' });
      if (r._fetchError) {
        // 降级：直接从浏览器内存 DATA 读（已包含 LocalEntries 覆盖）
        const list = (DATA[cat] || []).map(x => Object.assign({ _cat:cat }, x));
        return { ok:true, fallback:true, total: list.length, list };
      }
      return r;
    },
    async adminAddEntry(cat, payload) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}`, { method:'POST', body: payload });
      if (r._fetchError) {
        // 降级：通过 LocalEntries 持久化到 localStorage
        const p = Object.assign({}, payload);
        p.id = String(p.id || 'ENT-' + String((DATA[cat]||[]).length + 1).padStart(3,'0'));
        p.content = p.content || p.body || '';
        p.body    = p.body || p.content || '';
        LocalEntries.add(cat, p);
        AdminLogs.record('entry:add', `${cat}/${p.id} · ${p.title || ''}`);
        Bus.emit('stats:refresh');
        return { ok:true, fallback:true, entry: p };
      }
      if (r.ok) {
        AdminLogs.record('entry:add', `${cat}/${payload.id || ''} · ${payload.title || ''}`);
        Bus.emit('stats:refresh');
      }
      return r;
    },
    async adminUpdateEntry(cat, id, patch) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}/${encodeURIComponent(id)}`, { method:'PUT', body: patch });
      if (r._fetchError) {
        // 降级：通过 LocalEntries 持久化
        const arr = DATA[cat] || [];
        const found = arr.find(x => String(x.id) === String(id));
        if (!found) return { ok:false, msg:'未找到档案' };
        const merged = Object.assign({}, found, patch, { id: patch.id || id });
        LocalEntries.update(cat, id, merged);
        AdminLogs.record('entry:update', `${cat}/${id}`);
        return { ok:true, fallback:true, entry: merged };
      }
      if (r.ok) AdminLogs.record('entry:update', `${cat}/${id}`);
      return r;
    },
    async adminDeleteEntry(cat, id) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}/${encodeURIComponent(id)}`, { method:'DELETE' });
      if (r._fetchError) {
        // 降级：通过 LocalEntries 持久化
        const arr = DATA[cat] || [];
        const found = arr.find(x => String(x.id) === String(id));
        if (!found) return { ok:false, msg:'未找到档案' };
        LocalEntries.delete(cat, id);
        AdminLogs.record('entry:delete', `${cat}/${id} · ${found.title || ''}`);
        Bus.emit('stats:refresh');
        return { ok:true, fallback:true, removed: found };
      }
      if (r.ok) {
        AdminLogs.record('entry:delete', `${cat}/${id}`);
        Bus.emit('stats:refresh');
      }
      return r;
    },
    async adminListUsers() {
      const r = await API._adminFetch('/api/admin/users', { method:'GET' });
      if (r._fetchError) {
        // 降级：本地 users
        const list = Auth.getUsers().map(u => ({
          contact: u.contact,
          level: u.level || 'LV.2',
          role: u.role || (u.contact === 'admin' ? 'admin' : 'user'),
          createdAt: u.createdAt || 0,
          builtIn: u.builtIn || u.contact === 'admin'
        }));
        return { ok:true, fallback:true, total: list.length, list };
      }
      return r;
    },
    async adminUpdateUser(contact, patch) {
      const r = await API._adminFetch(`/api/admin/users/${encodeURIComponent(contact)}/update`, {
        method:'POST',
        body: patch || {}
      });
      if (r._fetchError) {
        // 降级：在 localStorage users 中更新
        const users = Auth.getUsers();
        const idx = users.findIndex(u => u.contact === contact);
        if (idx < 0) return { ok:false, msg:'未找到用户' };
        users[idx] = Object.assign({}, users[idx], patch);
        Auth.saveUsers(users);
        AdminLogs.record('user:update', `${contact} · level:${patch.level||''} role:${patch.role||''}`);
        return { ok:true, fallback:true, user: users[idx] };
      }
      if (r.ok) AdminLogs.record('user:update', contact);
      return r;
    },
    async adminDeleteUser(contact) {
      const r = await API._adminFetch(`/api/admin/users/${encodeURIComponent(contact)}`, {
        method:'DELETE', body:{ confirm:true }
      });
      if (r._fetchError) {
        // 降级：从 localStorage users 中删除
        const users = Auth.getUsers();
        const idx = users.findIndex(u => u.contact === contact);
        if (idx < 0) return { ok:false, msg:'未找到用户' };
        const removed = users.splice(idx, 1)[0];
        Auth.saveUsers(users);
        AdminLogs.record('user:delete', contact);
        return { ok:true, fallback:true, removed };
      }
      if (r.ok) AdminLogs.record('user:delete', contact);
      return r;
    }
  };

  // 管理员列表本地降级：只给 UI 展示空数组 + 提示
  API._adminLocalFallback = function (kind, params) {
    if (kind === 'subs') {
      const mine = Submissions.get().map(s => ({
        id: s.id, title: s.title, category: s.category, class: s.class,
        summary: s.summary, body: s.body, tags: s.tags || [],
        cover: s.cover || '',
        code: s.code || '',
        author: s.author, authorLevel: s.authorLevel,
        status: s.status || 'pending',
        reviewNote: s.reviewNote || '',
        reviewedAt: s.reviewedAt || 0,
        at: s.at
      }));
      let list = mine;
      if (params.status && params.status !== 'all') list = list.filter(s => s.status === params.status);
      if (params.category) list = list.filter(s => s.category === params.category);
      return { ok:true, fallback:true, total: list.length, list };
    }
    return { ok:true, fallback:true, total: 0, list: [] };
  };

  // 投稿存取（降级模式用）
  const Submissions = {
    get() { try { return JSON.parse(localStorage.getItem(SUBMIT_KEY) || '[]'); } catch { return []; } },
    _save(list) { localStorage.setItem(SUBMIT_KEY, JSON.stringify(list)); },
    add(s) {
      const all = Submissions.get();
      s.id = 'SUB-' + String(all.length + 1).padStart(3,'0');
      s.at = Date.now();
      s.author = Auth.get() ? Auth.get().user : '匿名';
      s.authorLevel = Auth.get() ? Auth.get().lvl : 'LV.1';
      all.unshift(s);
      Submissions._save(all);
      return s;
    },
    update(id, patch) {
      const all = Submissions.get();
      const idx = all.findIndex(s => s.id === id);
      if (idx < 0) return null;
      all[idx] = Object.assign({}, all[idx], patch);
      Submissions._save(all);
      return all[idx];
    },
    remove(id) {
      const all = Submissions.get();
      const idx = all.findIndex(s => s.id === id);
      if (idx < 0) return false;
      all.splice(idx, 1);
      Submissions._save(all);
      return true;
    }
  };

  // 档案 CRUD 持久化（离线模式下管理员的增删改不会丢失）
  // ============ 栏目/子分组持久化（管理员 CRUD）============
  const LocalCats = {
    _load() {
      try { return JSON.parse(localStorage.getItem(CATS_KEY) || '[]'); } catch { return []; }
    },
    _persist() {
      localStorage.setItem(CATS_KEY, JSON.stringify(
        DATA.categories.map(c => ({ ...c, subcats: c.subcats || [] }))
      ));
    },
    // 页面加载：把 localStorage 的栏目覆盖应用到 DATA.categories（合并 manifest 新增）
    applyOverrides() {
      const saved = LocalCats._load();
      if (!saved.length) return;
      const savedIds = new Set(saved.map(c => c.id));
      const keepFromManifest = DATA.categories.filter(c => !savedIds.has(c.id));
      DATA.categories = [...saved, ...keepFromManifest];
      DATA.categories.forEach(c => {
        if (!Array.isArray(DATA[c.id])) DATA[c.id] = [];
        if (!Array.isArray(c.subcats)) c.subcats = [];
      });
      rebuildCatMap();
    },
    addCat(cat) {
      cat = { ...cat };
      cat.id = String(cat.id || '').trim();
      if (!cat.id) return { ok: false, msg: '栏目 ID 不能为空' };
      if (!/^[a-z0-9_-]+$/i.test(cat.id)) return { ok: false, msg: 'ID 仅允许字母/数字/_/-（将作为路由与数据键）' };
      if (DATA.categories.some(c => c.id === cat.id)) return { ok: false, msg: '该 ID 已存在' };
      cat.subcats = [];
      DATA.categories.push(cat);
      DATA[cat.id] = [];
      LocalCats._persist();
      rebuildCatMap();
      Bus.emit('cats:changed', { action: 'add', cat });
      return { ok: true };
    },
    updateCat(id, patch) {
      const c = CAT_MAP[id];
      if (!c) return { ok: false, msg: '栏目不存在' };
      Object.assign(c, patch);
      LocalCats._persist();
      rebuildCatMap();
      Bus.emit('cats:changed', { action: 'update', id });
      return { ok: true };
    },
    removeCat(id) {
      const idx = DATA.categories.findIndex(c => c.id === id);
      if (idx < 0) return { ok: false, msg: '栏目不存在' };
      const had = (DATA[id] || []).length;
      DATA.categories.splice(idx, 1);
      delete DATA[id];
      LocalCats._persist();
      rebuildCatMap();
      Bus.emit('cats:changed', { action: 'remove', id, had });
      return { ok: true, had };
    },
    addSubcat(catId, subcat) {
      const c = CAT_MAP[catId];
      if (!c) return { ok: false, msg: '栏目不存在' };
      if (!c.subcats) c.subcats = [];
      subcat = { ...subcat };
      subcat.id = String(subcat.id || '').trim();
      if (!subcat.id) return { ok: false, msg: '子分组 ID 不能为空' };
      if (!/^[a-z0-9_-]+$/i.test(subcat.id)) return { ok: false, msg: 'ID 仅允许字母/数字/_/-' };
      if (c.subcats.some(s => s.id === subcat.id)) return { ok: false, msg: '该子分组已存在' };
      c.subcats.push(subcat);
      LocalCats._persist();
      Bus.emit('cats:changed', { action: 'subcat-add', catId, subcat });
      return { ok: true };
    },
    removeSubcat(catId, subId) {
      const c = CAT_MAP[catId];
      if (!c || !c.subcats) return { ok: false, msg: '栏目不存在' };
      c.subcats = c.subcats.filter(s => s.id !== subId);
      LocalCats._persist();
      Bus.emit('cats:changed', { action: 'subcat-remove', catId, subId });
      return { ok: true };
    }
  };

  const LocalEntries = {
    _load() {
      try { return JSON.parse(localStorage.getItem(ENTRIES_KEY) || '{}'); } catch { return {}; }
    },
    _save(data) { localStorage.setItem(ENTRIES_KEY, JSON.stringify(data)); },
    _cat(data, cat) {
      if (!data[cat]) data[cat] = { added: [], updated: {}, deleted: [] };
      return data[cat];
    },
    // 页面加载时把 localStorage 里的覆盖应用到 DATA
    applyOverrides() {
      const data = LocalEntries._load();
      for (const cat of Object.keys(data)) {
        if (!Array.isArray(DATA[cat])) DATA[cat] = [];
        const ov = data[cat];
        // 先应用删除
        if (ov.deleted && ov.deleted.length) {
          DATA[cat] = DATA[cat].filter(e => !ov.deleted.includes(String(e.id)));
        }
        // 再应用更新
        if (ov.updated) {
          for (const id of Object.keys(ov.updated)) {
            const idx = DATA[cat].findIndex(e => String(e.id) === id);
            if (idx >= 0) DATA[cat][idx] = Object.assign({}, DATA[cat][idx], ov.updated[id]);
            else DATA[cat].push(ov.updated[id]); // 原始数据里没有，直接加
          }
        }
        // 最后追加新增
        if (ov.added && ov.added.length) {
          DATA[cat].push(...ov.added);
        }
      }
    },
    add(cat, entry) {
      const data = LocalEntries._load();
      const ov = LocalEntries._cat(data, cat);
      ov.added.push(entry);
      LocalEntries._save(data);
      // 同步到内存
      if (!Array.isArray(DATA[cat])) DATA[cat] = [];
      DATA[cat].push(entry);
      Bus.emit('entries:changed', { cat, action: 'add', entry });
    },
    update(cat, id, patch) {
      const data = LocalEntries._load();
      const ov = LocalEntries._cat(data, cat);
      // 先看 added 里有没有
      const addedIdx = ov.added.findIndex(e => String(e.id) === String(id));
      if (addedIdx >= 0) {
        ov.added[addedIdx] = Object.assign({}, ov.added[addedIdx], patch);
      } else {
        // 记录到 updated
        ov.updated[String(id)] = Object.assign({}, ov.updated[String(id)] || {}, patch);
      }
      LocalEntries._save(data);
      // 同步到内存
      const arr = DATA[cat] || [];
      const idx = arr.findIndex(e => String(e.id) === String(id));
      if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], patch);
      Bus.emit('entries:changed', { cat, action: 'update', id });
    },
    delete(cat, id) {
      const data = LocalEntries._load();
      const ov = LocalEntries._cat(data, cat);
      const sid = String(id);
      // 从 added 里移除
      ov.added = ov.added.filter(e => String(e.id) !== sid);
      // 从 updated 里移除
      delete ov.updated[sid];
      // 记录到 deleted
      if (!ov.deleted.includes(sid)) ov.deleted.push(sid);
      LocalEntries._save(data);
      // 同步到内存
      if (Array.isArray(DATA[cat])) {
        DATA[cat] = DATA[cat].filter(e => String(e.id) !== sid);
      }
      Bus.emit('entries:changed', { cat, action: 'delete', id });
    }
  };

  function refreshIdentity() {
    const el = document.getElementById('stat-identity');
    if (el) el.textContent = Auth.identity();
    const lout = document.getElementById('logout-btn');
    if (lout) lout.style.display = Auth.get() ? 'inline-flex' : 'none';

    // 账号管理按钮：仅非游客才显示（游客/访客不可注销，因为没有可删除的账号记录）
    const accBtn = document.getElementById('account-btn');
    const accSep = document.getElementById('stat-sep-account');
    if (accBtn) {
      const show = Auth.get() && !Auth.isGuest() && !Auth.get().guest;
      accBtn.style.display = show ? 'inline' : 'none';
      if (accSep) accSep.style.display = show ? 'inline' : 'none';
    }

    // 管理员入口：仅管理员显示
    const admin = document.querySelector('.nav-admin-link');
    if (admin) admin.style.display = Auth.isAdmin() ? 'inline-block' : 'none';

    // 同步侧边栏统计与管理员入口
    refreshSidebarStats();
  }

  // ============ 账号管理面板 ============
  function renderFavList() {
    const listEl = document.getElementById('am-fav-list');
    if (!listEl) return;
    const list = Favorites.list();
    if (!list.length) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;border:1px dashed var(--border);color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;">${ico('starOutline',12)} 收藏夹为空 · 档案详情页可收藏（LV.2+）</div>`;
      return;
    }
    listEl.innerHTML = list.map(f => `
      <a class="am-fav-row" href="#/entry/${f.cat}/${encodeURIComponent(f.id)}" style="display:block;padding:10px 12px;border:1px solid var(--border);background:var(--bg-2);text-decoration:none;color:inherit;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);">
            <span style="color:var(--gold-1);">${escapeHtml(f.cat)}:${escapeHtml(f.id)}</span>
            ${f.class ? `<span style="margin:0 6px;">·</span><span>${escapeHtml(f.class)}</span>` : ''}
            <span style="margin:0 6px;">·</span>
            <span>${new Date(f.at||0).toLocaleDateString()}</span>
          </div>
          <button type="button" class="am-fav-del" data-cat="${escapeAttr(f.cat)}" data-id="${escapeAttr(f.id)}" style="border:1px solid var(--red-1);background:transparent;color:var(--red-1);padding:2px 8px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">取消收藏</button>
        </div>
        <div style="font-family:var(--f-serif);font-weight:600;margin-top:4px;">${escapeHtml(f.title)}</div>
        <div style="font-size:11px;color:var(--text-2);opacity:.8;margin-top:2px;">${escapeHtml((f.summary||'').slice(0,100)||'—')}</div>
      </a>
    `).join('');
    listEl.querySelectorAll('.am-fav-del').forEach(b => {
      b.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const fc = b.dataset.cat; const fid = b.dataset.id;
        if (!fc || !fid) return;
        Favorites.toggle(fc, fid);
        SFX.unfavor();
        renderFavList();
      });
    });
  }
  function renderReadList() {
    const listEl = document.getElementById('am-read-list');
    if (!listEl) return;
    const list = ReadProgress.list().sort((a,b) => (b.at||0)-(a.at||0)).slice(0, 20);
    if (!list.length) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;border:1px dashed var(--border);color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;">${ico('clock',12)} 暂无阅读记录</div>`;
      return;
    }
    listEl.innerHTML = list.map(r => {
      const pct = r.offsetPct || 0;
      const entry = findEntry(r.cat, r.id);
      const title = (entry && entry.title) || r.id;
      return `
      <a class="am-read-row" href="#/entry/${r.cat}/${encodeURIComponent(r.id)}" style="display:block;padding:10px 12px;border:1px solid var(--border);background:var(--bg-2);text-decoration:none;color:inherit;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);">
            <span style="color:var(--gold-1);">${escapeHtml(r.cat)}:${escapeHtml(r.id)}</span>
            <span style="margin:0 6px;">·</span>
            <span>${new Date(r.at||0).toLocaleString()}</span>
          </div>
          <div style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1);">${pct}%</div>
        </div>
        <div style="font-family:var(--f-serif);font-weight:600;margin-top:4px;">${escapeHtml(title)}</div>
        <div style="height:4px;background:var(--bg);border:1px solid var(--border);margin-top:6px;overflow:hidden;">
          <div style="width:${Math.min(100,pct)}%;height:100%;background:var(--gold-1);"></div>
        </div>
      </a>`;
    }).join('');
  }
  function openAccountModal(tab) {
    const a = Auth.get();
    if (!a || a.guest) return;
    const m = document.getElementById('account-modal');
    if (!m) return;
    const lvNum = parseInt((a.lvl || '').match(/\d/)?.[0] || '0');
    const perms = [];
    if (lvNum >= 1) perms.push('浏览档案');
    if (lvNum >= 2) perms.push('投稿设定');
    if (lvNum >= 3) perms.push('高级检索');
    if (lvNum >= 4) perms.push('档案复审');
    if (lvNum >= 5) perms.push('全局管控');

    const ac = document.getElementById('am-account');
    const lv = document.getElementById('am-level');
    const at = document.getElementById('am-login-at');
    const perm = document.getElementById('am-perm');
    if (ac) ac.textContent = a.user || '—';
    if (lv) lv.textContent = a.lvl || '—';
    if (at) at.textContent = a.at ? new Date(a.at).toLocaleString('zh-CN') : '—';
    if (perm) perm.textContent = perms.join(' ｜ ');

    document.getElementById('am-del-pass').value = '';
    document.getElementById('am-del-error').style.display = 'none';

    // 切换到指定 tab
    const active = tab || 'account';
    m.querySelectorAll('.am-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === active));
    m.querySelectorAll('.am-tabpane').forEach(p => p.classList.toggle('active', p.dataset.tabpane === active));

    // 渲染 tab 内容
    if (active === 'favorites') renderFavList();
    if (active === 'reading') renderReadList();

    m.style.display = 'block';
  }
  function closeAccountModal() {
    const m = document.getElementById('account-modal');
    if (m) m.style.display = 'none';
  }

  function bindAccountPanel() {
    const btn = document.getElementById('account-btn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', openAccountModal);
    }
    const close = document.getElementById('am-close');
    if (close && !close.dataset.bound) {
      close.dataset.bound = '1';
      close.addEventListener('click', closeAccountModal);
    }
    const mask = document.querySelector('.account-modal-mask');
    if (mask && !mask.dataset.bound) {
      mask.dataset.bound = '1';
      mask.addEventListener('click', closeAccountModal);
    }
    const del = document.getElementById('am-del-btn');
    if (del && !del.dataset.bound) {
      del.dataset.bound = '1';
      del.addEventListener('click', async () => {
        const a = Auth.get();
        if (!a || a.guest) return;
        const pw = document.getElementById('am-del-pass').value;
        const errEl = document.getElementById('am-del-error');
        if (!pw) {
          errEl.innerHTML = `${ico('warn',12)} 请输入密码以确认注销`;
          errEl.style.display = 'block';
          return;
        }
        // 二次确认
        if (!confirm(`确定要永久注销账号「${a.user}」吗？\n\n此操作不可逆：注册信息会被删除，但您的投稿将保留并标记为"已注销用户"。`)) {
          return;
        }
        del.disabled = true;
        del.classList.add('is-loading');
        errEl.style.display = 'none';
        const r = await API.deleteAccount(a.user, pw);
        del.disabled = false;
        del.classList.remove('is-loading');
        if (!r.ok) {
          errEl.innerHTML = `${ico('warn',12)} ` + r.msg;
          errEl.style.display = 'block';
          return;
        }
        // 注销成功
        alert('账号已注销');
        closeAccountModal();
        refreshIdentity();
        location.hash = '#/';
        showLoginGate();
      });
    }
    // 账号面板 Tab 切换
    document.querySelectorAll('.am-tab').forEach(t => {
      if (t.dataset.bound) return;
      t.dataset.bound = '1';
      t.addEventListener('click', () => {
        const name = t.dataset.tab;
        document.querySelectorAll('.am-tab').forEach(x => x.classList.toggle('active', x === t));
        document.querySelectorAll('.am-tabpane').forEach(p => p.classList.toggle('active', p.dataset.tabpane === name));
        if (name === 'favorites') renderFavList();
        if (name === 'reading') renderReadList();
      });
    });
    // ESC 关闭
    if (!bindAccountPanel._esc) {
      bindAccountPanel._esc = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const m = document.getElementById('account-modal');
          if (m && m.style.display !== 'none') closeAccountModal();
        }
      });
    }
  }
  // 在 DOM 就绪时绑定（一次）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAccountPanel);
  } else {
    bindAccountPanel();
  }

  // ============ 登录门禁屏 ============
  const LG = { gate: null, canvas: null, ctx: null, particles: [], raf: 0 };

  function showLoginGate() {
    const gate = document.getElementById('login-gate');
    if (!gate) return;
    gate.style.display = 'block';
    LG.gate = gate;
    bindLoginGate();
    startLoginParticles();
    // 会话号
    const s = document.getElementById('lg-session');
    if (s) s.textContent = 'SID-' + Math.random().toString(36).slice(2,10).toUpperCase();
  }

  function hideLoginGate() {
    const gate = document.getElementById('login-gate');
    if (gate) gate.style.display = 'none';
    cancelAnimationFrame(LG.raf);
  }

  function startLoginParticles() {
    const c = document.getElementById('lg-canvas');
    if (!c) return;
    LG.canvas = c; LG.ctx = c.getContext('2d');
    const resize = () => {
      c.width = c.clientWidth * window.devicePixelRatio;
      c.height = c.clientHeight * window.devicePixelRatio;
    };
    resize(); window.addEventListener('resize', resize);
    const W = () => c.width, H = () => c.height;
    const N = 90;
    LG.particles = Array.from({length:N}, () => ({
      x: Math.random()*W(), y: Math.random()*H(),
      vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.4,
      r: (Math.random()*1.6+0.4) * window.devicePixelRatio,
      a: Math.random()*0.6+0.2
    }));
    const draw = () => {
      const ctx = LG.ctx;
      ctx.clearRect(0,0,W(),H());
      // 连线
      const P = LG.particles;
      for (let i=0;i<P.length;i++) {
        for (let j=i+1;j<P.length;j++) {
          const dx=P[i].x-P[j].x, dy=P[i].y-P[j].y;
          const d2=dx*dx+dy*dy, max=120*120*window.devicePixelRatio*window.devicePixelRatio;
          if (d2 < max) {
            ctx.strokeStyle = `rgba(232,232,232,${(1-d2/max)*0.25})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(P[i].x,P[i].y); ctx.lineTo(P[j].x,P[j].y); ctx.stroke();
          }
        }
      }
      // 粒子
      for (const p of P) {
        p.x += p.vx; p.y += p.vy;
        if (p.x<0||p.x>W()) p.vx*=-1;
        if (p.y<0||p.y>H()) p.vy*=-1;
        ctx.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      }
      LG.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  // ============ 启动序列动画（登录成功过渡）============
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>{}[]/\\|';
  function _decodeText(el, finalText, dur = 600) {
    return new Promise(resolve => {
      const start = performance.now();
      const len = finalText.length;
      function tick(now) {
        const t = Math.min(1, (now - start) / dur);
        const revealCount = Math.floor(t * len);
        let str = '';
        for (let i = 0; i < len; i++) {
          if (i < revealCount) str += finalText[i];
          else if (finalText[i] === ' ') str += ' ';
          else str += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
        el.textContent = str;
        if (t < 1) requestAnimationFrame(tick);
        else { el.textContent = finalText; resolve(); }
      }
      requestAnimationFrame(tick);
    });
  }
  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function showBootSequence(auth, onComplete) {
    const user = (auth && auth.user) || '访客';
    const lvl = (auth && auth.lvl) || 'LV.1';
    const isAdmin = auth && auth.role === 'admin';

    // 如果已存在则先移除
    const old = document.getElementById('boot-sequence');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'boot-sequence';
    document.body.appendChild(overlay);

    const lines = [
      { delay: 100,  html: '<span class="boot-prompt">&gt;</span> 初始化安全终端...' },
      { delay: 200,  html: '<span class="boot-prompt">&gt;</span> 建立加密连接 <span class="boot-bar"><span class="boot-bar-fill"></span></span> <span class="boot-ok">100%</span>', bar: true },
      { delay: 300,  html: '<span class="boot-prompt">&gt;</span> 生物特征扫描... <span class="boot-ok">通过</span>' },
      { delay: 200,  decode: '身份识别', suffix: ' <span class="boot-ok">成功</span>', dur: 700 },
      { delay: 150,  decode: '档案密钥解密', suffix: ' <span class="boot-ok">完成</span>', dur: 600 },
      { delay: 100,  html: '<span class="boot-prompt">&gt;</span> 欢迎回来，<span class="boot-hl">' + user + '</span>' },
      { delay: 200,  html: '<span class="boot-prompt">&gt;</span> 权限等级：<span class="boot-hl">' + lvl + '</span>' + (isAdmin ? ' <span class="boot-warn">[管理员]</span>' : '') },
      { delay: 300,  html: '<span class="boot-prompt">&gt;</span> 正在进入档案库<span class="boot-cursor"></span>' },
    ];

    (async () => {
      SFX.login();
      for (const line of lines) {
        await _sleep(line.delay);
        const div = document.createElement('div');
        div.className = 'boot-line';
        overlay.appendChild(div);
        // 强制重排以触发过渡
        void div.offsetWidth;
        div.classList.add('show');

        if (line.decode) {
          const decodeSpan = document.createElement('span');
          decodeSpan.className = 'boot-decode';
          div.innerHTML = '<span class="boot-prompt">&gt;</span> ';
          div.appendChild(decodeSpan);
          const suffixSpan = document.createElement('span');
          suffixSpan.innerHTML = line.suffix || '';
          div.appendChild(suffixSpan);
          // 解码时播放搜索音
          SFX.search();
          await _decodeText(decodeSpan, line.decode, line.dur || 600);
          SFX.hit();
        } else if (line.bar) {
          const fill = div.querySelector('.boot-bar-fill');
          if (fill) {
            await _sleep(50);
            fill.style.width = '100%';
            await _sleep(400);
          }
        } else {
          div.innerHTML = line.html;
          SFX.click();
          await _sleep(150);
        }
      }
      // 故障闪烁效果
      overlay.classList.add('boot-glitch');
      SFX.theme();
      await _sleep(300);
      // 淡出
      overlay.classList.add('boot-out');
      await _sleep(500);
      overlay.remove();
      if (typeof onComplete === 'function') onComplete();
    })();
  }

  function bindLoginGate() {
    if (document.querySelector('.lg-tabs.bound')) return;
    document.querySelector('.lg-tabs').classList.add('bound');

    // Tab 切换
    document.querySelectorAll('.lg-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lg-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('lg-form-login').style.display = target === 'login' ? '' : 'none';
        document.getElementById('lg-form-register').style.display = target === 'register' ? '' : 'none';
      });
    });

    // 密码显隐
    const eyeLogin = document.getElementById('lg-eye-login');
    const eyeReg   = document.getElementById('lg-eye-reg');
    if (eyeLogin) eyeLogin.addEventListener('click', () => {
      const p = document.getElementById('lg-login-pass');
      const is = p.type === 'password';
      p.type = is ? 'text' : 'password';
      eyeLogin.textContent = is ? '◎' : '◉';
    });
    if (eyeReg) eyeReg.addEventListener('click', () => {
      const p = document.getElementById('lg-reg-pass');
      const is = p.type === 'password';
      p.type = is ? 'text' : 'password';
      eyeReg.textContent = is ? '◎' : '◉';
    });

    // 发送验证码
    const codeBtn = document.getElementById('lg-send-code');
    if (codeBtn && !codeBtn.dataset.bound) {
      codeBtn.dataset.bound = '1';
      codeBtn.addEventListener('click', async () => {
        const contact = document.getElementById('lg-reg-contact').value.trim();
        if (!contact) return showRegErr('请先输入手机号或邮箱');
        if (!/^1[3-9]\d{9}$/.test(contact) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
          return showRegErr('请输入有效的手机号或邮箱');

        codeBtn.disabled = true;
        const originText = codeBtn.textContent;
        codeBtn.textContent = '发送中...';
        hideRegErr();

        const r = await API.sendCode(contact);
        if (!r.ok) {
          codeBtn.disabled = false;
          codeBtn.textContent = originText;
          return showRegErr(r.msg || '发送失败');
        }

        // 如果服务端返回了 code（mock 模式或降级），在 Toast 里显示
        if (r.code) showCodeToast(contact, r.code, r.msg);
        else showCodeToast(contact, '已发送，请查收', r.msg, true);

        // 倒计时
        let sec = 60;
        codeBtn.textContent = `${sec}s 后重发`;
        const timer = setInterval(() => {
          sec--;
          if (sec <= 0) {
            clearInterval(timer);
            codeBtn.disabled = false;
            codeBtn.textContent = '重新发送';
          } else {
            codeBtn.textContent = `${sec}s 后重发`;
          }
        }, 1000);
      });
    }

    // 登录提交
    const loginForm = document.getElementById('lg-form-login');
    if (loginForm && !loginForm.dataset.bound) {
      loginForm.dataset.bound = '1';
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contact = document.getElementById('lg-login-contact').value.trim();
        const pass    = document.getElementById('lg-login-pass').value.trim();
        if (!contact) return showLoginErr('请输入手机号或邮箱');
        if (pass.length < 6) return showLoginErr('密码至少 6 位');

        hideLoginErr();
        const sub = document.getElementById('lg-submit-login');
        const btnText = sub.querySelector('.lg-btn-text');
        sub.disabled = true; sub.classList.add('is-loading');
        btnText.textContent = '正在验证...';

        const r = await API.login(contact, pass);

        sub.disabled = false; sub.classList.remove('is-loading');
        btnText.innerHTML = ico('shield',14)+' 登录档案系统';
        if (!r.ok) return showLoginErr(r.msg);
        refreshIdentity();
        hideLoginGate();
        showBootSequence(Auth.get(), () => {
          location.hash = '#/';
          router();
        });
      });
    }

    // 注册提交
    const regForm = document.getElementById('lg-form-register');
    if (regForm && !regForm.dataset.bound) {
      regForm.dataset.bound = '1';
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contact = document.getElementById('lg-reg-contact').value.trim();
        const code    = document.getElementById('lg-reg-code').value.trim();
        const pass    = document.getElementById('lg-reg-pass').value.trim();
        const pass2   = document.getElementById('lg-reg-pass2').value.trim();

        if (!contact) return showRegErr('请输入手机号或邮箱');
        if (!code) return showRegErr('请输入验证码');
        if (pass.length < 6) return showRegErr('密码至少 6 位');
        if (pass !== pass2) return showRegErr('两次密码不一致');

        hideRegErr();
        const sub = document.getElementById('lg-submit-reg');
        const btnText = sub.querySelector('.lg-btn-text');
        sub.disabled = true; sub.classList.add('is-loading');
        btnText.textContent = '正在注册...';

        const r = await API.register(contact, code, pass);

        sub.disabled = false; sub.classList.remove('is-loading');
        btnText.innerHTML = ico('shield',14)+' 注册并登录';
        if (!r.ok) return showRegErr(r.msg);
        refreshIdentity();
        hideLoginGate();
        showBootSequence(Auth.get(), () => {
          location.hash = '#/';
          router();
        });
      });
    }

    // 游客模式
    const guestBtn = document.getElementById('lg-guest-btn');
    if (guestBtn && !guestBtn.dataset.bound) {
      guestBtn.dataset.bound = '1';
      guestBtn.addEventListener('click', () => {
        Auth.guest();
        refreshIdentity();
        hideLoginGate();
        showBootSequence(Auth.get(), () => {
          location.hash = '#/';
          router();
        });
      });
    }

    function showLoginErr(m) { const e=document.getElementById('lg-error-login'); e.innerHTML=ico('warn',12)+' '+m; e.style.display='block'; SFX.error(); }
    function hideLoginErr()  { document.getElementById('lg-error-login').style.display='none'; }
    function showRegErr(m)   { const e=document.getElementById('lg-error-reg'); e.innerHTML=ico('warn',12)+' '+m; e.style.display='block'; SFX.error(); }
    function hideRegErr()    { document.getElementById('lg-error-reg').style.display='none'; }
  }

  // 验证码提示
  function showCodeToast(contact, codeOrMsg, desc, hideCode) {
    let toast = document.getElementById('lg-code-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lg-code-toast';
      toast.className = 'lg-code-toast';
      document.getElementById('login-gate').appendChild(toast);
    }
    const isPhone = /^1[3-9]\d{9}$/.test(contact);
    const title = hideCode ? '验证码已发送' : '验证码已发送（演示模式）';
    const body = hideCode
      ? `已向 <strong>${contact}</strong> ${isPhone ? '手机' : '邮箱'}发送验证码，请查收`
      : `已向 <strong>${contact}</strong> ${isPhone ? '手机' : '邮箱'}发送验证码<br>验证码为 <span class="lg-toast-code">${codeOrMsg}</span>`;
    const hint = desc ? desc : (hideCode ? '有效时间 5 分钟' : '接入真实短信/邮件服务后，此处不会显示验证码');
    toast.style.transition = '';
    toast.style.opacity = '1';
    toast.innerHTML = `
      <div class="lg-toast-title">${title}</div>
      <div class="lg-toast-body">${body}</div>
      <div class="lg-toast-hint">${hint}</div>
    `;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.transition='opacity .4s'; toast.style.opacity = '0'; setTimeout(() => toast.style.display='none', 420); }, 9000);
  }

  function bindLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      Auth.clear();
      refreshIdentity();
      location.hash = '#/';
      showLoginGate();
      SFX.logout();
    });
  }

  // ============ 全局键盘快捷键 (Esc / / / ← →) ============
  let _keyboardBound = false;
  function bindKeyboardShortcuts() {
    if (_keyboardBound) return;
    _keyboardBound = true;
    document.addEventListener('keydown', (e) => {
      // / 聚焦搜索框（非输入元素时）
      if (e.key === '/' && !/^(?:input|textarea|select)$/i.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        const gs = document.getElementById('global-search');
        if (gs) { gs.focus(); gs.select(); }
        return;
      }
      // Esc 关闭各类弹窗
      if (e.key === 'Escape') {
        const am = document.getElementById('account-modal');
        if (am && am.style.display !== 'none') { closeAccountModal(); return; }
        const lb = document.querySelector('.lightbox-overlay');
        if (lb) { lb.remove(); return; }
        const adm = document.querySelector('.admin-modal');
        if (adm) adm.remove();
      }
      // 列表页左右箭头翻页（仅当不是在输入框里）
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const editing = (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable);
      if (!editing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const hash = location.hash.slice(1) || '/';
        const [path, qs] = hash.split('?');
        const query = new URLSearchParams(qs || '');
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 1 && CAT_MAP[parts[0]]) {
          const page = parseInt(query.get('page') || '1', 10) || 1;
          const next = e.key === 'ArrowRight' ? page + 1 : page - 1;
          if (next >= 1) {
            const totalCnt = (getEntries(parts[0]) || []).length;
            const per = 12;
            const totalPages = Math.max(1, Math.ceil(totalCnt / per));
            if (next <= totalPages && next !== page) {
              query.set('page', String(next));
              location.hash = `#/${parts[0]}${query.toString() ? '?' + query.toString() : ''}`;
            }
          }
        }
      }
    });
  }

  // ============ 主题切换按钮绑定 ============
  let _themeBound = false;
  function bindThemeToggle() {
    if (_themeBound) return;
    _themeBound = true;
    // 在 header 状态行注入主题按钮
    const bar = document.querySelector('.header-status');
    if (!bar || bar.querySelector('.theme-toggle')) return;
    const sep = document.createElement('span'); sep.className = 'status-sep'; sep.textContent = '·';
    const btn = document.createElement('button');
    btn.className = 'theme-toggle status-item';
    btn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text-2);font-family:var(--f-mono);font-size:9px;letter-spacing:1px;padding:0 4px;display:inline-flex;align-items:center;gap:3px;';
    const sunSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:13px;height:13px;"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="7" y2="17"/><line x1="17" y1="7" x2="19.1" y2="4.9"/></svg>';
    const moonSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    const sync = () => {
      const isLight = Theme.get() === 'light';
      btn.innerHTML = (isLight ? sunSVG : moonSVG) + ' ' + (isLight ? '明亮档案室' : '机密暗室');
      btn.title = isLight ? '切换至暗黑模式' : '切换至明亮档案室';
    };
    sync();
    Bus.on('theme:changed', sync);
    btn.addEventListener('click', () => {
      Theme.set(Theme.get() === 'light' ? 'dark' : 'light');
      SFX.theme();
    });
    bar.appendChild(sep); bar.appendChild(btn);
  }

  // ============ 顶部状态栏计数刷新（Bus 监听）============
  let _statsBusBound = false;
  function bindStatsBus() {
    if (_statsBusBound) return;
    _statsBusBound = true;
    Bus.on('entries:changed', refreshTopStats);
    Bus.on('submissions:reviewed', refreshTopStats);
    Bus.on('stats:refresh', refreshTopStats);
    Bus.on('cats:changed', () => { renderNavCats(); refreshTopStats(); refreshSidebarStats(); });
  }
  function refreshTopStats() {
    const totEl = document.getElementById('stat-total');
    const updEl = document.getElementById('stat-updated');
    if (totEl) totEl.textContent = `${statsTotal()} 条`;
    if (updEl) updEl.textContent = DATA.meta.updated || '—';
    // 同步侧边栏总数
    const sbTot = document.getElementById('sb-stat-total');
    if (sbTot) sbTot.textContent = '在档条目：' + (statsTotal() || 0) + ' 条';
  }

  // ============ 关键词高亮 ============
  function highlightKeyword(text, kw) {
    if (!kw) return escapeHtml(text || '');
    const safe = escapeHtml(text || '');
    try {
      const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      return safe.replace(re, '<mark class="kw-hl">$1</mark>');
    } catch { return safe; }
  }

  // ============ 导出完整备份 ============
  function exportBackupJSON() {
    const keys = [
      AUTH_KEY, USERS_KEY, CODES_KEY, SUBMIT_KEY, TOKEN_KEY, ENTRIES_KEY, CATS_KEY,
      DISMISSED_NOTICES_KEY, FAV_KEY, COMMENT_KEY, LOG_KEY, THEME_KEY,
      READ_KEY, DRAFT_KEY
    ];
    const backup = {
      exportedAt: Date.now(),
      exportedBy: (Auth.get() && Auth.get().user) || '',
      version: '2.71',
      localStorage: {},
      dataSnap: {}
    };
    keys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v) backup.localStorage[k] = v;
    });
    // 全量数据快照（分类数据 + categories + meta）
    backup.dataSnap = {
      meta: DATA.meta,
      categories: DATA.categories,
      classLegend: DATA.classLegend
    };
    DATA.categories.forEach(c => { backup.dataSnap[c.id] = DATA[c.id] || []; });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `wa-backup-${ts}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    SFX.export();
  }

  // ============ 简易用户增长曲线计算 ============
  function computeMonthlyUserGrowth() {
    const users = Auth.getUsers();
    const months = {};
    users.forEach(u => {
      const at = u.at || u.createdAt || Date.now();
      const d = new Date(at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = (months[key] || 0) + 1;
    });
    const keys = Object.keys(months).sort();
    // 取最近 6 个月
    const last = keys.slice(-6);
    const pad = 6 - last.length;
    const out = [];
    for (let i = 0; i < pad; i++) out.push({ label: `M${i + 1}`, v: 0 });
    last.forEach((k, i) => out.push({ label: pad > 0 ? `M${pad + i + 1}` : k.slice(2), v: months[k] }));
    return out.slice(-6);
  }

  // ============ 路由 ============
  function router() {
    // 未登录强制进入门禁
    if (!Auth.get()) {
      showLoginGate();
      return;
    }
    hideLoginGate();
    refreshIdentity();
    // 启动 Bus 绑定
    bindStatsBus();

    const hash = location.hash.slice(1) || '/';
    const [path, qs] = hash.split('?');
    const query = new URLSearchParams(qs || '');
    const parts = path.split('/').filter(Boolean);

    updateNav(path);
    // 导航音效（排除初始空hash进入的情况）
    if (window._routedOnce) SFX.navigate();
    window._routedOnce = true;

    if (parts.length === 0) renderHome();
    else if (parts[0] === 'search') renderSearch(query.get('q') || '');
    else if (parts[0] === 'mindmap') renderMindMap();
    else if (parts[0] === 'submit') renderSubmit();
    else if (parts[0] === 'admin') renderAdmin();
    else if (parts[0] === 'entry' && parts.length >= 3) renderEntry(parts[1], decodeURIComponent(parts[2]));
    else if (CAT_MAP[parts[0]]) renderList(parts[0], query);
    else renderNotFound();

    // 非详情页隐藏阅读进度条
    if (parts[0] !== 'entry') {
      const rp = document.getElementById('reading-progress');
      if (rp) rp.style.width = '0%';
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
    initLazyLoad();
  }

  function updateNav(path) {
    document.querySelectorAll('.nav-link').forEach(a => {
      const route = a.dataset.route;
      const active = route === '/' ? path === '/' : path.startsWith(route);
      a.classList.toggle('active', active);
    });
    updateSidebarNav(path);
  }

  // ============ 栏目导航动态渲染 ============
  // 内置分类的专属 SVG 图标
  const CAT_ICONS = {
    anomalies: '<polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/>',
    organizations: '<polygon points="12,2 22,12 12,22 2,12"/>',
    deities: '<polygon points="12,2 14,8 20,6 16,11 22,14 16,15 18,21 12,17 6,21 8,15 2,14 8,11 4,6 10,8"/>',
    eras: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/>',
    timelines: '<circle cx="12" cy="13" r="8"/><polyline points="12,9 12,13 15,15"/><line x1="9" y1="2" x2="15" y2="2"/>'
  };
  // 通用 SVG（自定义栏目用）
  const CAT_ICON_DEFAULT = '<path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z"/><path d="M4 4v14"/><path d="M8 8h6M8 12h6"/>';
  function catIconSvg(catId) {
    const inner = CAT_ICONS[catId] || CAT_ICON_DEFAULT;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
  }
  // 渲染顶部导航 + 侧边栏的分类链接（动态栏目）
  function renderNavCats() {
    const headerWrap = document.getElementById('nav-cats-inline');
    const sbWrap = document.getElementById('sb-cat-links');
    const links = DATA.categories.map(c => {
      const svg = catIconSvg(c.id);
      return { header: `<a href="#/${c.id}" class="nav-link" data-route="/${c.id}">${escapeHtml(c.name)}</a>`,
               sidebar: `<a href="#/${c.id}" class="sidebar-link" data-route="/${c.id}">${svg}<span>${escapeHtml(c.name)}</span></a>` };
    });
    if (headerWrap) headerWrap.innerHTML = links.map(l => l.header).join('');
    if (sbWrap) sbWrap.innerHTML = links.map(l => l.sidebar).join('');
    // 重渲染后同步当前路由高亮
    const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
    if (path !== '/') updateNav(path);
  }

  // ============ 首页 ============
  function renderHome() {
    const stats = computeStats();
    const C = DATA.categories;

    // 分类卡片
    const catCards = C.map(cat => {
      const count = stats.counts[cat.id] || 0;
      return `
        <a class="cat-card" href="#/${cat.id}">
          <div class="cat-head">
            <span class="cat-code">${cat.code}</span>
            <span class="cat-icon">${cat.icon}</span>
          </div>
          <div class="cat-name">${cat.name}</div>
          <span class="cat-name-en">${cat.nameEn}</span>
          <div class="cat-desc">${cat.desc}</div>
          <div class="cat-foot">
            <div><span class="cat-count">${count}</span><span class="cat-count-label">DOCS</span></div>
            <span class="cat-go">ENTER →</span>
          </div>
        </a>`;
    }).join('');

    // 世界观概览（核心 4 项）
    const coreItems = [
      { n: '01', t: '超自然异象', d: '在档异常实体、现象、地点、物品，按危险等级分级归档。' },
      { n: '02', t: '极端组织', d: '红月之下活跃的官方机构、企业、宗教、雇佣兵与地下势力。' },
      { n: '03', t: '历史事件', d: '神代、黑蚀、寂祀三大纪元，以及《喀尔迦书》与灾变纪。' },
      { n: '04', t: '核心设定', d: '神祇权柄、异常理论框架、血矿与虚境等基础设定。' },
    ].map(x => `
      <div class="core-item">
        <span class="core-num">${x.n}</span>
        <div class="core-title">${x.t}</div>
        <div class="core-desc">${x.d}</div>
      </div>
    `).join('');

    // 首页时间线（选取 5 个关键节点）
    const tlNodes = [
      { year: '约 8000BC', title: '白曐降临', desc: '活性结晶撞击地表，首赐之日开启受赐者谱系。', red: false },
      { year: '第 I 纪元', title: '众神时代', desc: '神文明建立、众灵年代、旧神黄昏与埃尔德回归。', red: false },
      { year: '第 II 纪元', title: '黑蚀纪元', desc: '灰疫蔓延、伪神年代、神弃战争后巴别塔倒塌。', red: true },
      { year: '灾变纪', title: '理性黄昏', desc: '旧文明崩溃，异常大规模扩散，秩序重建开始。', red: true },
      { year: '红月协议', title: '红月黎明', desc: '红月政府建立，多方势力在废墟之上展开新博弈。', red: false },
    ];
    const tlImgUrl = encodeURI('IMG-04 纪元卷宗页头图.png');
    const timeline = tlNodes.map(t => `
      <div class="tl-item">
        <div class="tl-year">${t.year}</div>
        <div class="tl-dot ${t.red ? 'red' : ''}"></div>
        <div class="tl-img" style="background-image:url('${tlImgUrl}')">
          <span class="tl-img-tag">${t.title.slice(0,4)}</span>
        </div>
        <div class="tl-title">${t.title}</div>
        <div class="tl-desc">${t.desc}</div>
      </div>
    `).join('');

    // 精选文档（拿 anomalies 前 6 条 + 部分关键组织/卷宗）
    const picks = [];
    (DATA.anomalies || []).slice(0, 4).forEach(e =>
      picks.push({ e, cat: 'anomalies', num: e.id, icon: ico('hexagon',16), foot: '异常档案' }));
    (DATA.organizations || []).slice(0, 1).forEach(e =>
      picks.push({ e, cat: 'organizations', num: (e.code || 'ORG'), icon: ico('diamond',16), foot: '组织档案' }));
    (DATA.eras || []).slice(0, 1).forEach(e =>
      picks.push({ e, cat: 'eras', num: (e.code || 'ERA'), icon: ico('sun',16), foot: '纪元卷宗' }));

    const docs = picks.map((p, i) => {
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(p.e, p.cat),
        String(p.e.title || ''),
        String(p.num || '')
      );
      const sum = (p.e.summary || '').replace(/[\r\n]+/g, ' ').slice(0, 40);
      return `
      <a class="doc-card doc-card-hybrid" href="#/entry/${p.cat}/${encodeURIComponent(p.e.id)}">
        ${thumbHtml}
        <div class="doc-body">
          <span class="doc-num">DOC · ${String(i+1).padStart(2,'0')}</span>
          <div class="doc-title">${p.e.title}</div>
          ${sum ? `<div class="doc-sum">${escapeHtml(sum + (p.e.summary && p.e.summary.length > 40 ? '…' : ''))}</div>` : ''}
          <div class="doc-foot">档案编号 ${p.num} / ${p.foot}</div>
        </div>
      </a>`;
    }).join('');

    view.innerHTML = `
      <!-- HERO 巨幕 -->
      <section class="hero" id="hero-section">
        <div class="hero-bg"></div>
        <div class="hero-img" id="hero-img"></div>
        <canvas class="hero-dust" id="hero-dust"></canvas>
        <div class="hero-scanline"></div>
        <div class="hero-inner">
          <div>
            <div class="hero-tag" id="hero-tag">CLASSIFIED ARCHIVE · 绝密档案数据库</div>
            <h1 class="hero-title">
              未知之物
              <span class="line2">已被收容。</span>
            </h1>
            <p class="hero-desc" id="hero-desc">
              本档案库收录了自白曐降临以来，全部被记录在案的超自然异象、组织机构、神祇谱系、纪元历史与时间线事件。
              每一条档案均经过危险分级、来源追溯与交叉引用校验。
            </p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#/anomalies">${ico('arrowLeft',14)} 浏览档案</a>
              <a class="btn btn-ghost" href="#/eras">阅读历史卷宗 →</a>
            </div>
          </div>
          <div class="hero-stats">
            <div class="stat-row">
              <span class="stat-label">异常异象</span>
              <div><span class="stat-value" data-count="${stats.counts.anomalies||0}">0</span><span class="stat-unit">CASES</span></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">在册组织</span>
              <div><span class="stat-value" data-count="${stats.counts.organizations||0}">0</span><span class="stat-unit">ORGS</span></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">纪元卷宗</span>
              <div><span class="stat-value" data-count="${stats.counts.eras||0}">0</span><span class="stat-unit">CODS</span></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">神祇名录</span>
              <div><span class="stat-value" data-count="${stats.counts.deities||0}">0</span><span class="stat-unit">DEI</span></div>
            </div>
            <div class="hero-seal" title="世界观察档案库印玺">
              <img src="data/logo-mark.png" alt="" onerror="(function(el){var n='data/logo-mark.jpg,x.jpg,首页 HERO 巨幕背景.png,logo.png,logo.jpg'.split(','),i=0,fb=el.nextElementSibling;function t(){if(i>=n.length){el.style.display='none';if(fb)fb.style.display='grid';return;}var p=n[i++],im=new Image();im.onload=function(){el.src=p;};im.onerror=t;im.src=p;}})(this)">
              <span class="hero-seal-fb" style="display:none">${ico('shield',20)}</span>
              <div class="hero-seal-ring"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 分类索引 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">档案索引<span class="section-title-en">CATEGORY INDEX</span></div>
          <div class="section-head-right">共 <strong>${stats.total}</strong> 条档案 / 查看全部分类 <a href="#/anomalies">→</a></div>
        </div>
        <div class="category-grid">${catCards}</div>
      </section>

      <!-- 世界观概览 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">世界观概览<span class="section-title-en">WORLDVIEW OVERVIEW</span></div>
          <div class="section-head-right">核心条目 <a href="#/eras">查看卷宗 →</a></div>
        </div>
        <div class="core-grid">${coreItems}</div>
      </section>

      <!-- 时间线 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">关键时间线<span class="section-title-en">CRITICAL TIMELINE</span></div>
          <div class="section-head-right">跨组织对照 <a href="#/timelines">时间线档案 →</a></div>
        </div>
        <div class="timeline-strip">${timeline}</div>
      </section>

      <!-- 精选文档 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">精选文档<span class="section-title-en">SELECTED DOCUMENTS</span></div>
          <div class="section-head-right">权限要求：LV.3 <a href="#/anomalies">更多档案 →</a></div>
        </div>
        <div class="docs-grid">${docs}</div>
      </section>

      <!-- 标语横幅 -->
      <section class="motto">
        <div class="motto-cn">知识即力量。</div>
        <div class="motto-en">KNOWLEDGE IS POWER · 无知，是最危险的异常。</div>
        <div class="motto-badge">
          <img src="data/logo-mark.png" alt="" onerror="(function(el){var n='data/logo-mark.jpg,x.jpg,首页 HERO 巨幕背景.png,logo.png,logo.jpg'.split(','),i=0,fb=el.nextElementSibling;function t(){if(i>=n.length){el.style.display='none';if(fb)fb.style.display='inline';return;}var p=n[i++],im=new Image();im.onload=function(){el.src=p;};im.onerror=t;im.src=p;}})(this)">
          <span class="motto-badge-fb" style="display:none">⬢</span>
          LV.3 档案已解锁
        </div>
      </section>
    `;

    // 更新状态栏
    const totEl = document.getElementById('stat-total');
    const updEl = document.getElementById('stat-updated');
    if (totEl) totEl.textContent = `${stats.total} 条`;
    if (updEl) updEl.textContent = DATA.meta.updated || '—';

    // 尝试设置 Hero 背景图（若有提供）：png 优先 → jpg → 无图纯黑
    const hImg = document.getElementById('hero-img');
    if (hImg) {
      const candidates = ['data/hero.png', 'data/hero.jpg'];
      let i = 0;
      const tryNext = () => {
        if (i >= candidates.length) return;
        const candidate = candidates[i++];
        const testImg = new Image();
        testImg.onload = () => {
          hImg.style.setProperty('--hero-img', `url('${candidate}')`);
          hImg.style.setProperty('--hero-img-opacity', '1');
        };
        testImg.onerror = tryNext;
        testImg.src = candidate;
      };
      tryNext();
    }

    // ---- 艺术动态效果 ----
    startHeroEffects();
  }

  // ============ 首页艺术动态效果 ============
  function startHeroEffects() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    // 1. 打字机效果（hero-tag → hero-desc 链式）
    const tag = document.getElementById('hero-tag');
    const desc = document.getElementById('hero-desc');
    const typeEl = (el, speed, onDone) => {
      if (!el) return onDone && onDone();
      const full = el.textContent.replace(/\s+/g, ' ').trim();
      el.textContent = '';
      el.classList.add('typing');
      let i = 0;
      const it = setInterval(() => {
        i++;
        el.textContent = full.slice(0, i);
        if (i >= full.length) {
          clearInterval(it);
          setTimeout(() => { el.classList.add('done'); onDone && onDone(); }, 300);
        }
      }, speed);
    };
    if (tag) {
      typeEl(tag, 55, () => {
        // tag 完成后启动副标题打字机
        typeEl(desc, 28, null);
      });
    } else if (desc) {
      typeEl(desc, 28, null);
    }

    // 2. 数字滚动（stat-value）
    const statEls = document.querySelectorAll('.stat-value[data-count]');
    statEls.forEach(el => {
      const target = parseInt(el.dataset.count, 10) || 0;
      if (target === 0) { el.classList.add('counted'); el.textContent = '0'; return; }
      el.classList.add('counting');
      let cur = 0;
      const steps = 40;
      const inc = target / steps;
      let step = 0;
      const tick = () => {
        step++;
        cur = Math.round(inc * step);
        if (step >= steps) cur = target;
        el.textContent = String(cur);
        if (step < steps) {
          requestAnimationFrame(tick);
        } else {
          el.classList.remove('counting');
          el.classList.add('counted');
        }
      };
      // 延迟到 hero-stats 淡入后开始
      setTimeout(() => requestAnimationFrame(tick), 1800);
    });

    // 3. hero 视差（鼠标移动时背景轻微位移）
    const heroSection = document.getElementById('hero-section');
    const heroImg = document.getElementById('hero-img');
    const heroBg = heroSection ? heroSection.querySelector('.hero-bg') : null;
    if (heroSection && (heroImg || heroBg)) {
      let raf = null;
      const onMove = (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const rect = heroSection.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          if (heroImg) heroImg.style.transform = `translate(${x * 18}px, ${y * 14}px) scale(1.06)`;
          if (heroBg) heroBg.style.transform = `translate(${x * 8}px, ${y * 6}px)`;
        });
      };
      heroSection.addEventListener('mousemove', onMove);
      heroSection.addEventListener('mouseleave', () => {
        if (heroImg) heroImg.style.transform = '';
        if (heroBg) heroBg.style.transform = '';
      });
    }

    // 4. 滚动淡入（IntersectionObserver）
    const fadeTargets = document.querySelectorAll(
      '.section-block, .motto, .core-item, .tl-item, .cat-card'
    );
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('in-view'), idx * 60);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      fadeTargets.forEach(el => io.observe(el));
    } else {
      fadeTargets.forEach(el => el.classList.add('in-view'));
    }

    // 5. 粒子尘埃（hero 区漂浮的档案尘埃）
    startHeroDust();

    // 兜底：8 秒后强制全部可见，防止异常导致永久隐藏
    setTimeout(() => {
      document.querySelectorAll('.section-block, .motto, .core-item, .tl-item, .cat-card')
        .forEach(el => el.classList.add('in-view'));
    }, 8000);
  }

  // ============ HERO 粒子尘埃 ============
  let _dustRaf = null, _dustCanvas = null;
  function startHeroDust() {
    const canvas = document.getElementById('hero-dust');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    _dustCanvas = canvas;
    let particles = [];
    let w = 0, h = 0;
    const COUNT = 46;

    function resize() {
      const hero = document.getElementById('hero-section');
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      w = canvas.width = Math.max(1, Math.floor(r.width));
      h = canvas.height = Math.max(1, Math.floor(r.height));
    }
    function spawn() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.08 - Math.random() * 0.22,
        a: 0.12 + Math.random() * 0.38,
        ph: Math.random() * Math.PI * 2,
        sp: 0.004 + Math.random() * 0.012
      };
    }
    function init() {
      resize();
      particles = [];
      for (let i = 0; i < COUNT; i++) particles.push(spawn());
    }
    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx + Math.sin(p.ph) * 0.12;
        p.y += p.vy;
        p.ph += p.sp;
        // 闪烁
        const tw = 0.55 + Math.sin(p.ph * 2) * 0.45;
        const alpha = p.a * tw;
        // 出界重生
        if (p.y < -4 || p.x < -4 || p.x > w + 4) {
          p.x = Math.random() * w;
          p.y = h + 4;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,232,232,${alpha.toFixed(3)})`;
        ctx.fill();
      }
      _dustRaf = requestAnimationFrame(tick);
    }
    init();
    // 窗口尺寸变化时重置
    let rzT = null;
    const onResize = () => {
      clearTimeout(rzT);
      rzT = setTimeout(init, 200);
    };
    window.addEventListener('resize', onResize);
    // 页面可见性：隐藏时暂停，节省性能
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (_dustRaf) { cancelAnimationFrame(_dustRaf); _dustRaf = null; }
      } else if (!_dustRaf) {
        _dustRaf = requestAnimationFrame(tick);
      }
    });
    _dustRaf = requestAnimationFrame(tick);
    // 清理旧实例（路由切换重建时）
    if (window._heroDustCleanup) window._heroDustCleanup();
    window._heroDustCleanup = () => {
      if (_dustRaf) { cancelAnimationFrame(_dustRaf); _dustRaf = null; }
      window.removeEventListener('resize', onResize);
    };
  }

  function badgeHtml(cls, label, extraClass) {
    const n = CLASS_NAMES[cls] || label || cls || '未分级';
    return `<span class="ec-badge ${cls || 'neutral'} ${extraClass || ''}">${n}</span>`;
  }

  // ============ 列表页 ============
  function renderList(catId, query) {
    const cat = CAT_MAP[catId];
    if (!cat) return renderNotFound();

    let entries = getEntries(catId).map(e => ({ ...e, _cat: catId }));
    const q = (query.get('q') || '').trim().toLowerCase();
    const clsFilter = query.get('class') || '';
    const tagFilter = query.get('tag') || '';
    const subFilter = query.get('sub') || '';
    const sortKey = query.get('sort') || '';
    const page = parseInt(query.get('page') || '1', 10) || 1;

    if (q) {
      entries = entries.filter(e => {
        const hay = (
          e.id + ' ' + (e.code||'') + ' ' + e.title + ' ' +
          (e.summary||'') + ' ' + (e.body||'') + ' ' + (e.content||'') + ' ' +
          (e.tags||[]).join(' ') + ' ' + (e.org||'') + ' ' + (e.era||'')
        ).toLowerCase();
        // 支持空格分隔的多关键词 AND 匹配
        const kwds = q.split(/\s+/).filter(Boolean);
        return kwds.every(k => hay.includes(k));
      });
    }
    if (clsFilter && catId !== 'deities' && catId !== 'eras' && catId !== 'timelines') {
      entries = entries.filter(e => (e.class || 'neutral') === clsFilter);
    }
    if (tagFilter) {
      entries = entries.filter(e => (e.tags || []).includes(tagFilter));
    }
    if (subFilter) {
      entries = entries.filter(e => (e.subcat || '') === subFilter);
    }
    if (sortKey === 'title') {
      entries.sort((a,b) => (a.title||'').localeCompare(b.title||''));
    } else if (sortKey === 'code') {
      entries.sort((a,b) => (a.code||a.id||'').localeCompare(b.code||b.id||''));
    }

    // 分页（纪元卷宗按组分页不合适，不分页）
    const PER_PAGE = catId === 'eras' ? 9999 : 12;
    const totalPages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
    const curPage = Math.min(Math.max(1, page), totalPages);
    const pageStart = (curPage - 1) * PER_PAGE;
    const pageEntries = entries.slice(pageStart, pageStart + PER_PAGE);

    // 工具栏 + 高级筛选面板
    const showClassFilter = ['anomalies', 'organizations'].includes(catId);
    const classOptions = DATA.classLegend.map(c =>
      `<option value="${c.code}" ${clsFilter===c.code?'selected':''}>${c.name}</option>`
    ).join('');
    // 收集所有可用 tag（跨当前分类）
    const allTagsInCat = Array.from(new Set(
      (getEntries(catId) || []).flatMap(e => e.tags || [])
    )).sort();
    const advOpen = query.get('adv') === '1';
    const tagChips = allTagsInCat.map(t => {
      const active = tagFilter === t;
      return `<button type="button" class="tag-chip${active?' active':''}" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`;
    }).join('');
    const advPanel = `
      <div class="adv-panel" style="display:${advOpen?'grid':'none'};grid-template-columns:1fr;gap:10px;padding:12px 16px;border-top:1px dashed var(--border);background:var(--bg-2);">
        ${(cat.subcats||[]).length ? `<div><div class="adv-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);margin-bottom:6px;">子分组</div><div class="tag-chips" style="display:flex;flex-wrap:wrap;gap:6px;">${(cat.subcats||[]).map(s => { const a = subFilter === s.id; return `<button type="button" class="tag-chip${a?' active':''}" data-sub="${escapeAttr(s.id)}">${escapeHtml(s.name)}</button>`; }).join('')}<button type="button" class="tag-chip" data-sub="" style="opacity:.8;">${ico('cross',12)} 清空</button></div></div>` : ''}
        ${allTagsInCat.length ? `<div><div class="adv-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);margin-bottom:6px;">标签筛选</div><div class="tag-chips" style="display:flex;flex-wrap:wrap;gap:6px;">${tagChips}<button type="button" class="tag-chip" data-tag="" style="opacity:.8;">${ico('cross',12)} 清空</button></div></div>` : ''}
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <label style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);">最低字数 <input type="number" id="adv-min" min="0" value="${escapeAttr(query.get('minlen')||'')}" placeholder="0" style="width:90px;padding:4px 6px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--f-mono);font-size:11px;"></label>
          <label style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);">含关键词（正文） <input type="text" id="adv-body" value="${escapeAttr(query.get('b')||'')}" placeholder="仅正文搜索词" style="width:220px;padding:4px 6px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--f-mono);font-size:11px;"></label>
          <button id="adv-apply" class="btn btn-mini" style="border:1px solid var(--border);padding:5px 10px;font-family:var(--f-mono);font-size:10px;background:var(--bg);color:var(--text);cursor:pointer;">应用筛选</button>
        </div>
      </div>
    `;
    // 正文关键词、字数过滤
    const bodyKw = (query.get('b') || '').trim().toLowerCase();
    const minLen = parseInt(query.get('minlen') || '0', 10) || 0;
    if (bodyKw) entries = entries.filter(e => ((e.body||'')+(e.content||'')).toLowerCase().includes(bodyKw));
    if (minLen > 0) entries = entries.filter(e => {
      const n = ((e.body||'')+(e.content||'')).replace(/<[^>]+>/g,'').length;
      return n >= minLen;
    });

    // 重新计算分页
    const totalPages2 = Math.max(1, Math.ceil(entries.length / (catId === 'eras' ? 9999 : 12)));
    const curPage2 = Math.min(Math.max(1, page), totalPages2);
    const pageStart2 = (curPage2 - 1) * (catId === 'eras' ? 9999 : 12);
    const pageEntries2 = entries.slice(pageStart2, pageStart2 + (catId === 'eras' ? 9999 : 12));

    // 排序下拉
    const sortOptions = [
      { v: '', label: '默认' },
      { v: 'code', label: '按编号' },
      { v: 'title', label: '按标题' }
    ].map(o => `<option value="${o.v}" ${sortKey===o.v?'selected':''}>${o.label}</option>`).join('');

    const viewMode = query.get('view') || (localStorage.getItem('wa_view') || 'grid');
    let listHtml;
    if (catId === 'deities') listHtml = htmlDeityGrid(pageEntries2, q);
    else if (catId === 'timelines') listHtml = htmlTimelineList(pageEntries2, q);
    else if (catId === 'eras') listHtml = htmlEraGrouped(pageEntries2, q);
    else if (viewMode === 'list') listHtml = htmlEntryList(pageEntries2, catId, q);
    else listHtml = htmlEntryGrid(pageEntries2, catId, q);

    // 分页控件
    let pagerHtml = '';
    if (totalPages2 > 1) {
      const buildPageUrl = (p) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (clsFilter) params.set('class', clsFilter);
        if (tagFilter) params.set('tag', tagFilter);
        if (subFilter) params.set('sub', subFilter);
        if (sortKey) params.set('sort', sortKey);
        if (advOpen) params.set('adv', '1');
        if (bodyKw) params.set('b', query.get('b') || '');
        if (minLen) params.set('minlen', String(minLen));
        if (p > 1) params.set('page', p);
        return `#/${catId}${params.toString() ? '?'+params.toString() : ''}`;
      };
      const btns = [];
      btns.push(`<a class="pg-btn ${curPage2<=1?'disabled':''}" href="${curPage2>1?buildPageUrl(curPage2-1):'javascript:void(0)'}">‹ 上一页</a>`);
      // 页码按钮
      const maxBtns = 7;
      let startP = Math.max(1, curPage2 - 3);
      let endP = Math.min(totalPages2, startP + maxBtns - 1);
      if (endP - startP < maxBtns - 1) startP = Math.max(1, endP - maxBtns + 1);
      if (startP > 1) {
        btns.push(`<a class="pg-num" href="${buildPageUrl(1)}">1</a>`);
        if (startP > 2) btns.push(`<span class="pg-dots">···</span>`);
      }
      for (let i = startP; i <= endP; i++) {
        btns.push(`<a class="pg-num ${i===curPage2?'active':''}" href="${buildPageUrl(i)}">${i}</a>`);
      }
      if (endP < totalPages2) {
        if (endP < totalPages2 - 1) btns.push(`<span class="pg-dots">···</span>`);
        btns.push(`<a class="pg-num" href="${buildPageUrl(totalPages2)}">${totalPages2}</a>`);
      }
      btns.push(`<a class="pg-btn ${curPage2>=totalPages2?'disabled':''}" href="${curPage2<totalPages2?buildPageUrl(curPage2+1):'javascript:void(0)'}">下一页 ›</a>`);
      pagerHtml = `
        <div class="list-pager">
          ${btns.join('')}
          <span class="pg-info">第 ${curPage2}/${totalPages2} 页 · 共 ${entries.length} 条</span>
        </div>`;
    }

    // 红月黑匣子：分类页头图横幅（黑白灰阶纪实头图）
    const HEADER_IMGS = {
      anomalies:     'IMG-02 异常档案页头图.png',
      organizations: 'IMG-03 组织名录页头图.png',
      eras:          'IMG-04 纪元卷宗页头图.png',
      deities:       'IMG-05 神祇图鉴页头图.png',
      timelines:     'IMG-06 时间线页头图.png'
    };
    const headerImgAttr = HEADER_IMGS[catId]
      ? ` data-header-img="${encodeURI(HEADER_IMGS[catId])}"`
      : '';

    view.innerHTML = `
      <div class="list-header"${headerImgAttr}>
        <div class="list-header-inner">
          <div class="list-title">
            ${cat.icon} ${cat.name}
            <span class="list-title-en">${cat.nameEn}</span>
          </div>
          <p class="list-sub">${cat.desc} 数据来源：${cat.source || '项目原始资料'}</p>
        </div>
      </div>

      <div class="list-toolbar toolbar">
        <div class="toolbar-left">
          <span class="toolbar-count">在档 <strong>${entries.length}</strong> 条记录</span>
        </div>
        <div class="toolbar-spacer"></div>
        <input type="text" id="list-search" placeholder="搜索编号 / 代号 / 标题 / 标签 / 正文 (按 / 聚焦)..." value="${escapeHtml(q)}">
        ${showClassFilter ? `<label>分级</label><select id="list-class">
          <option value="">全部等级</option>
          ${classOptions}
        </select>` : ''}
        <label>排序</label><select id="list-sort">${sortOptions}</select>
        <button id="adv-toggle" type="button" class="btn btn-mini adv-toggle" style="border:1px solid var(--border);padding:5px 10px;font-family:var(--f-mono);font-size:10px;background:var(--bg);color:var(--text);cursor:pointer;">高级筛选 ${advOpen?'▲':'▼'}</button>
        ${['anomalies','organizations'].includes(catId) ? `
        <div class="view-toggle" id="view-toggle" title="切换视图">
          <button type="button" data-view="grid" class="${viewMode==='grid'?'active':''}" title="卡片视图">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button type="button" data-view="list" class="${viewMode==='list'?'active':''}" title="列表视图">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
          </button>
        </div>` : ''}
      </div>
      ${advPanel}

      ${entries.length === 0
        ? `<div class="empty-state">
             <div class="es-icon">▱</div>
             <div class="es-title">未检索到匹配档案</div>
             <div class="es-desc">尝试放宽关键词或移除筛选条件</div>
           </div>`
        : listHtml}

      ${pagerHtml}
    `;

    // 红月黑匣子：分类头图横幅注入背景变量
    const lh = document.querySelector('.list-header[data-header-img]');
    if (lh && lh.dataset.headerImg) {
      lh.style.setProperty('--lh-img', `url('${lh.dataset.headerImg}')`);
    }

    // 工具栏事件
    const buildAllParams = (ov) => {
      const p = new URLSearchParams();
      const o = Object.assign({
        q, cls: clsFilter, tag: tagFilter, sub: subFilter, sort: sortKey,
        adv: advOpen ? '1' : '',
        b: query.get('b') || '',
        minlen: query.get('minlen') || '',
        view: viewMode
      }, ov || {});
      if (o.q) p.set('q', o.q);
      if (o.cls) p.set('class', o.cls);
      if (o.tag) p.set('tag', o.tag);
      if (o.sub) p.set('sub', o.sub);
      if (o.sort) p.set('sort', o.sort);
      if (o.adv) p.set('adv', o.adv);
      if (o.b) p.set('b', o.b);
      if (o.minlen) p.set('minlen', o.minlen);
      if (o.view && o.view !== 'grid') p.set('view', o.view);
      return p;
    };
    const si = document.getElementById('list-search');
    if (si) {
      let t = null;
      si.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (si.value.trim()) SFX.search();
          const p = buildAllParams({ q: si.value.trim() });
          location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
        }, 250);
      });
    }
    const ss = document.getElementById('list-class');
    if (ss) {
      ss.addEventListener('change', () => {
        SFX.click();
        const p = buildAllParams({ cls: ss.value });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }
    const sso = document.getElementById('list-sort');
    if (sso) {
      sso.addEventListener('change', () => {
        SFX.click();
        const p = buildAllParams({ sort: sso.value });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }
    const atg = document.getElementById('adv-toggle');
    if (atg) {
      atg.addEventListener('click', () => {
        SFX.click();
        const p = buildAllParams({ adv: advOpen ? '' : '1' });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }
    document.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click();
        const t = btn.dataset.tag || '';
        const p = buildAllParams({ tag: t });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    });
    document.querySelectorAll('[data-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click();
        const s = btn.dataset.sub || '';
        const p = buildAllParams({ sub: s });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    });
    const aap = document.getElementById('adv-apply');
    if (aap) {
      aap.addEventListener('click', () => {
        SFX.click();
        const mi = document.getElementById('adv-min');
        const bi = document.getElementById('adv-body');
        const p = buildAllParams({
          minlen: mi && mi.value ? String(parseInt(mi.value,10)||0) : '',
          b: bi && bi.value.trim() ? bi.value.trim() : ''
        });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }

    // 视图切换
    const vt = document.getElementById('view-toggle');
    if (vt) {
      vt.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          SFX.click();
          const v = btn.dataset.view;
          try { localStorage.setItem('wa_view', v); } catch {}
          const p = buildAllParams({ view: v });
          location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
        });
      });
    }

    // 列表加载后：有结果 → 金属铃；无结果 → 低频嘟
    if (entries.length === 0) SFX.miss();
    else if (q || clsFilter || tagFilter || sortKey || advOpen) SFX.hit();
  }

  // 统一图片 URL 解析：已完整的 URL（data:/http/https/绝对路径）直接返回，否则补 data/ 前缀
  function resolveImgUrl(img) {
    if (!img || typeof img !== 'string') return null;
    if (img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://') || img.startsWith('/')) {
      return img;
    }
    return `data/${img}`;
  }

  // 异常 / 组织 / 卷宗：左图右文卡片网格（黑白冷冽档案卡）
  // 图片查找优先级：
  //   1. JSON 字段 e.img（相对 data/ 目录，或 base64 / 服务器路径）
  //   2. data/{cat}/{id 或 code}.png / .jpg / .webp / .jpeg
  //      例 anomalies → data/anomalies/UR-014.png
  //   3. 兜底：程序化生成的黑白档案风封面（data-URI SVG，按分类 + 条目哈希）
  function resolveEntryImage(e, catId) {
    const safeBase = (catId === 'anomalies') ? 'anomalies'
                  : (catId === 'organizations') ? 'organizations'
                  : (catId === 'eras') ? 'eras'
                  : (catId === 'deities') ? 'deities'
                  : '';
    const direct = resolveImgUrl(e.img);
    const idKey = String(e.id || '').replace(/\//g, '__');
    const codeKey = String(e.code || '').replace(/\s+/g, '_').replace(/\//g, '__');
    const exts = ['png', 'jpg', 'jpeg', 'webp'];
    const candidates = [];
    if (direct) candidates.push(direct);
    if (safeBase) {
      for (const ext of exts) {
        if (idKey)   candidates.push(`data/${safeBase}/${idKey}.${ext}`);
        if (codeKey && codeKey !== idKey) candidates.push(`data/${safeBase}/${codeKey}.${ext}`);
      }
    }
    // 程序化封面：始终可用，保证无图条目也有专属封面
    candidates.push(generateProceduralCover(e, catId));
    return candidates;
  }

  // ---- 程序化封面生成（黑白档案风 data-URI SVG）----
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    s = String(s || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function generateProceduralCover(e, catId) {
    const seed = hashStr((e.id || '') + '|' + (e.title || ''));
    const rnd = mulberry32(seed);
    const id = String(e.id || '????');
    const code = String(e.code || '');
    const title = String(e.title || '');
    const VB = 200;
    const bg = '#050505';
    const ink = 'rgba(232,232,232,0.82)';
    const inkDim = 'rgba(232,232,232,0.32)';
    const inkFaint = 'rgba(232,232,232,0.14)';
    let motif = '';
    if (catId === 'anomalies')      motif = coverAnomaly(rnd, VB, ink, inkDim, inkFaint);
    else if (catId === 'organizations') motif = coverOrg(rnd, VB, ink, inkDim, inkFaint);
    else if (catId === 'deities')   motif = coverDeity(rnd, VB, ink, inkDim, inkFaint);
    else if (catId === 'eras')      motif = coverEra(rnd, VB, ink, inkDim, inkFaint);
    else                            motif = coverAnomaly(rnd, VB, ink, inkDim, inkFaint);

    const stampCls = ({anomalies:'ANOMALY', organizations:'ORG', deities:'DEITY', eras:'ERA'})[catId] || 'FILE';
    const clsTag = `<text x="10" y="18" font-family="ui-monospace,monospace" font-size="9" fill="${inkDim}" letter-spacing="2">${stampCls}</text>`;
    const idTag = `<text x="190" y="18" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="${inkDim}" letter-spacing="1">${escapeHtml(id)}</text>`;
    const codeTag = code ? `<text x="10" y="192" font-family="ui-monospace,monospace" font-size="8.5" fill="${inkDim}" letter-spacing="1">${escapeHtml(code)}</text>` : '';
    // 顶部/底部细线
    const frame = `<rect x="1" y="1" width="${VB-2}" height="${VB-2}" fill="none" stroke="${inkFaint}" stroke-width="1"/>
                   <line x1="8" y1="24" x2="${VB-8}" y2="24" stroke="${inkFaint}" stroke-width="0.6"/>
                   <line x1="8" y1="${VB-18}" x2="${VB-8}" y2="${VB-18}" stroke="${inkFaint}" stroke-width="0.6"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" preserveAspectRatio="xMidYMid slice">
      <rect width="${VB}" height="${VB}" fill="${bg}"/>
      ${motif}
      ${frame}
      ${clsTag}${idTag}
      ${codeTag}
      <text x="100" y="${VB-6}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="6.5" fill="${inkFaint}" letter-spacing="3">VISUAL ARCHIVE · CLASSIFIED</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // 异常：故障扫描线 + 错位方块 + 警示符
  function coverAnomaly(rnd, VB, ink, dim, faint) {
    let s = '';
    // 扫描线
    for (let y = 30; y < VB - 22; y += 4) {
      if (rnd() > 0.45) {
        const x = 8 + rnd() * 20;
        const w = (VB - 16) * (0.4 + rnd() * 0.55);
        s += `<line x1="${x.toFixed(1)}" y1="${y}" x2="${(x+w).toFixed(1)}" y2="${y}" stroke="${rnd()>0.7?ink:dim}" stroke-width="${rnd()>0.8?1.2:0.7}"/>`;
      }
    }
    // 错位方块
    for (let i = 0; i < 5; i++) {
      const bx = 30 + rnd() * (VB - 80);
      const by = 40 + rnd() * (VB - 90);
      const bw = 14 + rnd() * 26;
      s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${(bw*0.5).toFixed(1)}" fill="none" stroke="${i%2?dim:faint}" stroke-width="0.8"/>`;
    }
    // 中心警示三角
    const cx = VB/2, cy = VB/2 + 6;
    s += `<g fill="none" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round">
      <path d="M${cx} ${cy-22} L${cx+22} ${cy+16} L${cx-22} ${cy+16} Z"/>
      <line x1="${cx}" y1="${cy-8}" x2="${cx}" y2="${cy+4}"/>
      <circle cx="${cx}" cy="${cy+10}" r="1.4" fill="${ink}" stroke="none"/>
    </g>`;
    return s;
  }
  // 组织：同心徽章 + 多边形印章
  function coverOrg(rnd, VB, ink, dim, faint) {
    let s = '';
    const cx = VB/2, cy = VB/2 + 4;
    // 同心圆
    for (let i = 0; i < 4; i++) {
      const r = 24 + i * 12;
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i%2?dim:faint}" stroke-width="${i===0?1.1:0.6}"/>`;
    }
    // 多边形外环
    const sides = 6 + Math.floor(rnd() * 4) * 2;
    const R = 64;
    let pts = '';
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      pts += `${(cx + Math.cos(a)*R).toFixed(1)},${(cy + Math.sin(a)*R).toFixed(1)} `;
    }
    s += `<polygon points="${pts.trim()}" fill="none" stroke="${dim}" stroke-width="0.9"/>`;
    // 中心十字
    s += `<g stroke="${ink}" stroke-width="1.2">
      <line x1="${cx-10}" y1="${cy}" x2="${cx+10}" y2="${cy}"/>
      <line x1="${cx}" y1="${cy-10}" x2="${cx}" y2="${cy+10}"/>
      <circle cx="${cx}" cy="${cy}" r="4" fill="none"/>
    </g>`;
    return s;
  }
  // 神祇：放射光芒 + 曼陀罗
  function coverDeity(rnd, VB, ink, dim, faint) {
    let s = '';
    const cx = VB/2, cy = VB/2 + 4;
    const spokes = 12 + Math.floor(rnd() * 8);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const r1 = 18, r2 = 26 + rnd() * 36;
      s += `<line x1="${(cx+Math.cos(a)*r1).toFixed(1)}" y1="${(cy+Math.sin(a)*r1).toFixed(1)}" x2="${(cx+Math.cos(a)*r2).toFixed(1)}" y2="${(cy+Math.sin(a)*r2).toFixed(1)}" stroke="${i%3===0?ink:dim}" stroke-width="${i%3===0?0.9:0.5}"/>`;
    }
    // 同心圆
    for (let i = 0; i < 3; i++) {
      s += `<circle cx="${cx}" cy="${cy}" r="${14 + i * 8}" fill="none" stroke="${i?dim:faint}" stroke-width="0.6"/>`;
    }
    // 中心眼
    s += `<g fill="none" stroke="${ink}" stroke-width="1.1">
      <path d="M${cx-12} ${cy} Q${cx} ${cy-10} ${cx+12} ${cy} Q${cx} ${cy+10} ${cx-12} ${cy} Z"/>
      <circle cx="${cx}" cy="${cy}" r="3.2"/>
    </g>`;
    return s;
  }
  // 纪元：地层带 + 时间刻度
  function coverEra(rnd, VB, ink, dim, faint) {
    let s = '';
    let y = 32;
    while (y < VB - 24) {
      const h = 6 + rnd() * 16;
      const op = 0.06 + rnd() * 0.16;
      s += `<rect x="8" y="${y.toFixed(1)}" width="${(VB-16).toFixed(1)}" height="${h.toFixed(1)}" fill="rgba(232,232,232,${op.toFixed(2)})"/>`;
      y += h + 1.5;
    }
    // 时间刻度线
    const ty = VB/2 + 4;
    s += `<line x1="14" y1="${ty}" x2="${VB-14}" y2="${ty}" stroke="${ink}" stroke-width="1"/>`;
    for (let i = 0; i < 7; i++) {
      const x = 14 + (i / 6) * (VB - 28);
      const big = i % 2 === 0;
      s += `<line x1="${x.toFixed(1)}" y1="${ty}" x2="${x.toFixed(1)}" y2="${ty - (big?8:4)}" stroke="${big?ink:dim}" stroke-width="0.8"/>`;
    }
    // 中心菱形节点
    const cx = VB/2;
    s += `<g fill="none" stroke="${ink}" stroke-width="1.1">
      <path d="M${cx} ${ty-16} L${cx+8} ${ty} L${cx} ${ty+16} L${cx-8} ${ty} Z"/>
    </g>`;
    return s;
  }
  // 全局占位封面图
  const PLACEHOLDER_COVER = 'placeholder-cover.png';

  // 为 <img> 注入「逐级尝试候选图 → 失败走占位」onerror
  // 策略：把候选列表存到 data-srcs (JSON) + data-idx，onerror 里取下一个
  // 最终失败：display:none，让父容器 .anom-thumb 显示 SVG 占位（通过兄弟节点 fallback）
  function buildAnomThumbHtml(candidates, label, fallbackCls) {
    const fbLabel = escapeHtml(fallbackCls || '封存');
    const fbSub = escapeHtml(label || '');
    const fbSubAttr = fbSub ? `<span class="anom-fb-sub">${fbSub}</span>` : '';
    // 在候选列表末尾加入全局占位图，确保最终总有一张图显示
    const srcsList = candidates.length ? candidates : [];
    srcsList.push(PLACEHOLDER_COVER);
    const srcs = JSON.stringify(srcsList);
    const first = srcsList[0];
    // onerror: 用原生小函数（挂在 window 上一次）切换到下一张；失败完切 SVG 占位
    return `
      <div class="anom-thumb">
        <img class="anom-thumb-img" src="${escapeAttr(first)}"
             data-srcs="${escapeAttr(srcs)}" data-idx="0" alt="${escapeAttr(label)}"
             onerror="__tryNextAnomImg(this)" onload="__markAnomImgLoaded(this)">
        <div class="anom-thumb-fb" aria-hidden="true">
          <svg class="anom-fb-svg" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="anomDiag" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="16" height="16" fill="none"/>
                <line x1="0" y1="0" x2="0" y2="16" stroke="currentColor" stroke-opacity="0.18" stroke-width="1"/>
              </pattern>
            </defs>
            <rect x="1" y="1" width="138" height="138" fill="url(#anomDiag)" stroke="currentColor" stroke-opacity="0.35" />
            <rect x="18" y="18" width="104" height="104" fill="none" stroke="currentColor" stroke-opacity="0.2" />
            <g fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.25" stroke-linecap="square">
              <path d="M42 42 H98 V98 H42 Z"/>
              <path d="M42 42 L98 98 M98 42 L42 98"/>
            </g>
            <text x="70" y="72" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
                  font-size="14" fill="currentColor" opacity="0.85" letter-spacing="2">NO IMG</text>
            <text x="70" y="92" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
                  font-size="10" fill="currentColor" opacity="0.55" letter-spacing="1.5">VISUAL REDACTED</text>
          </svg>
          <div class="anom-fb-meta">
            <span class="anom-fb-code">${fbLabel}</span>
            ${fbSubAttr}
          </div>
        </div>
        <div class="anom-thumb-scan" aria-hidden="true"></div>
        <div class="anom-thumb-corners" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
    `;
  }

  function htmlEntryGrid(entries, catId, kw) {
    const cards = entries.map(e => {
      const cls = e.class || (catId === 'organizations' ? 'org' : (catId === 'eras' ? 'era' : 'neutral'));
      const bdg = badgeHtml(cls, null, (cls === e.class) ? '' : cls);
      const codeTxt = (e.code && e.code !== e.title) ? e.code : e.id;
      const idTxt = e.id;
      const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const extraMeta = catId === 'eras' ? (e.era ? `<span class="ec-meta-dot">${ico('sun',12)} ${highlightKeyword(e.era, kw)}</span>` : '')
                    : catId === 'organizations' ? (e.org ? `<span class="ec-meta-dot">${ico('diamond',12)} ${highlightKeyword(e.org, kw)}</span>` : '')
                    : '';
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(e, catId),
        String(e.title || ''),
        String(codeTxt || '')
      );
      // 从 body 提取字数
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      return `
        <a class="entry-card anom-card" href="#/entry/${e._cat||catId}/${encodeURIComponent(e.id)}">
          ${thumbHtml}
          <div class="anom-body">
            <div class="anom-body-top">
              <div class="anom-idrow">
                <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                ${bdg}
              </div>
              <div class="anom-title-row">
                <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                ${codeTxt !== idTxt ? `<div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>` : ''}
              </div>
            </div>
            <div class="anom-body-mid">
              ${extraMeta ? `<div class="ec-meta">${extraMeta}</div>` : ''}
              <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
            </div>
            <div class="entry-card-foot">
              <span class="ec-tags">${tagHtml}</span>
              <span class="ec-foot-info">${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount} 字</span>
            </div>
          </div>
        </a>`;
    }).join('');
    return `<div class="entry-grid entry-grid-anom">${cards}</div>`;
  }

  // 档案列表视图（紧凑条目）
  function htmlEntryList(entries, catId, kw) {
    const items = entries.map(e => {
      const idTxt = e.id;
      const title = highlightKeyword(e.title, kw);
      const codeTxt = (e.code && e.code !== e.title) ? highlightKeyword(e.code, kw) : '';
      const cls = e.class || (catId === 'organizations' ? 'org' : 'neutral');
      const clsName = DATA.classLegend.find(c => c.code === cls)?.name || '';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="entry-list-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      const metaBits = [];
      if (wordCount) metaBits.push(`${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount}字`);
      if (e.updated) metaBits.push(e.updated);
      const metaHtml = metaBits.length ? `<span class="entry-list-meta">${metaBits.join(' · ')}</span>` : '';
      const clsHtml = clsName ? `<span class="entry-list-class">${clsName}</span>` : '';
      return `
        <a class="entry-list-item" href="#/entry/${e._cat||catId}/${encodeURIComponent(e.id)}">
          <span class="entry-list-num">${idTxt}</span>
          <span class="entry-list-dash">—</span>
          <span class="entry-list-title">${title}</span>
          ${codeTxt ? `<span class="entry-list-code">代号: ${codeTxt}</span>` : ''}
          ${clsHtml}
          ${tagHtml}
          ${metaHtml}
        </a>`;
    }).join('');
    return `<div class="entry-list">${items}</div>`;
  }

  // 神祇图鉴 — 统一使用 anom-card 风格
  function htmlDeityGrid(entries, kw) {
    const cards = entries.map(e => {
      const idTxt = e.id;
      const codeTxt = e.code || e.id;
      const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(e, 'deities'),
        String(e.title || ''),
        String(codeTxt || '')
      );
      return `
        <a class="entry-card anom-card" href="#/entry/deities/${encodeURIComponent(e.id)}">
          ${thumbHtml}
          <div class="anom-body">
            <div class="anom-body-top">
              <div class="anom-idrow">
                <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                ${badgeHtml('neutral', null, '神祇')}
              </div>
              <div class="anom-title-row">
                <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                <div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>
              </div>
            </div>
            <div class="anom-body-mid">
              <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
            </div>
            <div class="entry-card-foot">
              <span class="ec-tags">${tagHtml}</span>
              <span class="ec-foot-info">${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount} 字</span>
            </div>
          </div>
        </a>`;
    }).join('');
    return `<div class="entry-grid entry-grid-anom">${cards}</div>`;
  }

  // 时间线列表 — 统一使用 anom-card 风格
  function htmlTimelineList(entries, kw) {
    const cards = entries.map(e => {
      const idTxt = e.id;
      const codeTxt = e.code || e.id;
      const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(e, 'timelines'),
        String(e.title || ''),
        String(codeTxt || '')
      );
      return `
        <a class="entry-card anom-card" href="#/entry/timelines/${encodeURIComponent(e.id)}">
          ${thumbHtml}
          <div class="anom-body">
            <div class="anom-body-top">
              <div class="anom-idrow">
                <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                ${badgeHtml('tl', null, '时间线')}
              </div>
              <div class="anom-title-row">
                <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                <div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>
              </div>
            </div>
            <div class="anom-body-mid">
              <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
            </div>
            <div class="entry-card-foot">
              <span class="ec-tags">${tagHtml}</span>
              <span class="ec-foot-info">${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount} 字</span>
            </div>
          </div>
        </a>`;
    }).join('');
    return `<div class="entry-grid entry-grid-anom">${cards}</div>`;
  }

  // 纪元卷宗：按纪元分组 — 统一使用 anom-card 风格
  function htmlEraGrouped(entries, kw) {
    const groups = {};
    entries.forEach(e => {
      const era = e.era || '未分类卷宗';
      (groups[era] = groups[era] || []).push(e);
    });
    const out = Object.entries(groups).map(([era, list]) => {
      const cards = list.map(e => {
        const idTxt = e.id;
        const codeTxt = e.code || e.id;
        const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
        const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
        const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
        const wordCount = bodyText.length;
        const thumbHtml = buildAnomThumbHtml(
          resolveEntryImage(e, 'eras'),
          String(e.title || ''),
          String(codeTxt || '')
        );
        return `
          <a class="entry-card anom-card" href="#/entry/eras/${encodeURIComponent(e.id)}">
            ${thumbHtml}
            <div class="anom-body">
              <div class="anom-body-top">
                <div class="anom-idrow">
                  <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                  ${badgeHtml('era', null, '纪元')}
                </div>
                <div class="anom-title-row">
                  <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                  <div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>
                </div>
              </div>
              <div class="anom-body-mid">
                <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
              </div>
              <div class="entry-card-foot">
                <span class="ec-tags">${tagHtml}</span>
                <span class="ec-foot-info">${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount} 字</span>
              </div>
            </div>
          </a>`;
      }).join('');
      return `
        <div class="era-group">
          <div class="era-group-title">
            <span>${ico('sun',12)} ${highlightKeyword(era, kw)}</span>
            <span class="era-group-count">${list.length} VOLS</span>
          </div>
          <div class="era-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:12px;">${cards}</div>
        </div>`;
    }).join('');
    return out;
  }

  // ============ 详情页辅助：TOC 生成 ============
  function injectTocAnchors(html) {
    // 把 h2/h3 加 id，返回 {html, toc:[{level,id,text}]}
    const toc = [];
    const used = {};
    let idx = 0;
    const out = (html || '').replace(/<(h[1-6])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (m0, tag, attrs = '', inner) => {
      const m = inner.replace(/<[^>]+>/g, '').trim();
      if (!m) return m0;
      let id = 'h-' + encodeURIComponent(m).replace(/%/g,'').slice(0,24).toLowerCase() + (idx++);
      while (used[id]) id += '-'+(idx++);
      used[id] = true;
      const lv = parseInt(tag.charAt(1),10);
      toc.push({ level: lv, id, text: m });
      // 如果已有 id 属性，保持（替换）
      const re = /\sid=(['"])([^'"]*)\1/;
      const a2 = re.test(attrs) ? attrs.replace(re, ` id="${id}"`) : `${attrs} id="${id}"`;
      return `<${tag}${a2}>${inner}</${tag}>`;
    });
    return { html: out, toc };
  }

  // ============ 详情页 ============
  function renderEntry(catId, id) {
    const cat = CAT_MAP[catId];
    const e = findEntry(catId, id);
    if (!cat || !e) return renderNotFound();

    const entryKey = `${catId}:${id}`;
    const isFav = Favorites.has(catId, id);
    const canFav = Auth.isLv('LV.2');

    // 顶部机密印章（高危显示 TOP SECRET，其他显示 CONFIDENTIAL 等）
    let stampText = 'CONFIDENTIAL';
    if (e.class === 'keter' || e.class === 'apollyon') stampText = 'TOP SECRET';
    else if (e.class === 'euclid') stampText = 'RESTRICTED';
    else if (e.class === 'thaumiel') stampText = 'THAUMIEL-CLASS';

    // 构造 meta
    const metaRows = [];
    metaRows.push({ k: '档案编号', v: `<span class="meta-v">${escapeHtml(e.id)}</span>` });
    if (e.code) metaRows.push({ k: '档案代号', v: escapeHtml(e.code) });
    if (catId === 'anomalies' || catId === 'organizations') {
      metaRows.push({ k: '危险分级', v: badgeHtml(e.class || 'neutral') });
    }
    if (e.era) metaRows.push({ k: '所属纪元', v: escapeHtml(e.era) });
    if (e.org) metaRows.push({ k: '所属组织', v: escapeHtml(e.org) });
    if (e.tags && e.tags.length) {
      metaRows.push({ k: '关键词', v: escapeHtml(e.tags.join(' / ')) });
    }
    metaRows.push({ k: '档案分类', v: escapeHtml(cat.name) });
    metaRows.push({ k: '权限要求', v: `<span style="color:var(--red-2);font-family:var(--f-serif);font-weight:600">LV.3 以上</span>` });

    const metaHtml = metaRows.map(m => `
      <div class="meta-kv">
        <div class="meta-k">${m.k}</div>
        <div class="meta-v">${typeof m.v==='string'?m.v:escapeHtml(m.v)}</div>
      </div>
    `).join('');

    // 神祇图块 + 来源块
    const imgField = (catId === 'deities' && e.img) ? `
      <div class="detail-field">
        <div class="detail-field-label">神像图 · ICON</div>
        <div class="detail-field-content" style="text-align:center">
          <img src="${escapeAttr(resolveImgUrl(e.img))}" alt="${escapeHtml(e.title)}" onerror="this.style.display='none'">
        </div>
      </div>` : '';

    const srcField = e.source ? `
      <div class="detail-field">
        <div class="detail-field-label">来源档案 · SOURCE FILE</div>
        <div class="detail-field-content" style="font-family:var(--f-mono);font-size:12px;color:var(--text-2);word-break:break-all">
          ${escapeHtml(e.source)}
        </div>
      </div>` : '';

    // 处理正文：注入锚点 + 生成 TOC
    const rawBody = e.body || '<p>（本条目正文尚未填充）</p>';
    const { html: bodyHtml, toc } = injectTocAnchors(imgField + rawBody + srcField);

    // 阅读进度恢复
    const readRec = ReadProgress.get(catId, id);
    const readHintHtml = (readRec && readRec.scrollTop && readRec.scrollTop > 120) ? `
      <div id="read-hint" class="read-hint" style="padding:10px 16px;margin:10px 0;border:1px dashed var(--gold-2);background:var(--bg-2);font-family:var(--f-mono);font-size:11px;letter-spacing:.5px;color:var(--gold-1);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <span>${ico('clock',12)} 上次阅读至 ${readRec.offsetPct ? '约 ' + readRec.offsetPct + '%' : ''}，记录于 ${new Date(readRec.at||Date.now()).toLocaleString()}</span>
        <div style="display:flex;gap:8px;">
          <button type="button" id="read-resume" class="btn btn-mini" style="border:1px solid var(--gold-2);background:transparent;color:var(--gold-1);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">跳转继续</button>
          <button type="button" id="read-dismiss" class="btn btn-mini" style="border:1px solid var(--border);background:transparent;color:var(--text-2);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">忽略</button>
        </div>
      </div>` : '';

    // 关联推荐（基于同分类 + 共享标签，最多 5 条）
    const related = [];
    const tagSet = new Set(e.tags || []);
    const allInCat = getEntries(catId) || [];
    for (const r of allInCat) {
      if (String(r.id) === String(id)) continue;
      if (related.length >= 5) break;
      const rTags = r.tags || [];
      const share = rTags.filter(t => tagSet.has(t)).length;
      if (share > 0 || (!tagSet.size && related.length < 2)) {
        related.push({ ...r, share });
      }
    }
    related.sort((a,b) => b.share - a.share);
    const relatedHtml = related.length ? `
      <section class="related-section" style="margin-top:30px;border-top:1px solid var(--border);padding-top:20px;">
        <div class="sec-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">◆ 相关档案 · RELATED ENTRIES</div>
        <div class="entry-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">
          ${related.map(r => `
            <a class="entry-card anom-card" href="#/entry/${catId}/${encodeURIComponent(r.id)}" style="padding:10px;">
              <div class="anom-body" style="padding:0;">
                <div class="anom-idrow">
                  <span class="ec-id">${escapeHtml(r.id)}</span>
                  ${badgeHtml(r.class || 'neutral', null, r.class ? '' : (CLASS_NAMES[r.class]||''))}
                </div>
                <div class="ec-title" style="font-size:14px;">${escapeHtml(r.title)}</div>
                <div class="ec-summary" style="font-size:11px;margin-top:4px;opacity:.75;">${escapeHtml((r.summary||'').slice(0,80)||'—')}</div>
                ${r.share ? `<div style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1);margin-top:4px;">共享标签 ×${r.share}</div>` : ''}
              </div>
            </a>
          `).join('')}
        </div>
      </section>
    ` : '';

    // 评论区
    const me = Auth.get();
    const isAdmin = Auth.isAdmin();
    const comments = Comments.list(catId, id);
    const commentsHtml = `
      <section class="comments-section" style="margin-top:30px;border-top:1px solid var(--border);padding-top:20px;">
        <div class="sec-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">${ico('pencil',12)} 档案批注 · COMMENTS（${comments.length}）</div>
        <form id="comment-form" style="margin-bottom:16px;display:grid;gap:8px;">
          <textarea id="comment-text" rows="3" placeholder="批注请基于档案内容，管理员可删除不当留言…" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;font-family:var(--f-serif);font-size:13px;resize:vertical;"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);letter-spacing:1px;">
              身份：${escapeHtml(me.user)} · ${me.lvl}
            </span>
            <button type="submit" class="btn btn-mini" style="border:1px solid var(--border);padding:6px 14px;font-family:var(--f-mono);font-size:10px;background:var(--bg);color:var(--text);cursor:pointer;">提交批注</button>
          </div>
        </form>
        <div id="comment-list" class="comment-list" style="display:grid;gap:10px;">
          ${comments.length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;border:1px dashed var(--border);">${ico('pencil',12)} 尚未有批注，成为第一个批注者</div>`
            : comments.map(c => `
              <div class="comment-card" data-cid="${escapeAttr(c.id)}" style="border:1px solid var(--border);padding:10px 12px;background:var(--bg-2);">
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
                  <div style="font-family:var(--f-mono);font-size:11px;">
                    <span style="font-weight:600;">${escapeHtml(c.author)}</span>
                    <span style="opacity:.5;margin:0 6px;">·</span>
                    <span style="color:var(--gold-1);">${c.authorLevel || ''}</span>
                    ${c.author === 'admin' || c.role === 'admin' ? `<span style="opacity:.5;margin:0 6px;">·</span><span style="color:var(--red-2);">管理员</span>` : ''}
                  </div>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <span style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);">${new Date(c.at).toLocaleString()}</span>
                    ${isAdmin ? `<button type="button" class="btn btn-mini comment-del" data-cid="${escapeAttr(c.id)}" style="border:1px solid var(--red-1);background:transparent;color:var(--red-1);padding:2px 8px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">删除</button>` : ''}
                  </div>
                </div>
                <div style="white-space:pre-wrap;word-break:break-word;font-family:var(--f-serif);font-size:13px;line-height:1.8;">${escapeHtml(c.text)}</div>
              </div>
            `).join('')}
        </div>
      </section>
    `;

    view.innerHTML = `
      <div class="detail-wrap">
        <a class="back-link" href="#/${catId}">← 返回 ${escapeHtml(cat.name)} / ALL RECORDS</a>

        <article class="detail-card">
          <div class="detail-watermark" aria-hidden="true">${stampText}</div>
          <div class="detail-stamp">
            <div class="detail-stamp-inner">
              <img src="data/logo-mark.png" alt="" onerror="(function(el){var n='data/logo-mark.jpg,x.jpg,首页 HERO 巨幕背景.png,logo.png,logo.jpg'.split(','),i=0,fb=el.nextElementSibling;function t(){if(i>=n.length){el.style.display='none';if(fb)fb.style.display='grid';return;}var p=n[i++],im=new Image();im.onload=function(){el.src=p;};im.onerror=t;im.src=p;}})(this)">
              <span class="ds-fb" style="display:none">⬢</span>
              <div class="ds-ring outer"></div>
              <div class="ds-ring inner"></div>
            </div>
            <div class="detail-stamp-label">${stampText}</div>
          </div>

          <div class="detail-head">
            <div class="detail-id-row">
              <span>${cat.code}</span>
              <span class="sep"></span>
              <span>${escapeHtml(e.id)}</span>
              ${e.class ? `<span class="sep"></span><span>${CLASS_NAMES[e.class]||e.class}</span>` : ''}
              <span class="sep"></span>
              <button type="button" id="fav-btn" class="btn btn-mini fav-btn" ${canFav?'':'disabled title="LV.2 以上可收藏"'} style="border:1px solid var(--${isFav?'gold-1':'border'});background:${isFav?'var(--gold-1)':'transparent'};color:${isFav?'#000':'var(--text-2)'};padding:3px 10px;cursor:${canFav?'pointer':'not-allowed'};font-family:var(--f-mono);font-size:10px;">
                ${isFav? ico('starFill',14)+' 已收藏' : ico('starOutline',14)+' 收藏'}
              </button>
            </div>
            <h1 class="detail-title">
              ${escapeHtml(e.title)}
              <small>${escapeHtml(e.summary || '—')}</small>
            </h1>
            <div class="detail-meta">${metaHtml}</div>
          </div>

          <div class="detail-reader-bar">
            <span class="drb-label">阅读字号</span>
            <button type="button" class="drb-btn" data-fs="13" title="小">A-</button>
            <button type="button" class="drb-btn active" data-fs="15" title="默认">A</button>
            <button type="button" class="drb-btn" data-fs="17" title="大">A+</button>
            <button type="button" class="drb-btn" data-fs="20" title="特大">A++</button>
            <span class="drb-sep"></span>
            <button type="button" class="drb-btn drb-top" title="回到顶部">↑ 顶部</button>
          </div>

          ${readHintHtml}

          <div style="display:grid;grid-template-columns:${toc && toc.length>1 ? 'minmax(0,1fr) 220px' : '1fr'};gap:24px;align-items:flex-start;">
            <div class="detail-body" id="detail-body">${bodyHtml}</div>
            ${toc && toc.length>1 ? `
              <nav id="toc-nav" class="toc-nav" aria-label="章节目录" style="position:sticky;top:76px;border-left:1px solid var(--border);padding:6px 0 6px 14px;font-family:var(--f-mono);font-size:11px;line-height:1.9;">
                <div style="letter-spacing:2px;color:var(--text-2);margin-bottom:6px;">◆ 目录</div>
                ${toc.map(t => `<a class="toc-link" href="#${t.id}" style="display:block;color:var(--text-2);text-decoration:none;padding:2px 0;padding-left:${(Math.max(t.level,2)-2)*12}px;border-left:2px solid transparent;margin-left:-15px;padding-left:${(Math.max(t.level,2)-2)*12+13}px;">${escapeHtml(t.text)}</a>`).join('')}
              </nav>
            ` : ''}
          </div>

          <div class="detail-source">
            <div>来源路径<strong>${escapeHtml(e.source||'—')}</strong></div>
            <div>归档于<strong>${DATA.meta.updated || '—'}</strong> / 世界观察档案库</div>
          </div>
        </article>
        ${relatedHtml}
        ${commentsHtml}
      </div>
    `;

    // 详情页字号控制 + 阅读进度 + TOC 高亮
    const readerBar = view.querySelector('.detail-reader-bar');
    const detailBody = document.getElementById('detail-body');
    if (readerBar && detailBody) {
      const savedFs = localStorage.getItem('detail-font-size');
      if (savedFs) {
        detailBody.style.fontSize = `${savedFs}px`;
        detailBody.style.lineHeight = (1.9 + (parseInt(savedFs) - 15) * 0.03).toFixed(2);
        readerBar.querySelectorAll('.drb-btn[data-fs]').forEach(b => {
          b.classList.toggle('active', b.dataset.fs === savedFs);
        });
      }
      readerBar.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.drb-btn');
        if (!btn) return;
        if (btn.classList.contains('drb-top')) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const fs = btn.dataset.fs;
        if (!fs) return;
        detailBody.style.fontSize = `${fs}px`;
        detailBody.style.lineHeight = (1.9 + (parseInt(fs) - 15) * 0.03).toFixed(2);
        localStorage.setItem('detail-font-size', fs);
        readerBar.querySelectorAll('.drb-btn[data-fs]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
      });
    }

    // 阅读进度保存（debounce）+ 顶部进度条
    let rpT = null;
    let rpObserver = null;
    let progBar = document.getElementById('reading-progress');
    if (!progBar) {
      progBar = document.createElement('div');
      progBar.id = 'reading-progress';
      document.body.appendChild(progBar);
    }
    const saveProgress = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const top = Math.max(0, window.scrollY);
      const percent = Math.round((top / total) * 100);
      ReadProgress.save(catId, id, top, percent);
    };
    const updateProgressBar = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const top = Math.max(0, window.scrollY);
      const pct = Math.min(100, (top / total) * 100);
      progBar.style.width = pct + '%';
    };
    updateProgressBar();
    window.addEventListener('scroll', () => {
      if (!location.hash.startsWith(`#/entry/${catId}/${encodeURIComponent(id)}`)) return;
      updateProgressBar();
      clearTimeout(rpT);
      rpT = setTimeout(saveProgress, 400);
    }, { passive: true });

    // 阅读恢复按钮
    const rres = document.getElementById('read-resume');
    const rdismiss = document.getElementById('read-dismiss');
    if (rres) rres.addEventListener('click', () => {
      window.scrollTo({ top: readRec.scrollTop || 0, behavior: 'smooth' });
      const rh = document.getElementById('read-hint'); if (rh) rh.remove();
    });
    if (rdismiss) rdismiss.addEventListener('click', () => {
      const rh = document.getElementById('read-hint'); if (rh) rh.remove();
    });

    // TOC 平滑滚动 + IntersectionObserver 高亮
    const tocLinks = document.querySelectorAll('#toc-nav .toc-link');
    if (tocLinks.length) {
      tocLinks.forEach(a => {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const id = a.getAttribute('href').slice(1);
          const tgt = document.getElementById(id);
          if (tgt) {
            const y = tgt.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top: y, behavior: 'smooth' });
            history.replaceState(null, '', location.pathname + location.hash.split('#')[0] + '#' + id);
          }
        });
      });
      if ('IntersectionObserver' in window) {
        const idMap = new Map();
        tocLinks.forEach(a => {
          const id = a.getAttribute('href').slice(1);
          const t = document.getElementById(id);
          if (t) idMap.set(id, a);
        });
        if (idMap.size) {
          rpObserver = new IntersectionObserver((entries) => {
            entries.forEach(ent => {
              const a = idMap.get(ent.target.id);
              if (!a) return;
              if (ent.isIntersecting) {
                tocLinks.forEach(x => { x.classList.remove('active'); x.style.borderLeftColor = 'transparent'; x.style.color = 'var(--text-2)'; });
                a.classList.add('active');
                a.style.borderLeftColor = 'var(--gold-1)';
                a.style.color = 'var(--gold-1)';
              }
            });
          }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
          idMap.forEach((a, id) => {
            const t = document.getElementById(id);
            if (t) rpObserver.observe(t);
          });
        }
      }
    }

    // 收藏按钮
    const favBtn = document.getElementById('fav-btn');
    if (favBtn && canFav) {
      favBtn.addEventListener('click', () => {
        if (Favorites.has(catId, id)) {
          Favorites.toggle(catId, id);
          favBtn.innerHTML = ico('starOutline',14)+' 收藏';
          favBtn.style.borderColor = 'var(--border)';
          favBtn.style.background = 'transparent';
          favBtn.style.color = 'var(--text-2)';
          SFX.unfavor();
        } else {
          Favorites.toggle(catId, id, e);
          favBtn.innerHTML = ico('starFill',14)+' 已收藏';
          favBtn.style.borderColor = 'var(--gold-2)';
          favBtn.style.background = 'rgba(212,175,55,0.08)';
          favBtn.style.color = 'var(--gold-1)';
          SFX.favor();
        }
      });
    }

    // 评论提交
    const cf = document.getElementById('comment-form');
    if (cf) {
      cf.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const tx = document.getElementById('comment-text');
        const text = (tx ? tx.value : '').trim();
        if (!text) return;
        Comments.add(catId, id, text);
        renderEntry(catId, id);
      });
    }
    // 评论删除
    document.querySelectorAll('.comment-del').forEach(b => {
      b.addEventListener('click', () => {
        const cid = b.dataset.cid;
        if (!cid) return;
        if (!confirm(`确认删除该批注？`)) return;
        Comments.remove(catId, id, cid);
        renderEntry(catId, id);
      });
    });
  }

  // ============ 搜索结果 ============
  function snippet(bodyText, kw, len = 160) {
    if (!kw) return (bodyText || '').slice(0, len);
    const t = bodyText || '';
    const i = t.toLowerCase().indexOf(kw.toLowerCase());
    if (i < 0) return t.slice(0, len);
    const s = Math.max(0, i - 40);
    return (s ? '…' : '') + t.slice(s, s + len) + (s + len < t.length ? '…' : '');
  }
  function renderSearch(q) {
    const kw = q.trim();
    if (!kw) {
      view.innerHTML = `
        <div class="list-header">
          <div class="list-title">检索中心<span class="list-title-en">SEARCH CENTER</span></div>
          <p class="list-sub">在顶部搜索框输入关键词，将在全部档案中检索编号、代号、标题、标签与正文片段。</p>
        </div>
        <div class="empty-state">
          <div class="es-icon">◐</div>
          <div class="es-title">请输入检索关键词</div>
          <div class="es-desc">支持档案编号 / 代号 / 标题 / 标签 / 正文片段（按 <kbd style="border:1px solid var(--border);padding:0 6px;border-radius:2px;background:var(--bg-2);">/</kbd> 聚焦搜索框）</div>
        </div>`;
      return;
    }

    // 多关键词 AND
    const kwds = kw.split(/\s+/).filter(Boolean);
    const results = allEntries().filter(e => {
      const h = [e.id, e.code, e.title, e.summary, e.body, (e.tags||[]).join(' '), e.org, e.era]
        .filter(Boolean).join(' ').toLowerCase();
      return kwds.every(k => h.includes(k.toLowerCase()));
    }).map(e => ({ ...e, _catLabel: CAT_MAP[e._cat].name, _catIcon: CAT_MAP[e._cat].icon }));

    // 高亮用主关键词（第一个）
    const firstKw = kwds[0] || '';
    const cards = results.map(e => {
      const plain = ((e.body||'')+(e.summary||'')).replace(/<[^>]+>/g,'');
      const sn = snippet(plain, firstKw, 180);
      return `
      <a class="entry-card" href="#/entry/${e._cat}/${encodeURIComponent(e.id)}">
        <div class="entry-card-head">
          <span class="ec-id">${highlightKeyword(e.id, firstKw)}</span>
          ${e.class ? badgeHtml(e.class) : `<span class="ec-badge ${e._cat}">${escapeHtml(e._catLabel)}</span>`}
        </div>
        <div class="entry-card-body">
          <div class="ec-title">${highlightKeyword(e.title, firstKw)}</div>
          <div class="ec-code">${highlightKeyword(e.code||'—', firstKw)} · ${e._catIcon} ${escapeHtml(e._catLabel)}</div>
          <div class="ec-summary">${highlightKeyword(sn || (e.summary||e.title||'').slice(0,140), firstKw)}</div>
        </div>
        <div class="entry-card-foot">
          <span class="ec-tags">
            ${(e.tags||[]).slice(0,3).map(t => `<span class="ec-tag">${highlightKeyword(t, firstKw)}</span>`).join('')}
          </span>
          <span>VIEW →</span>
        </div>
      </a>`;
    }).join('');

    view.innerHTML = `
      <div class="list-header">
        <div class="list-title">检索结果<span class="list-title-en">SEARCH RESULTS</span></div>
        <p class="list-sub">关键词匹配 <q style="color:var(--gold-2)">${escapeHtml(kw)}</q> 在全部 5 个分类中的结果（支持空格分隔多词 AND）。</p>
      </div>
      <div class="search-summary">找到 <strong>${results.length}</strong> 条相关档案，关键词 <q>${escapeHtml(kw)}</q></div>
      ${results.length === 0
        ? `<div class="empty-state">
             <div class="es-icon">∅</div>
             <div class="es-title">未找到匹配档案</div>
             <div class="es-desc">建议检查关键词或使用更宽泛的检索词</div>
             <div class="popular-tags">
               <div class="popular-tags-title">热门标签 · 试试这些</div>
               <div class="pt-cloud">
                 ${getPopularTags(12).map(({tag, n}) => `
                   <a class="pt-tag" href="#/search?q=${encodeURIComponent(tag)}">${escapeHtml(tag)}<span class="pt-count">${n}</span></a>
                 `).join('') || '<span style="color:var(--text-4);font-size:11px;">暂无标签数据</span>'}
               </div>
             </div>
           </div>`
        : `<div class="entry-grid">${cards}</div>`}
    `;
  }

  // ============ 思维导图 ============
  let MM = null;  // mindmap runtime
  function renderMindMap() {
    const catColors = {
      anomalies:    { fill:'#c0392b', glow:'rgba(192,57,43,0.55)', label:'异常' },
      organizations:{ fill:'#e8e8e8', glow:'rgba(232,232,232,0.55)', label:'组织' },
      deities:      { fill:'#c8c8c8', glow:'rgba(200,200,200,0.55)', label:'神祇' },
      eras:         { fill:'#8a8a8a', glow:'rgba(138,138,138,0.55)', label:'纪元' },
      timelines:    { fill:'#dcdcdc', glow:'rgba(220,220,220,0.55)', label:'时间线' }
    };

    // 节点：每个分类 1 个中心锚点 + 若干档案节点
    const nodes = [];
    const edges = [];
    const center = { id:'C', label:'世界观中心', cat:'hub', r:26, x:0, y:0, vx:0, vy:0, pinned:true };
    nodes.push(center);

    for (const cat of DATA.categories) {
      const list = getEntries(cat.id);
      const catNode = {
        id:'CAT-'+cat.id, label:cat.name, cat:'cat-'+cat.id, r:20,
        x:0, y:0, vx:0, vy:0, pinned:false, _isCat:true, _catId:cat.id
      };
      nodes.push(catNode);
      edges.push({ a:center, b:catNode, kind:'hub', color:'rgba(255,255,255,0.45)' });
      // 档案节点（每个分类最多取前 25 条，避免过密）
      const sub = list.slice(0, 25);
      for (const e of sub) {
        const n = {
          id: cat.id + ':' + e.id,
          label: e.title,
          cat: cat.id,
          r: Math.max(6, Math.min(14, 8 + (e.tags||[]).length * 0.8)),
          x: 0, y: 0, vx: 0, vy: 0,
          _link: `#/entry/${cat.id}/${encodeURIComponent(e.id)}`,
          _class: e.class
        };
        nodes.push(n);
        edges.push({ a:catNode, b:n, kind:'leaf', color: (catColors[cat.id]?.glow || 'rgba(255,255,255,0.3)') });
        // 基于 tags 随机建立同分类内 1-2 条互联，显得稠密
        if (Math.random() < 0.18 && sub.length > 2) {
          const other = sub[Math.floor(Math.random()*sub.length)];
          if (other && other.id !== e.id) {
            const oid = cat.id + ':' + other.id;
            const on = nodes.find(x => x.id === oid);
            if (on) edges.push({ a:n, b:on, kind:'peer', color:'rgba(255,255,255,0.12)' });
          }
        }
      }
    }

    // 构造图例 HTML
    const legendItems = Object.entries(catColors).map(([k,v]) => {
      const n = CAT_MAP[k]?.name || k;
      const cnt = (getEntries(k) || []).length;
      return `<label class="mm-leg-item">
        <span class="mm-leg-dot" style="background:${v.fill};box-shadow:0 0 10px ${v.glow}"></span>
        <span class="mm-leg-name">${n}</span>
        <span class="mm-leg-cnt">${cnt}</span>
      </label>`;
    }).join('');

    view.innerHTML = `
      <div class="mm-wrap">
        <div class="mm-head">
          <div>
            <div class="mm-title">关系图谱 · MIND MAP</div>
            <div class="mm-sub">节点共计 <strong>${nodes.length}</strong> · 连线 <strong>${edges.length}</strong> · 鼠标滚轮缩放，拖拽画布平移，拖拽节点固定位置，双击节点打开档案</div>
          </div>
          <div class="mm-controls">
            <button class="mm-btn" id="mm-reset">${ico('clock',12)} 重置视图</button>
            <button class="mm-btn" id="mm-freeze">${ico('eye',12)} 释放固定</button>
          </div>
        </div>
        <div class="mm-stage">
          <canvas id="mm-canvas"></canvas>
          <div class="mm-hud tl">
            <div>WORLDVIEW ARCHIVE · REL-GRAPH v2</div>
            <div id="mm-hud-pos">POS 0.00 , 0.00 · SCALE 1.00</div>
          </div>
          <div class="mm-hud tr">
            <div>身份 <span id="mm-hud-user">—</span></div>
            <div>节点 <span id="mm-hud-hover">无</span></div>
          </div>
          <div class="mm-hud bl">
            <div class="mm-hud-title">图例 · LEGEND</div>
            ${legendItems}
          </div>
          <div class="mm-hud br">
            <div>滚轮缩放 · 拖动画布</div>
            <div>拖拽节点 · 双击打开档案</div>
            <div class="mm-hud-tip">提示：输入账号 <strong>lock</strong> 可看失败动画</div>
          </div>
        </div>
      </div>
    `;

    // HUD 用户
    const u = document.getElementById('mm-hud-user'); if (u) u.textContent = Auth.identity();

    // 初始化画布
    const canvas = document.getElementById('mm-canvas');
    const ctx = canvas.getContext('2d');
    MM = { canvas, ctx, nodes, edges, catColors,
      cx: 0, cy: 0, scale: 1,
      w: 0, h: 0, dpr: window.devicePixelRatio || 1,
      drag: null, hover: null, raf: 0
    };
    const m = MM;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width  = rect.width  * m.dpr;
      canvas.height = rect.height * m.dpr;
      canvas.style.width  = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      m.w = rect.width; m.h = rect.height;
      // 初始中心
      if (m.cx === 0 && m.cy === 0) { m.cx = m.w/2; m.cy = m.h/2; }
    };
    resize();
    window.addEventListener('resize', resize);

    // 初始散布节点到圆周
    let i = 1;  // 跳过中心
    const catNodes = nodes.filter(n => n._isCat);
    catNodes.forEach((n, idx) => {
      const t = (idx / catNodes.length) * Math.PI * 2;
      n.x = Math.cos(t) * 220;
      n.y = Math.sin(t) * 220;
    });
    for (const n of nodes) {
      if (!n._isCat && n.id !== 'C') {
        // 放到所属分类节点附近
        const catNode = nodes.find(x => x._isCat && x._catId === n.cat);
        const base = catNode ? [catNode.x, catNode.y] : [0,0];
        const t = Math.random()*Math.PI*2;
        const r = 70 + Math.random()*130;
        n.x = base[0] + Math.cos(t)*r;
        n.y = base[1] + Math.sin(t)*r;
      }
    }

    // 屏幕坐标 <-> 世界坐标
    const toWorld = (sx, sy) => ({ x: (sx - m.cx)/m.scale, y: (sy - m.cy)/m.scale });
    const toScreen = (wx, wy) => ({ x: wx*m.scale + m.cx, y: wy*m.scale + m.cy });

    function hit(x, y) {
      for (let i = nodes.length-1; i >= 0; i--) {
        const n = nodes[i];
        const dx = n.x - x, dy = n.y - y;
        if (dx*dx + dy*dy <= (n.r+2)*(n.r+2)) return n;
      }
      return null;
    }

    // 事件
    const rect = () => canvas.getBoundingClientRect();
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const old = m.scale;
      const k = Math.exp(-e.deltaY * 0.001);
      m.scale = Math.max(0.25, Math.min(4, m.scale * k));
      // 以鼠标为中心缩放
      const s = rect();
      const mx = e.clientX - s.left, my = e.clientY - s.top;
      const w = toWorld(mx, my);
      m.scale = old * k;
      m.scale = Math.max(0.25, Math.min(4, m.scale));
      const after = toScreen(w.x, w.y);
      m.cx += mx - after.x; m.cy += my - after.y;
    }, { passive:false });

    let pan = null;
    canvas.addEventListener('mousedown', e => {
      const s = rect();
      const sx = e.clientX - s.left, sy = e.clientY - s.top;
      const w = toWorld(sx, sy);
      const n = hit(w.x, w.y);
      if (n) {
        m.drag = { n, ox: w.x - n.x, oy: w.y - n.y, moved:false };
        n.pinned = true;
      } else {
        pan = { x: sx, y: sy, ocx: m.cx, ocy: m.cy, moved:false };
      }
    });
    window.addEventListener('mousemove', e => {
      const s = rect();
      const sx = e.clientX - s.left, sy = e.clientY - s.top;
      const w = toWorld(sx, sy);
      if (m.drag) {
        const n = m.drag.n;
        n.x = w.x - m.drag.ox; n.y = w.y - m.drag.oy;
        m.drag.moved = true;
      } else if (pan) {
        m.cx = pan.ocx + (sx - pan.x); m.cy = pan.ocy + (sy - pan.y);
        pan.moved = true;
      } else {
        m.hover = hit(w.x, w.y);
      }
      // HUD 坐标
      const hp = document.getElementById('mm-hud-pos');
      if (hp) hp.textContent = `POS ${w.x.toFixed(0)} , ${w.y.toFixed(0)} · SCALE ${m.scale.toFixed(2)}`;
      const hh = document.getElementById('mm-hud-hover');
      if (hh) hh.textContent = m.hover ? (m.hover.label || m.hover.id) : '无';
    });
    window.addEventListener('mouseup', () => {
      if (m.drag && !m.drag.moved) {
        // 点击未移动 => 取消固定（如果用户未拖）
      }
      m.drag = null; pan = null;
    });
    canvas.addEventListener('dblclick', e => {
      const s = rect();
      const sx = e.clientX - s.left, sy = e.clientY - s.top;
      const w = toWorld(sx, sy);
      const n = hit(w.x, w.y);
      if (n && n._link) location.hash = n._link;
    });

    document.getElementById('mm-reset').addEventListener('click', () => {
      m.cx = m.w/2; m.cy = m.h/2; m.scale = 1;
    });
    document.getElementById('mm-freeze').addEventListener('click', () => {
      for (const n of nodes) if (n.id !== 'C' && !n._isCat) n.pinned = false;
    });

    // 力导向模拟 + 渲染
    const step = () => {
      // 1. 节点间斥力
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i+1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx*dx + dy*dy;
          if (d2 < 0.01) { dx = Math.random()-0.5; dy = Math.random()-0.5; d2 = dx*dx+dy*dy; }
          const d = Math.sqrt(d2);
          const force = 6000 / d2;
          const fx = dx/d * force, fy = dy/d * force;
          if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
          if (!b.pinned) { b.vx += fx; b.vy += fy; }
        }
      }
      // 2. 连线弹簧力
      for (const e of edges) {
        const target = e.kind === 'hub' ? 160 : (e.kind === 'leaf' ? 70 : 120);
        const k = e.kind === 'peer' ? 0.01 : 0.06;
        let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
        const d = Math.sqrt(dx*dx+dy*dy) || 0.01;
        const diff = d - target;
        const fx = dx/d * diff * k, fy = dy/d * diff * k;
        if (!e.a.pinned) { e.a.vx += fx; e.a.vy += fy; }
        if (!e.b.pinned) { e.b.vx -= fx; e.b.vy -= fy; }
      }
      // 3. 中心轻微吸引
      for (const n of nodes) {
        if (n.pinned || n.id === 'C') continue;
        n.vx -= n.x * 0.0008;
        n.vy -= n.y * 0.0008;
      }
      // 4. 阻尼 + 应用
      for (const n of nodes) {
        if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.86; n.vy *= 0.86;
        n.x += n.vx; n.y += n.vy;
      }
      draw();
      m.raf = requestAnimationFrame(step);
    };

    function draw() {
      const c = canvas;
      const ctx2 = ctx;
      ctx2.save();
      ctx2.setTransform(m.dpr,0,0,m.dpr,0,0);
      ctx2.clearRect(0,0,m.w,m.h);
      // 背景网格
      drawGrid(ctx2, m);
      // 世界变换
      ctx2.translate(m.cx, m.cy);
      ctx2.scale(m.scale, m.scale);
      // 边
      for (const e of edges) {
        if (e.kind === 'peer') {
          ctx2.strokeStyle = e.color;
          ctx2.setLineDash([3, 6]);
          ctx2.lineWidth = 0.8 / m.scale;
        } else {
          ctx2.strokeStyle = e.color;
          ctx2.setLineDash([]);
          ctx2.lineWidth = (e.kind === 'hub' ? 1.4 : 0.9) / m.scale;
        }
        ctx2.beginPath();
        ctx2.moveTo(e.a.x, e.a.y); ctx2.lineTo(e.b.x, e.b.y);
        ctx2.stroke();
      }
      ctx2.setLineDash([]);
      // 节点
      for (const n of nodes) {
        let col;
        if (n.id === 'C') col = { fill:'#0a0a0a', glow:'rgba(255,255,255,0.85)', stroke:'#f2f2f2' };
        else if (n._isCat) {
          const c = catColors[n._catId];
          col = { fill:'#0a0a0a', glow: c?.glow || 'rgba(255,255,255,0.6)', stroke: c?.fill || '#e8e8e8' };
        } else {
          const c = catColors[n.cat];
          col = { fill: c?.fill || '#e8e8e8', glow: c?.glow || 'rgba(232,232,232,0.55)', stroke:'rgba(0,0,0,0.4)' };
        }
        const hov = (m.hover === n) || (m.drag && m.drag.n === n);
        const rr = hov ? n.r * 1.35 : n.r;
        // 外发光
        const g = ctx2.createRadialGradient(n.x, n.y, n.r*0.3, n.x, n.y, rr*3);
        g.addColorStop(0, col.glow);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx2.fillStyle = g;
        ctx2.beginPath(); ctx2.arc(n.x, n.y, rr*3, 0, Math.PI*2); ctx2.fill();
        // 圆
        ctx2.fillStyle = col.fill;
        ctx2.strokeStyle = col.stroke;
        ctx2.lineWidth = (n._isCat || n.id==='C' ? 2 : 1) / m.scale;
        ctx2.beginPath(); ctx2.arc(n.x, n.y, rr, 0, Math.PI*2); ctx2.fill(); ctx2.stroke();
        // 中心十字装饰（hub/分类节点）
        if (n._isCat || n.id === 'C') {
          ctx2.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx2.lineWidth = 1 / m.scale;
          ctx2.beginPath();
          ctx2.moveTo(n.x - rr*0.55, n.y); ctx2.lineTo(n.x + rr*0.55, n.y);
          ctx2.moveTo(n.x, n.y - rr*0.55); ctx2.lineTo(n.x, n.y + rr*0.55);
          ctx2.stroke();
        }
        // 标签
        if (n._isCat || n.id === 'C' || hov || m.scale > 1.1) {
          ctx2.fillStyle = m.scale > 0.8 ? 'rgba(238,225,196,0.95)' : 'rgba(238,225,196,0.65)';
          ctx2.font = `${n._isCat || n.id==='C' ? 700 : 500} ${Math.max(8, (hov ? 13 : 11) / Math.max(0.6, m.scale))}px "Noto Serif SC", "Noto Serif", serif`;
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'top';
          ctx2.shadowColor = 'rgba(0,0,0,0.9)';
          ctx2.shadowBlur = 6 / m.scale;
          ctx2.fillText(n.label, n.x, n.y + rr + 4/m.scale);
          ctx2.shadowBlur = 0;
        }
      }
      ctx2.restore();
    }

    function drawGrid(ctx2, m) {
      const gs = 60; // 60px 一格（世界坐标）
      // 以 scale 决定细/粗线
      ctx2.strokeStyle = 'rgba(232,232,232,0.06)';
      ctx2.lineWidth = 1;
      const ox = ((m.cx % (gs*m.scale)) + gs*m.scale*10) % (gs*m.scale) - gs*m.scale;
      const oy = ((m.cy % (gs*m.scale)) + gs*m.scale*10) % (gs*m.scale) - gs*m.scale;
      ctx2.beginPath();
      for (let x = ox; x < m.w; x += gs*m.scale) { ctx2.moveTo(x,0); ctx2.lineTo(x,m.h); }
      for (let y = oy; y < m.h; y += gs*m.scale) { ctx2.moveTo(0,y); ctx2.lineTo(m.w,y); }
      ctx2.stroke();
      // 粗网格 5×5
      ctx2.strokeStyle = 'rgba(232,232,232,0.14)';
      ctx2.beginPath();
      const gs5 = gs*5*m.scale;
      const ox5 = ((m.cx % gs5) + gs5*10) % gs5 - gs5;
      const oy5 = ((m.cy % gs5) + gs5*10) % gs5 - gs5;
      for (let x = ox5; x < m.w; x += gs5) { ctx2.moveTo(x,0); ctx2.lineTo(x,m.h); }
      for (let y = oy5; y < m.h; y += gs5) { ctx2.moveTo(0,y); ctx2.lineTo(m.w,y); }
      ctx2.stroke();
      // 十字中心准星
      ctx2.strokeStyle = 'rgba(138,35,35,0.35)';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(m.cx, 0); ctx2.lineTo(m.cx, m.h);
      ctx2.moveTo(0, m.cy); ctx2.lineTo(m.w, m.cy);
      ctx2.stroke();
    }

    step();
  }

  // ============ 投稿页面 ============
  function renderSubmit() {
    // 权限检查：游客 LV.1 不可投稿
    if (!Auth.canSubmit()) {
      view.innerHTML = `
        <div class="submit-locked">
          <div class="submit-locked-icon">🔒</div>
          <h2>权限不足 · CLEARANCE DENIED</h2>
          <p>当前身份：<strong>${Auth.identity()}</strong></p>
          <p>投稿设定需要 <strong>LV.2</strong> 以上权限。</p>
          <p>游客仅可浏览档案，请<a href="javascript:void(0)" id="goto-login" class="submit-link">登录或注册</a>后投稿。</p>
        </div>
      `;
      const link = document.getElementById('goto-login');
      if (link) link.addEventListener('click', () => {
        Auth.clear();
        refreshIdentity();
        showLoginGate();
      });
      return;
    }

    const subs = Submissions.get();
    function statusBadgeHtml(st) {
      if (st === 'approved') return '<span class="sb-status sb-status-ok">已发布</span>';
      if (st === 'rejected') return '<span class="sb-status sb-status-no">已退回</span>';
      return '<span class="sb-status sb-status-pend">待审核</span>';
    }
    const subsHtml = subs.length === 0
      ? '<div class="submit-empty">暂无投稿记录</div>'
      : subs.map(s => {
          const done = (s.status === 'approved' || s.status === 'rejected');
          return `
        <div class="submit-item">
          <div class="submit-item-head">
            <span class="submit-item-id">${s.id}</span>
            <span class="submit-item-cat">${CAT_MAP[s.category]?.name || s.category}</span>
            ${statusBadgeHtml(s.status)}
            <span class="submit-item-date">${new Date(s.at).toLocaleString('zh-CN')}</span>
            ${done ? `<button type="button" class="submit-item-del" title="删除此记录" data-del-id="${escapeAttr(s.id)}">🗑 删除记录</button>` : ''}
          </div>
          <div class="submit-item-title">${escapeHtml(s.title)}</div>
          <div class="submit-item-summary">${escapeHtml(s.summary || '')}</div>
          <div class="submit-item-author">投稿人：${escapeHtml(s.author || '')}${s.reviewNote ? ` · 备注：${escapeHtml(s.reviewNote)}` : ''}</div>
        </div>
      `;}).join('');

    const catOpts = DATA.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const classOpts = Object.entries(CLASS_NAMES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

    // 审核状态通知（带关闭按钮 + 关闭状态持久化）
    const allDismissed = (() => {
      try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]')); } catch { return new Set(); }
    })();
    const notices = subs.filter(s => (s.status === 'approved' || s.status === 'rejected') && !allDismissed.has(s.id));
    const saveDismissed = (set) => {
      localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(Array.from(set)));
    };
    const noticeHtml = notices.length ? `
      <div class="submit-notice-head">
        <span class="submit-notice-head-label">审核通知 · ${notices.length} 条</span>
        <button type="button" class="submit-notice-clear-all" id="notice-clear-all">全部已读</button>
      </div>
      ${notices.map(s => `
        <div class="submit-notice notice-${s.status}" data-sub-id="${escapeAttr(s.id)}">
          <div class="submit-notice-icon">${s.status === 'approved' ? ico('check',16) : ico('cross',16)}</div>
          <div class="submit-notice-body">
            <div class="submit-notice-title">${s.status === 'approved' ? '投稿已通过审核' : '投稿已被退回'}</div>
            <div class="submit-notice-meta">${escapeHtml(s.id)} · ${escapeHtml(CAT_MAP[s.category]?.name || s.category)} · ${new Date(s.at).toLocaleString('zh-CN')}</div>
            ${s.reviewNote ? `<div class="submit-notice-note">管理员备注：${escapeHtml(s.reviewNote)}</div>` : ''}
          </div>
          <button type="button" class="submit-notice-close" title="关闭" data-close-id="${escapeAttr(s.id)}">${ico('cross',12)}</button>
        </div>
      `).join('')}
    ` : '';

    view.innerHTML = `
      <div class="submit-wrap">
        <div class="submit-head">
          <div class="submit-title-block">
            <h2 class="submit-h2">投稿设定 · SUBMIT ENTRY</h2>
            <p class="submit-sub">当前身份 <strong>${Auth.identity()}</strong> · LV.2 投稿权限已激活 · 稿件进入 <span class="sb-pending-badge">待审核</span> 队列</p>
          </div>
        </div>

        ${noticeHtml}

        <form id="submit-form" class="submit-form">
          <div class="submit-grid">
            <div class="sb-field sb-field-docx">
              <span class="sb-label">上传 DOCX 文档（自动解析文字/图片 · 自动换行）</span>
              <div class="docx-uploader">
                <label class="docx-choose">
                  <input type="file" id="sb-docx" accept=".docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                  <span class="docx-choose-icon">⬆</span>
                  <span class="docx-choose-text" id="docx-choose-text">选择 Word 文档 (.docx)</span>
                </label>
                <span class="docx-parse-status" id="docx-parse-status"></span>
              </div>
              <p class="docx-hint">解析出的 <strong>标题</strong> 和 <strong>正文</strong> 会自动填入下方编辑器，DOCX 内的图片会被提取并插入正文对应位置。您可继续编辑后再提交。</p>
            </div>
            <label class="sb-field">
              <span class="sb-label">标题 · TITLE</span>
              <input type="text" id="sb-title" placeholder="档案标题" required>
            </label>
            <div class="sb-row-2">
              <label class="sb-field">
                <span class="sb-label">分类 · CATEGORY</span>
                <select id="sb-category">${catOpts}</select>
              </label>
              <label class="sb-field">
                <span class="sb-label">危险等级 · CLASS</span>
                <select id="sb-class">
                  <option value="neutral">未分级</option>
                  ${classOpts}
                </select>
              </label>
            </div>
            <label class="sb-field">
              <span class="sb-label">摘要 · SUMMARY</span>
              <input type="text" id="sb-summary" placeholder="一句话简介（选填）">
            </label>
            <div class="sb-field sb-field-cover">
              <span class="sb-label">封面/预览图 · COVER IMAGE <span class="sb-label-hint">卡片缩略图 · 选填</span></span>
              <div class="sb-cover-uploader">
                <label class="sb-cover-choose">
                  <input type="file" id="sb-cover" accept="image/*" hidden>
                  <span class="sb-cover-choose-icon">⬆</span>
                  <span class="sb-cover-choose-text" id="sb-cover-text">选择图片</span>
                </label>
                <div class="sb-cover-preview" id="sb-cover-preview">
                  <div class="sb-cover-empty">暂无封面</div>
                </div>
                <button type="button" class="sb-cover-clear" id="sb-cover-clear" style="display:none">${ico('cross',12)} 移除</button>
              </div>
              <p class="docx-hint">上传后将作为档案卡片的缩略图显示。支持 PNG / JPG / WEBP，建议正方形比例。</p>
            </div>
            <div class="sb-field sb-field-editor" id="sb-editor-wrap">
              <div class="sb-editor-head">
                <span class="sb-label">正文 · BODY <span class="sb-label-hint">所见即所得 · 工具栏排版 · 可插入图片</span></span>
                <div class="sb-editor-head-tools">
                  <span class="sb-editor-stat" id="sb-editor-stat">0 字</span>
                  <button type="button" class="sb-tool sb-tool-fs" id="sb-fullscreen" title="全屏编辑">${ico('eye',12)} 全屏</button>
                </div>
              </div>
              <div class="sb-editor-toolbar" id="sb-editor-toolbar">
                <button type="button" class="sb-tool" data-cmd="bold" title="粗体"><strong>B</strong></button>
                <button type="button" class="sb-tool" data-cmd="italic" title="斜体"><em>I</em></button>
                <button type="button" class="sb-tool" data-cmd="underline" title="下划线"><u>U</u></button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="h3" title="小标题">H3</button>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="h2" title="大标题">H2</button>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="blockquote" title="引用">❝</button>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="p" title="正文段落">¶</button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="insertUnorderedList" title="无序列表">• 列表</button>
                <button type="button" class="sb-tool" data-cmd="insertOrderedList" title="有序列表">1.列表</button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="insertHorizontalRule" title="分割线">―</button>
                <label class="sb-tool sb-tool-upload" title="插入本地图片">
                  ${ico('camera',32)}
                  <input type="file" id="sb-insert-img" accept="image/*" hidden>
                </label>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="removeFormat" title="清除格式">${ico('cross',12)}清除</button>
                <span class="sb-tool-info" id="sb-img-status"></span>
              </div>
              <div id="sb-body" class="sb-editor-area detail-body" contenteditable="true" data-placeholder="在此输入正文，或上传 DOCX 自动填入。使用上方工具栏进行排版，所见即所得。"></div>
            </div>
            <div class="sb-field sb-preview" id="sb-preview">
              <div class="sb-preview-head">
                <span class="sb-label">最终渲染 · FINAL RENDER <span class="sb-label-hint">实际展示效果</span></span>
                <div class="sb-preview-controls">
                  <button type="button" class="sb-preview-btn" id="sb-preview-toggle" title="显示/隐藏渲染预览">
                    <span class="sb-pe-text">隐藏</span>
                  </button>
                  <label class="sb-preview-ctrl">
                    <span class="sb-preview-ctrl-label">字号</span>
                    <select id="sb-font-size" class="sb-preview-select">
                      <option value="12">12</option>
                      <option value="13">13</option>
                      <option value="14">14</option>
                      <option value="15">15</option>
                      <option value="16">16</option>
                      <option value="18">18</option>
                      <option value="20">20</option>
                    </select>
                  </label>
                  <button type="button" class="sb-preview-btn" id="sb-preview-expand" title="展开/收起预览区">
                    <span class="sb-pe-text">展开</span><span class="sb-pe-icon">⤢</span>
                  </button>
                  <button type="button" class="sb-preview-btn" id="sb-preview-top" title="回到顶部">↑</button>
                </div>
              </div>
              <div class="sb-preview-scroll" id="sb-preview-scroll">
                <div class="detail-body" id="sb-preview-body">
                  <div style="color:var(--text-3);font-family:var(--f-mono);font-size:12px;letter-spacing:1px">在上方输入正文或上传 DOCX 后，此处显示最终渲染效果。</div>
                </div>
              </div>
            </div>
            <label class="sb-field">
              <span class="sb-label">标签 · TAGS（逗号分隔）</span>
              <input type="text" id="sb-tags" placeholder="例：异常, 收容, 红月">
            </label>
            <label class="sb-field">
              <span class="sb-label">来源文件 · SOURCE</span>
              <input type="text" id="sb-source" placeholder="例：红月之下/核心档案/XXX.docx（选填）">
            </label>
          </div>
          <button type="submit" class="sb-submit-btn">
            <span class="sb-btn-text">${ico('save',14)} 提交投稿 · SUBMIT</span>
          </button>
          <div class="sb-success" id="sb-success" style="display:none"></div>
          <div class="lg-error" id="sb-error" style="display:none"></div>
        </form>

        <div class="submit-history">
          <h3 class="submit-history-h3">投稿记录 · MY SUBMISSIONS (${subs.length})</h3>
          ${subsHtml}
        </div>
      </div>
    `;

    // ============ 草稿箱：恢复提示 + 自动保存 ============
    const draft = SubmitDraft.get();
    let draftHintInjected = false;
    if (draft && (draft.title || draft.body)) {
      const formEl = document.getElementById('submit-form');
      if (formEl) {
        const hint = document.createElement('div');
        hint.id = 'draft-hint';
        hint.style.cssText = 'padding:10px 16px;border:1px dashed var(--gold-2);background:var(--bg-2);font-family:var(--f-mono);font-size:11px;letter-spacing:.5px;color:var(--gold-1);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;';
        hint.innerHTML = `
          <span>${ico('save',12)} 检测到未提交的草稿（保存于 ${new Date(draft.at||Date.now()).toLocaleString()}），字数 ${(draft.body||'').replace(/<[^>]+>/g,'').length || 0} 字</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" id="draft-restore" class="btn btn-mini" style="border:1px solid var(--gold-2);background:transparent;color:var(--gold-1);padding:4px 12px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">恢复草稿</button>
            <button type="button" id="draft-discard" class="btn btn-mini" style="border:1px solid var(--border);background:transparent;color:var(--text-2);padding:4px 12px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">丢弃</button>
          </div>
        `;
        formEl.parentNode.insertBefore(hint, formEl);
        draftHintInjected = true;
      }
    }
    function collectFormDraft() {
      const titleEl = document.getElementById('sb-title');
      const catEl = document.getElementById('sb-category');
      const clsEl = document.getElementById('sb-class');
      const sumEl = document.getElementById('sb-summary');
      const tagsEl = document.getElementById('sb-tags');
      const srcEl = document.getElementById('sb-source');
      return {
        title: titleEl ? titleEl.value : '',
        category: catEl ? catEl.value : 'anomalies',
        class: clsEl ? clsEl.value : 'neutral',
        summary: sumEl ? sumEl.value : '',
        body: getBodyHTML(),
        tags: tagsEl ? tagsEl.value : '',
        source: srcEl ? srcEl.value : '',
        cover: window.__sbCoverUrl || ''
      };
    }
    let saveT = null;
    function scheduleDraftSave() {
      clearTimeout(saveT);
      saveT = setTimeout(() => { SubmitDraft.save(collectFormDraft()); }, 1200);
    }
    if (draftHintInjected) {
      document.getElementById('draft-restore').addEventListener('click', () => {
        if (!draft) return;
        if (!confirm('恢复草稿会覆盖当前表单的内容，确认恢复？')) return;
        const ti = document.getElementById('sb-title'); if (ti) ti.value = draft.title || '';
        const ci = document.getElementById('sb-category'); if (ci) ci.value = draft.category || 'anomalies';
        const cc = document.getElementById('sb-class'); if (cc) cc.value = draft.class || 'neutral';
        const sm = document.getElementById('sb-summary'); if (sm) sm.value = draft.summary || '';
        const tg = document.getElementById('sb-tags'); if (tg) tg.value = draft.tags || '';
        const sr = document.getElementById('sb-source'); if (sr) sr.value = draft.source || '';
        if (draft.cover) {
          window.__sbCoverUrl = draft.cover;
          const cp = document.getElementById('sb-cover-preview'); if (cp) cp.innerHTML = `<img src="${draft.cover}" alt="封面预览" style="width:100%;height:100%;object-fit:cover">`;
          const ct = document.getElementById('sb-cover-text'); if (ct) ct.textContent = '已恢复封面';
          const ccl = document.getElementById('sb-cover-clear'); if (ccl) ccl.style.display = '';
        }
        setBodyHTML(draft.body || '');
        syncPreview();
        const hint = document.getElementById('draft-hint'); if (hint) hint.remove();
        sbInfo('已恢复上次草稿（每 1.2 秒自动保存）');
      });
      document.getElementById('draft-discard').addEventListener('click', () => {
        if (!confirm('确认丢弃草稿？此操作不可恢复。')) return;
        SubmitDraft.clear();
        const hint = document.getElementById('draft-hint'); if (hint) hint.remove();
      });
    }

    // 正文编辑器（所见即所得）
    const bodyEditor = document.getElementById('sb-body');
    const editorStat = document.getElementById('sb-editor-stat');
    const pvEl = document.getElementById('sb-preview-body');
    const pvScroll = document.getElementById('sb-preview-scroll');
    const fontSel = document.getElementById('sb-font-size');
    const expandBtn = document.getElementById('sb-preview-expand');
    const topBtn = document.getElementById('sb-preview-top');
    const toggleBtn = document.getElementById('sb-preview-toggle');
    const fsBtn = document.getElementById('sb-fullscreen');
    const editorWrap = document.getElementById('sb-editor-wrap');

    const countChars = (html) => {
      if (!html) return 0;
      const text = String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      return text.length;
    };
    const getBodyHTML = () => bodyEditor ? bodyEditor.innerHTML.trim() : '';
    const setBodyHTML = (html) => { if (bodyEditor) bodyEditor.innerHTML = html; };

    const syncPreview = () => {
      const v = getBodyHTML();
      if (pvEl) pvEl.innerHTML = v || `<div style="color:var(--text-3);font-family:var(--f-mono);font-size:12px;letter-spacing:1px">在上方输入正文或上传 DOCX 后，此处显示最终渲染效果。</div>`;
      const chars = v ? countChars(v) : 0;
      if (editorStat) editorStat.textContent = `${chars} 字`;
    };
    // 给每个输入控件绑上 draft 自动保存
    function bindDraftSave() {
      const fields = ['sb-title', 'sb-summary', 'sb-tags', 'sb-source'];
      fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset._ds) {
          el.dataset._ds = '1';
          el.addEventListener('input', scheduleDraftSave);
          el.addEventListener('change', scheduleDraftSave);
        }
      });
      ['sb-category', 'sb-class'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset._ds) {
          el.dataset._ds = '1'; el.addEventListener('change', scheduleDraftSave);
        }
      });
    }
    bindDraftSave();
    if (bodyEditor && !bodyEditor.dataset.bound) {
      bodyEditor.dataset.bound = '1';
      bodyEditor.addEventListener('input', () => { syncPreview(); scheduleDraftSave(); });
      // 粘贴时清洗为纯文本/HTML（去除 style 脚本等危险标签）
      bodyEditor.addEventListener('paste', (e) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        if (html) {
          // 简易清洗：去掉 script/style/事件属性
          const clean = html.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
                            .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
                            .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
                            .replace(/<\/?(meta|link|o:p|st1)[^>]*>/gi, '');
          document.execCommand('insertHTML', false, clean);
        } else if (text) {
          document.execCommand('insertText', false, text);
        }
      });
    }

    // 全屏编辑
    if (fsBtn && !fsBtn.dataset.bound) {
      fsBtn.dataset.bound = '1';
      fsBtn.addEventListener('click', () => {
        const isFs = editorWrap.classList.toggle('fullscreen');
        fsBtn.innerHTML = isFs ? ico('cross',12)+' 退出全屏' : ico('eye',12)+' 全屏';
        if (isFs) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
        if (bodyEditor) bodyEditor.focus();
      });
      // ESC 退出全屏
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editorWrap.classList.contains('fullscreen')) {
          editorWrap.classList.remove('fullscreen');
          fsBtn.innerHTML = ico('eye',12)+' 全屏';
          document.body.style.overflow = '';
        }
      });
    }

    // 预览显示/隐藏切换
    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.dataset.bound = '1';
      toggleBtn.addEventListener('click', () => {
        const preview = document.getElementById('sb-preview');
        const isHidden = preview.classList.toggle('preview-hidden');
        toggleBtn.querySelector('.sb-pe-text').textContent = isHidden ? '显示' : '隐藏';
      });
    }

    // 字号控制（localStorage 持久化，同时应用于编辑器和预览）
    if (fontSel && !fontSel.dataset.bound) {
      fontSel.dataset.bound = '1';
      const savedSize = localStorage.getItem('sb-preview-font-size');
      const applyFont = (size) => {
        const lh = (1.8 + (size - 12) * 0.02).toFixed(2);
        if (pvEl) { pvEl.style.fontSize = `${size}px`; pvEl.style.lineHeight = lh; }
        if (bodyEditor) { bodyEditor.style.fontSize = `${size}px`; bodyEditor.style.lineHeight = lh; }
      };
      if (savedSize) { fontSel.value = savedSize; applyFont(savedSize); }
      else { applyFont(fontSel.value); }
      fontSel.addEventListener('change', (e) => {
        const size = e.target.value;
        applyFont(size);
        localStorage.setItem('sb-preview-font-size', size);
      });
    }

    // 展开/收起预览区
    if (expandBtn && !expandBtn.dataset.bound) {
      expandBtn.dataset.bound = '1';
      const peText = expandBtn.querySelector('.sb-pe-text');
      const peIcon = expandBtn.querySelector('.sb-pe-icon');
      expandBtn.addEventListener('click', () => {
        const isExpanded = expandBtn.classList.toggle('active');
        if (pvScroll) pvScroll.classList.toggle('expanded', isExpanded);
        if (peText) peText.textContent = isExpanded ? '收起' : '展开';
        if (peIcon) peIcon.textContent = isExpanded ? '⤡' : '⤢';
      });
    }

    // 回到顶部
    if (topBtn && !topBtn.dataset.bound) {
      topBtn.dataset.bound = '1';
      topBtn.addEventListener('click', () => {
        if (pvScroll) pvScroll.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 编辑器工具栏（所见即所得）
    const toolbar = document.getElementById('sb-editor-toolbar');
    if (toolbar && !toolbar.dataset.bound) {
      toolbar.dataset.bound = '1';
      toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.sb-tool');
        if (!btn || btn.classList.contains('sb-tool-upload')) return;
        e.preventDefault();
        if (!bodyEditor) return;
        bodyEditor.focus();
        const cmd = btn.dataset.cmd;
        if (!cmd) return;
        const val = btn.dataset.val || null;
        try {
          document.execCommand(cmd, false, val);
        } catch (err) { /* 忽略 */ }
        syncPreview();
      });
    }

    // 本地图片上传 → 插入正文
    const imgInput = document.getElementById('sb-insert-img');
    const imgStatus = document.getElementById('sb-img-status');
    if (imgInput && !imgInput.dataset.bound) {
      imgInput.dataset.bound = '1';
      imgInput.addEventListener('change', async () => {
        const file = imgInput.files && imgInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          if (imgStatus) { imgStatus.innerHTML = ico('warn',12)+' 仅支持图片文件'; imgStatus.className = 'sb-tool-info err'; }
          return;
        }
        if (imgStatus) { imgStatus.textContent = '上传中…'; imgStatus.className = 'sb-tool-info loading'; }
        try {
          const r = await API.uploadImage(file);
          if (!r.ok) {
            if (imgStatus) { imgStatus.innerHTML = ico('warn',12)+' ' + (r.msg || '失败'); imgStatus.className = 'sb-tool-info err'; }
            return;
          }
          // 在光标位置插入 <img>（contenteditable）
          if (bodyEditor) {
            bodyEditor.focus();
            const tag = `<img src="${r.url}" alt="${escapeAttr(file.name)}" style="max-width:100%;border:1px solid rgba(232,232,232,0.2);margin:8px 0"><br>`;
            document.execCommand('insertHTML', false, tag);
            syncPreview();
          }
          const where = r.fallback ? '本地 base64' : '服务器';
          if (imgStatus) { imgStatus.innerHTML = ico('check',12)+` 已插入（${where}）`; imgStatus.className = 'sb-tool-info ok'; }
        } catch (e) {
          if (imgStatus) { imgStatus.innerHTML = ico('warn',12)+' ' + (e.message || '异常'); imgStatus.className = 'sb-tool-info err'; }
        }
        imgInput.value = '';
      });
    }

    // 封面/预览图上传
    const coverInput = document.getElementById('sb-cover');
    const coverPreview = document.getElementById('sb-cover-preview');
    const coverText = document.getElementById('sb-cover-text');
    const coverClear = document.getElementById('sb-cover-clear');
    window.__sbCoverUrl = '';
    if (coverInput && !coverInput.dataset.bound) {
      coverInput.dataset.bound = '1';
      coverInput.addEventListener('change', async () => {
        const file = coverInput.files && coverInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { sbErr('仅支持图片文件'); return; }
        coverText.textContent = '上传中…';
        try {
          const r = await API.uploadImage(file);
          if (!r.ok) { coverText.textContent = '选择图片'; sbErr(r.msg || '上传失败'); return; }
          window.__sbCoverUrl = r.url;
          if (coverPreview) {
            coverPreview.innerHTML = `<img src="${r.url}" alt="封面预览" style="width:100%;height:100%;object-fit:cover">`;
          }
          coverText.textContent = file.name.length > 18 ? file.name.slice(0,16) + '…' : file.name;
          if (coverClear) coverClear.style.display = '';
          scheduleDraftSave();
        } catch (e) {
          coverText.textContent = '选择图片';
          sbErr('封面上传失败：' + (e.message || ''));
        }
      });
    }
    if (coverClear && !coverClear.dataset.bound) {
      coverClear.dataset.bound = '1';
      coverClear.addEventListener('click', () => {
        window.__sbCoverUrl = '';
        if (coverPreview) coverPreview.innerHTML = '<div class="sb-cover-empty">暂无封面</div>';
        coverText.textContent = '选择图片';
        coverClear.style.display = 'none';
        coverInput.value = '';
        scheduleDraftSave();
      });
    }

    // DOCX 上传 → 自动解析 → 填标题/正文
    const docxFile = document.getElementById('sb-docx');
    const docxStatus = document.getElementById('docx-parse-status');
    const docxChoose = document.getElementById('docx-choose-text');
    if (docxFile && !docxFile.dataset.bound) {
      docxFile.dataset.bound = '1';
      docxFile.addEventListener('change', async () => {
        const file = docxFile.files && docxFile.files[0];
        if (!file) return;
        docxChoose.textContent = file.name;
        docxStatus.textContent = '解析中…';
        docxStatus.className = 'docx-parse-status parsing';
        try {
          const r = await API.uploadDocx(file);
          if (!r.ok) {
            docxStatus.innerHTML = ico('warn',12)+' ' + (r.msg || '解析失败');
            docxStatus.className = 'docx-parse-status err';
            return;
          }
          // 填标题：优先用 titleSuggest（非空才填）
          const titleIn = document.getElementById('sb-title');
          if (titleIn && !titleIn.value.trim() && r.titleSuggest) titleIn.value = r.titleSuggest;
          // 填正文：若编辑器空 → 直接设置 HTML；非空 → 追加到末尾
          if (bodyEditor) {
            const current = getBodyHTML();
            const isPlaceholder = !current || current.includes('在此输入正文');
            const newHtml = r.html || r.text || '';
            if (isPlaceholder || !current) {
              setBodyHTML(newHtml);
            } else {
              // 追加到末尾
              bodyEditor.focus();
              const range = document.createRange();
              range.selectNodeContents(bodyEditor);
              range.collapse(false);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
              document.execCommand('insertHTML', false, '<hr>' + newHtml);
            }
            syncPreview();
          }
          const where = r.fallback ? '浏览器端降级解析（图片 base64）' : '服务器解析（图片 data/uploads）';
          const warnCount = (r.warnings && r.warnings.length) || 0;
          docxStatus.innerHTML = ico('check',12)+' 解析完成 · ' + where + (warnCount ? ` · 警告 ${warnCount}` : '');
          docxStatus.className = 'docx-parse-status ok';
          // 顶部提示
          if (r.msg) sbInfo(r.msg);
        } catch (e) {
          docxStatus.innerHTML = ico('warn',12)+' 解析异常：' + (e.message || '未知错误');
          docxStatus.className = 'docx-parse-status err';
        }
      });
    }

    // 绑定表单提交
    const form = document.getElementById('submit-form');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('sb-title').value.trim();
        const body  = getBodyHTML();
        const bodyText = body.replace(/<[^>]+>/g, '').trim();
        if (!title) return sbErr('请输入标题');
        if (!bodyText) return sbErr('请输入正文');

        const data = {
          title,
          category: document.getElementById('sb-category').value,
          class: document.getElementById('sb-class').value,
          summary: document.getElementById('sb-summary').value.trim(),
          body: body,
          tags: document.getElementById('sb-tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),
          source: document.getElementById('sb-source').value.trim(),
          cover: window.__sbCoverUrl || ''
        };

        const btn = document.querySelector('.sb-submit-btn');
        const btnText = btn.querySelector('.sb-btn-text');
        btn.disabled = true;
        btnText.textContent = '正在提交...';
        document.getElementById('sb-success').style.display = 'none';

        const r = await API.submit(data);

        btn.disabled = false;
        btnText.innerHTML = ico('save',14)+' 提交投稿 · SUBMIT';
        if (!r.ok) { SFX.error(); return sbErr(r.msg || '投稿失败'); }

        SFX.save();
        const ok = document.getElementById('sb-success');
        const savedId = (r.submission && r.submission.id) || '新档案';
        const where = r.fallback ? '本地审核队列' : '服务器审核队列';
        ok.classList.remove('sb-info');
        ok.innerHTML = `
          <span>${ico('check',14)} 投稿已收妥 · 编号 <strong>${savedId}</strong> · 已进入${where}，等待管理员审核后再发布</span>
          <button type="button" class="sb-close-btn" title="关闭通知">${ico('cross',12)}</button>
        `;
        ok.style.display = 'block';
        // 绑定关闭按钮
        const closeBtn = ok.querySelector('.sb-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => { ok.style.display = 'none'; });
        document.getElementById('sb-error').style.display = 'none';
        form.reset();
        window.__sbCoverUrl = '';
        setBodyHTML('');
        syncPreview();
        SubmitDraft.clear();
        const cp = document.getElementById('sb-cover-preview');
        if (cp) cp.innerHTML = '<div class="sb-cover-empty">暂无封面</div>';
        const ct = document.getElementById('sb-cover-text');
        if (ct) ct.textContent = '选择图片';
        const cc = document.getElementById('sb-cover-clear');
        if (cc) cc.style.display = 'none';
        const dh = document.getElementById('draft-hint');
        if (dh) dh.remove();
      });
    }

    function sbErr(m) {
      const e = document.getElementById('sb-error');
      e.innerHTML = ico('warn',12)+' ' + m; e.style.display = 'block';
    }
    function sbInfo(m) {
      // 复用 success 容器显示中性提示（绿色背景不突兀）
      const ok = document.getElementById('sb-success');
      if (!ok) return;
      ok.innerHTML = ico('eye',12)+' ' + escapeHtml(m) + `<button type="button" class="sb-close-btn" title="关闭">${ico('cross',12)}</button>`;
      ok.style.display = 'block';
      ok.classList.add('sb-info');
      const cb = ok.querySelector('.sb-close-btn');
      if (cb) cb.addEventListener('click', () => { ok.style.display = 'none'; });
    }

    // 审核通知：关闭单条
    document.querySelectorAll('.submit-notice-close').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-id');
        if (!id) return;
        const notice = btn.closest('.submit-notice');
        if (notice) notice.style.display = 'none';
        try {
          const arr = JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]');
          if (!arr.includes(id)) { arr.push(id); localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(arr)); }
        } catch (_) {}
      });
    });
    // 审核通知：全部已读
    const clearAllBtn = document.getElementById('notice-clear-all');
    if (clearAllBtn && !clearAllBtn.dataset.bound) {
      clearAllBtn.dataset.bound = '1';
      clearAllBtn.addEventListener('click', () => {
        const ids = Array.from(document.querySelectorAll('.submit-notice[data-sub-id]')).map(n => n.getAttribute('data-sub-id'));
        document.querySelectorAll('.submit-notice').forEach(n => { n.style.display = 'none'; });
        try {
          const set = new Set(JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]'));
          ids.forEach(id => set.add(id));
          localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(Array.from(set)));
        } catch (_) {}
      });
    }

    // 投稿记录：删除已发布/已退回的记录
    document.querySelectorAll('.submit-item-del').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-id');
        if (!id) return;
        if (!confirm(`确认删除投稿记录「${id}」？此操作不会影响已发布的档案内容。`)) return;
        Submissions.remove(id);
        // 同步在已关闭通知中移除该 id
        try {
          const arr = JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]');
          const filtered = arr.filter(x => x !== id);
          if (filtered.length !== arr.length) localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(filtered));
        } catch (_) {}
        renderSubmit();
      });
    });
  }

  // ============ 管理员后台 ============
  function renderAdmin() {
    // 守卫 1：必须登录
    if (!Auth.get()) { showLoginGate(); return; }
    // 守卫 2：必须管理员
    if (!Auth.isAdmin()) {
      view.innerHTML = `
        <div class="empty-state" style="padding:120px 24px">
          <div class="es-icon">🛡</div>
          <div class="es-title">ADMIN ONLY · 仅管理员可访问</div>
          <div class="es-desc">请用管理员账号（默认 admin / admin123，可在 .env 修改）登录。</div>
          <p style="margin-top:24px"><a href="javascript:void(0)" id="admin-goto-login">→ 切换管理员身份登录</a></p>
        </div>
      `;
      const b = document.getElementById('admin-goto-login');
      if (b) b.addEventListener('click', () => { Auth.clear(); refreshIdentity(); showLoginGate(); });
      return;
    }

    // Tab 切换（URL hash：#/admin?tab=entries 或 view._adminTab）
    const tab = (new URLSearchParams(location.hash.split('?')[1] || '')).get('tab') || view._adminTab || 'subs';

    const me = Auth.get();
    view.innerHTML = `
      <div class="admin-wrap">
        <div class="admin-head" data-header-img="${encodeURI('IMG-07 管理中枢横幅.png')}">
          <div>
            <h2 class="admin-h2">🛡 管理员控制台 · ADMIN CONSOLE</h2>
            <p class="admin-sub">操作身份：<strong>${escapeHtml(me.user)}</strong> · ${escapeHtml(me.lvl||'')} · <span style="color:var(--red-2)">ADMINISTRATOR</span></p>
          </div>
          <div class="admin-head-right">
            <span id="admin-banner" class="admin-banner"></span>
          </div>
        </div>

        <nav class="admin-tabs">
          <a class="atab ${tab==='dash'?'active':''}" data-atab="dash">${ico('chart',14)} 数据仪表盘</a>
          <a class="atab ${tab==='subs'?'active':''}" data-atab="subs">${ico('shield',14)} 待审核投稿 <span id="admin-count-subs" class="atab-count">0</span></a>
          <a class="atab ${tab==='entries'?'active':''}" data-atab="entries">${ico('doc',14)} 档案管理</a>
          <a class="atab ${tab==='users'?'active':''}" data-atab="users">${ico('eye',14)} 用户管理</a>
          <a class="atab ${tab==='logs'?'active':''}" data-atab="logs">${ico('doc',14)} 操作日志</a>
          <a class="atab ${tab==='cats'?'active':''}" data-atab="cats">${ico('grid',14)} 栏目管理</a>
          <a class="atab ${tab==='data'?'active':''}" data-atab="data">${ico('save',14)} 数据备份</a>
        </nav>

        <div id="admin-tab-body" class="admin-tab-body"></div>
      </div>
    `;

    // 管理中枢横幅背景注入
    const adminHead = document.querySelector('.admin-head[data-header-img]');
    if (adminHead && adminHead.dataset.headerImg) {
      adminHead.style.setProperty('--lh-img', `url('${adminHead.dataset.headerImg}')`);
    }

    // Tab 点击 → 更新 view._adminTab → 重绘 body
    document.querySelectorAll('.atab').forEach(el => {
      if (el.dataset._bound) return;
      el.dataset._bound = '1';
      el.addEventListener('click', () => {
        document.querySelectorAll('.atab').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        view._adminTab = el.dataset.atab;
        SFX.adminClick();
        drawAdminTab();
      });
    });

    function banner(msg, kind) {
      const b = document.getElementById('admin-banner');
      if (!b) return;
      b.textContent = msg;
      b.className = 'admin-banner ' + (kind || '');
      setTimeout(() => { b.textContent = ''; b.className = 'admin-banner'; }, 4500);
    }

    // Toast（右下角，用于批量操作汇总提示）
    let toastEl = null;
    function toast(msg, kind) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'admin-toast';
        toastEl.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;max-width:360px;padding:12px 16px;font-family:var(--f-mono);font-size:12px;letter-spacing:.5px;border:1px solid var(--border);background:var(--bg);color:var(--text);box-shadow:0 8px 30px rgba(0,0,0,.4);';
        document.body.appendChild(toastEl);
      }
      toastEl.style.borderColor = (kind==='ok' && 'var(--gold-2)') || (kind==='err' && 'var(--red-1)') || 'var(--border)';
      toastEl.textContent = msg;
      toastEl.style.display = 'block';
      clearTimeout(toastEl._t);
      toastEl._t = setTimeout(() => { toastEl.style.display = 'none'; }, 4500);
    }

    // ========== SVG 图表辅助 ==========
    // 环形图（donut）：segments=[{label,value,color}]
    function svgDonut(segments, size) {
      size = size || 180;
      const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
      const cx = size / 2, cy = size / 2;
      const r = size / 2 - 14;
      const C = 2 * Math.PI * r;
      let offset = 0;
      const segs = segments.filter(s => s.value > 0).map(s => {
        const frac = s.value / total;
        const len = frac * C;
        const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
        offset += len;
        return el;
      }).join('');
      return `<svg viewBox="0 0 ${size} ${size}" style="width:100%;height:auto;display:block;max-width:${size}px;margin:0 auto;">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(232,232,232,0.08)" stroke-width="16"/>
        ${segs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="var(--f-serif,serif)" font-size="26" fill="currentColor" font-weight="600">${total}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="currentColor" fill-opacity="0.6" letter-spacing="2">TOTAL</text>
      </svg>`;
    }
    // 柱状图：bars=[{label,value,color?}], opts={h,maxVal}
    function svgBars(bars, opts) {
      opts = opts || {};
      const h = opts.h || 130;
      const W = 300, padL = 36, padR = 10, padB = 26, padT = 14;
      const maxVal = Math.max(1, opts.maxVal || 0, ...bars.map(b => b.value));
      const innerW = W - padL - padR;
      const bw = bars.length ? (innerW / bars.length) * 0.6 : 0;
      const gap = bars.length ? (innerW / bars.length) * 0.4 : 0;
      const baseY = h - padB;
      const barH = baseY - padT;
      // 网格线
      const grids = [0, 0.25, 0.5, 0.75, 1].map(g => {
        const y = baseY - g * barH;
        const val = Math.round(g * maxVal);
        return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="currentColor" stroke-opacity="${g === 0 ? 0.3 : 0.1}" stroke-dasharray="${g === 0 ? '0' : '2 4'}"/>
                <text x="${padL - 4}" y="${y + 3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="8" fill="currentColor" fill-opacity="0.5">${val}</text>`;
      }).join('');
      const barsHtml = bars.map((b, i) => {
        const x = padL + i * (bw + gap) + gap / 2;
        const bh = (b.value / maxVal) * barH;
        const y = baseY - bh;
        const color = b.color || 'currentColor';
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="1"/>
                <text x="${(x + bw/2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="currentColor">${b.value}</text>
                <text x="${(x + bw/2).toFixed(1)}" y="${baseY + 13}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="8" fill="currentColor" fill-opacity="0.65">${escapeHtml(b.label)}</text>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:${h}px;display:block;">
        ${grids}${barsHtml}
        <line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="currentColor" stroke-opacity="0.4"/>
      </svg>`;
    }

    // ========== Tab：数据仪表盘 ==========
    function drawDashTab() {
      const body = document.getElementById('admin-tab-body');
      const counts = statsCounts();
      const totalEntries = DATA.categories.reduce((s, c) => s + (counts[c.id]||0), 0);
      const pendingSubs = (Submissions.get().filter(s => s.status==='pending')).length;
      // 本月新增：按 LocalEntries.added 中 at 字段 + Submissions.reviewedAt 本月
      const now = new Date();
      const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
      let monthAdded = 0;
      DATA.categories.forEach(cat => {
        const list = DATA[cat.id] || [];
        list.forEach(e => {
          const t = e.at || e.createdAt || e.updatedAt || 0;
          if (t) {
            const d = new Date(t);
            const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
            if (key === ym) monthAdded++;
          }
        });
      });
      const userGrowth = computeMonthlyUserGrowth();
      const maxG = Math.max(1, ...userGrowth.map(x => x.v));
      const growthSvg = `
        <svg viewBox="0 0 300 110" style="width:100%;height:110px;display:block;">
          <g stroke="currentColor" stroke-opacity="0.18">
            <line x1="40" y1="90" x2="290" y2="90"/><line x1="40" y1="20" x2="40" y2="90"/>
            <line x1="40" y1="55" x2="290" y2="55" stroke-dasharray="2 4"/>
          </g>
          ${userGrowth.map((p,i)=>{
            const x = 50 + (240/(userGrowth.length-1||1))*i;
            const h = (p.v/maxG)*60;
            const y = 90 - h;
            return `
              <rect x="${x-14}" y="${y}" width="28" height="${h}" fill="none" stroke="currentColor" stroke-width="1.2"/>
              <rect x="${x-14}" y="${y}" width="28" height="${h}" fill="currentColor" fill-opacity="0.14"/>
              <text x="${x}" y="${y-4}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="9" fill="currentColor">${p.v}</text>
              <text x="${x}" y="104" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="9" fill="currentColor" fill-opacity=".6">${escapeHtml(p.label)}</text>
            `;
          }).join('')}
        </svg>
      `;
      // 分类分布环形图
      const catColors = ['#c0392b', '#b8b8b8', '#9aa0a6', '#7d858b', '#5a6066'];
      const catSegs = DATA.categories.map((c, i) => ({
        label: c.name, value: counts[c.id] || 0, color: catColors[i % catColors.length]
      }));
      const donutSvg = svgDonut(catSegs, 180);
      const donutLegend = catSegs.map(s => {
        const pct = totalEntries ? Math.round(s.value / totalEntries * 100) : 0;
        return `<div class="dl-row"><span class="dl-dot" style="background:${s.color}"></span><span class="dl-label">${escapeHtml(s.label)}</span><span class="dl-val">${s.value}</span><span class="dl-pct">${pct}%</span></div>`;
      }).join('');

      // 危险等级分布柱状图
      const dangerColors = { safe:'#6b8e6b', euclid:'#c9a23a', keter:'#c0392b', apollyon:'#7b241c', thaumiel:'#4a6fa5', neutral:'#6c6c6c' };
      const dangerBars = DATA.classLegend.map(c => {
        const n = allEntries().filter(e => (e.class || 'neutral') === c.code).length;
        return { label: c.name, value: n, color: dangerColors[c.code] || 'currentColor' };
      });

      // 投稿趋势（近 6 个月，按提交时间 at）
      const subGrowth = (function() {
        const subs = Submissions.get();
        const months = {};
        subs.forEach(s => {
          const at = s.at || s.reviewedAt || 0;
          if (!at) return;
          const d = new Date(at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          months[key] = (months[key] || 0) + 1;
        });
        const keys = Object.keys(months).sort();
        const last = keys.slice(-6);
        const pad = 6 - last.length;
        const out = [];
        for (let i = 0; i < pad; i++) out.push({ label: 'M' + (i + 1), v: 0 });
        last.forEach((k, i) => out.push({ label: pad > 0 ? 'M' + (pad + i + 1) : k.slice(2), v: months[k] }));
        return out.slice(-6);
      })();
      const subBars = subGrowth.map(p => ({ label: p.label, value: p.v }));
      const subTotal = Submissions.get().length;

      body.innerHTML = `
        <div class="dash-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">总档案数 · TOTAL</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${totalEntries}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">
              ${DATA.categories.map(c => `${c.icon} ${counts[c.id]||0}`).join(' · ')}
            </div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">待审核投稿 · PENDING</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;color:var(--gold-1);">${pendingSubs}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">
              <a class="atab-link" href="javascript:void(0)" id="dash-go-subs">前往投稿审核 →</a>
            </div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">本月新增 · MONTHLY</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${monthAdded}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">归档于 ${DATA.meta.updated||'—'}</div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">注册用户 · USERS</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${Auth.getUsers().length}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">
              LV.1+ 默认 · 投稿需 LV.2 · 管理员 ${Auth.getUsers().filter(u=>u.role==='admin').length}
            </div>
          </div>
        </div>
        <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
          <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">用户增长曲线 · MONTHLY USERS · 近 6 个月</div>
          <div class="dash-chart" style="color:var(--text-2);">${growthSvg}</div>
        </div>
        <div class="dash-row2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px;">
          <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">分类条目分布 · CATEGORY RING</div>
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
              <div style="flex:0 0 180px;color:var(--text-2);">${donutSvg}</div>
              <div class="dash-legend" style="flex:1;min-width:140px;font-family:var(--f-mono);font-size:11px;">${donutLegend}</div>
            </div>
          </div>
          <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">危险等级分布 · DANGER LEVEL</div>
            <div class="dash-chart" style="color:var(--text-2);">${svgBars(dangerBars, { h: 140 })}</div>
          </div>
          <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">投稿趋势 · SUBMISSIONS · 近 6 个月（共 ${subTotal}）</div>
            <div class="dash-chart" style="color:var(--text-2);">${svgBars(subBars, { h: 140 })}</div>
          </div>
        </div>
      `;
      const gsubs = document.getElementById('dash-go-subs');
      if (gsubs) gsubs.addEventListener('click', () => {
        document.querySelectorAll('.atab').forEach(x => x.classList.toggle('active', x.dataset.atab === 'subs'));
        view._adminTab = 'subs'; drawAdminTab();
      });
    }

    // ========== Tab：操作日志 ==========
    function drawLogsTab() {
      const body = document.getElementById('admin-tab-body');
      const list = AdminLogs.list().sort((a,b) => (b.at||0)-(a.at||0));
      body.innerHTML = `
        <div class="admin-toolbar">
          <span class="admin-toolbar-note">共 ${list.length} 条日志（仅本地保留最近 500 条）</span>
          <div class="admin-filter-inline">
            <input type="text" id="admin-logs-search" placeholder="搜索操作 / 详情…" class="admin-search-input">
            <label>类型
              <select id="admin-logs-type">
                <option value="">全部</option>
                ${AdminLogs.types().map(t=>`<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('')}
              </select>
            </label>
            <button class="abtn abtn-danger abtn-mini" id="admin-logs-clear">清空日志</button>
          </div>
        </div>
        <div id="admin-logs-list"></div>
      `;
      const listDiv = document.getElementById('admin-logs-list');
      const qEl = document.getElementById('admin-logs-search');
      const tEl = document.getElementById('admin-logs-type');
      function render() {
        const q = (qEl.value||'').trim().toLowerCase();
        const ty = tEl.value;
        const filtered = list.filter(l => {
          if (ty && l.type !== ty) return false;
          if (q) {
            const h = `${l.type} ${l.detail} ${l.user||''}`.toLowerCase();
            if (!h.includes(q)) return false;
          }
          return true;
        });
        if (!filtered.length) { listDiv.innerHTML = `<div class="admin-empty">无日志记录</div>`; return; }
        listDiv.innerHTML = `
          <table class="admin-table">
            <thead><tr><th style="width:180px">时间</th><th style="width:160px">类型</th><th style="width:140px">操作人</th><th>详情</th></tr></thead>
            <tbody>
              ${filtered.map(l => `
                <tr>
                  <td class="atd-mono">${new Date(l.at).toLocaleString('zh-CN')}</td>
                  <td><span style="font-family:var(--f-mono);color:var(--gold-1);font-size:11px;">${escapeHtml(l.type)}</span></td>
                  <td>${escapeHtml(l.user||'—')}</td>
                  <td style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(l.detail||'')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
      render();
      qEl.addEventListener('input', render);
      tEl.addEventListener('change', render);
      document.getElementById('admin-logs-clear').addEventListener('click', () => {
        if (!confirm('确认清空全部操作日志？此操作不可恢复。')) return;
        AdminLogs.clear();
        banner('操作日志已清空', 'ok');
        drawLogsTab();
      });
    }

    // ========== Tab：数据备份 ==========
    function drawDataTab() {
      const body = document.getElementById('admin-tab-body');
      const estKeys = [AUTH_KEY, USERS_KEY, CODES_KEY, SUBMIT_KEY, ENTRIES_KEY, CATS_KEY, FAV_KEY, COMMENT_KEY, LOG_KEY, READ_KEY, DRAFT_KEY, THEME_KEY];
      const rows = estKeys.map(k => {
        const v = localStorage.getItem(k);
        const kb = v ? Math.round(v.length / 1024) : 0;
        return { k, kb, used: !!v };
      });
      const totalKb = rows.reduce((s,r)=>s+r.kb,0);
      const quote = 5 * 1024;
      const percent = Math.min(100, Math.round((totalKb/quote)*100));
      body.innerHTML = `
        <div class="dash-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px;">
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">本地存储用量 · STORAGE</div>
            <div class="dash-v" style="font-size:28px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${totalKb} KB</div>
            <div style="height:8px;border:1px solid var(--border);margin-top:10px;background:var(--bg);overflow:hidden;">
              <div style="height:100%;width:${percent}%;background:${percent>=85?'var(--red-1)':'var(--gold-1)'};"></div>
            </div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:6px;">估算上限 ≈ 5 MB · 当前 ${percent}%</div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">一键导出 · EXPORT JSON</div>
            <div style="margin-top:10px;">
              <button class="abtn abtn-approve" id="backup-export-btn">⬇ 导出完整备份（含档案/用户/投稿/收藏/日志）</button>
            </div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:8px;">导出内容包含 14 个 localStorage key + 全部分类数据快照</div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">备份文件列表</div>
            <div style="margin-top:8px;">
              <label class="af-cover-upload-btn" style="display:inline-block;">
                📂 选择备份文件查看大小
                <input type="file" id="backup-file-info" accept="application/json" hidden>
              </label>
            </div>
            <div id="backup-info" class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:8px;"></div>
          </div>
        </div>
        <div style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
          <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:10px;">存储明细 · KEYS</div>
          <table class="admin-table">
            <thead><tr><th style="width:280px">localStorage Key</th><th style="width:120px">大小</th><th>状态</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td class="atd-mono">${escapeHtml(r.k)}</td>
                  <td class="atd-mono">${r.kb} KB</td>
                  <td>${r.used ? '<span style="color:var(--gold-1);">已使用</span>' : '<span style="color:var(--text-2);">空</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      document.getElementById('backup-export-btn').addEventListener('click', () => {
        exportBackupJSON();
        banner('备份 JSON 已下载', 'ok');
      });
      const fi = document.getElementById('backup-file-info');
      const info = document.getElementById('backup-info');
      if (fi) fi.addEventListener('change', () => {
        const f = fi.files && fi.files[0];
        if (!f) return;
        info.textContent = `已选择「${f.name}」 · ${Math.round(f.size/1024)} KB · ${new Date(f.lastModified).toLocaleString()}`;
      });
    }

    function drawAdminTab() {
      const t = view._adminTab || tab;
      if (t === 'dash') return drawDashTab();
      if (t === 'subs') return drawSubsTab();
      if (t === 'entries') return drawEntriesTab();
      if (t === 'users') return drawUsersTab();
      if (t === 'logs') return drawLogsTab();
      if (t === 'cats') return drawCatsTab();
      if (t === 'data') return drawDataTab();
    }

    // ========== Tab：栏目管理 ==========
    function drawCatsTab() {
      const body = document.getElementById('admin-tab-body');
      function render() {
        const counts = statsCounts();
        const catCards = DATA.categories.map(c => {
          const n = counts[c.id] || 0;
          const subs = c.subcats || [];
          const subHtml = subs.length ? subs.map(s => `
            <span class="sc-chip">
              <span class="sc-chip-name">${escapeHtml(s.name)} <em>${escapeHtml(s.id)}</em></span>
              <button class="sc-chip-rm" data-rm-sub data-cat="${escapeAttr(c.id)}" data-sub="${escapeAttr(s.id)}" title="删除子分组">${ico('cross',10)}</button>
            </span>`).join('') : '<span class="sc-empty">暂无子分组</span>';
          return `
          <div class="cat-card" data-cat="${escapeAttr(c.id)}">
            <div class="cat-card-head">
              <span class="cat-icon">${catIconSvg(c.id)}</span>
              <div class="cat-meta">
                <div class="cat-name">${escapeHtml(c.name)} <em class="cat-id">#${escapeHtml(c.id)}</em></div>
                <div class="cat-sub">${escapeHtml(c.nameEn||c.code||'')} · ${n} 条档案 · ${subs.length} 个子分组</div>
              </div>
              <div class="cat-actions">
                <button class="abtn abtn-mini" data-edit-cat data-cat="${escapeAttr(c.id)}">${ico('pencil',12)} 编辑</button>
                <button class="abtn abtn-mini abtn-danger" data-del-cat data-cat="${escapeAttr(c.id)}">${ico('trash',12)} 删除</button>
              </div>
            </div>
            ${c.desc ? `<div class="cat-desc">${escapeHtml(c.desc)}</div>` : ''}
            <div class="cat-subcats">
              <div class="sc-label">子分组</div>
              <div class="sc-list">${subHtml}</div>
              <div class="sc-add">
                <input type="text" class="sc-input sc-add-name" placeholder="子分组名称（如：实体）">
                <input type="text" class="sc-input sc-add-id" placeholder="ID（如：entity）">
                <button class="abtn abtn-mini" data-add-sub data-cat="${escapeAttr(c.id)}">${ico('plus',12)} 添加</button>
              </div>
            </div>
          </div>`;
        }).join('');
        body.innerHTML = `
          <div class="admin-toolbar">
            <span class="admin-toolbar-note">共 ${DATA.categories.length} 个栏目 · 管理员可新建顶级栏目与子分组</span>
            <button class="abtn abtn-approve" id="cat-new-btn">${ico('plus',14)} 新建栏目</button>
          </div>
          <div class="cat-list">${catCards}</div>
          <div class="cat-help">
            <strong>说明：</strong>新建栏目会出现在顶部导航与侧边栏；栏目 ID 用于路由（<code>#/栏目id</code>）与数据存储，创建后不可修改。
            子分组用于在栏目内对条目进一步分类，条目编辑时可选择归属。
          </div>
        `;
        bindCatEvents();
      }
      function bindCatEvents() {
        const newBtn = document.getElementById('cat-new-btn');
        if (newBtn) newBtn.addEventListener('click', () => openCatEditor(null));
        body.querySelectorAll('[data-edit-cat]').forEach(b => {
          b.addEventListener('click', () => { const c = CAT_MAP[b.dataset.cat]; if (c) openCatEditor(c); });
        });
        body.querySelectorAll('[data-del-cat]').forEach(b => {
          b.addEventListener('click', () => {
            const id = b.dataset.cat;
            const c = CAT_MAP[id];
            if (!c) return;
            const n = (DATA[id]||[]).length;
            if (!confirm(`确定删除栏目「${c.name}」？${n ? `该栏目下 ${n} 条档案将不再显示（数据保留在本地存储备份）。` : ''}此操作不可撤销。`)) return;
            const r = LocalCats.removeCat(id);
            if (r.ok) {
              AdminLogs.record('category:delete', `${id} · ${c.name}${n?` (${n}条)`:''}`);
              banner(`已删除栏目：${c.name}`, 'ok');
              render();
            } else banner(r.msg || '删除失败', 'err');
          });
        });
        body.querySelectorAll('[data-add-sub]').forEach(b => {
          b.addEventListener('click', () => {
            const catId = b.dataset.cat;
            const card = b.closest('.cat-card');
            const nameEl = card.querySelector('.sc-add-name');
            const idEl = card.querySelector('.sc-add-id');
            const name = (nameEl.value || '').trim();
            const sid = (idEl.value || '').trim();
            if (!name) { banner('请填写子分组名称', 'err'); return; }
            const finalId = sid || ('sc_' + Date.now().toString(36).slice(-5));
            const r = LocalCats.addSubcat(catId, { id: finalId, name });
            if (r.ok) {
              AdminLogs.record('subcategory:add', `${catId}/${finalId} · ${name}`);
              banner(`已添加子分组：${name}`, 'ok');
              render();
            } else banner(r.msg || '添加失败', 'err');
          });
        });
        body.querySelectorAll('[data-rm-sub]').forEach(b => {
          b.addEventListener('click', () => {
            const catId = b.dataset.cat;
            const subId = b.dataset.sub;
            const c = CAT_MAP[catId];
            const s = ((c && c.subcats) || []).find(x => x.id === subId);
            if (!confirm(`删除子分组「${s ? s.name : subId}」？已归类到该子分组的条目将变为未分组。`)) return;
            const r = LocalCats.removeSubcat(catId, subId);
            if (r.ok) {
              AdminLogs.record('subcategory:delete', `${catId}/${subId} · ${s?s.name:''}`);
              banner('已删除子分组', 'ok');
              render();
            } else banner(r.msg || '删除失败', 'err');
          });
        });
      }
      function openCatEditor(c) {
        const isEdit = !!c;
        const dlg = document.createElement('div');
        dlg.className = 'admin-modal';
        dlg.innerHTML = `
          <div class="admin-modal-body">
            <h3 class="am-title">${isEdit?'编辑栏目':'新建栏目'}${isEdit?` · ${escapeHtml(c.name)}`:''}</h3>
            <div class="am-grid">
              <label class="af"><span>栏目 ID（路由/数据键，仅字母数字_-，创建后不可改）</span><input data-f="id" value="${escapeAttr(c?c.id:'')}" ${isEdit?'disabled':''} placeholder="如 locations"/></label>
              <label class="af"><span>名称 *</span><input data-f="name" value="${escapeAttr(c?c.name:'')}" placeholder="如 地点志"/></label>
              <label class="af"><span>英文名 / 代号</span><input data-f="nameEn" value="${escapeAttr(c?c.nameEn:'')}" placeholder="如 Locations"/></label>
              <label class="af"><span>图标符号（单字符，如 ◈ ⬡ ✦）</span><input data-f="icon" value="${escapeAttr(c?c.icon:'◈')}" maxlength="2"/></label>
              <label class="af" style="grid-column:1/-1"><span>简介</span><input data-f="desc" value="${escapeAttr(c?c.desc:'')}" placeholder="栏目描述"/></label>
              <label class="af" style="grid-column:1/-1"><span>来源标注（可选）</span><input data-f="source" value="${escapeAttr(c?c.source:'')}" placeholder="数据来源"/></label>
            </div>
            <div class="am-foot">
              <button class="abtn abtn-cancel" data-act="cancel">取消</button>
              <button class="abtn abtn-approve" data-act="save">${isEdit?'保存':'创建栏目'}</button>
            </div>
          </div>`;
        document.body.appendChild(dlg);
        function close() { dlg.remove(); }
        dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        dlg.querySelector('[data-act="save"]').addEventListener('click', () => {
          const p = {};
          dlg.querySelectorAll('[data-f]').forEach(el => { if (!el.disabled) p[el.dataset.f] = el.value.trim(); });
          if (!p.name) { banner('请填写栏目名称', 'err'); return; }
          if (isEdit) {
            const r = LocalCats.updateCat(c.id, { name:p.name, nameEn:p.nameEn, icon:p.icon, desc:p.desc, source:p.source });
            if (r.ok) { AdminLogs.record('category:update', `${c.id} · ${p.name}`); banner('栏目已更新', 'ok'); close(); render(); }
            else banner(r.msg||'更新失败', 'err');
          } else {
            if (!p.id) { banner('请填写栏目 ID', 'err'); return; }
            const r = LocalCats.addCat({ id:p.id, name:p.name, nameEn:p.nameEn, code:p.nameEn||p.id, icon:p.icon||'◈', desc:p.desc, source:p.source });
            if (r.ok) { AdminLogs.record('category:add', `${p.id} · ${p.name}`); banner(`已创建栏目：${p.name}`, 'ok'); close(); render(); }
            else banner(r.msg||'创建失败', 'err');
          }
        });
      }
      render();
    }

    // ========== Tab 1：投稿审核 ==========
    async function drawSubsTab() {
      const body = document.getElementById('admin-tab-body');
      body.innerHTML = `<div class="admin-loading">加载投稿列表…</div>`;
      const r = await API.adminListSubmissions('pending', '');
      let allSubs = r.ok ? r.list : [];
      let subsPage = 1;
      const SUBS_PAGE_SIZE = 10;

      const sc = document.getElementById('admin-count-subs');
      if (sc) sc.textContent = allSubs.length;

      body.innerHTML = `
        <div class="admin-toolbar">
          <span class="admin-toolbar-note">共 ${allSubs.length} 条${r.fallback ? '（降级模式）' : ''}</span>
          <div class="admin-filter-inline">
            <input type="text" id="admin-subs-search" placeholder="搜索标题 / 作者 / ID…" class="admin-search-input">
            <label>状态
              <select id="admin-subs-status">
                <option value="pending" selected>待审核</option>
                <option value="all">全部</option>
                <option value="approved">已通过</option>
                <option value="rejected">已退回</option>
              </select>
            </label>
          </div>
        </div>
        <div class="admin-batch-bar" id="admin-subs-batchbar" style="display:none">
          <span class="admin-batch-count" id="admin-subs-batch-count">已选 0 项</span>
          <button class="abtn abtn-approve" id="admin-subs-batch-approve">批量通过</button>
          <button class="abtn abtn-reject" id="admin-subs-batch-reject">批量打回</button>
        </div>
        <div id="admin-subs-list" class="admin-subs-list"></div>
      `;
      const searchInputS = document.getElementById('admin-subs-search');
      const subsListDiv = document.getElementById('admin-subs-list');

      function renderSubsPage() {
        const q = (searchInputS.value || '').trim().toLowerCase();
        let filtered = allSubs;
        if (q) {
          filtered = allSubs.filter(s =>
            String(s.id).toLowerCase().includes(q) ||
            String(s.title||'').toLowerCase().includes(q) ||
            String(s.author||'').toLowerCase().includes(q)
          );
        }
        if (!filtered.length) {
          subsListDiv.innerHTML = `<div class="admin-empty">${q ? '未找到匹配稿件' : '暂无稿件'}</div>`;
          return;
        }
        const totalPages = Math.max(1, Math.ceil(filtered.length / SUBS_PAGE_SIZE));
        if (subsPage > totalPages) subsPage = totalPages;
        const start = (subsPage - 1) * SUBS_PAGE_SIZE;
        const pageItems = filtered.slice(start, start + SUBS_PAGE_SIZE);

        subsListDiv.innerHTML = pageItems.map((s) => `
          <div class="admin-sub" data-id="${escapeAttr(s.id)}">
            <div class="admin-sub-head">
              <div class="admin-sub-ids">
                <input type="checkbox" class="admin-subs-check" data-id="${escapeAttr(s.id)}" style="margin-right:8px;vertical-align:middle">
                <span class="as-id">${escapeHtml(s.id)}</span>
                <span class="as-cat">${escapeHtml(CAT_MAP[s.category]?.name || s.category)}</span>
                <span class="as-cls">${escapeHtml(CLASS_NAMES[s.class] || s.class || '未分级')}</span>
                <span class="as-status as-status-${s.status||'pending'}">${
                  s.status === 'approved' ? '已通过'
                  : s.status === 'rejected' ? '已退回' : '待审核'
                }</span>
              </div>
              <div class="admin-sub-meta">
                <span>作者：${escapeHtml(s.author||'')} (${escapeHtml(s.authorLevel||'')})</span>
                <span>· ${new Date(s.at||0).toLocaleString('zh-CN')}</span>
              </div>
            </div>
            <div class="admin-sub-title">${escapeHtml(s.title)}</div>
            <details class="admin-sub-detail">
              <summary>展开正文 / 编辑补丁</summary>
              <div class="admin-sub-grid">
                <label class="af"><span>标题（通过时使用）</span><input data-k="title" value="${escapeAttr(s.title)}"/></label>
                <div class="af af-row-2">
                  <label><span>分类</span>
                    <select data-k="category">
                      ${DATA.categories.map(c => `<option value="${c.id}" ${c.id===s.category?'selected':''}>${c.name}</option>`).join('')}
                    </select>
                  </label>
                  <label><span>危险等级</span>
                    <select data-k="class">
                      <option value="neutral">未分级</option>
                      ${Object.entries(CLASS_NAMES).map(([k,v])=>`<option value="${k}" ${k===s.class?'selected':''}>${v}</option>`).join('')}
                    </select>
                  </label>
                </div>
                <label class="af"><span>代号</span><input data-k="code" value="${escapeAttr(s.code||'')}"/></label>
                <label class="af"><span>摘要</span><input data-k="summary" value="${escapeAttr(s.summary||'')}"/></label>
                <div class="af af-cover-row">
                  <label><span>封面/预览图（通过时使用）</span>
                    <div class="af-cover-wrap">
                      <input data-k="cover" value="${escapeAttr(s.cover||'')}" placeholder="留空则无封面"/>
                      <label class="af-cover-upload-btn">
                        ⬆ 上传
                        <input type="file" class="af-cover-file" accept="image/*" hidden>
                      </label>
                    </div>
                  </label>
                  <div class="af-cover-thumb">${s.cover ? `<img src="${escapeAttr(s.cover)}" alt="封面" onerror="this.style.display='none'">` : '<div class="af-cover-empty">无</div>'}</div>
                </div>
                <label class="af"><span>正文（可直接修改后通过）</span>
                  <textarea data-k="body" rows="6">${escapeHtml(s.body || '')}</textarea>
                </label>
                <label class="af"><span>审核备注（作者可见）</span><input data-k="note" placeholder="例：摘要描述再精炼一些"></label>
              </div>
            </details>
            <div class="admin-sub-actions">
              <button class="abtn abtn-approve" data-action="approve">${ico('check',14)} 通过并发布</button>
              <button class="abtn abtn-reject"  data-action="reject">${ico('cross',14)} 退回</button>
            </div>
          </div>`).join('')
          + (totalPages > 1 ? `
            <div class="admin-pager">
              <button class="abtn abtn-mini" data-page="prev" ${subsPage<=1?'disabled':''}>‹ 上一页</button>
              <span class="pager-info">第 ${subsPage} / ${totalPages} 页 · 共 ${filtered.length} 条${q ? '（搜索结果）' : ''}</span>
              <button class="abtn abtn-mini" data-page="next" ${subsPage>=totalPages?'disabled':''}>下一页 ›</button>
            </div>` : '');

        // 单条审核事件
        pageItems.forEach((s) => {
          const card = subsListDiv.querySelector(`.admin-sub[data-id="${CSS.escape(s.id)}"]`);
          if (!card) return;
          const ap = card.querySelector('[data-action="approve"]');
          const rj = card.querySelector('[data-action="reject"]');
          // 封面上传
          const coverFile = card.querySelector('.af-cover-file');
          const coverInput = card.querySelector('[data-k="cover"]');
          const coverThumb = card.querySelector('.af-cover-thumb');
          if (coverFile && !coverFile.dataset.bound) {
            coverFile.dataset.bound = '1';
            coverFile.addEventListener('change', async () => {
              const file = coverFile.files && coverFile.files[0];
              if (!file) return;
              if (!file.type.startsWith('image/')) { banner('仅支持图片文件', 'err'); return; }
              try {
                const r = await API.uploadImage(file);
                if (!r.ok) { banner(r.msg || '封面上传失败', 'err'); return; }
                if (coverInput) coverInput.value = r.url;
                if (coverThumb) coverThumb.innerHTML = `<img src="${r.url}" alt="封面" style="width:100%;height:100%;object-fit:cover">`;
              } catch (e) { banner('封面上传失败', 'err'); }
            });
          }
          const readPatch = () => {
            const patch = {};
            card.querySelectorAll('[data-k]').forEach(el => {
              const k = el.dataset.k;
              if (k === 'note') return;
              if (k === 'tags') patch[k] = el.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean);
              else patch[k] = el.value;
            });
            const noteEl = card.querySelector('[data-k="note"]');
            return { patch, note: noteEl ? noteEl.value : '' };
          };
          if (ap) ap.addEventListener('click', async () => {
            ap.disabled = true; const t = ap.textContent; ap.textContent = '处理中…';
            const { patch, note } = readPatch();
            const r2 = await API.adminReview(s.id, 'approved', { note, patch });
            ap.disabled = false; ap.textContent = t;
            if (!r2.ok) return banner(r2.msg || '通过失败', 'err');
            banner(`通过成功 · 已写入 ${r2.mergedEntry ? CAT_MAP[r2.mergedEntry.cat]?.name || r2.mergedEntry.cat : s.category}`, 'ok');
            drawSubsTab();
          });
          if (rj) rj.addEventListener('click', async () => {
            rj.disabled = true; const t = rj.textContent; rj.textContent = '处理中…';
            const { note } = readPatch();
            const r2 = await API.adminReview(s.id, 'rejected', { note });
            rj.disabled = false; rj.textContent = t;
            if (!r2.ok) return banner(r2.msg || '退回失败', 'err');
            banner('已退回投稿' + (note ? `（备注：${note}）` : ''), 'ok');
            drawSubsTab();
          });
        });

        // 分页
        subsListDiv.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.page === 'prev') subsPage--;
            else if (btn.dataset.page === 'next') subsPage++;
            renderSubsPage();
          });
        });

        // 复选框 + 批量操作
        const batchBarS = body.querySelector('#admin-subs-batchbar');
        const batchCountS = body.querySelector('#admin-subs-batch-count');
        function updateSubsBatch() {
          const checked = subsListDiv.querySelectorAll('.admin-subs-check:checked');
          if (batchBarS) batchBarS.style.display = checked.length > 0 ? '' : 'none';
          if (batchCountS) batchCountS.textContent = `已选 ${checked.length} 项`;
        }
        subsListDiv.querySelectorAll('.admin-subs-check').forEach(cb => cb.addEventListener('change', updateSubsBatch));

        const batchApprove = body.querySelector('#admin-subs-batch-approve');
        if (batchApprove && !batchApprove.dataset.bound) {
          batchApprove.dataset.bound = '1';
          batchApprove.addEventListener('click', async () => {
            const ids = Array.from(subsListDiv.querySelectorAll('.admin-subs-check:checked')).map(cb => cb.dataset.id);
            if (!ids.length) return;
            if (!confirm(`确认批量通过 ${ids.length} 条投稿？`)) return;
            batchApprove.disabled = true; const t = batchApprove.textContent; batchApprove.textContent = '处理中…';
            let ok = 0, fail = 0;
            for (const sid of ids) {
              const card = subsListDiv.querySelector(`.admin-sub[data-id="${CSS.escape(sid)}"]`);
              const patch = {};
              if (card) {
                card.querySelectorAll('[data-k]').forEach(el => {
                  const k = el.dataset.k;
                  if (k === 'note') return;
                  if (k === 'tags') patch[k] = el.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean);
                  else patch[k] = el.value;
                });
              }
              const r2 = await API.adminReview(sid, 'approved', { patch });
              if (r2.ok) ok++; else fail++;
            }
            batchApprove.disabled = false; batchApprove.textContent = t;
            banner(`批量通过完成 · 成功 ${ok} 条${fail ? ` · 失败 ${fail} 条` : ''}`, fail ? 'err' : 'ok');
            drawSubsTab();
          });
        }

        const batchReject = body.querySelector('#admin-subs-batch-reject');
        if (batchReject && !batchReject.dataset.bound) {
          batchReject.dataset.bound = '1';
          batchReject.addEventListener('click', async () => {
            const ids = Array.from(subsListDiv.querySelectorAll('.admin-subs-check:checked')).map(cb => cb.dataset.id);
            if (!ids.length) return;
            const note = prompt(`批量打回 ${ids.length} 条投稿，输入统一备注（可留空）：`, '');
            if (note === null) return;
            batchReject.disabled = true; const t = batchReject.textContent; batchReject.textContent = '处理中…';
            let ok = 0, fail = 0;
            for (const sid of ids) {
              const r2 = await API.adminReview(sid, 'rejected', { note: note || '' });
              if (r2.ok) ok++; else fail++;
            }
            batchReject.disabled = false; batchReject.textContent = t;
            banner(`批量打回完成 · 成功 ${ok} 条${fail ? ` · 失败 ${fail} 条` : ''}`, fail ? 'err' : 'ok');
            drawSubsTab();
          });
        }
      }

      // 搜索
      searchInputS.addEventListener('input', debounce(() => { subsPage = 1; renderSubsPage(); }, 250));

      // 状态筛选
      document.getElementById('admin-subs-status').addEventListener('change', async () => {
        const v = document.getElementById('admin-subs-status').value;
        const res = await API.adminListSubmissions(v, '');
        allSubs = res.ok ? res.list : [];
        subsPage = 1;
        // 更新计数
        const noteEl = body.querySelector('.admin-toolbar-note');
        if (noteEl) noteEl.textContent = `共 ${allSubs.length} 条${res.fallback ? '（降级模式）' : ''}`;
        renderSubsPage();
      });

      renderSubsPage();
    }

    // ========== Tab 2：档案管理 ==========
    async function drawEntriesTab() {
      const body = document.getElementById('admin-tab-body');
      body.innerHTML = `
        <div class="admin-toolbar">
          <div class="admin-filter-inline">
            <label>分类
              <select id="admin-entry-cat">
                ${DATA.categories.map(c => `<option value="${c.id}">${c.name} (${statsCounts()[c.id]||0})</option>`).join('')}
              </select>
            </label>
            <input type="text" id="admin-entry-search" placeholder="搜索编号 / 标题…" class="admin-search-input">
            <button class="abtn abtn-approve" id="admin-add-entry">＋ 新增档案</button>
          </div>
          <span id="admin-entry-flag" class="admin-toolbar-note"></span>
        </div>
        <div id="admin-entries-list" class="admin-loading">加载列表…</div>
      `;
      const catSel = document.getElementById('admin-entry-cat');
      const searchInput = document.getElementById('admin-entry-search');
      const flag = document.getElementById('admin-entry-flag');
      const listDiv = document.getElementById('admin-entries-list');
      let allEntries = [];
      let entryPage = 1;
      const ENTRY_PAGE_SIZE = 20;

      async function refreshEntries() {
        const cat = catSel.value;
        const r = await API.adminListEntries(cat);
        allEntries = r.ok ? r.list : [];
        if (flag) flag.textContent = r.fallback ? '降级模式' : `共 ${r.total} 条`;
        if (!r.ok) { listDiv.textContent = '加载失败：' + (r.msg||''); return; }
        entryPage = 1;
        renderEntryPage();
      }

      function renderEntryPage() {
        const cat = catSel.value;
        const q = (searchInput.value || '').trim().toLowerCase();
        let filtered = allEntries;
        if (q) {
          filtered = allEntries.filter(x =>
            String(x.id).toLowerCase().includes(q) ||
            String(x.title||'').toLowerCase().includes(q) ||
            String(x.code||'').toLowerCase().includes(q)
          );
        }
        if (!filtered.length) {
          listDiv.innerHTML = `<div class="admin-empty">${q ? '未找到匹配档案' : '此分类暂无档案'}</div>`;
          return;
        }
        const totalPages = Math.max(1, Math.ceil(filtered.length / ENTRY_PAGE_SIZE));
        if (entryPage > totalPages) entryPage = totalPages;
        const start = (entryPage - 1) * ENTRY_PAGE_SIZE;
        const pageItems = filtered.slice(start, start + ENTRY_PAGE_SIZE);

        listDiv.innerHTML = `
          <div class="admin-batch-bar" id="admin-entries-batchbar" style="display:none">
            <span class="admin-batch-count" id="admin-entries-batch-count">已选 0 项</span>
            <button class="abtn abtn-danger" id="admin-entries-batch-del">批量删除选中</button>
          </div>
          <table class="admin-table">
            <thead><tr><th style="width:32px"><input type="checkbox" id="admin-entries-selectall"></th><th style="width:140px">编号</th><th>标题</th><th style="width:120px">等级/代号</th><th style="width:200px">操作</th></tr></thead>
            <tbody>
              ${pageItems.map(x => `
                <tr data-id="${escapeAttr(x.id)}">
                  <td><input type="checkbox" class="admin-entries-check" data-id="${escapeAttr(x.id)}"></td>
                  <td class="atd-mono">${escapeHtml(x.id)}</td>
                  <td>${escapeHtml(x.title)}</td>
                  <td>
                    <div>${escapeHtml(CLASS_NAMES[x.class]||x.class||'—')}</div>
                    <div style="color:var(--text-3);font-size:11px;font-family:var(--f-mono)">${escapeHtml(x.code||'')}</div>
                  </td>
                  <td>
                    <button class="abtn abtn-mini" data-act="edit">编辑</button>
                    <button class="abtn abtn-mini abtn-danger" data-act="del">删除</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${totalPages > 1 ? `
            <div class="admin-pager">
              <button class="abtn abtn-mini" data-page="prev" ${entryPage<=1?'disabled':''}>‹ 上一页</button>
              <span class="pager-info">第 ${entryPage} / ${totalPages} 页 · 共 ${filtered.length} 条${q ? '（搜索结果）' : ''}</span>
              <button class="abtn abtn-mini" data-page="next" ${entryPage>=totalPages?'disabled':''}>下一页 ›</button>
            </div>
          ` : filtered.length > ENTRY_PAGE_SIZE ? '' : ''}
        `;

        // 行事件
        listDiv.querySelectorAll('tbody tr').forEach(tr => {
          const id = tr.dataset.id;
          const x = filtered.find(y => String(y.id) === String(id));
          if (!x) return;
          tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEntryEditor(cat, x));
          tr.querySelector('[data-act="del"]').addEventListener('click', async () => {
            if (!confirm(`确认删除？删除后无法恢复：\n${cat} / ${x.id} / ${x.title}`)) return;
            const rd = await API.adminDeleteEntry(cat, x.id);
            if (!rd.ok) return banner(rd.msg || '删除失败', 'err');
            banner('已删除 ' + x.id, 'ok'); refreshEntries();
          });
        });

        // 分页
        listDiv.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.page === 'prev') entryPage--;
            else if (btn.dataset.page === 'next') entryPage++;
            renderEntryPage();
          });
        });

        // 批量删除
        const selectAll = listDiv.querySelector('#admin-entries-selectall');
        const batchBar = listDiv.querySelector('#admin-entries-batchbar');
        const batchCount = listDiv.querySelector('#admin-entries-batch-count');
        const batchDelBtn = listDiv.querySelector('#admin-entries-batch-del');
        function updateBatchBar() {
          const checks = listDiv.querySelectorAll('.admin-entries-check');
          const checked = listDiv.querySelectorAll('.admin-entries-check:checked');
          if (batchBar) batchBar.style.display = checked.length > 0 ? '' : 'none';
          if (batchCount) batchCount.textContent = `已选 ${checked.length} 项`;
          if (selectAll) selectAll.checked = checks.length > 0 && checked.length === checks.length;
        }
        if (selectAll) selectAll.addEventListener('change', () => {
          listDiv.querySelectorAll('.admin-entries-check').forEach(cb => { cb.checked = selectAll.checked; });
          updateBatchBar();
        });
        listDiv.querySelectorAll('.admin-entries-check').forEach(cb => cb.addEventListener('change', updateBatchBar));
        if (batchDelBtn) batchDelBtn.addEventListener('click', async () => {
          const ids = Array.from(listDiv.querySelectorAll('.admin-entries-check:checked')).map(cb => cb.dataset.id);
          if (!ids.length) return;
          if (!confirm(`确认批量删除 ${ids.length} 条档案？此操作不可恢复！`)) return;
          batchDelBtn.disabled = true; const t = batchDelBtn.textContent; batchDelBtn.textContent = '删除中…';
          let ok = 0, fail = 0;
          for (const id of ids) {
            const rd = await API.adminDeleteEntry(cat, id);
            if (rd.ok) ok++; else fail++;
          }
          batchDelBtn.disabled = false; batchDelBtn.textContent = t;
          banner(`批量删除完成 · 成功 ${ok} 条${fail ? ` · 失败 ${fail} 条` : ''}`, fail ? 'err' : 'ok');
          refreshEntries();
        });
      }

      catSel.addEventListener('change', refreshEntries);
      searchInput.addEventListener('input', debounce(() => { entryPage = 1; renderEntryPage(); }, 250));
      document.getElementById('admin-add-entry').addEventListener('click', () => {
        const blank = { id:'', title:'', code:'', class:'neutral', summary:'', body:'', tags:[] };
        openEntryEditor(catSel.value, blank, true);
      });
      refreshEntries();

      // 弹层编辑器
      function openEntryEditor(cat, x, isCreate=false) {
        const dlg = document.createElement('div');
        dlg.className = 'admin-modal';
        dlg.innerHTML = `
          <div class="admin-modal-body">
            <h3 class="am-title">${isCreate?'新增档案':'编辑档案'} · ${escapeHtml(CAT_MAP[cat]?.name||cat)} ${isCreate?'':escapeHtml(x.id||'')}</h3>
            <div class="am-grid">
              <label class="af"><span>编号 ID（新增可留空自动生成）</span><input data-f="id" value="${escapeAttr(x.id||'')}"/></label>
              <div class="af af-row-2">
                <label><span>分类（最终写回）</span>
                  <select data-f="cat">
                    ${DATA.categories.map(c=>`<option value="${c.id}" ${c.id===cat?'selected':''}>${c.name}</option>`).join('')}
                  </select>
                </label>
                <label><span>危险等级</span>
                  <select data-f="class">
                    <option value="neutral">未分级</option>
                    ${Object.entries(CLASS_NAMES).map(([k,v])=>`<option value="${k}" ${k===x.class?'selected':''}>${v}</option>`).join('')}
                  </select>
                </label>
              </div>
              <label class="af"><span>子分组</span>
                <select data-f="subcat" id="entry-subcat-select">
                  <option value="">— 未分组 —</option>
                  ${(CAT_MAP[cat]?.subcats||[]).map(s=>`<option value="${s.id}" ${s.id===x.subcat?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}
                </select>
              </label>
              <label class="af"><span>标题</span><input data-f="title" value="${escapeAttr(x.title||'')}"/></label>
              <label class="af"><span>代号</span><input data-f="code" value="${escapeAttr(x.code||'')}"/></label>
              <label class="af"><span>摘要</span><input data-f="summary" value="${escapeAttr(x.summary||'')}"/></label>
              <label class="af"><span>正文（支持 HTML）</span>
                <textarea data-f="body" rows="8">${escapeHtml(x.body||x.content||'')}</textarea>
              </label>
              <label class="af"><span>标签（逗号分隔）</span>
                <input data-f="tags" value="${escapeHtml((x.tags||[]).join(', '))}"/>
              </label>
              <label class="af"><span>封面图片路径（data/anomalies/xxx.png 或上传）</span>
                <div class="af-cover-wrap">
                  <input data-f="img" value="${escapeAttr(x.img||'')}" placeholder="data/anomalies/xxx.png"/>
                  <label class="af-cover-upload-btn">
                    ⬆ 上传
                    <input type="file" class="af-cover-file-edit" accept="image/*" hidden>
                  </label>
                </div>
                <div class="af-cover-thumb af-cover-thumb-edit">${x.img ? `<img src="${escapeAttr(resolveImgUrl(x.img))}" alt="封面" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : '<div class="af-cover-empty">无</div>'}</div>
              </label>
              <label class="af"><span>来源</span><input data-f="source" value="${escapeAttr(x.source||'')}"/></label>
            </div>
            <div class="am-foot">
              <button class="abtn abtn-cancel" data-act="cancel">取消</button>
              <button class="abtn abtn-approve" data-act="save">保存</button>
            </div>
          </div>
        `;
        document.body.appendChild(dlg);
        function close() { dlg.remove(); }
        dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        // 分类切换时刷新子分组选项
        const catSel = dlg.querySelector('[data-f="cat"]');
        const subSel = dlg.querySelector('#entry-subcat-select');
        if (catSel && subSel) {
          catSel.addEventListener('change', () => {
            const subs = (CAT_MAP[catSel.value]?.subcats) || [];
            const cur = subSel.value;
            subSel.innerHTML = '<option value="">— 未分组 —</option>' +
              subs.map(s => `<option value="${s.id}" ${s.id===cur?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
          });
        }
        // 封面上传
        const editCoverFile = dlg.querySelector('.af-cover-file-edit');
        const editCoverInput = dlg.querySelector('[data-f="img"]');
        const editCoverThumb = dlg.querySelector('.af-cover-thumb-edit');
        if (editCoverFile) {
          editCoverFile.addEventListener('change', async () => {
            const file = editCoverFile.files && editCoverFile.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { banner('仅支持图片文件', 'err'); return; }
            try {
              const r = await API.uploadImage(file);
              if (!r.ok) { banner(r.msg || '封面上传失败', 'err'); return; }
              if (editCoverInput) editCoverInput.value = r.url;
              if (editCoverThumb) editCoverThumb.innerHTML = `<img src="${r.url}" alt="封面" style="width:100%;height:100%;object-fit:cover">`;
            } catch (e) { banner('封面上传失败', 'err'); }
          });
        }
        dlg.querySelector('[data-act="save"]').addEventListener('click', async () => {
          const payload = {};
          dlg.querySelectorAll('[data-f]').forEach(el => {
            const k = el.dataset.f;
            if (k === 'cat') return;
            if (k === 'tags') payload[k] = el.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
            else payload[k] = el.value;
          });
          const finalCat = dlg.querySelector('[data-f="cat"]').value || cat;
          const saveBtn = dlg.querySelector('[data-act="save"]');
          saveBtn.disabled = true; const t = saveBtn.textContent; saveBtn.textContent = '保存中…';
          let res;
          if (isCreate) {
            res = await API.adminAddEntry(finalCat, payload);
          } else {
            const targetCat = finalCat;
            res = await API.adminUpdateEntry(targetCat, x.id, payload);
            // 如果分类变了，就需要从源分类删掉再加回来（后端这里暂只支持同分类更新；分类变更交给"通过并发布"那条路径的主文件写入）
            if (targetCat !== cat && res.ok && !res.fallback) {
              banner('提示：分类已变动，请确认 id 是否与目标分类匹配', '');
            }
          }
          saveBtn.disabled = false; saveBtn.textContent = t;
          if (!res.ok) { banner(res.msg || '保存失败','err'); return; }
          banner(isCreate ? `已新增：${res.entry?.id||''} ${res.entry?.title||''}` : `已保存：${x.id}`, 'ok');
          close();
          if (catSel.value === (finalCat || cat)) refreshEntries();
        });
      }
    }

    // ========== Tab 3：用户管理 ==========
    async function drawUsersTab() {
      const body = document.getElementById('admin-tab-body');
      body.innerHTML = `<div class="admin-loading">加载用户列表…</div>`;
      const r = await API.adminListUsers();
      if (!r.ok) { body.textContent = '加载失败：' + (r.msg||''); return; }
      const allUsers = r.list;
      let userPage = 1;
      const USER_PAGE_SIZE = 20;

      body.innerHTML = `
        <div class="admin-toolbar">
          <div class="admin-filter-inline">
            <input type="text" id="admin-user-search" placeholder="搜索账号…" class="admin-search-input">
          </div>
          <span class="admin-toolbar-note">共 ${r.total} 位用户${r.fallback ? '（降级模式）' : ''}</span>
        </div>
        <div id="admin-users-list"></div>
      `;
      const searchInputU = document.getElementById('admin-user-search');
      const usersListDiv = document.getElementById('admin-users-list');

      function renderUsersPage() {
        const q = (searchInputU.value || '').trim().toLowerCase();
        let filtered = allUsers;
        if (q) {
          filtered = allUsers.filter(u => String(u.contact).toLowerCase().includes(q));
        }
        if (!filtered.length) {
          usersListDiv.innerHTML = `<div class="admin-empty">${q ? '未找到匹配用户' : '暂无用户'}</div>`;
          return;
        }
        const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE));
        if (userPage > totalPages) userPage = totalPages;
        const start = (userPage - 1) * USER_PAGE_SIZE;
        const pageItems = filtered.slice(start, start + USER_PAGE_SIZE);

        usersListDiv.innerHTML = `
          <div class="admin-batch-bar" id="admin-users-batchbar" style="display:none">
            <span class="admin-batch-count" id="admin-users-batch-count">已选 0 项</span>
            <button class="abtn abtn-danger" id="admin-users-batch-del">批量删除选中</button>
          </div>
          <table class="admin-table">
            <thead><tr><th style="width:32px"><input type="checkbox" id="admin-users-selectall"></th><th style="width:260px">账号</th><th style="width:140px">等级</th><th style="width:140px">角色</th><th style="width:160px">注册时间</th><th style="width:240px">操作</th></tr></thead>
            <tbody>
              ${pageItems.map(u => `
                <tr data-contact="${escapeAttr(u.contact)}">
                  <td><input type="checkbox" class="admin-users-check" data-contact="${escapeAttr(u.contact)}" ${u.builtIn?'disabled':''}></td>
                  <td>
                    <span class="atd-mono">${escapeHtml(u.contact)}</span>
                    ${u.builtIn ? '<span style="margin-left:6px;color:var(--red-2);font-family:var(--f-mono);font-size:11px">BUILT-IN</span>' : ''}
                  </td>
                  <td>
                    <select data-f="level">
                      ${['LV.1','LV.2','LV.3','LV.4','LV.5','LV.9'].map(l => `<option value="${l}" ${l===(u.level||'LV.2')?'selected':''}>${l}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <select data-f="role">
                      <option value="user" ${(u.role||'user')==='user'?'selected':''}>普通用户</option>
                      <option value="admin" ${u.role==='admin'?'selected':''}>管理员</option>
                    </select>
                  </td>
                  <td class="atd-mono" style="color:var(--text-3);font-size:12px">
                    ${u.createdAt ? new Date(u.createdAt).toLocaleString('zh-CN') : '—'}
                  </td>
                  <td>
                    <button class="abtn abtn-mini" data-act="save">保存</button>
                    <button class="abtn abtn-mini abtn-danger" data-act="del" ${u.builtIn?'disabled':''}>删除</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${totalPages > 1 ? `
            <div class="admin-pager">
              <button class="abtn abtn-mini" data-page="prev" ${userPage<=1?'disabled':''}>‹ 上一页</button>
              <span class="pager-info">第 ${userPage} / ${totalPages} 页 · 共 ${filtered.length} 位用户${q ? '（搜索结果）' : ''}</span>
              <button class="abtn abtn-mini" data-page="next" ${userPage>=totalPages?'disabled':''}>下一页 ›</button>
            </div>
          ` : ''}
        `;

        usersListDiv.querySelectorAll('tbody tr').forEach(tr => {
          const contact = tr.dataset.contact;
          const levelSel = tr.querySelector('[data-f="level"]');
          const roleSel  = tr.querySelector('[data-f="role"]');
          tr.querySelector('[data-act="save"]').addEventListener('click', async () => {
            const rd = await API.adminUpdateUser(contact, { level: levelSel.value, role: roleSel.value });
            if (!rd.ok) return banner(rd.msg || '保存失败', 'err');
            banner('已更新 ' + contact, 'ok');
          });
          const delBtn = tr.querySelector('[data-act="del"]');
          if (delBtn && !delBtn.disabled) delBtn.addEventListener('click', async () => {
            if (!confirm(`确认删除账号？该用户的投稿将保留但作者置为"已注销用户"：${contact}`)) return;
            const rd = await API.adminDeleteUser(contact);
            if (!rd.ok) return banner(rd.msg || '删除失败', 'err');
            banner(rd.msg || '已删除', 'ok'); drawUsersTab();
          });
        });

        // 分页
        usersListDiv.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.page === 'prev') userPage--;
            else if (btn.dataset.page === 'next') userPage++;
            renderUsersPage();
          });
        });

        // 批量删除
        const selectAllU = usersListDiv.querySelector('#admin-users-selectall');
        const batchBarU = usersListDiv.querySelector('#admin-users-batchbar');
        const batchCountU = usersListDiv.querySelector('#admin-users-batch-count');
        const batchDelU = usersListDiv.querySelector('#admin-users-batch-del');
        function updateUsersBatch() {
          const checks = usersListDiv.querySelectorAll('.admin-users-check');
          const checked = usersListDiv.querySelectorAll('.admin-users-check:checked');
          if (batchBarU) batchBarU.style.display = checked.length > 0 ? '' : 'none';
          if (batchCountU) batchCountU.textContent = `已选 ${checked.length} 项`;
          if (selectAllU) selectAllU.checked = checks.length > 0 && checked.length === checks.length;
        }
        if (selectAllU) selectAllU.addEventListener('change', () => {
          usersListDiv.querySelectorAll('.admin-users-check:not(:disabled)').forEach(cb => { cb.checked = selectAllU.checked; });
          updateUsersBatch();
        });
        usersListDiv.querySelectorAll('.admin-users-check').forEach(cb => cb.addEventListener('change', updateUsersBatch));
        if (batchDelU) batchDelU.addEventListener('click', async () => {
          const contacts = Array.from(usersListDiv.querySelectorAll('.admin-users-check:checked')).map(cb => cb.dataset.contact);
          if (!contacts.length) return;
          if (!confirm(`确认批量删除 ${contacts.length} 个账号？此操作不可恢复！`)) return;
          batchDelU.disabled = true; const t = batchDelU.textContent; batchDelU.textContent = '删除中…';
          let ok = 0, fail = 0;
          for (const c of contacts) {
            const rd = await API.adminDeleteUser(c);
            if (rd.ok) ok++; else fail++;
          }
          batchDelU.disabled = false; batchDelU.textContent = t;
          banner(`批量删除完成 · 成功 ${ok} 个${fail ? ` · 失败 ${fail} 个` : ''}`, fail ? 'err' : 'ok');
          drawUsersTab();
        });
      }

      searchInputU.addEventListener('input', () => { userPage = 1; renderUsersPage(); });
      renderUsersPage();
    }

    drawAdminTab();
  }

  // ============ 404 ============
  function renderNotFound() {
    view.innerHTML = `
      <div class="notfound-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;padding:60px 24px;text-align:center">
        <div class="notfound-stamp" style="width:220px;height:220px;margin-bottom:32px;position:relative">
          <img src="404-stamp.png" alt="ARCHIVE DESTROYED" style="width:100%;height:100%;object-fit:contain;opacity:0.85;filter:grayscale(1) contrast(1.2)"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div style="display:none;width:100%;height:100%;border-radius:50%;border:4px solid var(--red-2);align-items:center;justify-content:center;flex-direction:column;font-family:var(--f-mono);color:var(--red-2);transform:rotate(-8deg);opacity:0.7">
            <span style="font-size:18px;font-weight:bold;letter-spacing:2px">ARCHIVE</span>
            <span style="font-size:18px;font-weight:bold;letter-spacing:2px">DESTROYED</span>
          </div>
        </div>
        <h1 style="font-family:var(--f-mono);font-size:64px;font-weight:900;letter-spacing:8px;color:var(--text);margin:0">404</h1>
        <div style="font-family:var(--f-mono);font-size:13px;letter-spacing:3px;color:var(--text-2);margin-top:8px">FILE NOT FOUND · 档案路径不存在</div>
        <p style="color:var(--text-2);max-width:400px;margin:20px 0 32px;line-height:1.7">该路径未被归档或已被销毁。请通过顶部导航返回有效区域，或使用搜索功能查找目标档案。</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
          <a href="#/" style="display:inline-block;padding:10px 28px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);font-family:var(--f-mono);font-size:12px;letter-spacing:1px;text-decoration:none;cursor:pointer">← 返回首页</a>
          <a href="#/search" style="display:inline-block;padding:10px 28px;border:1px solid var(--gold-2);background:transparent;color:var(--gold-1);font-family:var(--f-mono);font-size:12px;letter-spacing:1px;text-decoration:none;cursor:pointer">${ico('search',14)} 搜索档案</a>
        </div>
      </div>
    `;
  }

  // ============ 全局搜索绑定 ============
  const SEARCH_HISTORY_KEY = 'wa_search_history';
  function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); }
    catch { return []; }
  }
  function saveSearchHistory(kw) {
    kw = (kw || '').trim();
    if (!kw) return;
    let h = getSearchHistory();
    h = [kw, ...h.filter(k => k.toLowerCase() !== kw.toLowerCase())].slice(0, 8);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h));
  }
  function removeSearchHistory(kw) {
    let h = getSearchHistory().filter(k => k !== kw);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h));
  }
  function clearSearchHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }
  // 获取热门标签（按出现频次）
  function getPopularTags(limit = 12) {
    const counts = {};
    allEntries().forEach(e => {
      (e.tags || []).forEach(t => {
        if (!t) return;
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, n]) => ({ tag, n }));
  }

  function bindGlobalSearch() {
    const input = document.getElementById('global-search');
    const btn = document.getElementById('search-btn');
    const dropdown = document.getElementById('search-dropdown');
    const histList = document.getElementById('sd-history-list');
    const histSection = document.getElementById('sd-history');
    const suggestSection = document.getElementById('sd-suggest');
    const suggestList = document.getElementById('sd-suggest-list');
    const emptyEl = document.getElementById('sd-empty');
    const clearBtn = document.getElementById('sh-clear');
    if (!input || !btn || !dropdown) return;

    const submit = () => {
      const q = input.value.trim();
      if (q) {
        saveSearchHistory(q);
        hideDropdown();
        SFX.search();
        location.hash = `#/search?q=${encodeURIComponent(q)}`;
      }
    };

    function renderHistory() {
      const h = getSearchHistory();
      if (!h.length) {
        histSection.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }
      emptyEl.style.display = 'none';
      histSection.style.display = 'block';
      histList.innerHTML = h.map(k => `
        <span class="sd-item" data-kw="${escapeAttr(k)}">
          <span class="sd-kw">${escapeHtml(k)}</span>
          <button type="button" class="sd-rm" data-rm="${escapeAttr(k)}" title="移除" aria-label="移除">×</button>
        </span>`).join('');
    }

    function renderSuggestions(q) {
      q = (q || '').trim().toLowerCase();
      if (!q) { suggestSection.style.display = 'none'; return; }
      const matches = allEntries().filter(e => {
        const h = [e.id, e.code, e.title, e.summary, (e.tags||[]).join(' ')]
          .filter(Boolean).join(' ').toLowerCase();
        return h.includes(q);
      }).slice(0, 6);
      if (!matches.length) { suggestSection.style.display = 'none'; return; }
      suggestSection.style.display = 'block';
      suggestList.innerHTML = matches.map(e => {
        const label = e.title || e.code || e.id;
        const catLabel = CAT_MAP[e._cat] ? CAT_MAP[e._cat].name : e._cat;
        return `<a class="sd-item sd-suggest-item" href="#/entry/${e._cat}/${encodeURIComponent(e.id)}" data-nav="1">
          <span class="sd-kw">${highlightKeyword(label, q)}</span>
          <span class="sd-cat">${escapeHtml(catLabel)}</span>
        </a>`;
      }).join('');
    }

    function showDropdown() {
      renderHistory();
      renderSuggestions(input.value);
      dropdown.classList.add('active');
    }
    function hideDropdown() { dropdown.classList.remove('active'); }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') { hideDropdown(); input.blur(); }
    });
    input.addEventListener('focus', showDropdown);
    input.addEventListener('input', debounce(() => {
      if (document.activeElement === input) renderSuggestions(input.value);
    }, 180));

    // 点击历史项/建议项
    dropdown.addEventListener('click', e => {
      const rm = e.target.closest('.sd-rm');
      if (rm) {
        e.preventDefault(); e.stopPropagation();
        removeSearchHistory(rm.getAttribute('data-rm'));
        renderHistory();
        return;
      }
      const item = e.target.closest('.sd-item');
      if (item) {
        const kw = item.getAttribute('data-kw');
        const nav = item.getAttribute('data-nav');
        if (nav) { hideDropdown(); return; } // 建议项是 <a> 直接跳转
        if (kw) {
          input.value = kw;
          submit();
        }
      }
    });
    // 清除历史
    if (clearBtn) clearBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      clearSearchHistory();
      renderHistory();
    });

    // 点击外部关闭
    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target) && e.target !== input) hideDropdown();
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ============ 卡片图片全局降级（inline onerror/onload 调用，必须挂 window）============
  window.__tryNextAnomImg = function (imgEl) {
    if (!imgEl) return;
    try {
      const srcs = JSON.parse(imgEl.getAttribute('data-srcs') || '[]');
      let idx = parseInt(imgEl.getAttribute('data-idx') || '0', 10) || 0;
      idx += 1;
      if (idx >= srcs.length) {
        // 全部失败：隐藏 <img>，父容器会显示 fallback（它默认显示在底层）
        imgEl.style.display = 'none';
        imgEl.onerror = null;
        return;
      }
      imgEl.setAttribute('data-idx', String(idx));
      imgEl.src = srcs[idx];
    } catch (_) {
      imgEl.style.display = 'none';
    }
  };
  window.__markAnomImgLoaded = function (imgEl) {
    if (!imgEl) return;
    // 标记加载成功，CSS 可以据此隐藏 fallback
    imgEl.classList.add('loaded');
    const wrap = imgEl.closest && imgEl.closest('.anom-thumb');
    if (wrap) wrap.classList.add('has-img');
  };

  // ============ v2.1 工具函数 ============
  // 防抖
  function debounce(fn, delay) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 图片懒加载
  let _lazyObserver = null;
  function initLazyLoad() {
    if (!('IntersectionObserver' in window)) return;
    if (_lazyObserver) _lazyObserver.disconnect();
    _lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          const src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
          }
          _lazyObserver.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });
    // 观察所有带 data-src 的图片
    document.querySelectorAll('img[data-src]').forEach(img => _lazyObserver.observe(img));
  }

  // 图片灯箱
  let _lightboxImgs = [];
  let _lightboxIdx = 0;
  function openLightbox(imgs, index) {
    _lightboxImgs = imgs;
    _lightboxIdx = index;
    const ov = document.createElement('div');
    ov.className = 'lightbox-overlay';
    ov.innerHTML = `
      <span class="lightbox-close">&times;</span>
      ${imgs.length > 1 ? '<span class="lightbox-nav lightbox-prev">&#8249;</span>' : ''}
      <img class="lightbox-img" src="${escapeAttr(imgs[index])}">
      ${imgs.length > 1 ? '<span class="lightbox-nav lightbox-next">&#8250;</span>' : ''}
      ${imgs.length > 1 ? `<span class="lightbox-counter">${index + 1} / ${imgs.length}</span>` : ''}
    `;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); };
    ov.addEventListener('click', (ev) => {
      if (ev.target === ov || ev.target.classList.contains('lightbox-close')) close();
      else if (ev.target.classList.contains('lightbox-prev')) {
        _lightboxIdx = (_lightboxIdx - 1 + _lightboxImgs.length) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      } else if (ev.target.classList.contains('lightbox-next')) {
        _lightboxIdx = (_lightboxIdx + 1) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      }
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      else if (e.key === 'ArrowLeft' && _lightboxImgs.length > 1) {
        _lightboxIdx = (_lightboxIdx - 1 + _lightboxImgs.length) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      } else if (e.key === 'ArrowRight' && _lightboxImgs.length > 1) {
        _lightboxIdx = (_lightboxIdx + 1) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      }
    });
  }

  // 绑定灯箱到容器内所有图片
  function bindLightbox(container) {
    if (!container) return;
    const imgs = container.querySelectorAll('img[src]:not(.no-lightbox)');
    const srcList = [];
    imgs.forEach((img, i) => {
      const src = img.src || (img.getAttribute('data-src') || '');
      if (src && !src.startsWith('data:')) srcList.push(src);
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = srcList.indexOf(img.src || img.getAttribute('data-src'));
        openLightbox(srcList, Math.max(0, idx));
      });
    });
  }

  // 返回顶部按钮
  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', debounce(() => {
      btn.classList.toggle('visible', window.scrollY > 400);
    }, 100));
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 导出档案
  function exportEntry(cat, entry, format) {
    const meta = CAT_MAP[cat];
    const cls = CLASS_NAMES[entry.class] || entry.class || '未分级';
    let content, mime, ext;
    if (format === 'json') {
      content = JSON.stringify({ category: cat, categoryName: meta?.name, ...entry }, null, 2);
      mime = 'application/json'; ext = 'json';
    } else {
      // Markdown
      const tags = (entry.tags || []).map(t => `\`${t}\``).join(' ');
      content = `# ${entry.title}\n\n> 编号: ${entry.id}\n> 分类: ${meta?.name || cat}\n> 危险等级: ${cls}\n> 代号: ${entry.code || '—'}\n\n## 摘要\n\n${entry.summary || ''}\n\n## 正文\n\n${(entry.body || '').replace(/<[^>]+>/g, '')}\n\n## 标签\n\n${tags || '—'}\n`;
      mime = 'text/markdown'; ext = 'md';
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${entry.id}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ============ 侧边栏 ============
  let _sidebarBound = false;
  function initSidebar() {
    if (_sidebarBound) return;
    _sidebarBound = true;

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    if (!sidebar || !toggleBtn) return;

    const STORAGE_KEY = 'wa_sidebar_open';
    const isMobile = () => window.innerWidth <= 900;

    function open() {
      sidebar.classList.add('open');
      document.body.classList.add('sidebar-open');
      if (overlay) overlay.classList.add('active');
      SFX.sidebarOpen();
    }
    function close() {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      if (overlay) overlay.classList.remove('active');
      SFX.sidebarClose();
    }
    function toggle() {
      sidebar.classList.contains('open') ? close() : open();
    }

    // 持久化状态（仅桌面端记忆）
    function saveState() {
      try {
        if (!isMobile()) localStorage.setItem(STORAGE_KEY, sidebar.classList.contains('open') ? '1' : '0');
      } catch {}
    }
    function loadState() {
      try {
        // 桌面端恢复记忆，移动端默认关闭
        if (!isMobile() && localStorage.getItem(STORAGE_KEY) === '1') open();
      } catch {}
    }

    toggleBtn.addEventListener('click', () => { toggle(); saveState(); });
    if (closeBtn) closeBtn.addEventListener('click', () => { close(); saveState(); });
    if (overlay) overlay.addEventListener('click', () => { close(); saveState(); });

    // 点击导航链接后，移动端自动收起
    sidebar.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
      link.addEventListener('click', () => {
        if (isMobile()) close();
      });
    });

    // 快捷操作按钮
    const themeBtn = document.getElementById('sb-theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      Theme.set(Theme.get() === 'light' ? 'dark' : 'light');
      SFX.theme();
    });

    const backTopBtn = document.getElementById('sb-back-top');
    if (backTopBtn) backTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const exportBtn = document.getElementById('sb-export-data');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      if (typeof exportBackupJSON === 'function') exportBackupJSON();
    });

    // 侧边栏音效开关
    const sbSfxBtn = document.getElementById('sb-sfx-toggle');
    if (sbSfxBtn) sbSfxBtn.addEventListener('click', () => {
      SFX.toggle(); syncSfxUI();
    });
    // 初始同步
    if (typeof syncSfxUI === 'function') syncSfxUI();

    // 窗口尺寸变化时调整
    let _resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        if (isMobile() && sidebar.classList.contains('open')) {
          // 移动端切换时确保遮罩显示
          if (overlay) overlay.classList.add('active');
        }
      }, 150);
    });

    loadState();

    // 移动端滑动手势关闭侧边栏
    let touchStartX = 0, touchStartY = 0, touchDeltaX = 0, isTracking = false;
    sidebar.addEventListener('touchstart', (e) => {
      if (!isMobile() || !sidebar.classList.contains('open')) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchDeltaX = 0;
      isTracking = true;
    }, { passive: true });
    sidebar.addEventListener('touchmove', (e) => {
      if (!isTracking) return;
      const t = e.touches[0];
      touchDeltaX = t.clientX - touchStartX;
      if (touchDeltaX < 0) {
        sidebar.style.transform = `translateX(${touchDeltaX}px)`;
        sidebar.style.transition = 'none';
      }
    }, { passive: true });
    sidebar.addEventListener('touchend', () => {
      if (!isTracking) return;
      isTracking = false;
      sidebar.style.transition = '';
      sidebar.style.transform = '';
      if (touchDeltaX < -80) { close(); saveState(); }
    });
    // 从屏幕左缘右滑打开
    document.addEventListener('touchstart', (e) => {
      if (!isMobile() || sidebar.classList.contains('open')) return;
      const t = e.touches[0];
      if (t.clientX < 24) {
        touchStartX = t.clientX;
        isTracking = true;
      }
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!isTracking || isMobile() === false) { isTracking = false; return; }
      const t = e.changedTouches[0];
      if (t.clientX - touchStartX > 60 && !sidebar.classList.contains('open')) {
        open();
      }
      isTracking = false;
    });

    // 移动端底部菜单按钮
    const mtabMenu = document.getElementById('mtab-menu');
    if (mtabMenu) mtabMenu.addEventListener('click', () => { toggle(); saveState(); });

    // ===== 桌面端滚动自动隐藏/显示 =====
    let lastScrollY = window.scrollY;
    let scrollTimer = null;
    let edgeHoverTimer = null;
    const EDGE_ZONE = 8; // 左侧边缘触发宽度

    function handleScrollAuto() {
      if (isMobile()) return;
      if (!sidebar.classList.contains('open')) return; // 未打开不处理
      const curY = window.scrollY;
      const delta = curY - lastScrollY;
      // 向下滚动超过 8px 且不在顶部附近 → 隐藏
      if (delta > 8 && curY > 100) {
        sidebar.classList.add('auto-hidden');
      }
      // 向上滚动 → 显示
      else if (delta < -8) {
        sidebar.classList.remove('auto-hidden');
      }
      lastScrollY = curY;
    }

    window.addEventListener('scroll', () => {
      if (isMobile()) return;
      clearTimeout(scrollTimer);
      handleScrollAuto();
    }, { passive: true });

    // 鼠标移到左侧边缘 → 自动显示
    document.addEventListener('mousemove', (e) => {
      if (isMobile()) return;
      // 仅在侧边栏已打开但被隐藏时，或未打开时，检测边缘
      if (e.clientX <= EDGE_ZONE) {
        clearTimeout(edgeHoverTimer);
        edgeHoverTimer = setTimeout(() => {
          if (!sidebar.classList.contains('open')) {
            open();
            saveState();
          } else if (sidebar.classList.contains('auto-hidden')) {
            sidebar.classList.remove('auto-hidden');
          }
        }, 120);
      }
      // 鼠标移到侧边栏区域也取消隐藏
      if (sidebar.classList.contains('auto-hidden') && e.clientX <= 260) {
        sidebar.classList.remove('auto-hidden');
      }
    });

    // 点击侧边栏外区域（右侧）时不影响，但确保离开边缘区清除定时器
    document.addEventListener('mousemove', (e) => {
      if (e.clientX > EDGE_ZONE + 20) clearTimeout(edgeHoverTimer);
    });
  }

  // 侧边栏导航高亮
  function updateSidebarNav(path) {
    document.querySelectorAll('.sidebar-link[data-route]').forEach(a => {
      const route = a.dataset.route;
      const active = route === '/' ? path === '/' : path.startsWith(route);
      a.classList.toggle('active', active);
    });
    // 移动端底部导航高亮
    document.querySelectorAll('.mtab[data-route]').forEach(a => {
      const route = a.dataset.route;
      const active = route === '/' ? path === '/' : path.startsWith(route);
      a.classList.toggle('active', active);
    });
  }

  // 侧边栏统计刷新
  function refreshSidebarStats() {
    const idEl = document.getElementById('sb-stat-identity');
    if (idEl) idEl.textContent = '身份：' + Auth.identity();
    const totEl = document.getElementById('sb-stat-total');
    if (totEl) totEl.textContent = '在档条目：' + (statsTotal() || 0) + ' 条';
    // 管理员入口
    const adminLinks = document.querySelectorAll('.sidebar-admin-link');
    adminLinks.forEach(l => l.style.display = Auth.isAdmin() ? 'flex' : 'none');
  }

  // ============ 音效模块（Web Audio API 合成，无需外部文件）============
  const SFX = (() => {
    let _ctx = null;
    let _masterGain = null;
    let _reverbBus = null;   // 简易混响总线
    let _dryGain = null;     // 干声通道
    let _wetGain = null;     // 湿声通道
    let _muted = false;
    let _volume = 0.5;       // 主音量 0~1
    const STORAGE_KEY = 'wa_sfx_muted';
    const VOL_KEY = 'wa_sfx_vol';

    function _ensureCtx() {
      if (_ctx) return _ctx;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        _ctx = new Ctx();

        // 主总线 → destination
        _masterGain = _ctx.createGain();
        _masterGain.gain.value = _volume;
        _masterGain.connect(_ctx.destination);

        // 干声通道
        _dryGain = _ctx.createGain();
        _dryGain.gain.value = 0.85;
        _dryGain.connect(_masterGain);

        // 湿声通道：反馈延迟网络（简易混响）
        _wetGain = _ctx.createGain();
        _wetGain.gain.value = 0.35;
        _wetGain.connect(_masterGain);

        const delay1 = _ctx.createDelay(1.0);
        delay1.delayTime.value = 0.13;
        const fb1 = _ctx.createGain();
        fb1.gain.value = 0.42;
        const lp1 = _ctx.createBiquadFilter();
        lp1.type = 'lowpass'; lp1.frequency.value = 3200;
        delay1.connect(lp1); lp1.connect(fb1); fb1.connect(delay1);
        delay1.connect(_wetGain);

        const delay2 = _ctx.createDelay(1.0);
        delay2.delayTime.value = 0.07;
        const fb2 = _ctx.createGain();
        fb2.gain.value = 0.38;
        delay2.connect(fb2); fb2.connect(delay2);
        delay2.connect(_wetGain);

        _reverbBus = { delay1, delay2 };
      } catch { return null; }
      return _ctx;
    }
    // 用户首次交互时解锁 AudioContext（浏览器策略）
    function _unlock() {
      const ctx = _ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
    document.addEventListener('pointerdown', _unlock, { once: false });
    document.addEventListener('keydown', _unlock, { once: false });

    function loadPref() {
      try {
        _muted = localStorage.getItem(STORAGE_KEY) === '1';
        const v = parseFloat(localStorage.getItem(VOL_KEY));
        if (!isNaN(v)) _volume = Math.max(0, Math.min(1, v));
      } catch {}
    }
    function savePref() {
      try {
        localStorage.setItem(STORAGE_KEY, _muted ? '1' : '0');
        localStorage.setItem(VOL_KEY, String(_volume));
      } catch {}
    }
    loadPref();

    function isMuted() { return _muted; }
    function setMuted(v) { _muted = !!v; savePref(); Bus.emit('sfx:changed', { muted: _muted }); }
    function toggle() { setMuted(!_muted); return _muted; }
    function getVolume() { return _volume; }
    function setVolume(v) {
      _volume = Math.max(0, Math.min(1, v));
      if (_masterGain) _masterGain.gain.value = _volume;
      savePref();
      Bus.emit('sfx:changed', { volume: _volume });
    }

    // 核心播放：合成一段单音（带低通滤波 + 可选混响发送）
    function _tone({ freq = 440, type = 'sine', dur = 0.1, vol = 1, attack = 0.008, release = 0.08, freqEnd = null, delay = 0, sendReverb = 0.3, lp = 0, detune = 0 }) {
      if (_muted) return;
      const ctx = _ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + dur);
      if (detune) osc.detune.setValueAtTime(detune, now);
      // 指数包络（比 linear 更自然）
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);

      // 可选低通滤波（让高频音色更柔和）
      let lastNode = g;
      if (lp > 0) {
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = lp;
        lowpass.Q.value = 0.7;
        osc.connect(lowpass); lowpass.connect(g);
      } else {
        osc.connect(g);
      }
      // 干声
      g.connect(_dryGain);
      // 湿声发送
      if (sendReverb > 0 && _reverbBus) {
        const sendGain = ctx.createGain();
        sendGain.gain.value = sendReverb;
        g.connect(sendGain);
        sendGain.connect(_reverbBus.delay1);
        sendGain.connect(_reverbBus.delay2);
      }
      osc.start(now);
      osc.stop(now + dur + release + 0.05);
    }

    // 双振荡器混合音色（更饱满）
    function _dualTone(opts) {
      const { type1 = 'sine', type2 = 'triangle', detune2 = 6, vol2 = 0.5, ...rest } = opts;
      _tone({ ...rest, type: type1 });
      _tone({ ...rest, type: type2, vol: (rest.vol || 1) * vol2, detune: detune2, delay: (rest.delay || 0), sendReverb: 0.15 });
    }

    // 噪声（带低通，更柔和）
    function _noise({ dur = 0.05, vol = 0.6, filterFreq = 1800, filterType = 'bandpass', delay = 0, sendReverb = 0.1, lp = 0 }) {
      if (_muted) return;
      const ctx = _ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = filterType; bp.frequency.value = filterFreq;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp); bp.connect(g);
      // 可选低通
      if (lp > 0) {
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass'; lowpass.frequency.value = lp;
        g.connect(lowpass); lowpass.connect(_dryGain);
        if (sendReverb > 0 && _reverbBus) {
          const sg = ctx.createGain(); sg.gain.value = sendReverb;
          lowpass.connect(sg); sg.connect(_reverbBus.delay1);
        }
      } else {
        g.connect(_dryGain);
        if (sendReverb > 0 && _reverbBus) {
          const sg = ctx.createGain(); sg.gain.value = sendReverb;
          g.connect(sg); sg.connect(_reverbBus.delay1);
        }
      }
      src.start(now);
      src.stop(now + dur + 0.02);
    }

    // === 对外音效 API ===
    const api = {
      isMuted, setMuted, toggle, getVolume, setVolume,
      // 通用按钮点击（柔和短哔）
      click: () => _dualTone({ freq: 720, type1: 'sine', type2: 'triangle', dur: 0.04, vol: 0.28, release: 0.04, lp: 2400, sendReverb: 0.12 }),
      // 侧边栏开（滑入 + 咔嗒，温暖低频）
      sidebarOpen: () => {
        _noise({ dur: 0.06, vol: 0.15, filterFreq: 800, filterType: 'lowpass', sendReverb: 0.2 });
        _dualTone({ freq: 180, freqEnd: 360, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 1800, sendReverb: 0.25 });
      },
      // 侧边栏关（滑出 + 咔嗒）
      sidebarClose: () => {
        _noise({ dur: 0.06, vol: 0.12, filterFreq: 600, filterType: 'lowpass', sendReverb: 0.2 });
        _dualTone({ freq: 360, freqEnd: 180, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 1800, sendReverb: 0.25 });
      },
      // 导航/路由切换（两下柔和拨弦，带混响）
      navigate: () => {
        _dualTone({ freq: 587, type1: 'sine', type2: 'triangle', dur: 0.07, vol: 0.2, release: 0.06, lp: 3200, sendReverb: 0.35 });
        _dualTone({ freq: 740, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.16, release: 0.08, lp: 3200, delay: 0.05, sendReverb: 0.35 });
      },
      // 搜索触发（短促下滑音）
      search: () => _dualTone({ freq: 1046, freqEnd: 698, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.24, release: 0.05, lp: 4000, sendReverb: 0.2 }),
      // 搜索命中（柔和金属铃，带长尾混响）
      hit: () => {
        _dualTone({ freq: 1318, type1: 'sine', type2: 'triangle', dur: 0.12, vol: 0.2, release: 0.15, lp: 5000, sendReverb: 0.55 });
        _tone({ freq: 2637, type: 'sine', dur: 0.08, vol: 0.08, release: 0.12, delay: 0.01, sendReverb: 0.4 });
      },
      // 搜索无结果（低频柔和嘟）
      miss: () => _dualTone({ freq: 220, freqEnd: 146, type1: 'sine', type2: 'triangle', dur: 0.18, vol: 0.24, release: 0.1, lp: 1200, sendReverb: 0.3 }),
      // 登录成功（上行五声音阶，温暖）
      login: () => {
        _dualTone({ freq: 523, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.22, release: 0.06, lp: 3200, sendReverb: 0.3 });
        _dualTone({ freq: 659, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.2, release: 0.06, lp: 3200, delay: 0.07, sendReverb: 0.3 });
        _dualTone({ freq: 784, type1: 'sine', type2: 'triangle', dur: 0.16, vol: 0.2, release: 0.18, lp: 3200, delay: 0.14, sendReverb: 0.5 });
      },
      // 登出（下行柔和小调）
      logout: () => {
        _dualTone({ freq: 440, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.22, release: 0.08, lp: 2400, sendReverb: 0.3 });
        _dualTone({ freq: 349, type1: 'sine', type2: 'triangle', dur: 0.14, vol: 0.2, release: 0.12, lp: 2400, delay: 0.08, sendReverb: 0.4 });
      },
      // 错误/警告（柔和双音，去刺耳）
      error: () => {
        _dualTone({ freq: 392, type1: 'sine', type2: 'triangle', dur: 0.07, vol: 0.22, release: 0.05, lp: 2000, sendReverb: 0.25 });
        _dualTone({ freq: 311, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.22, release: 0.07, lp: 2000, delay: 0.09, sendReverb: 0.3 });
      },
      // 收藏（上扬叮，带混响尾音）
      favor: () => {
        _dualTone({ freq: 880, freqEnd: 1318, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.24, release: 0.1, lp: 4000, sendReverb: 0.45 });
        _tone({ freq: 2637, type: 'sine', dur: 0.06, vol: 0.06, release: 0.08, delay: 0.02, sendReverb: 0.3 });
      },
      // 取消收藏（下扬）
      unfavor: () => _dualTone({ freq: 698, freqEnd: 466, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.22, release: 0.08, lp: 3200, sendReverb: 0.3 }),
      // 归档/写入成功（柔和咔 + 温暖尾音）
      save: () => {
        _noise({ dur: 0.04, vol: 0.12, filterFreq: 1600, filterType: 'lowpass', sendReverb: 0.2 });
        _noise({ dur: 0.04, vol: 0.1, filterFreq: 1400, filterType: 'lowpass', delay: 0.05, sendReverb: 0.2 });
        _dualTone({ freq: 698, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.18, release: 0.1, lp: 3200, delay: 0.08, sendReverb: 0.4 });
      },
      // 导出备份（数据流，柔和上升）
      export: () => {
        const notes = [523, 659, 784, 988];
        notes.forEach((f, i) => {
          _dualTone({ freq: f, type1: 'sine', type2: 'triangle', dur: 0.06, vol: 0.14, release: 0.05, lp: 3200, delay: i * 0.05, sendReverb: 0.25 });
        });
        _dualTone({ freq: 1175, type1: 'sine', type2: 'triangle', dur: 0.14, vol: 0.18, release: 0.15, lp: 4000, delay: 0.22, sendReverb: 0.5 });
      },
      // 主题切换（柔和反极）
      theme: () => {
        const up = _ThemeLightDark();
        _dualTone({ freq: up ? 587 : 466, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 3200, sendReverb: 0.3 });
        _dualTone({ freq: up ? 880 : 349, type1: 'sine', type2: 'triangle', dur: 0.12, vol: 0.18, release: 0.1, lp: 3200, delay: 0.06, sendReverb: 0.4 });
      },
      // 管理后台操作（柔和机械咔嗒）
      adminClick: () => {
        _noise({ dur: 0.04, vol: 0.12, filterFreq: 1200, filterType: 'lowpass', sendReverb: 0.2 });
        _tone({ freq: 146, type: 'sine', dur: 0.04, vol: 0.18, release: 0.04, lp: 800, sendReverb: 0.15 });
      },
    };

    function _ThemeLightDark() {
      try { return (localStorage.getItem('wa_theme') || 'dark') === 'light'; }
      catch { return false; }
    }
    return api;
  })();

  // ============ 背景音乐模块（Web Audio 合成 ambient drone）============
  const BGM = (() => {
    let _ctx = null;
    let _masterGain = null;
    let _nodes = [];      // 所有振荡器/滤波器节点，用于停止
    let _lfoNodes = [];   // LFO 节点
    let _bellTimer = null; // 随机钟声定时器
    let _playing = false;
    let _volume = 0.18;
    const STORAGE_KEY = 'wa_bgm_on';
    const VOL_KEY = 'wa_bgm_vol';

    function loadPref() {
      try {
        _playing = localStorage.getItem(STORAGE_KEY) === '1';
        const v = parseFloat(localStorage.getItem(VOL_KEY));
        if (!isNaN(v)) _volume = Math.max(0, Math.min(1, v));
      } catch {}
    }
    function savePref() {
      try {
        localStorage.setItem(STORAGE_KEY, _playing ? '1' : '0');
        localStorage.setItem(VOL_KEY, String(_volume));
      } catch {}
    }
    loadPref();

    function _getCtx() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      // 复用 SFX 的 AudioContext（如果已创建）
      // 通过检测全局已有的 AudioContext
      if (!_ctx) {
        try { _ctx = new Ctx(); } catch { return null; }
      }
      if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
      return _ctx;
    }

    function _build() {
      const ctx = _getCtx();
      if (!ctx) return false;

      // 主增益
      _masterGain = ctx.createGain();
      _masterGain.gain.value = 0;
      _masterGain.connect(ctx.destination);

      // 低通滤波（让整体音色更暗沉柔和）
      const masterLP = ctx.createBiquadFilter();
      masterLP.type = 'lowpass';
      masterLP.frequency.value = 900;
      masterLP.Q.value = 0.4;
      masterLP.connect(_masterGain);

      // === 基础 drone 层（低频持续音）===
      // A1 = 55Hz, E2 = 82.4Hz, A2 = 110Hz（A 小调五度叠加）
      const droneFreqs = [55, 82.4, 110, 164.8];
      const droneTypes = ['sine', 'sine', 'triangle', 'sine'];
      droneFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = droneTypes[i];
        osc.frequency.value = freq;
        // 微微 detune 增加厚度
        osc.detune.value = (i % 2 === 0 ? 4 : -4);

        const g = ctx.createGain();
        g.gain.value = 0.08 - i * 0.012;

        // 每个 drone 有独立的慢速 LFO 调制音量（呼吸感）
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.03 + i * 0.012; // 更慢，0.03~0.066 Hz
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.025; // 调制深度减半
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        osc.connect(g);
        g.connect(masterLP);
        osc.start();
        lfo.start();
        _nodes.push(osc, g, lfo, lfoGain);
      });

      // === 高频泛音层（空灵氛围，极轻）===
      // E5 = 659Hz, A5 = 880Hz, C6 = 1046Hz（A 小调和弦高八度）
      const padFreqs = [659, 880, 1046];
      padFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = (i - 1) * 3;

        const g = ctx.createGain();
        g.gain.value = 0.008; // 减半

        // 慢速音量调制
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.02;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.004;
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        // 独立低通（更低，更柔和）
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1200;

        osc.connect(g);
        g.connect(lp);
        lp.connect(_masterGain);
        osc.start();
        lfo.start();
        _nodes.push(osc, g, lfo, lfoGain, lp);
      });

      // === 噪声底层（极轻的"风声"）===
      const noiseBufSize = ctx.sampleRate * 4; // 4秒循环
      const noiseBuf = ctx.createBuffer(1, noiseBufSize, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseBufSize; i++) {
        nd[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;
      const noiseLP = ctx.createBiquadFilter();
      noiseLP.type = 'lowpass';
      noiseLP.frequency.value = 250; // 更低
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.006; // 减半
      // 噪声 LFO
      const nLfo = ctx.createOscillator();
      nLfo.frequency.value = 0.04;
      const nLfoGain = ctx.createGain();
      nLfoGain.gain.value = 0.003;
      nLfo.connect(nLfoGain);
      nLfoGain.connect(noiseGain.gain);
      noiseSrc.connect(noiseLP);
      noiseLP.connect(noiseGain);
      noiseGain.connect(_masterGain);
      noiseSrc.start();
      nLfo.start();
      _nodes.push(noiseSrc, noiseLP, noiseGain, nLfo, nLfoGain);

      // === 随机钟声点缀 ===
      _scheduleBell();

      return true;
    }

    function _scheduleBell() {
      if (!_playing) return;
      const ctx = _getCtx();
      if (!ctx) return;
      // 每 15~40 秒随机一次钟声（更稀疏）
      const delay = 15000 + Math.random() * 25000;
      _bellTimer = setTimeout(() => {
        _playBell();
        _scheduleBell();
      }, delay);
    }

    function _playBell() {
      if (!_playing || !_masterGain) return;
      const ctx = _getCtx();
      if (!ctx) return;
      // 只用低音区：A3=220, E4=329, A4=440, C5=523（避免高频刺耳）
      const notes = [220, 329, 440, 523];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2; // 泛音
      osc2.detune.value = 4;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.018, now + 0.04); // 音量减半，起音更慢
      g.gain.exponentialRampToValueAtTime(0.0001, now + 5.0); // 更长尾

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.exponentialRampToValueAtTime(0.006, now + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      // 延迟反馈（钟声混响）
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.22;
      const fb = ctx.createGain();
      fb.gain.value = 0.35; // 反馈降低
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800; // 更暗

      osc.connect(g);
      osc2.connect(g2);
      g.connect(_masterGain);
      g2.connect(_masterGain);
      g.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(_masterGain);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 4.5);
      osc2.stop(now + 3.0);
    }

    function play() {
      if (_playing) return;
      const ctx = _getCtx();
      if (!ctx) return;
      if (_nodes.length === 0) {
        if (!_build()) return;
      }
      _playing = true;
      // 淡入
      const now = ctx.currentTime;
      _masterGain.gain.cancelScheduledValues(now);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
      _masterGain.gain.linearRampToValueAtTime(_volume, now + 2.0);
      _scheduleBell();
      savePref();
      Bus.emit('bgm:changed', { playing: true });
    }

    function stop() {
      if (!_playing) return;
      _playing = false;
      const ctx = _getCtx();
      if (_bellTimer) { clearTimeout(_bellTimer); _bellTimer = null; }
      if (ctx && _masterGain) {
        const now = ctx.currentTime;
        _masterGain.gain.cancelScheduledValues(now);
        _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
        _masterGain.gain.linearRampToValueAtTime(0, now + 1.5);
      }
      // 1.5 秒后停止所有节点
      setTimeout(() => {
        _nodes.forEach(n => { try { n.stop && n.stop(); n.disconnect(); } catch {} });
        _nodes = [];
        _lfoNodes = [];
        _masterGain = null;
      }, 1600);
      savePref();
      Bus.emit('bgm:changed', { playing: false });
    }

    function toggle() {
      _playing ? stop() : play();
      return _playing;
    }
    function isPlaying() { return _playing; }
    function getVolume() { return _volume; }
    function setVolume(v) {
      _volume = Math.max(0, Math.min(1, v));
      if (_masterGain && _playing) {
        const ctx = _getCtx();
        if (ctx) {
          const now = ctx.currentTime;
          _masterGain.gain.cancelScheduledValues(now);
          _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
          _masterGain.gain.linearRampToValueAtTime(_volume, now + 0.3);
        }
      }
      savePref();
      Bus.emit('bgm:changed', { volume: _volume });
    }

    // 浏览器策略：首次用户交互后自动恢复
    function _autoResume() {
      if (_playing && _nodes.length === 0) {
        play();
      } else if (_playing && _getCtx() && _getCtx().state === 'suspended') {
        _getCtx().resume().catch(() => {});
      }
    }
    document.addEventListener('pointerdown', _autoResume);
    document.addEventListener('keydown', _autoResume);

    return { play, stop, toggle, isPlaying, getVolume, setVolume };
  })();

  // ============ 音效开关 UI 同步 ============
  let _sfxUIBound = false;
  function syncSfxUI() {
    const muted = SFX.isMuted();
    const vol = Math.round(SFX.getVolume() * 100);
    const onIco = document.getElementById('sfx-ico-on');
    const offIco = document.getElementById('sfx-ico-off');
    const lblHeader = document.getElementById('sfx-label-header');
    if (onIco) onIco.style.display = muted ? 'none' : 'inline-block';
    if (offIco) offIco.style.display = muted ? 'inline-block' : 'none';
    if (lblHeader) lblHeader.textContent = muted ? '静音' : '音效';
    const sbBtn = document.getElementById('sb-sfx-toggle');
    if (sbBtn) {
      const svg = sbBtn.querySelector('svg');
      if (svg && muted) {
        svg.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
      } else if (svg) {
        svg.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';
      }
    }
    const sbLbl = document.getElementById('sb-sfx-label');
    if (sbLbl) sbLbl.textContent = muted ? '音效：关' : '音效：开';
    // 音量滑块
    const volWrap = document.getElementById('sb-sfx-vol-wrap');
    if (volWrap) volWrap.style.display = muted ? 'none' : 'flex';
    const volSlider = document.getElementById('sb-sfx-vol');
    if (volSlider) volSlider.value = vol;
    const volVal = document.getElementById('sb-sfx-vol-val');
    if (volVal) volVal.textContent = vol;
  }
  function initSfxUI() {
    if (_sfxUIBound) { syncSfxUI(); return; }
    _sfxUIBound = true;
    const hdr = document.getElementById('sfx-toggle-header');
    if (hdr) hdr.addEventListener('click', () => { SFX.toggle(); syncSfxUI(); });
    const volSlider = document.getElementById('sb-sfx-vol');
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        SFX.setVolume(parseInt(volSlider.value, 10) / 100);
        const volVal = document.getElementById('sb-sfx-vol-val');
        if (volVal) volVal.textContent = volSlider.value;
      });
      volSlider.addEventListener('change', () => {
        // 松开滑块时播放预览音
        SFX.click();
      });
    }
    Bus.on('sfx:changed', syncSfxUI);
    syncSfxUI();
  }

  // ============ 背景音乐 UI 同步 ============
  let _bgmUIBound = false;
  function syncBgmUI() {
    const playing = BGM.isPlaying();
    const vol = Math.round(BGM.getVolume() * 100);
    const sbLbl = document.getElementById('sb-bgm-label');
    if (sbLbl) sbLbl.textContent = playing ? '背景音乐：开' : '背景音乐：关';
    // 切换图标颜色
    const sbBtn = document.getElementById('sb-bgm-toggle');
    if (sbBtn) {
      sbBtn.style.color = playing ? 'var(--gold-1)' : '';
    }
    const volWrap = document.getElementById('sb-bgm-vol-wrap');
    if (volWrap) volWrap.style.display = playing ? 'flex' : 'none';
    const volSlider = document.getElementById('sb-bgm-vol');
    if (volSlider) volSlider.value = vol;
    const volVal = document.getElementById('sb-bgm-vol-val');
    if (volVal) volVal.textContent = vol;
  }
  function initBgmUI() {
    if (_bgmUIBound) { syncBgmUI(); return; }
    _bgmUIBound = true;
    const sbBtn = document.getElementById('sb-bgm-toggle');
    if (sbBtn) sbBtn.addEventListener('click', () => {
      BGM.toggle();
      syncBgmUI();
    });
    const volSlider = document.getElementById('sb-bgm-vol');
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        BGM.setVolume(parseInt(volSlider.value, 10) / 100);
        const volVal = document.getElementById('sb-bgm-vol-val');
        if (volVal) volVal.textContent = volSlider.value;
      });
    }
    Bus.on('bgm:changed', syncBgmUI);
    syncBgmUI();
  }

  // ============ 启动 ============
  function start() {
    // 恢复管理员之前的档案更改（增删改）到内存 DATA
    LocalCats.applyOverrides();
    LocalEntries.applyOverrides();
    Theme.init();
    renderNavCats();
    bindGlobalSearch();
    bindLogout();
    bindThemeToggle();
    initBackToTop();
    initSidebar();
    initSfxUI();
    initBgmUI();
    refreshIdentity();
    if (!Auth.get()) {
      showLoginGate();
    } else {
      if (!location.hash) location.hash = '#/';
      else router();
    }
  }
  window.addEventListener('hashchange', router);
  document.addEventListener('DOMContentLoaded', start);
  if (document.readyState !== 'loading') start();

  // 状态栏红点（实时更新，不依赖数据）
  const updInterval = setInterval(() => {
    const el = document.getElementById('stat-total');
    if (el && statsTotal()) {
      clearInterval(updInterval);
      el.textContent = `${statsTotal()} 条`;
      document.getElementById('stat-updated').textContent = DATA.meta.updated || '—';
    }
  }, 50);
})();
