/**
 * 通知服务：短信 + 邮件
 * 双通道：mock（打印/返回给前端）/ real（阿里云短信 + SMTP 邮件）
 */

// ---------------- Mock 通道（默认）----------------
function mockSend(type, target, code) {
  const typeLabel = type === 'sms' ? '[MOCK 短信]' : '[MOCK 邮件]';
  const msg = `${typeLabel} 发送至 ${target} ｜验证码：${code}`;
  console.log('\n' + '─'.repeat(40));
  console.log(msg);
  console.log('─'.repeat(40) + '\n');
  return Promise.resolve({ ok: true, mock: true, code, provider:'mock' });
}

// ---------------- 阿里云短信（SMS_PROVIDER=aliyun）----------------
let aliClient = null;
function getAliClient() {
  if (aliClient) return aliClient;
  try {
    // optionalDependencies，用户不一定装了
    const Dysmsapi = require('@alicloud/dysmsapi20170525').default;
    const OpenApi  = require('@alicloud/openapi-client');
    const Util     = require('@alicloud/tea-util');
    const config = new OpenApi.Config({
      accessKeyId:     process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    });
    config.endpoint = process.env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com';
    aliClient = { Dysmsapi: new Dysmsapi(config), Util };
    return aliClient;
  } catch (e) {
    throw new Error(`阿里云 SDK 未安装，请运行：npm install @alicloud/dysmsapi20170525\n原因：${e.message}`);
  }
}
async function sendAliyunSms({ phone, code }) {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const tplCode  = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!signName || !tplCode || !process.env.ALIYUN_ACCESS_KEY_ID || !process.env.ALIYUN_ACCESS_KEY_SECRET) {
    return { ok:false, msg:'阿里云短信配置缺失（缺 ALIYUN_* 变量）' };
  }
  try {
    const { Dysmsapi, Util } = getAliClient();
    const req = new Dysmsapi.SendSmsRequest({
      phoneNumbers: phone,
      signName,
      templateCode: tplCode,
      templateParam: JSON.stringify({ code })
    });
    const resp = await Dysmsapi.sendSmsWithOptions(req, new Util.RuntimeOptions({}));
    const body = resp.body || {};
    if (body.code !== 'OK') {
      return { ok:false, msg:`${body.code || 'ERROR'}: ${body.message || '发送失败'}` };
    }
    return { ok:true, provider:'aliyun', bizId: body.bizId };
  } catch (e) {
    return { ok:false, msg:`阿里云调用异常：${e.message}` };
  }
}

// ---------------- Nodemailer SMTP 邮件（EMAIL_PROVIDER=smtp）----------------
let smtpTransporter = null;
function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  const nodemailer = require('nodemailer');
  const secure = String(process.env.SMTP_SECURE) === 'true';
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || (secure ? 465 : 587),
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false } // 有些自签证书需要
  });
  return smtpTransporter;
}
async function sendSmtpEmail({ to, code }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok:false, msg:'SMTP 配置缺失（缺 SMTP_HOST/USER/PASS）' };
  }
  try {
    const t = getSmtpTransporter();
    const fromName = process.env.EMAIL_FROM_NAME || 'Worldview Archive';
    const info = await t.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
      subject: `[世界观察档案室] 您的验证码：${code}`,
      html: `
        <div style="background:#070707;color:#e8e2d0;padding:32px 40px;font-family:Georgia,serif;max-width:480px;margin:0 auto;border:1px solid #b5894a;">
          <div style="font-size:10px;letter-spacing:4px;color:#b5894a;margin-bottom:16px;">WORLDVIEW ARCHIVE · AUTH CODE</div>
          <div style="font-size:14px;color:#e8e2d0;line-height:1.8;">您好，<br>您正在申请档案系统接入，以下是您的验证码：</div>
          <div style="margin:28px 0;text-align:center;">
            <span style="display:inline-block;padding:12px 24px;border:1px solid #b5894a;background:rgba(181,137,74,0.08);font-family:Consolas,monospace;font-size:30px;letter-spacing:12px;color:#d6b46c;font-weight:700;">${code}</span>
          </div>
          <div style="font-size:12px;color:#7a7263;line-height:1.8;">
            有效期 5 分钟。<br>如非您本人操作，请忽略此邮件。<br><br>
            — 世界观察档案室
          </div>
        </div>
      `,
      text: `[世界观察档案室] 您的验证码：${code}，有效期 5 分钟。如非本人操作请忽略。`
    });
    return { ok:true, provider:'smtp', messageId: info.messageId };
  } catch (e) {
    return { ok:false, msg:`邮件发送失败：${e.message}` };
  }
}

// ---------------- 对外统一入口 ----------------
async function sendSms({ phone, code, provider }) {
  provider = (provider || process.env.SMS_PROVIDER || 'mock').toLowerCase();
  if (provider === 'aliyun') {
    try { return await sendAliyunSms({ phone, code }); }
    catch (e) { return { ok:false, msg:`阿里云短信通道异常：${e.message}` }; }
  }
  return mockSend('sms', phone, code);
}

async function sendEmail({ to, code, provider }) {
  provider = (provider || process.env.EMAIL_PROVIDER || 'mock').toLowerCase();
  if (provider === 'smtp') {
    return await sendSmtpEmail({ to, code });
  }
  return mockSend('email', to, code);
}

module.exports = { sendSms, sendEmail };
