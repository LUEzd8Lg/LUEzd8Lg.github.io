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
 * 能力：
 * - POST { submission }            → 写入仓库 submissions/{id}-{stamp}.json
 * - GET  ?list=submissions|issues|all → 服务端用令牌读仓库，返回 { ok, subs:[{path,sha,data}], issues:[...] }
 * - POST { action:'delete', path, sha } → 服务端删除已审稿件（仅限 submissions/ 目录）
 *
 * 安全：令牌只存在 Worker 环境变量里，永远不会出现在页面或仓库中。
 */

const GH_ACCEPT = 'application/vnd.github+json';

export default {
  async fetch(request, env) {
    const allow = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (allow !== '*') {
      const origin = request.headers.get('Origin') || '';
      if (origin && origin !== allow) {
        return reply({ ok: false, error: 'origin' }, 403, cors);
      }
    }

    if (request.method === 'GET') {
      const list = new URL(request.url).searchParams.get('list');
      if (list) return handleList(String(list), env, cors);
      return reply({ ok: true, service: 'archive-submission-worker' }, 200, cors);
    }
    if (request.method !== 'POST') {
      return reply({ ok: false, error: 'method' }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return reply({ ok: false, error: 'bad-json' }, 400, cors);
    }

    // 管理端删除已审稿件
    if (body && body.action === 'delete') {
      return handleDelete(body, env, cors);
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
    const branch = env.BRANCH || 'main';

    const gh = await ghApi(env, '/contents/' + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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

async function ghApi(env, path, opts) {
  const headers = {
    'Authorization': 'token ' + env.GH_TOKEN,
    'Accept': GH_ACCEPT,
    'User-Agent': 'archive-submission-worker'
  };
  if (opts && opts.headers) Object.assign(headers, opts.headers);
  const o = Object.assign({}, opts || {}, { headers: headers });
  return fetch('https://api.github.com/repos/' + (env.REPO || 'LUEzd8Lg/LUEzd8Lg.github.io') + path, o);
}

// 列出远端稿件：submissions 目录 JSON + 含投稿标记的开放 Issue
async function handleList(list, env, cors) {
  const branch = env.BRANCH || 'main';
  const out = { ok: true, subs: [], issues: [] };
  try {
    if (list === 'submissions' || list === 'all') {
      const res = await ghApi(env, '/contents/submissions?ref=' + branch);
      if (res.ok) {
        const files = await res.json();
        if (Array.isArray(files)) {
          for (const f of files) {
            if (!f || f.type !== 'file' || !/\.json$/i.test(f.name || '')) continue;
            try {
              const fr = await ghApi(env, '/contents/' + f.path + '?ref=' + branch);
              if (!fr.ok) continue;
              const fd = await fr.json();
              if (!fd || !fd.content) continue;
              const data = decodeJsonB64(fd.content);
              if (!data || !data.title) continue;
              if (!data.status) data.status = 'pending';
              out.subs.push({ path: f.path, sha: f.sha, data: data });
            } catch (e) {}
          }
        }
      }
    }
    if (list === 'issues' || list === 'all') {
      const res = await ghApi(env, '/issues?state=open&per_page=60&sort=created&direction=desc');
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          for (const it of items) {
            if (!it || it.pull_request || !it.number) continue;
            const body = String(it.body || '');
            if (body.indexOf('ARCHIVE-SUBMISSION') < 0) continue;
            out.issues.push({
              number: it.number,
              title: it.title || '',
              body: body,
              html_url: it.html_url || '',
              user: (it.user && it.user.login) || '',
              created_at: it.created_at || ''
            });
          }
        }
      }
    }
  } catch (e) {
    return reply({ ok: false, error: 'list-failed' }, 502, cors);
  }
  return reply(out, 200, cors);
}

// 删除指定稿件文件（仅允许 submissions/ 目录，防止误删其他内容）
async function handleDelete(body, env, cors) {
  const path = String(body.path || '');
  const sha = String(body.sha || '');
  if (!path || !sha || path.indexOf('..') > -1 || !/^submissions\/[^/]+\.json$/.test(path)) {
    return reply({ ok: false, error: 'bad-path' }, 400, cors);
  }
  const branch = env.BRANCH || 'main';
  const res = await ghApi(env, '/contents/' + path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'remove reviewed submission', sha: sha, branch: branch })
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try {
      const err = await res.json();
      if (err && err.message) msg = err.message;
    } catch (e) {}
    return reply({ ok: false, error: msg }, 502, cors);
  }
  return reply({ ok: true }, 200, cors);
}

function decodeJsonB64(content) {
  const bin = atob(String(content).replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

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
