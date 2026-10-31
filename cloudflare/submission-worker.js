/**
 * 世界观察档案库 · 投稿代理 Worker
 *
 * 部署方式（Cloudflare）：
 * 1. Workers & Pages → Create → Worker，粘贴本文件内容，Deploy。
 * 2. Settings → Variables and Secrets 添加：
 *    - GH_TOKEN（Secret，必填）：GitHub 细粒度令牌，仅本仓库，Contents: Read and write
 *    - REPO（Text，可选）：默认 LUEzd8Lg/LUEzd8Lg.github.io
 *    - BRANCH（Text，可选）：默认 main
 *    - ALLOW_ORIGIN（Text，可选）：站点来源，如 https://luezd8lg.github.io（不填为 *）
 * 3. 把 Worker 地址（如 https://xxx.workers.dev）填进站点的 data/submissions-config.json 的 endpoint 字段。
 *
 * 安全：令牌只存在 Worker 环境变量里，永远不会出现在页面或仓库中。
 */

export default {
  async fetch(request, env) {
    const allow = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method === 'GET') {
      return reply({ ok: true, service: 'archive-submission-worker' }, 200, cors);
    }
    if (request.method !== 'POST') {
      return reply({ ok: false, error: 'method' }, 405, cors);
    }

    if (allow !== '*') {
      const origin = request.headers.get('Origin') || '';
      if (origin && origin !== allow) {
        return reply({ ok: false, error: 'origin' }, 403, cors);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return reply({ ok: false, error: 'bad-json' }, 400, cors);
    }

    const s = body && body.submission;
    if (!s || typeof s !== 'object' || !s.title || !s.body) {
      return reply({ ok: false, error: 'empty' }, 400, cors);
    }
    if (JSON.stringify(s).length > 50000) {
      return reply({ ok: false, error: 'too-large' }, 413, cors);
    }

    const id = String(s.id || 'SUB').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'SUB';
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const path = 'submissions/' + id + '-' + stamp + '.json';
    const content = JSON.stringify(Object.assign({}, s, { at: s.at || Date.now(), via: 'worker' }), null, 2);
    const repo = env.REPO || 'LUEzd8Lg/LUEzd8Lg.github.io';
    const branch = env.BRANCH || 'main';

    const gh = await fetch('https://api.github.com/repos/' + repo + '/contents/' + path, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + env.GH_TOKEN,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'archive-submission-worker',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'submission ' + id,
        content: b64(content),
        branch: branch
      })
    });

    if (!gh.ok) {
      let msg = 'HTTP ' + gh.status;
      try {
        const err = await gh.json();
        if (err && err.message) msg = err.message;
      } catch (e) {}
      return reply({ ok: false, error: msg }, 502, cors);
    }

    return reply({ ok: true, path: path }, 200, cors);
  }
};

function reply(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors)
  });
}

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
