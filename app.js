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
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18,10h-1.26A8,8,0,1,0,9,20h9a5,5,0,0,0,0-10Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12,20h9"/><path d="M16.5,3.5a2.1,2.1,0,0,1,3,3L7,19l-4,1,1-4Z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7,11V7a5,5,0,0,1,10,0v4"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"/><path d="M6.5,2H20v20H6.5A2.5,2.5,0,0,1,4,19.5v-15A2.5,2.5,0,0,1,6.5,2Z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84,4.61a5.5,5.5,0,0,0-7.78,0L12,5.67l-1.06-1.06a5.5,5.5,0,0,0-7.78,7.78l1.06,1.06L12,21.23l7.78-7.78,1.06-1.06a5.5,5.5,0,0,0,0-7.78Z"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84,4.61a5.5,5.5,0,0,0-7.78,0L12,5.67l-1.06-1.06a5.5,5.5,0,0,0-7.78,7.78l1.06,1.06L12,21.23l7.78-7.78,1.06-1.06a5.5,5.5,0,0,0,0-7.78Z"/></svg>',
    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,17 4,12 9,7"/><path d="M20,18v-2a4,4,0,0,0-4-4H4"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
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
    add(cat, id, text, replyTo) {
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
        deleted: false,
        replyTo: replyTo || null,
        likes: []
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
    },
    toggleLike(cat, id, cid) {
      const all = Comments._all();
      const k = Comments._k(cat, id);
      const list = all[k] || [];
      const idx = list.findIndex(c => c.id === cid);
      if (idx < 0) return false;
      if (!list[idx].likes) list[idx].likes = [];
      const user = (Auth.get() && Auth.get().user) || '匿名';
      const li = list[idx].likes.indexOf(user);
      if (li >= 0) list[idx].likes.splice(li, 1);
      else list[idx].likes.push(user);
      all[k] = list;
      Comments._save(all);
      Bus.emit('comments:changed', { cat, id, liked: cid });
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
    CYCLE: ['dark', 'light', 'holo'],
    get() { return localStorage.getItem(THEME_KEY) || 'dark'; },
    set(t) {
      const v = Theme.CYCLE.includes(t) ? t : 'dark';
      localStorage.setItem(THEME_KEY, v);
      Theme._apply(v);
      Bus.emit('theme:changed', v);
      return v;
    },
    next() {
      const cur = Theme.get();
      const idx = Theme.CYCLE.indexOf(cur);
      return Theme.set(Theme.CYCLE[(idx + 1) % Theme.CYCLE.length]);
    },
    _apply(v) {
      const root = document.documentElement;
      root.classList.toggle('theme-light', v === 'light');
      root.classList.toggle('theme-holo', v === 'holo');
    },
    init() {
      Theme._apply(Theme.get());
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
        if (!Auth.canSubmit()) return { ok:false, msg:'需 LV.2 以上权限' };
        if (!payload.title || !payload.body) return { ok:false, msg:'标题和正文必填' };
        const saved = Submissions.add(payload);
        const ghResult = await pushSubmissionToGitHub(saved);
        return { ok:true, fallback:true, submission: saved, github: ghResult };
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
        const ct = res.headers.get('content-type') || '';
        // 静态服务器（GitHub Pages）返回非 JSON 或非 2xx → 降级到浏览器端 mammoth.js
        if (!ct.includes('application/json') || !res.ok) {
          return await API._docxFallbackBrowser(file);
        }
        const json = await res.json().catch(() => ({}));
        json._httpStatus = res.status;
        if (json.ok) return json;
        // 后端返回错误 JSON → 也降级到浏览器端解析
        if (!window.__mammothFailed) return await API._docxFallbackBrowser(file);
        return json;
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
    async uploadAudio(file) {
      const MAX_SIZE = 15 * 1024 * 1024;
      if (file.size > MAX_SIZE) return { ok: false, msg: '音频文件过大（限制 15MB）' };
      try {
        const data = new FormData();
        data.append('audio', file);
        const headers = Object.assign({}, API._authHeaders());
        const res = await fetch('/api/submit/upload-audio', {
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
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ ok: true, url: reader.result, fallback: true });
        reader.onerror = () => resolve({ ok: false, msg: '音频读取失败' });
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
    async adminReview(subId, status, { note = '', patch = null, githubFile = null, githubSha = null } = {}) {
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
        if (!updated) {
          // GitHub投稿不在localStorage中，直接处理
          if (githubFile) {
            let mergedEntry = null;
            if (status === 'approved' && patch) {
              const cat = patch.category || 'anomalies';
              const entry = {
                id: patch.id || subId,
                title: patch.title || '',
                class: patch.class || 'neutral',
                code: patch.code || '',
                summary: patch.summary || '',
                body: patch.body || '',
                content: patch.body || '',
                tags: patch.tags || [],
                source: patch.source || '',
                img: patch.cover || '',
                audio: patch.audio || ''
              };
              LocalEntries.add(cat, entry);
              mergedEntry = { ...entry, cat };
            }
            AdminLogs.record(status === 'approved' ? 'submission:approve' : 'submission:reject',
              `${subId} · GitHub投稿${note ? ' · 备注:' + note : ''}`);
            Bus.emit('submissions:reviewed', { id: subId, status, note });
            Bus.emit('stats:refresh');
            Bus.emit('data:changed');
            return { ok:true, fallback:true, githubSubmission: true, mergedEntry };
          }
          return { ok:false, msg:'未找到投稿' };
        }
        // 如果通过审核，把投稿内容作为新档案加入对应分类
        let mergedEntry = null;
        if (status === 'approved' && patch) {
          const cat = patch.category || updated.category || 'anomalies';
          const entry = {
            id: patch.id || updated.id,
            title: patch.title || updated.title,
            class: patch.class || updated.class || 'neutral',
            code: patch.code || updated.code || '',
            summary: patch.summary || updated.summary || '',
            body: patch.body || updated.body || '',
            content: patch.body || updated.body || '',
            tags: patch.tags || updated.tags || [],
            source: patch.source || updated.source || '',
            img: patch.cover || updated.cover || '',
            audio: patch.audio || updated.audio || ''
          };
          LocalEntries.add(cat, entry);
          mergedEntry = { ...entry, cat };
        }
        // 操作日志 + 通知
        AdminLogs.record(status === 'approved' ? 'submission:approve' : 'submission:reject',
          `${subId} · ${updated.title || ''}${note ? ' · 备注:' + note : ''}`);
        Bus.emit('submissions:reviewed', { id: subId, status, note });
        Bus.emit('stats:refresh');
        Bus.emit('data:changed');
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

    // 我的账户入口：所有登录用户可见
    const accLink = document.querySelector('.sidebar-account-link');
    if (accLink) accLink.style.display = Auth.get() ? 'flex' : 'none';

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
      btn.addEventListener('click', () => { location.hash = '#/account'; });
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
    initSiteHUD();
  }

  // === Site HUD — 登录动画风格延续到网站内部 ===
  let _siteHUDInit = false;
  let _siteHUDTimer = null;

  function initSiteHUD() {
    if (_siteHUDInit) return;
    _siteHUDInit = true;

    const body = document.body;
    body.classList.add('hud-active');

    // 1. CRT 扫描线叠加层
    const crt = document.createElement('div');
    crt.className = 'site-crt-overlay';
    body.appendChild(crt);

    // 2. 暗角
    const vig = document.createElement('div');
    vig.className = 'site-vignette';
    body.appendChild(vig);

    // 3. HUD 四角框
    ['tl','tr','bl','br'].forEach(pos => {
      const c = document.createElement('div');
      c.className = 'site-hud-corner ' + pos;
      body.appendChild(c);
    });

    // 4. 顶部遥测条
    const tel = document.createElement('div');
    tel.className = 'site-telemetry';
    const metrics = [
      { label: 'CPU', base: 35, range: 25 },
      { label: 'MEM', base: 48, range: 18 },
      { label: 'NET', base: 22, range: 30 },
      { label: 'I/O', base: 15, range: 20 },
      { label: 'THR', base: 62, range: 15 },
    ];
    tel.innerHTML = metrics.map(m =>
      `<span class="st-item">${m.label}<span class="st-bar"><span class="st-bar-fill" data-m="${m.label}" style="width:${m.base}%"></span></span><span class="st-val" data-v="${m.label}">${m.base}%</span></span>`
    ).join('');
    body.appendChild(tel);

    // 5. 底部状态条
    const st = document.createElement('div');
    st.className = 'site-status';
    const auth = Auth.get();
    const sid = 'SID-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const coord = `${(Math.random()*180-90).toFixed(2)}°N ${(Math.random()*360-180).toFixed(2)}°E`;
    const buildId = 'BLD-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    st.innerHTML = [
      `COORD ${coord}`,
      `ENC AES-256-GCM`,
      `CH TLS-1.3/X25519`,
      `SID ${sid}`,
      `BUILD ${buildId}`,
    ].map((s, i, arr) => i < arr.length - 1 ? `<span>${s}</span><span class="ss-sep">·</span>` : `<span>${s}</span>`).join('');
    body.appendChild(st);

    // 6. 遥测数据实时更新
    const tick = () => {
      metrics.forEach(m => {
        const val = Math.round(m.base + (Math.random() - 0.5) * m.range);
        const clamped = Math.max(1, Math.min(99, val));
        const bar = tel.querySelector(`[data-m="${m.label}"]`);
        const valEl = tel.querySelector(`[data-v="${m.label}"]`);
        if (bar) bar.style.width = clamped + '%';
        if (valEl) valEl.textContent = clamped + '%';
      });
    };
    _siteHUDTimer = setInterval(tick, 1200);
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

    const old = document.getElementById('boot-sequence');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'boot-sequence';
    document.body.appendChild(overlay);

    // ---- 数据流背景（多层：十六进制 + 二进制 + 数据包） ----
    const rain = document.createElement('canvas');
    rain.id = 'boot-data-rain';
    overlay.appendChild(rain);
    const rctx = rain.getContext('2d');
    let raf2 = 0;
    const HEX = '0123456789ABCDEF';
    const BIN = '01';
    const FS = 12;
    let cols = [];
    let packets = [];
    function initRain() {
      rain.width = window.innerWidth;
      rain.height = window.innerHeight;
      const n = Math.floor(rain.width / (FS * 1.5));
      cols = Array.from({length: n}, () => ({
        y: Math.random() * rain.height,
        sp: 0.3 + Math.random() * 2.0,
        ch: Array.from({length: 20}, () => {
          const r = Math.random();
          if (r < 0.7) return HEX[Math.floor(Math.random() * HEX.length)];
          if (r < 0.9) return BIN[Math.floor(Math.random() * BIN.length)];
          return ['/', '\\', '|', '*', '+', '-', '>', '<'][Math.floor(Math.random() * 8)];
        }),
        bright: Math.random() < 0.15
      }));
      packets = [];
    }
    function spawnPacket() {
      if (packets.length > 5) return;
      packets.push({
        x: Math.random() * rain.width,
        y: -20,
        sp: 3 + Math.random() * 4,
        txt: '0x' + Array.from({length: 8}, () => HEX[Math.floor(Math.random() * HEX.length)]).join(''),
        life: 1
      });
    }
    function drawRain() {
      rctx.fillStyle = 'rgba(0,0,0,0.07)';
      rctx.fillRect(0, 0, rain.width, rain.height);
      rctx.font = FS + 'px monospace';
      const cw = FS * 1.5;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        for (let j = 0; j < c.ch.length; j++) {
          const y = c.y - j * FS;
          if (y < 0 || y > rain.height) continue;
          const fade = (1 - j / c.ch.length);
          const alpha = c.bright ? fade * 0.3 : fade * 0.1;
          rctx.fillStyle = 'rgba(200,200,200,' + alpha + ')';
          rctx.fillText(c.ch[j], i * cw, y);
        }
        c.y += c.sp;
        if (c.y - c.ch.length * FS > rain.height) {
          c.y = 0;
          c.ch = c.ch.map(() => {
            const r = Math.random();
            if (r < 0.7) return HEX[Math.floor(Math.random() * HEX.length)];
            if (r < 0.9) return BIN[Math.floor(Math.random() * BIN.length)];
            return ['/', '\\', '|', '*', '+', '-', '>', '<'][Math.floor(Math.random() * 8)];
          });
          c.bright = Math.random() < 0.15;
        }
        if (Math.random() < 0.06) c.ch[Math.floor(Math.random() * c.ch.length)] = HEX[Math.floor(Math.random() * HEX.length)];
      }
      // 数据包
      if (Math.random() < 0.04) spawnPacket();
      rctx.font = FS + 'px monospace';
      for (let p of packets) {
        rctx.fillStyle = 'rgba(220,220,220,' + (p.life * 0.4) + ')';
        rctx.fillText(p.txt, p.x, p.y);
        p.y += p.sp;
        p.life -= 0.008;
      }
      packets = packets.filter(p => p.life > 0 && p.y < rain.height + 20);
      raf2 = requestAnimationFrame(drawRain);
    }
    initRain(); drawRain();
    const onResize = () => initRain();
    window.addEventListener('resize', onResize);

    // ---- 扫描线 ----
    const scan = document.createElement('div');
    scan.className = 'boot-scanline';
    overlay.appendChild(scan);

    // ---- HUD 角框 ----
    ['tl', 'tr', 'bl', 'br'].forEach(pos => {
      const c = document.createElement('div');
      c.className = 'boot-hud-corner ' + pos;
      overlay.appendChild(c);
    });

    // ---- 系统信息 ----
    const sid = 'SID-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ts = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    const tk = 'TK-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const nodes = Math.floor(Math.random() * 8) + 8;
    let records = 0;
    try { records = statsTotal(); } catch (e) {}
    const ip = '10.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255);
    const hash = Array.from({length: 16}, () => HEX[Math.floor(Math.random() * HEX.length)]).join('');
    const buildId = Math.random().toString(36).slice(2, 8).toUpperCase();

    // ---- 顶部遥测条 ----
    const telemetry = document.createElement('div');
    telemetry.className = 'boot-telemetry-top';
    telemetry.innerHTML = `
      <span class="bt-item"><span class="bt-label">CPU</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="cpu"></span></span><span class="bt-val" data-tv="cpu">0%</span></span>
      <span class="bt-item"><span class="bt-label">MEM</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="mem"></span></span><span class="bt-val" data-tv="mem">0%</span></span>
      <span class="bt-item"><span class="bt-label">NET</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="net"></span></span><span class="bt-val" data-tv="net">0ms</span></span>
      <span class="bt-item"><span class="bt-label">I/O</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="io"></span></span><span class="bt-val" data-tv="io">0MB</span></span>
      <span class="bt-item"><span class="bt-label">THR</span><span class="bt-val" data-tv="thr">0</span></span>
    `;
    overlay.appendChild(telemetry);

    // 遥测数据 ticker
    let teleRaf = 0;
    let ioTotal = 0;
    function tickTelemetry() {
      const cpu = 20 + Math.floor(Math.random() * 50);
      const mem = 35 + Math.floor(Math.random() * 40);
      const net = 2 + Math.floor(Math.random() * 20);
      const io = 1 + Math.floor(Math.random() * 8);
      const thr = 40 + Math.floor(Math.random() * 30);
      ioTotal += io;
      const setBar = (key, pct) => {
        const el = telemetry.querySelector('[data-tg="' + key + '"]');
        if (el) el.style.width = pct + '%';
      };
      const setVal = (key, val) => {
        const el = telemetry.querySelector('[data-tv="' + key + '"]');
        if (el) el.textContent = val;
      };
      setBar('cpu', cpu); setVal('cpu', cpu + '%');
      setBar('mem', mem); setVal('mem', mem + '%');
      setBar('net', Math.min(100, net * 4)); setVal('net', net + 'ms');
      setBar('io', Math.min(100, io * 10)); setVal('io', ioTotal + 'MB');
      setVal('thr', String(thr));
      teleRaf = setTimeout(tickTelemetry, 200);
    }
    tickTelemetry();

    // ---- 底部状态条 ----
    const statusBar = document.createElement('div');
    statusBar.className = 'boot-status-bar';
    statusBar.innerHTML = `
      <span class="bsb-item">COORD <span class="bsb-val">${Math.floor(Math.random()*180)-90}°${Math.random()<0.5?'N':'S'} / ${Math.floor(Math.random()*360)-180}°${Math.random()<0.5?'E':'W'}</span></span>
      <span class="bsb-item">ENC <span class="bsb-val">AES-256-GCM</span></span>
      <span class="bsb-item">CHAN <span class="bsb-val">TLS 1.3 / CHACHA20</span></span>
      <span class="bsb-item">GATE <span class="bsb-val">NODE-04 / A7</span></span>
      <span class="bsb-item">BUILD <span class="bsb-val">#${buildId}</span></span>
    `;
    overlay.appendChild(statusBar);

    // ---- 主内容区域 ----
    const content = document.createElement('div');
    content.className = 'boot-content';
    overlay.appendChild(content);

    // ---- ASCII 系统标识 ----
    const asciiLogo = document.createElement('pre');
    asciiLogo.className = 'boot-ascii-logo';
    asciiLogo.textContent = [
      ' ___      _ _ _ ___ _      _      ___ ___ ___ _____',
      '| _ \\_  _| | | / __| |    /_\\ ___| _ \\ _ _/ _ \\_   _|',
      '|  _/ || | |  \\__ \\ |__ / _ \\___ |  _/ | | (_) || |  ',
      '|_|  \\_, |_|_|___/____/_/ \\_\\  |_| |_| |_|\\___/ |_|  ',
      '     |__/                                            '
    ].join('\n');
    content.appendChild(asciiLogo);

    // ---- 节点同步可视化辅助函数 ----
    function makeNodes(count) {
      let html = '<span class="boot-nodes">';
      for (let i = 0; i < count; i++) {
        html += '<span class="bn-dot"></span>';
        if (i < count - 1) html += '<span class="bn-link"></span>';
      }
      html += '</span>';
      return html;
    }
    function activateNodes(div, count, stepMs) {
      return new Promise(async resolve => {
        const dots = div.querySelectorAll('.bn-dot');
        const links = div.querySelectorAll('.bn-link');
        for (let i = 0; i < dots.length; i++) {
          await _sleep(stepMs);
          if (dots[i]) dots[i].classList.add('active');
          if (links[i - 1]) links[i - 1].classList.add('active');
        }
        resolve();
      });
    }

    // ---- 数据解析流辅助函数 ----
    function makeDataStream(items) {
      let html = '<div class="boot-data-stream">';
      for (const item of items) {
        html += `<div><span class="bds-key">${item.k}</span>: <span class="bds-${item.t || 'val'}">${item.v}</span></div>`;
      }
      html += '</div>';
      return html;
    }

    // ---- ACCESS GRANTED 终章 ----
    const accessGranted = document.createElement('div');
    accessGranted.className = 'boot-access-granted';
    accessGranted.innerHTML = `
      <div class="bag-text">ACCESS GRANTED</div>
      <div class="bag-line"></div>
      <div class="bag-sub">WELCOME, ${user.toUpperCase()}</div>
    `;
    overlay.appendChild(accessGranted);

    // ---- 启动序列步骤 ----
    const lines = [
      { delay: 80,  html: '<span class="boot-sys">[SYS]</span> 世界观察档案库 · 安全终端 <span class="boot-ver">v3.12</span> <span class="boot-dim">| kernel 5.4.0-arch</span>' },
      { delay: 60,  html: '<span class="boot-sys">[SYS]</span> <span class="boot-ip">' + sid + '</span> <span class="boot-dim">|</span> <span class="boot-dim">' + ts + '</span> <span class="boot-dim">|</span> <span class="boot-ip">' + ip + '</span>' },
      { delay: 100, html: '<span class="boot-prompt">&gt;</span> 初始化安全终端 <span class="boot-dim">/dev/archive/tty0</span>' },
      { delay: 140, html: '<span class="boot-prompt">&gt;</span> 建立加密连接 <span class="boot-bar"><span class="boot-bar-fill"></span></span> <span class="boot-ok">100%</span> <span class="boot-dim">TLS 1.3 / X25519</span>', bar: true },
      { delay: 200, html: '<span class="boot-prompt">&gt;</span> 数据节点同步 ' + makeNodes(nodes) + ' <span class="boot-ok">完成</span> <span class="boot-dim">' + nodes + ' nodes online</span>', nodes: nodes },
      { delay: 160, html: '<span class="boot-prompt">&gt;</span> 档案库索引加载 <span class="boot-bar"><span class="boot-bar-fill"></span></span> <span class="boot-ok">100%</span> <span class="boot-dim">' + records + ' records</span>', bar: true, stream: [
        { k: 'anomalies', v: 'indexed', t: 'val' },
        { k: 'organizations', v: 'indexed', t: 'val' },
        { k: 'deities', v: 'indexed', t: 'val' },
        { k: 'eras', v: 'indexed', t: 'val' },
        { k: 'timelines', v: 'indexed', t: 'val' },
        { k: 'total_records', v: String(records), t: 'num' },
      ] },
      { delay: 120, html: '<span class="boot-prompt">&gt;</span> 数据完整性校验 <span class="boot-ok">SHA-256</span> <span class="boot-dim">' + hash + '</span>' },
      { delay: 130, html: '<span class="boot-prompt">&gt;</span> 生物特征扫描... <span class="boot-ok">通过</span> <span class="boot-dim">retina + fingerprint</span>' },
      { delay: 170, decode: '身份识别', suffix: ' <span class="boot-ok">成功</span>', dur: 700 },
      { delay: 140, decode: '档案密钥解密', suffix: ' <span class="boot-ok">完成</span> <span class="boot-dim">RSA-4096</span>', dur: 600 },
      { delay: 90,  html: '<span class="boot-prompt">&gt;</span> 安全协议验证 <span class="boot-ok">AES-256-GCM</span> <span class="boot-dim">/ HMAC-SHA512</span>' },
      { delay: 90,  html: '<span class="boot-prompt">&gt;</span> 会话令牌 <span class="boot-dim">' + tk + '</span>' },
      { delay: 80,  html: '<span class="boot-prompt">&gt;</span> 加密通道 <span class="boot-ok">已建立</span> <span class="boot-dim">end-to-end</span>' },
      { delay: 100, html: '<span class="boot-prompt">&gt;</span> 访问日志已记录 <span class="boot-dim">NODE-04 / GATE-A7 / ' + ts + '</span>' },
      { delay: 120, html: '<span class="boot-prompt">&gt;</span> 欢迎回来，<span class="boot-hl">' + user + '</span> <span class="boot-dim">|</span> 权限等级 <span class="boot-hl">' + lvl + '</span>' + (isAdmin ? ' <span class="boot-warn">[ADMIN]</span>' : '') },
    ];

    (async () => {
      SFX.login();

      // 显示 ASCII logo
      await _sleep(100);
      asciiLogo.classList.add('show');
      await _sleep(300);

      for (const line of lines) {
        await _sleep(line.delay);
        const div = document.createElement('div');
        div.className = 'boot-line';
        content.appendChild(div);
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
          SFX.search();
          await _decodeText(decodeSpan, line.decode, line.dur || 600);
          SFX.hit();
        } else if (line.bar) {
          div.innerHTML = line.html;
          SFX.click();
          const fill = div.querySelector('.boot-bar-fill');
          if (fill) {
            await _sleep(50);
            fill.style.width = '100%';
            await _sleep(250);
          }
          // 数据解析流
          if (line.stream) {
            const ds = document.createElement('div');
            ds.innerHTML = makeDataStream(line.stream);
            const dsEl = ds.firstChild;
            content.appendChild(dsEl);
            void dsEl.offsetWidth;
            dsEl.classList.add('show');
            await _sleep(300);
          }
        } else if (line.nodes) {
          div.innerHTML = line.html;
          SFX.click();
          await _sleep(80);
          await activateNodes(div, line.nodes, 60);
          await _sleep(200);
        } else {
          div.innerHTML = line.html;
          SFX.click();
          await _sleep(80);
        }
      }

      // ACCESS GRANTED 终章
      await _sleep(200);
      // 隐藏日志内容
      content.style.transition = 'opacity 0.3s ease';
      content.style.opacity = '0';
      accessGranted.classList.add('show');
      SFX.theme();
      await _sleep(600);

      // 故障闪烁退出
      overlay.classList.add('boot-glitch');
      await _sleep(300);
      cancelAnimationFrame(raf2);
      clearTimeout(teleRaf);
      window.removeEventListener('resize', onResize);
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
    const holoSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z"/><path d="M12 2 L12 22"/><path d="M3 7 L12 12 L21 7"/><path d="M3 17 L12 12 L21 17"/></svg>';
    const THEME_META = {
      dark:  { icon: moonSVG, label: '机密暗室',   title: '切换至 明亮档案室' },
      light: { icon: sunSVG,  label: '明亮档案室', title: '切换至 全息终端' },
      holo:  { icon: holoSVG, label: '全息终端',   title: '切换至 机密暗室' },
    };
    const sync = () => {
      const t = Theme.get();
      const m = THEME_META[t] || THEME_META.dark;
      btn.innerHTML = m.icon + ' ' + m.label;
      btn.title = m.title;
    };
    sync();
    Bus.on('theme:changed', sync);
    btn.addEventListener('click', () => {
      Theme.next();
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
    else if (parts[0] === 'account') renderAccount();
    else if (parts[0] === 'user' && parts.length >= 2) renderUserPage(decodeURIComponent(parts[1]));
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

    const audioField = e.audio ? `
      <div class="detail-field detail-audio-field">
        <div class="detail-field-label">${ico('audio',12)} 档案音频 · AUDIO FILE</div>
        <div class="detail-audio-player">
          <audio controls preload="metadata" src="${escapeAttr(resolveImgUrl(e.audio))}" style="width:100%"></audio>
        </div>
      </div>` : '';

    // 处理正文：注入锚点 + 生成 TOC
    const rawBody = e.body || '<p>（本条目正文尚未填充）</p>';
    const { html: bodyHtml, toc } = injectTocAnchors(imgField + rawBody + srcField);

    // 阅读时间估算
    const plainText = (rawBody || '').replace(/<[^>]+>/g, '');
    const charCount = plainText.replace(/\s/g, '').length;
    const readMinutes = Math.max(1, Math.round(charCount / 400));

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

    // 上下篇导航
    const catEntries = getEntries(catId) || [];
    const curIdx = catEntries.findIndex(r => String(r.id) === String(id));
    const prevEntry = curIdx > 0 ? catEntries[curIdx - 1] : null;
    const nextEntry = curIdx >= 0 && curIdx < catEntries.length - 1 ? catEntries[curIdx + 1] : null;
    const entryNavHtml = `
      <nav class="entry-nav">
        <a class="entry-nav-item prev ${prevEntry ? '' : 'disabled'}" href="${prevEntry ? '#/entry/' + catId + '/' + encodeURIComponent(prevEntry.id) : 'javascript:void(0)'}">
          <span class="entry-nav-label">${ico('arrowLeft',11)} 上一篇</span>
          <span class="entry-nav-title">${prevEntry ? escapeHtml(prevEntry.title) : '已是首篇'}</span>
        </a>
        <a class="entry-nav-item next ${nextEntry ? '' : 'disabled'}" href="${nextEntry ? '#/entry/' + catId + '/' + encodeURIComponent(nextEntry.id) : 'javascript:void(0)'}">
          <span class="entry-nav-label">下一篇 ${ico('arrowRight',11)}</span>
          <span class="entry-nav-title">${nextEntry ? escapeHtml(nextEntry.title) : '已是末篇'}</span>
        </a>
      </nav>
    `;

    // 评论区
    const me = Auth.get();
    const isAdmin = Auth.isAdmin();
    const comments = Comments.list(catId, id);
    const myName = (me && me.user) || '匿名';
    const topComments = comments.filter(c => !c.replyTo);
    const repliesMap = {};
    comments.filter(c => c.replyTo).forEach(c => {
      (repliesMap[c.replyTo] = repliesMap[c.replyTo] || []).push(c);
    });
    function renderComment(c, isReply) {
      const authorLink = c.author && c.author !== '游客'
        ? `<a href="#/user/${encodeURIComponent(c.author)}" style="font-weight:600;color:var(--text);text-decoration:none;">${escapeHtml(c.author)}</a>`
        : `<span style="font-weight:600;">${escapeHtml(c.author)}</span>`;
      const likes = c.likes || [];
      const hasLiked = likes.includes(myName);
      const replies = repliesMap[c.id] || [];
      return `
        <div class="comment-card" data-cid="${escapeAttr(c.id)}" style="border:1px solid var(--border);padding:10px 12px;background:var(--bg-2);${isReply ? 'margin-left:46px;border-left:2px solid var(--border-2);' : ''}">
          <div style="display:flex;gap:10px;">
            ${renderAvatar(c.author, { size: isReply ? 28 : 36 })}
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                <div style="font-family:var(--f-mono);font-size:11px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  ${authorLink}
                  <span style="opacity:.5;">·</span>
                  <span style="color:var(--gold-3);">${c.authorLevel || ''}</span>
                  ${c.author === 'admin' || c.role === 'admin' ? `<span style="opacity:.5;">·</span><span style="color:var(--red-2);">管理员</span>` : ''}
                </div>
                <span style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);">${new Date(c.at).toLocaleString()}</span>
              </div>
              <div style="white-space:pre-wrap;word-break:break-word;font-family:var(--f-serif);font-size:13px;line-height:1.8;">${escapeHtml(c.text)}</div>
              <div style="display:flex;gap:14px;align-items:center;margin-top:6px;">
                <button type="button" class="comment-like" data-cid="${escapeAttr(c.id)}" style="background:none;border:none;color:${hasLiked?'var(--red-2)':'var(--text-2)'};cursor:pointer;font-family:var(--f-mono);font-size:10px;display:flex;align-items:center;gap:3px;padding:0;">
                  ${hasLiked ? ico('heartFill',12) : ico('heart',12)} ${likes.length || ''}
                </button>
                <button type="button" class="comment-reply" data-cid="${escapeAttr(c.id)}" style="background:none;border:none;color:var(--text-2);cursor:pointer;font-family:var(--f-mono);font-size:10px;display:flex;align-items:center;gap:3px;padding:0;">
                  ${ico('reply',12)} 回复
                </button>
                ${isAdmin ? `<button type="button" class="btn btn-mini comment-del" data-cid="${escapeAttr(c.id)}" style="border:1px solid var(--red);background:transparent;color:var(--red-2);padding:2px 8px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">删除</button>` : ''}
              </div>
              <div class="reply-form-zone" data-cid="${escapeAttr(c.id)}"></div>
            </div>
          </div>
          ${replies.length > 0 ? `<div style="display:grid;gap:8px;margin-top:8px;">${replies.map(r => renderComment(r, true)).join('')}</div>` : ''}
        </div>`;
    }
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
            : topComments.map(c => renderComment(c, false)).join('')}
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
            <span class="read-time" id="read-time-badge">${ico('clock',11)} 约 ${readMinutes} 分钟 · ${charCount} 字</span>
            <span class="drb-sep"></span>
            <button type="button" class="drb-btn drb-top" title="回到顶部">↑ 顶部</button>
          </div>

          ${readHintHtml}

          ${audioField}

          <div style="display:grid;grid-template-columns:${toc && toc.length>1 ? 'minmax(0,1fr) 220px' : '1fr'};gap:24px;align-items:flex-start;">
            <div class="detail-body" id="detail-body">${bodyHtml}</div>
            ${toc && toc.length>1 ? `
              <nav id="toc-nav" class="toc-nav" aria-label="章节目录">
                <div class="toc-head">
                  <span class="toc-title">◆ 目录</span>
                  <span class="toc-count">${toc.length} 节</span>
                </div>
                ${toc.map(t => `<a class="toc-link" href="#${t.id}" data-level="${t.level}">${escapeHtml(t.text)}</a>`).join('')}
              </nav>
            ` : ''}
          </div>

          <div class="detail-source">
            <div>来源路径<strong>${escapeHtml(e.source||'—')}</strong></div>
            <div>归档于<strong>${DATA.meta.updated || '—'}</strong> / 世界观察档案库</div>
          </div>
        </article>
        ${relatedHtml}
        ${entryNavHtml}
        ${commentsHtml}
        ${toc && toc.length > 1 ? `
          <button class="toc-mobile-btn" id="toc-mobile-btn" title="目录" aria-label="打开目录">${ico('list',18)}</button>
          <div class="toc-mobile-panel" id="toc-mobile-panel">
            <div class="toc-mobile-inner">
              <button class="toc-mobile-close" id="toc-mobile-close" aria-label="关闭目录">${ico('x',16)}</button>
              <div class="toc-head" style="margin-bottom:12px;">
                <span class="toc-title">◆ 目录</span>
                <span class="toc-count">${toc.length} 节</span>
              </div>
              ${toc.map(t => `<a class="toc-link" href="#${t.id}" data-level="${t.level}">${escapeHtml(t.text)}</a>`).join('')}
            </div>
          </div>
        ` : ''}
        <div class="read-float" id="read-float">
          <div class="read-float-ring">
            <svg viewBox="0 0 44 44" width="44" height="44">
              <circle class="ring-bg" cx="22" cy="22" r="20"/>
              <circle class="ring-fg" cx="22" cy="22" r="20" stroke-dasharray="125.66" stroke-dashoffset="125.66"/>
            </svg>
            <span class="read-float-pct" id="read-float-pct">0%</span>
          </div>
          <span class="read-float-label">PROGRESS</span>
        </div>
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
    const readFloat = document.getElementById('read-float');
    const readFloatPct = document.getElementById('read-float-pct');
    const readFloatRing = readFloat ? readFloat.querySelector('.ring-fg') : null;
    const RING_CIRC = 2 * Math.PI * 20;
    const updateProgressBar = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const top = Math.max(0, window.scrollY);
      const pct = Math.min(100, (top / total) * 100);
      progBar.style.width = pct + '%';
      if (readFloat) {
        if (top > 200) readFloat.classList.add('visible');
        else readFloat.classList.remove('visible');
      }
      if (readFloatPct) readFloatPct.textContent = Math.round(pct) + '%';
      if (readFloatRing) readFloatRing.style.strokeDashoffset = RING_CIRC * (1 - pct / 100);
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
          const tid = a.getAttribute('href').slice(1);
          const tgt = document.getElementById(tid);
          if (tgt) {
            const y = tgt.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top: y, behavior: 'smooth' });
            history.replaceState(null, '', location.pathname + location.hash.split('#')[0] + '#' + tid);
          }
        });
      });
      if ('IntersectionObserver' in window) {
        const idMap = new Map();
        tocLinks.forEach(a => {
          const tid = a.getAttribute('href').slice(1);
          const t = document.getElementById(tid);
          if (t) idMap.set(tid, a);
        });
        if (idMap.size) {
          rpObserver = new IntersectionObserver((entries) => {
            entries.forEach(ent => {
              const a = idMap.get(ent.target.id);
              if (!a) return;
              if (ent.isIntersecting) {
                document.querySelectorAll('.toc-link').forEach(x => x.classList.remove('active'));
                a.classList.add('active');
              }
            });
          }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
          idMap.forEach((a, tid) => {
            const t = document.getElementById(tid);
            if (t) rpObserver.observe(t);
          });
        }
      }
    }

    // 移动端目录面板
    const tocMobileBtn = document.getElementById('toc-mobile-btn');
    const tocMobilePanel = document.getElementById('toc-mobile-panel');
    const tocMobileClose = document.getElementById('toc-mobile-close');
    if (tocMobileBtn && tocMobilePanel) {
      tocMobileBtn.addEventListener('click', () => tocMobilePanel.classList.add('open'));
    }
    if (tocMobileClose) {
      tocMobileClose.addEventListener('click', () => tocMobilePanel.classList.remove('open'));
    }
    if (tocMobilePanel) {
      tocMobilePanel.addEventListener('click', (ev) => {
        if (ev.target === tocMobilePanel) tocMobilePanel.classList.remove('open');
      });
      tocMobilePanel.querySelectorAll('.toc-link').forEach(a => {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const tid = a.getAttribute('href').slice(1);
          const tgt = document.getElementById(tid);
          if (tgt) {
            const y = tgt.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
          tocMobilePanel.classList.remove('open');
        });
      });
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
    // 评论点赞
    document.querySelectorAll('.comment-like').forEach(b => {
      b.addEventListener('click', () => {
        const cid = b.dataset.cid;
        if (!cid) return;
        Comments.toggleLike(catId, id, cid);
        renderEntry(catId, id);
      });
    });
    // 评论回复
    document.querySelectorAll('.comment-reply').forEach(b => {
      b.addEventListener('click', () => {
        const cid = b.dataset.cid;
        if (!cid) return;
        const zone = document.querySelector(`.reply-form-zone[data-cid="${cid}"]`);
        if (!zone || zone.dataset.shown === '1') return;
        zone.dataset.shown = '1';
        zone.innerHTML = `
          <div style="margin-top:8px;display:grid;gap:6px;padding:8px;border:1px solid var(--border);background:var(--bg);">
            <textarea rows="2" placeholder="回复…" style="background:var(--bg-2);border:1px solid var(--border);color:var(--text);padding:8px;font-family:var(--f-serif);font-size:12px;resize:vertical;"></textarea>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" class="reply-cancel" style="border:1px solid var(--border);background:var(--bg-2);color:var(--text-2);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">取消</button>
              <button type="button" class="reply-submit" style="border:1px solid var(--border);background:var(--bg);color:var(--text);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">回复</button>
            </div>
          </div>`;
        const ta = zone.querySelector('textarea');
        const cancelBtn = zone.querySelector('.reply-cancel');
        const submitBtn = zone.querySelector('.reply-submit');
        if (ta) ta.focus();
        if (cancelBtn) cancelBtn.addEventListener('click', () => { zone.innerHTML = ''; zone.dataset.shown = ''; });
        if (submitBtn) submitBtn.addEventListener('click', () => {
          const text = (ta ? ta.value : '').trim();
          if (!text) return;
          Comments.add(catId, id, text, cid);
          renderEntry(catId, id);
        });
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
            <div class="sb-row-2">
              <label class="sb-field">
                <span class="sb-label">标题 · TITLE</span>
                <input type="text" id="sb-title" placeholder="档案标题" required>
              </label>
              <label class="sb-field">
                <span class="sb-label">编号 · ID（选填）</span>
                <input type="text" id="sb-id" placeholder="留空自动生成，如 001 / SUB-002">
              </label>
            </div>
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
                <button type="button" class="sb-tool" data-cmd="clearFloat" title="清除浮动（文字不再绕图）">⇩</button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="hongyue" title="选中文字应用红月字体" style="font-family:'HongYue','Noto Serif SC',serif">红月</button>
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
            <div class="sb-field sb-field-audio">
              <span class="sb-label">音频附件 · AUDIO <span class="sb-label-hint">档案配音 / 录音 · 选填</span></span>
              <div class="sb-audio-uploader">
                <label class="sb-audio-choose">
                  <input type="file" id="sb-audio" accept="audio/*" hidden>
                  <span class="sb-audio-choose-icon">${ico('audio',14)}</span>
                  <span class="sb-audio-choose-text" id="sb-audio-text">选择音频</span>
                </label>
                <button type="button" class="sb-audio-clear" id="sb-audio-clear" style="display:none">${ico('x',12)} 移除</button>
              </div>
              <p class="docx-hint">支持 MP3 / WAV / OGG / M4A，限制 15MB。上传后将在档案详情页显示播放器。</p>
            </div>
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
      const idEl = document.getElementById('sb-id');
      const catEl = document.getElementById('sb-category');
      const clsEl = document.getElementById('sb-class');
      const sumEl = document.getElementById('sb-summary');
      const tagsEl = document.getElementById('sb-tags');
      const srcEl = document.getElementById('sb-source');
      return {
        title: titleEl ? titleEl.value : '',
        id: idEl ? idEl.value : '',
        category: catEl ? catEl.value : 'anomalies',
        class: clsEl ? clsEl.value : 'neutral',
        summary: sumEl ? sumEl.value : '',
        body: getBodyHTML(),
        tags: tagsEl ? tagsEl.value : '',
        source: srcEl ? srcEl.value : '',
        cover: window.__sbCoverUrl || '',
        audio: window.__sbAudioUrl || ''
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
    const di = document.getElementById('sb-id'); if (di) di.value = draft.id || '';
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
        if (draft.audio) {
          window.__sbAudioUrl = draft.audio;
          const at = document.getElementById('sb-audio-text'); if (at) at.textContent = '已恢复音频';
          const acl = document.getElementById('sb-audio-clear'); if (acl) acl.style.display = '';
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
        if (cmd === 'hongyue') {
          const sel = window.getSelection();
          if (!sel.rangeCount || sel.isCollapsed) { banner('请先选中文字', 'err'); return; }
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.className = 'font-hy';
          span.appendChild(range.extractContents());
          range.insertNode(span);
          sel.removeAllRanges();
          syncPreview();
          return;
        }
        if (cmd === 'clearFloat') {
          document.execCommand('insertHTML', false, '<div style="clear:both;height:0"></div>');
          syncPreview();
          scheduleDraftSave();
          return;
        }
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
            const tag = `<img src="${r.url}" alt="${escapeAttr(file.name)}" style="border:1px solid rgba(232,232,232,0.2);margin:8px 0"><br>`;
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

    // 图片拖拽排版
    if (bodyEditor && !bodyEditor.dataset.imgAlignBound) {
      bodyEditor.dataset.imgAlignBound = '1';
      let draggedImg = null;
      let alignBar = null;

      function bindDraggableImgs() {
        bodyEditor.querySelectorAll('img:not([draggable])').forEach(img => {
          img.setAttribute('draggable', 'true');
        });
      }
      bindDraggableImgs();
      new MutationObserver(() => bindDraggableImgs()).observe(bodyEditor, { childList: true, subtree: true });

      function hideAlignBar() {
        if (alignBar) { alignBar.remove(); alignBar = null; }
      }

      function showAlignBar(img) {
        hideAlignBar();
        alignBar = document.createElement('div');
        alignBar.className = 'img-align-bar';
        const aligns = [
          { cls: '', label: '内联', icon: '▬' },
          { cls: 'img-float-left', label: '左浮', icon: '↦' },
          { cls: 'img-float-right', label: '右浮', icon: '↤' },
          { cls: 'img-center', label: '居中', icon: '↧' },
        ];
        aligns.forEach(a => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'img-align-btn';
          btn.textContent = a.icon + ' ' + a.label;
          const isCurrent = a.cls ? img.classList.contains(a.cls) : (!img.classList.contains('img-float-left') && !img.classList.contains('img-float-right') && !img.classList.contains('img-center'));
          if (isCurrent) btn.classList.add('active');
          btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            img.classList.remove('img-float-left', 'img-float-right', 'img-center');
            if (a.cls) img.classList.add(a.cls);
            syncPreview();
            scheduleDraftSave();
            hideAlignBar();
          });
          alignBar.appendChild(btn);
        });
        // 尺寸滑块
        const sep = document.createElement('span');
        sep.className = 'img-align-sep';
        alignBar.appendChild(sep);
        const sizeLabel = document.createElement('span');
        sizeLabel.className = 'img-size-label';
        const curW = img.style.width || '';
        let curPct = 100;
        if (curW && curW.endsWith('%')) curPct = parseInt(curW);
        sizeLabel.textContent = curPct + '%';
        alignBar.appendChild(sizeLabel);
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'img-size-slider';
        slider.min = 15;
        slider.max = 100;
        slider.value = curPct;
        slider.addEventListener('input', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const v = parseInt(slider.value);
          img.style.width = v + '%';
          img.style.maxWidth = 'none';
          sizeLabel.textContent = v + '%';
          syncPreview();
        });
        slider.addEventListener('change', () => {
          scheduleDraftSave();
        });
        slider.addEventListener('mousedown', (ev) => ev.stopPropagation());
        alignBar.appendChild(slider);
        const rect = img.getBoundingClientRect();
        document.body.appendChild(alignBar);
        alignBar.style.position = 'fixed';
        alignBar.style.left = Math.max(8, rect.left) + 'px';
        alignBar.style.top = (rect.top > 40 ? rect.top - 32 : rect.bottom + 4) + 'px';
        alignBar.style.zIndex = '10000';
      }

      bodyEditor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
          showAlignBar(e.target);
        } else {
          hideAlignBar();
        }
      });

      bodyEditor.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
          draggedImg = e.target;
          e.target.classList.add('img-dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', '');
          hideAlignBar();
        }
      });

      bodyEditor.addEventListener('dragend', () => {
        if (draggedImg) {
          draggedImg.classList.remove('img-dragging');
          draggedImg = null;
        }
      });

      bodyEditor.addEventListener('dragover', (e) => {
        if (draggedImg) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      });

      bodyEditor.addEventListener('drop', (e) => {
        if (!draggedImg) return;
        e.preventDefault();
        const rect = bodyEditor.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        draggedImg.classList.remove('img-float-left', 'img-float-right', 'img-center');
        if (pct < 0.35) {
          draggedImg.classList.add('img-float-left');
          if (!draggedImg.style.width) { draggedImg.style.width = '45%'; draggedImg.style.maxWidth = 'none'; }
        } else if (pct > 0.65) {
          draggedImg.classList.add('img-float-right');
          if (!draggedImg.style.width) { draggedImg.style.width = '45%'; draggedImg.style.maxWidth = 'none'; }
        } else {
          draggedImg.classList.add('img-center');
          if (!draggedImg.style.width) { draggedImg.style.width = '100%'; draggedImg.style.maxWidth = 'none'; }
        }
        const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
        if (range && range.startContainer !== draggedImg && !draggedImg.contains(range.startContainer)) {
          if (draggedImg.parentNode) draggedImg.parentNode.removeChild(draggedImg);
          range.insertNode(draggedImg);
          const sp = document.createTextNode('\u00a0');
          draggedImg.parentNode.insertBefore(sp, draggedImg.nextSibling);
        }
        window.getSelection().removeAllRanges();
        syncPreview();
        scheduleDraftSave();
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

    // 音频上传
    const audioInput = document.getElementById('sb-audio');
    const audioText = document.getElementById('sb-audio-text');
    const audioClear = document.getElementById('sb-audio-clear');
    window.__sbAudioUrl = '';
    if (audioInput && !audioInput.dataset.bound) {
      audioInput.dataset.bound = '1';
      audioInput.addEventListener('change', async () => {
        const file = audioInput.files && audioInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('audio/')) { sbErr('仅支持音频文件'); return; }
        audioText.textContent = '上传中…';
        try {
          const r = await API.uploadAudio(file);
          if (!r.ok) { audioText.textContent = '选择音频'; sbErr(r.msg || '音频上传失败'); return; }
          window.__sbAudioUrl = r.url;
          audioText.textContent = file.name.length > 18 ? file.name.slice(0,16) + '…' : file.name;
          if (audioClear) audioClear.style.display = '';
          scheduleDraftSave();
        } catch (e) {
          audioText.textContent = '选择音频';
          sbErr('音频上传失败：' + (e.message || ''));
        }
        audioInput.value = '';
      });
    }
    if (audioClear && !audioClear.dataset.bound) {
      audioClear.dataset.bound = '1';
      audioClear.addEventListener('click', () => {
        window.__sbAudioUrl = '';
        audioText.textContent = '选择音频';
        audioClear.style.display = 'none';
        audioInput.value = '';
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

        const customId = document.getElementById('sb-id').value.trim();
        const data = {
          title,
          category: document.getElementById('sb-category').value,
          class: document.getElementById('sb-class').value,
          summary: document.getElementById('sb-summary').value.trim(),
          body: body,
          tags: document.getElementById('sb-tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),
          source: document.getElementById('sb-source').value.trim(),
          cover: window.__sbCoverUrl || '',
          audio: window.__sbAudioUrl || '',
          id: customId || ''
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
        const ghStatus = r.github ? (r.github.ok ? ' · 已同步至 GitHub' : ' · GitHub 同步失败（仅本地保存）') : '';
        ok.classList.remove('sb-info');
        ok.innerHTML = `
          <span>${ico('check',14)} 投稿已收妥 · 编号 <strong>${savedId}</strong> · 已进入${where}${ghStatus}，等待管理员审核后再发布</span>
          <button type="button" class="sb-close-btn" title="关闭通知">${ico('cross',12)}</button>
        `;
        ok.style.display = 'block';
        // 绑定关闭按钮
        const closeBtn = ok.querySelector('.sb-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => { ok.style.display = 'none'; });
        document.getElementById('sb-error').style.display = 'none';
        form.reset();
        window.__sbCoverUrl = '';
        window.__sbAudioUrl = '';
        setBodyHTML('');
        syncPreview();
        SubmitDraft.clear();
        const cp = document.getElementById('sb-cover-preview');
        if (cp) cp.innerHTML = '<div class="sb-cover-empty">暂无封面</div>';
        const ct = document.getElementById('sb-cover-text');
        if (ct) ct.textContent = '选择图片';
        const cc = document.getElementById('sb-cover-clear');
        if (cc) cc.style.display = 'none';
        const at = document.getElementById('sb-audio-text');
        if (at) at.textContent = '选择音频';
        const ac = document.getElementById('sb-audio-clear');
        if (ac) ac.style.display = 'none';
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

  // ============ 账户详情页 ============
  const PROFILE_KEY = 'wa_profile_v1';

  const LEVEL_INFO = {
    'LV.1': { name: '访客', en: 'VISITOR', next: 'LV.2', maxExp: 100, perms: ['浏览档案'] },
    'LV.2': { name: '档案员', en: 'ARCHIVIST', next: 'LV.3', maxExp: 300, perms: ['浏览档案', '投稿设定'] },
    'LV.3': { name: '研究员', en: 'RESEARCHER', next: 'LV.4', maxExp: 600, perms: ['浏览档案', '投稿设定', '高级检索'] },
    'LV.4': { name: '复审官', en: 'REVIEWER', next: 'LV.5', maxExp: 1000, perms: ['浏览档案', '投稿设定', '高级检索', '档案复审'] },
    'LV.5': { name: '管制官', en: 'CONTROLLER', next: null, maxExp: 9999, perms: ['浏览档案', '投稿设定', '高级检索', '档案复审', '全局管控'] },
    'LV.9': { name: '系统管理员', en: 'ADMINISTRATOR', next: null, maxExp: 9999, perms: ['全部权限'] },
  };

  function generateArchivistCode(seed) {
    let hash = 0;
    const str = seed || 'guest';
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '', h = Math.abs(hash);
    for (let i = 0; i < 4; i++) { code += chars[h % chars.length]; h = Math.floor(h / chars.length); }
    return 'ARCH-' + code;
  }

  function generateAvatarSVG(seed) {
    let hash = 0;
    const str = seed || 'guest';
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    const size = 5, cs = 12, total = size * cs;
    let h = Math.abs(hash) + 1, rects = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < Math.ceil(size / 2); x++) {
        const bit = h % 2; h = Math.floor(h / 2) || (h * 7 + 3);
        if (bit) {
          rects += `<rect x="${x*cs}" y="${y*cs}" width="${cs}" height="${cs}" fill="currentColor"/>`;
          if (x < Math.floor(size / 2)) rects += `<rect x="${(size-1-x)*cs}" y="${y*cs}" width="${cs}" height="${cs}" fill="currentColor"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg" style="color:var(--silver-2)"><rect width="${total}" height="${total}" fill="var(--bg-inset)"/>${rects}</svg>`;
  }

  function renderAvatar(user, opts) {
    opts = opts || {};
    const size = opts.size || 40;
    const clickable = opts.clickable !== false;
    const all = Profile._all();
    const profile = all[user || '__guest__'] || {};
    let avatarInner;
    if (profile.customAvatar) {
      avatarInner = `<img src="${escapeAttr(profile.customAvatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${escapeAttr(user || 'guest')}">`;
    } else {
      let svg = generateAvatarSVG(profile.avatarSeed || user);
      avatarInner = svg.replace('<svg ', '<svg width="100%" height="100%" ');
    }
    const style = `display:inline-flex;width:${size}px;height:${size}px;flex-shrink:0;border-radius:3px;overflow:hidden;border:1px solid var(--border-2);line-height:0;`;
    if (clickable && user && user !== '游客') {
      return `<a href="#/user/${encodeURIComponent(user)}" class="avatar-link" title="${escapeAttr(user)}" style="${style}cursor:pointer;">${avatarInner}</a>`;
    }
    return `<div style="${style}">${avatarInner}</div>`;
  }

  const Profile = {
    _all() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(PROFILE_KEY, JSON.stringify(d)); },
    get(user) {
      const key = user || (Auth.get() && Auth.get().user) || '__guest__';
      const all = Profile._all();
      if (!all[key]) {
        all[key] = { bio: '', exp: 0, createdAt: (Auth.get() && Auth.get().at) || Date.now(), archivistCode: generateArchivistCode(key), avatarSeed: key };
        Profile._save(all);
      }
      return all[key];
    },
    update(patch) {
      const key = (Auth.get() && Auth.get().user) || '__guest__';
      const all = Profile._all();
      all[key] = Object.assign(all[key] || {}, patch);
      Profile._save(all);
      return all[key];
    },
  };

  function apToast(msg) {
    let t = document.getElementById('ap-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ap-toast'; t.className = 'ap-toast'; document.body.appendChild(t); }
    t.innerHTML = msg.replace(/\n/g, '<br>');
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 4000);
  }

  function renderAccount() {
    if (!Auth.get()) { showLoginGate(); return; }
    const a = Auth.get();
    const profile = Profile.get();
    const lvl = a.lvl || 'LV.1';
    const info = LEVEL_INFO[lvl] || LEVEL_INFO['LV.1'];
    const favList = Favorites.list();
    const readList = ReadProgress.list();
    const subs = Submissions.get().filter(s => s.author === a.user);
    const activityExp = favList.length * 10 + readList.length * 5 + subs.length * 20;
    const totalExp = (profile.exp || 0) + activityExp;
    const maxExp = info.maxExp;
    const expPct = info.next ? Math.min(100, (totalExp / maxExp) * 100) : 100;
    const createdAt = new Date(profile.createdAt || a.at || Date.now());
    const createdStr = createdAt.toLocaleDateString('zh-CN');
    const days = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    const archivistNum = String(profile.createdAt || a.at || Date.now()).slice(-4);

    view.innerHTML = `
      <div class="account-page">
        <div class="ap-banner">
          <div class="ap-banner-grid"></div>
          <div class="ap-banner-content">
            <h1 class="ap-title">档案员档案</h1>
            <p class="ap-subtitle">PERSONNEL DOSSIER · CLASSIFIED</p>
          </div>
          <div class="ap-banner-code">${escapeHtml(profile.archivistCode || generateArchivistCode(a.user))}</div>
        </div>
        <div class="ap-layout">
          <div class="ap-left">
            <div class="ap-card ap-profile-card">
              <div class="ap-avatar-wrap">
                <div class="ap-avatar">${profile.customAvatar
                  ? `<img src="${escapeAttr(profile.customAvatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${escapeAttr(a.user)}">`
                  : generateAvatarSVG(profile.avatarSeed || a.user)}</div>
                <div class="ap-avatar-ring"></div>
                <div class="ap-avatar-actions">
                  <button class="ap-avatar-btn" id="ap-avatar-upload-btn" title="上传自定义头像">${ico('edit', 12)}</button>
                  ${profile.customAvatar ? `<button class="ap-avatar-btn ap-avatar-reset" id="ap-avatar-reset-btn" title="恢复默认头像">${ico('close', 12)}</button>` : ''}
                  <input type="file" id="ap-avatar-file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none">
                </div>
              </div>
              <div class="ap-profile-info">
                <div class="ap-code">${escapeHtml(profile.archivistCode || generateArchivistCode(a.user))}</div>
                <div class="ap-username">${escapeHtml(a.user)}</div>
                <div class="ap-lvl-badge ap-lvl-${lvl.replace('.','')}">
                  <span class="ap-lvl-tag">${escapeHtml(lvl)}</span>
                  <span class="ap-lvl-name">${escapeHtml(info.name)}</span>
                </div>
              </div>
              <div class="ap-profile-meta">
                <div class="ap-meta-row"><span class="ap-meta-label">编号</span><span class="ap-meta-value">No.${escapeHtml(archivistNum)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">入档日期</span><span class="ap-meta-value">${escapeHtml(createdStr)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">在档天数</span><span class="ap-meta-value">${days} 天</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">身份</span><span class="ap-meta-value">${a.guest ? '游客' : (Auth.isAdmin() ? '管理员' : '注册档案员')}</span></div>
              </div>
              <div class="ap-bio-section">
                <div class="ap-bio-header">
                  <span class="ap-bio-title">个人备注</span>
                  <button class="ap-bio-edit" id="ap-bio-edit-btn">${ico('edit',12)} 编辑</button>
                </div>
                <div class="ap-bio-text" id="ap-bio-text">${escapeHtml(profile.bio || '暂无备注。点击编辑添加个人说明。')}</div>
                <textarea class="ap-bio-input" id="ap-bio-input" style="display:none" placeholder="输入个人备注..." maxlength="200"></textarea>
                <div class="ap-bio-actions" id="ap-bio-actions" style="display:none">
                  <button class="ap-btn ap-btn-save" id="ap-bio-save">保存</button>
                  <button class="ap-btn ap-btn-cancel" id="ap-bio-cancel">取消</button>
                </div>
              </div>
            </div>
            <div class="ap-card ap-stats-card">
              <div class="ap-card-title">${ico('chart',14)} 活动统计</div>
              <div class="ap-stats-grid">
                <div class="ap-stat-item"><div class="ap-stat-num">${favList.length}</div><div class="ap-stat-label">收藏</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${readList.length}</div><div class="ap-stat-label">阅读记录</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${subs.length}</div><div class="ap-stat-label">投稿</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${totalExp}</div><div class="ap-stat-label">经验值</div></div>
              </div>
            </div>
          </div>
          <div class="ap-right">
            <div class="ap-card ap-perm-card">
              <div class="ap-card-title">${ico('shield',14)} 权限等级 · CLEARANCE LEVEL</div>
              <div class="ap-lvl-progress">
                <div class="ap-lvl-current">
                  <span class="ap-lvl-big">${escapeHtml(lvl)}</span>
                  <span class="ap-lvl-en">${escapeHtml(info.en)}</span>
                </div>
                ${info.next ? `
                  <div class="ap-exp-bar-wrap">
                    <div class="ap-exp-info"><span>经验值 ${totalExp} / ${maxExp}</span><span>下一级：${escapeHtml(LEVEL_INFO[info.next].name)} (${info.next})</span></div>
                    <div class="ap-exp-bar"><div class="ap-exp-fill" style="width:${expPct}%"></div></div>
                  </div>` : `
                  <div class="ap-exp-bar-wrap">
                    <div class="ap-exp-info"><span>已达最高等级</span><span>经验值 ${totalExp}</span></div>
                    <div class="ap-exp-bar"><div class="ap-exp-fill ap-exp-max" style="width:100%"></div></div>
                  </div>`}
              </div>
              <div class="ap-perm-list">
                ${Object.entries(LEVEL_INFO).map(([lv,li]) => {
                  const unlocked = Auth.isLv(lv);
                  const isCurrent = lv === lvl;
                  return `<div class="ap-perm-row ${unlocked?'unlocked':'locked'} ${isCurrent?'current':''}">
                    <div class="ap-perm-lv"><span class="ap-perm-lv-tag">${escapeHtml(lv)}</span><span class="ap-perm-lv-name">${escapeHtml(li.name)}</span></div>
                    <div class="ap-perm-desc">${li.perms.join(' · ')}</div>
                    <div class="ap-perm-status">${unlocked ? '已解锁' : '未解锁'}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>
            <div class="ap-card ap-timeline-card">
              <div class="ap-card-title">${ico('clock',14)} 活动时间线 · ACTIVITY LOG</div>
              <div class="ap-timeline" id="ap-timeline">${renderActivityTimeline(favList, readList, subs)}</div>
            </div>
            <div class="ap-card ap-security-card">
              <div class="ap-card-title">${ico('lock',14)} 安全设置 · SECURITY</div>
              <div class="ap-sec-list">
                ${!a.guest ? `<div class="ap-sec-row" id="ap-sec-password">
                  <div class="ap-sec-info"><div class="ap-sec-name">修改密码</div><div class="ap-sec-desc">定期更换密码以保障账号安全</div></div>
                  <button class="ap-btn ap-btn-action" id="ap-change-pw-btn">修改</button>
                </div>` : ''}
                <div class="ap-sec-row" id="ap-sec-export">
                  <div class="ap-sec-info"><div class="ap-sec-name">导出我的数据</div><div class="ap-sec-desc">导出收藏、阅读记录、个人资料等数据</div></div>
                  <button class="ap-btn ap-btn-action" id="ap-export-btn">导出</button>
                </div>
                <div class="ap-sec-row" id="ap-sec-history">
                  <div class="ap-sec-info"><div class="ap-sec-name">会话信息</div><div class="ap-sec-desc">本次登录会话的详细信息</div></div>
                  <button class="ap-btn ap-btn-action" id="ap-history-btn">查看</button>
                </div>
                ${!a.guest ? `<div class="ap-sec-row ap-sec-danger">
                  <div class="ap-sec-info"><div class="ap-sec-name">注销账号</div><div class="ap-sec-desc">永久删除账号及所有关联数据，不可恢复</div></div>
                  <button class="ap-btn ap-btn-danger" id="ap-delete-btn">注销</button>
                </div>` : ''}
              </div>
              <div class="ap-pw-form" id="ap-pw-form" style="display:none">
                <div class="ap-pw-row"><label>原密码</label><input type="password" id="ap-pw-old" placeholder="输入原密码"></div>
                <div class="ap-pw-row"><label>新密码</label><input type="password" id="ap-pw-new" placeholder="至少6位"></div>
                <div class="ap-pw-row"><label>确认新密码</label><input type="password" id="ap-pw-confirm" placeholder="再次输入新密码"></div>
                <div class="ap-pw-actions"><button class="ap-btn ap-btn-save" id="ap-pw-submit">确认修改</button><button class="ap-btn ap-btn-cancel" id="ap-pw-cancel">取消</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    bindAccountPageEvents();
  }

  function renderUserPage(username) {
    if (!Auth.get()) { showLoginGate(); return; }
    const profile = Profile.get(username);
    const all = Profile._all();
    const isSelf = Auth.get().user === username;
    const lvl = profile.userLevel || 'LV.1';
    const info = LEVEL_INFO[lvl] || LEVEL_INFO['LV.1'];
    const createdAt = new Date(profile.createdAt || Date.now());
    const createdStr = createdAt.toLocaleDateString('zh-CN');
    const days = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    const archivistNum = String(profile.createdAt || Date.now()).slice(-4);
    const subs = Submissions.get().filter(s => s.author === username);
    const allComments = Comments._all ? Comments._all() : {};
    let commentCount = 0;
    const userComments = [];
    Object.entries(allComments).forEach(([key, arr]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach(c => {
        if (c.author === username && !c.deleted) {
          commentCount++;
          const [catId, entryId] = key.split(':');
          const cat = CAT_MAP[catId];
          const entry = findEntry(catId, entryId);
          userComments.push({
            text: c.text, at: c.at, catId, entryId,
            catName: cat ? cat.name : catId,
            catCode: cat ? cat.code : '',
            entryTitle: entry ? (entry.title || entry.id) : entryId
          });
        }
      });
    });
    userComments.sort((a, b) => b.at - a.at);

    const userFavs = Favorites._all()[username] || [];
    const userReads = Object.entries(ReadProgress._all())
      .filter(([k]) => k.startsWith(username + '|'))
      .map(([k, v]) => {
        const ck = k.split('|')[1] || '';
        const [cat, eid] = ck.split(':');
        return { cat, id: eid, ...v };
      });

    const avatarHtml = profile.customAvatar
      ? `<img src="${escapeAttr(profile.customAvatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${escapeAttr(username)}">`
      : generateAvatarSVG(profile.avatarSeed || username);

    view.innerHTML = `
      <div class="account-page">
        <div class="ap-banner">
          <div class="ap-banner-grid"></div>
          <div class="ap-banner-content">
            <a href="#/account" style="color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;text-decoration:none;">← 返回我的账户</a>
            <h1 class="ap-title" style="margin-top:8px;">档案员档案</h1>
            <p class="ap-subtitle">PERSONNEL DOSSIER · ${escapeHtml(profile.archivistCode || generateArchivistCode(username))}</p>
          </div>
          ${isSelf ? `<div class="ap-banner-code">${escapeHtml(profile.archivistCode || generateArchivistCode(username))}</div>` : ''}
        </div>
        <div class="ap-layout">
          <div class="ap-left">
            <div class="ap-card ap-profile-card">
              <div class="ap-avatar-wrap">
                <div class="ap-avatar">${avatarHtml}</div>
                <div class="ap-avatar-ring"></div>
              </div>
              <div class="ap-profile-info">
                <div class="ap-code">${escapeHtml(profile.archivistCode || generateArchivistCode(username))}</div>
                <div class="ap-username">${escapeHtml(username)}</div>
                <div class="ap-lvl-badge ap-lvl-${lvl.replace('.','')}">
                  <span class="ap-lvl-tag">${escapeHtml(lvl)}</span>
                  <span class="ap-lvl-name">${escapeHtml(info.name)}</span>
                </div>
              </div>
              <div class="ap-profile-meta">
                <div class="ap-meta-row"><span class="ap-meta-label">编号</span><span class="ap-meta-value">No.${escapeHtml(archivistNum)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">入档日期</span><span class="ap-meta-value">${escapeHtml(createdStr)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">在档天数</span><span class="ap-meta-value">${days} 天</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">身份</span><span class="ap-meta-value">档案员</span></div>
              </div>
              <div class="ap-bio-section">
                <div class="ap-bio-header"><span class="ap-bio-title">个人备注</span></div>
                <div class="ap-bio-text">${escapeHtml(profile.bio || '该档案员尚未添加个人备注。')}</div>
              </div>
            </div>
            <div class="ap-card ap-stats-card">
              <div class="ap-card-title">${ico('chart',14)} 活动统计</div>
              <div class="ap-stats-grid">
                <div class="ap-stat-item"><div class="ap-stat-num">${subs.length}</div><div class="ap-stat-label">投稿</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${commentCount}</div><div class="ap-stat-label">批注</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${days}</div><div class="ap-stat-label">在档天数</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${profile.exp || 0}</div><div class="ap-stat-label">经验值</div></div>
              </div>
            </div>
            <div class="ap-card ap-timeline-card">
              <div class="ap-card-title">${ico('clock',14)} 活动时间线 · ACTIVITY LOG</div>
              <div class="ap-timeline">${renderActivityTimeline(userFavs, userReads, subs)}</div>
            </div>
          </div>
          <div class="ap-right">
            <div class="ap-card ap-perm-card">
              <div class="ap-card-title">${ico('shield',14)} 权限等级</div>
              <div class="ap-lvl-current">
                <span>当前等级</span>
                <span class="ap-lvl-big">${escapeHtml(lvl)} · ${escapeHtml(info.name)}</span>
              </div>
              <div class="ap-perm-list">
                ${(info.perms||[]).map(p => `<div class="ap-perm-item"><span class="ap-perm-check">✓</span> ${escapeHtml(p)}</div>`).join('')}
              </div>
            </div>
            ${subs.length > 0 ? `
            <div class="ap-card">
              <div class="ap-card-title">${ico('file',14)} 投稿记录（${subs.length}）</div>
              <div style="display:grid;gap:8px;">
                ${subs.slice(0, 10).map(s => `
                  <div style="border:1px solid var(--border);padding:8px 10px;background:var(--bg-2);">
                    <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);">${escapeHtml(s.id || '')} · ${new Date(s.at).toLocaleDateString('zh-CN')}</div>
                    <div style="font-size:12px;margin-top:2px;">${escapeHtml(s.title || '未命名')}</div>
                    <div style="font-family:var(--f-mono);font-size:10px;margin-top:2px;">
                      <span style="color:var(--text-2);">${escapeHtml(s.category || '')}</span>
                      ${s.status ? ` · <span style="color:${s.status==='approved'?'var(--silver-3)':'var(--red-3)'}">${escapeHtml(s.status)}</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>` : ''}
            ${userComments.length > 0 ? `
            <div class="ap-card">
              <div class="ap-card-title">${ico('pencil',14)} 批注记录（${userComments.length}）</div>
              <div style="display:grid;gap:8px;">
                ${userComments.slice(0, 10).map(c => `
                  <div style="border:1px solid var(--border);padding:8px 10px;background:var(--bg-2);">
                    <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                      <a href="#/entry/${c.catId}/${encodeURIComponent(c.entryId)}" style="color:var(--text-2);text-decoration:none;">${escapeHtml(c.catCode || c.catName)} · ${escapeHtml(c.entryTitle)}</a>
                      <span style="opacity:.5;">·</span>
                      <span>${new Date(c.at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div style="font-size:12px;margin-top:4px;white-space:pre-wrap;word-break:break-word;font-family:var(--f-serif);line-height:1.6;">${escapeHtml(c.text)}</div>
                  </div>
                `).join('')}
              </div>
              ${userComments.length > 10 ? `
              <div id="comment-rest" style="display:none;grid-template-rows:1fr;gap:8px;margin-top:8px;">
                ${userComments.slice(10).map(c => `
                  <div style="border:1px solid var(--border);padding:8px 10px;background:var(--bg-2);">
                    <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                      <a href="#/entry/${c.catId}/${encodeURIComponent(c.entryId)}" style="color:var(--text-2);text-decoration:none;">${escapeHtml(c.catCode || c.catName)} · ${escapeHtml(c.entryTitle)}</a>
                      <span style="opacity:.5;">·</span>
                      <span>${new Date(c.at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div style="font-size:12px;margin-top:4px;white-space:pre-wrap;word-break:break-word;font-family:var(--f-serif);line-height:1.6;">${escapeHtml(c.text)}</div>
                  </div>
                `).join('')}
              </div>
              <button type="button" id="comment-expand-btn" style="margin-top:8px;width:100%;border:1px solid var(--border);background:var(--bg-2);color:var(--text-2);padding:6px;cursor:pointer;font-family:var(--f-mono);font-size:10px;letter-spacing:1px;">查看全部（${userComments.length}）</button>
              ` : ''}
            </div>` : ''}
          </div>
        </div>
      </div>`;

    const expandBtn = document.getElementById('comment-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const rest = document.getElementById('comment-rest');
        if (!rest) return;
        const expanded = rest.style.display !== 'none';
        if (expanded) {
          rest.style.display = 'none';
          expandBtn.textContent = `查看全部（${userComments.length}）`;
        } else {
          rest.style.display = 'grid';
          expandBtn.textContent = '收起';
        }
      });
    }
  }

  function renderActivityTimeline(favList, readList, subs) {
    const events = [];
    favList.forEach(f => events.push({ type:'fav', title:f.title||f.id, at:f.at, label:'收藏' }));
    readList.forEach(r => events.push({ type:'read', title:r.id, at:r.at, label:`阅读 ${r.offsetPct||0}%` }));
    subs.forEach(s => events.push({ type:'submit', title:s.title||s.id, at:s.at, label:'投稿' }));
    events.sort((a,b) => (b.at||0) - (a.at||0));
    const top = events.slice(0, 20);
    if (!top.length) return '<div class="ap-timeline-empty">暂无活动记录</div>';
    return top.map(e => {
      const dt = e.at ? new Date(e.at) : null;
      const ds = dt ? dt.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}) : '--';
      const ts = dt ? dt.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : '--';
      return `<div class="ap-tl-item ap-tl-${e.type}"><div class="ap-tl-dot"></div><div class="ap-tl-content"><div class="ap-tl-label">${escapeHtml(e.label)}</div><div class="ap-tl-title">${escapeHtml(e.title)}</div><div class="ap-tl-time">${ds} ${ts}</div></div></div>`;
    }).join('');
  }

  function bindAccountPageEvents() {
    // 头像上传
    const uploadBtn = document.getElementById('ap-avatar-upload-btn');
    const fileInput = document.getElementById('ap-avatar-file');
    const resetBtn = document.getElementById('ap-avatar-reset-btn');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { apToast('图片不能超过 3MB'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            const max = 200;
            if (w > h) { if (w > max) { h *= max / w; w = max; } }
            else { if (h > max) { w *= max / h; h = max; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            Profile.update({ customAvatar: dataUrl });
            renderAccount();
            apToast('头像已更新');
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
    if (resetBtn) resetBtn.addEventListener('click', () => {
      Profile.update({ customAvatar: '' });
      renderAccount();
      apToast('已恢复默认头像');
    });

    const editBtn = document.getElementById('ap-bio-edit-btn');
    const bioText = document.getElementById('ap-bio-text');
    const bioInput = document.getElementById('ap-bio-input');
    const bioActions = document.getElementById('ap-bio-actions');
    if (editBtn) editBtn.addEventListener('click', () => {
      bioInput.value = Profile.get().bio || '';
      bioText.style.display = 'none'; editBtn.style.display = 'none';
      bioInput.style.display = 'block'; bioActions.style.display = 'flex'; bioInput.focus();
    });
    const saveBio = document.getElementById('ap-bio-save');
    if (saveBio) saveBio.addEventListener('click', () => {
      Profile.update({ bio: bioInput.value.trim() });
      bioText.textContent = bioInput.value.trim() || '暂无备注。点击编辑添加个人说明。';
      bioInput.style.display='none'; bioActions.style.display='none'; bioText.style.display='block'; editBtn.style.display='';
      apToast('备注已保存');
    });
    const cancelBio = document.getElementById('ap-bio-cancel');
    if (cancelBio) cancelBio.addEventListener('click', () => {
      bioInput.style.display='none'; bioActions.style.display='none'; bioText.style.display='block'; editBtn.style.display='';
    });

    const changePwBtn = document.getElementById('ap-change-pw-btn');
    const pwForm = document.getElementById('ap-pw-form');
    if (changePwBtn) changePwBtn.addEventListener('click', () => {
      pwForm.style.display = pwForm.style.display === 'none' ? 'block' : 'none';
    });
    const pwSubmit = document.getElementById('ap-pw-submit');
    if (pwSubmit) pwSubmit.addEventListener('click', () => {
      const oldPw = document.getElementById('ap-pw-old').value;
      const newPw = document.getElementById('ap-pw-new').value;
      const confirmPw = document.getElementById('ap-pw-confirm').value;
      if (!oldPw || !newPw) { apToast('请填写完整'); return; }
      if (newPw.length < 6) { apToast('新密码至少6位'); return; }
      if (newPw !== confirmPw) { apToast('两次密码不一致'); return; }
      const a = Auth.get();
      const users = Auth.getUsers();
      const u = users.find(u => u.contact === a.user);
      if (!u) { apToast('用户不存在'); return; }
      if (u.pass !== btoa(oldPw)) { apToast('原密码错误'); return; }
      u.pass = btoa(newPw);
      Auth.saveUsers(users);
      pwForm.style.display = 'none';
      ['ap-pw-old','ap-pw-new','ap-pw-confirm'].forEach(id => document.getElementById(id).value = '');
      apToast('密码修改成功');
    });
    const pwCancel = document.getElementById('ap-pw-cancel');
    if (pwCancel) pwCancel.addEventListener('click', () => { pwForm.style.display = 'none'; });

    const exportBtn = document.getElementById('ap-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const a = Auth.get();
      const data = {
        account: a.user, level: a.lvl, profile: Profile.get(),
        favorites: Favorites.list(), readProgress: ReadProgress.list(),
        submissions: Submissions.get().filter(s => s.author === a.user),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url; el.download = `archive-data-${a.user}-${Date.now()}.json`;
      document.body.appendChild(el); el.click(); document.body.removeChild(el);
      URL.revokeObjectURL(url);
      apToast('数据已导出');
    });

    const historyBtn = document.getElementById('ap-history-btn');
    if (historyBtn) historyBtn.addEventListener('click', () => {
      const a = Auth.get();
      const p = Profile.get();
      const dt = new Date(a.at || Date.now());
      const cd = new Date(p.createdAt || a.at || Date.now());
      apToast(`本次会话: ${dt.toLocaleString('zh-CN')}\n入档日期: ${cd.toLocaleDateString('zh-CN')}\n身份: ${a.guest?'游客':(Auth.isAdmin()?'管理员':'注册档案员')}\n等级: ${a.lvl}`);
    });

    const deleteBtn = document.getElementById('ap-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
      openAccountModal('account');
      setTimeout(() => {
        const danger = document.querySelector('.am-danger-zone');
        if (danger) danger.scrollIntoView({ behavior:'smooth', block:'center' });
      }, 100);
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
          <a class="atab ${tab==='sync'?'active':''}" data-atab="sync">${ico('cloud',14)} GitHub 同步</a>
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
      if (t === 'sync') return drawSyncTab();
    }

    // ========== Tab：GitHub 同步 ==========
    const SYNC_KEY = 'wa_github_sync';
    function getSyncConfig() {
      try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { return {}; }
    }
    function saveSyncConfig(cfg) {
      localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
    }
    function serializeDataFiles() {
      const files = {};
      const anomalies = DATA.anomalies || [];
      const urban = anomalies.filter(e => String(e.id).startsWith('UR-'));
      const operations = anomalies.filter(e => String(e.id).startsWith('OP-'));
      files['data/anomalies-urban.json'] = JSON.stringify(urban, null, 2);
      files['data/anomalies-operations.json'] = JSON.stringify(operations, null, 2);
      files['data/organizations.json'] = JSON.stringify(DATA.organizations || [], null, 2);
      files['data/deities.json'] = JSON.stringify(DATA.deities || [], null, 2);
      files['data/eras.json'] = JSON.stringify(DATA.eras || [], null, 2);
      files['data/timelines.json'] = JSON.stringify(DATA.timelines || [], null, 2);
      // 生成 merged.js
      const merged = {
        categories: DATA.categories || [],
        anomalies: anomalies,
        organizations: DATA.organizations || [],
        deities: DATA.deities || [],
        eras: DATA.eras || [],
        timelines: DATA.timelines || []
      };
      const mergedJs = [
        '/* AUTO-GENERATED by Worldview Archive admin panel */',
        '(function(){',
        '  if(!window.ARCHIVE_DATA){window.ARCHIVE_DATA={meta:{},categories:[]};}',
        '  var D=window.ARCHIVE_DATA;',
        '  D.categories=' + JSON.stringify(merged.categories) + ';',
        '  D.anomalies=' + JSON.stringify(merged.anomalies) + ';',
        '  D.organizations=' + JSON.stringify(merged.organizations) + ';',
        '  D.deities=' + JSON.stringify(merged.deities) + ';',
        '  D.eras=' + JSON.stringify(merged.eras) + ';',
        '  D.timelines=' + JSON.stringify(merged.timelines) + ';',
        '  D.meta=D.meta||{};',
        '  D.meta.total=D.anomalies.length+D.organizations.length+D.deities.length+D.eras.length+D.timelines.length;',
        '  D.meta.updated=new Date().toISOString().slice(0,10);',
        '  D._loaded=true;',
        '})();',
        ''
      ].join('\n');
      files['data/merged.js'] = mergedJs;
      return files;
    }
    function exportDataFiles() {
      const files = serializeDataFiles();
      for (const [path, content] of Object.entries(files)) {
        const blob = new Blob([content], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = path.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }
    }
    async function pushToGitHub(cfg, onProgress) {
      const { token, owner, repo, branch } = cfg;
      const files = serializeDataFiles();
      const paths = Object.keys(files);
      const results = [];
      for (let i = 0; i < paths.length; i++) {
        const filePath = paths[i];
        const content = files[filePath];
        onProgress(i, paths.length, filePath);
        // 获取现有文件的 SHA
        let sha = null;
        try {
          const shaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (shaRes.ok) {
            const shaData = await shaRes.json();
            sha = shaData.sha;
          }
        } catch (e) { /* 文件可能不存在 */ }
        // 推送文件
        const b64 = btoa(unescape(encodeURIComponent(content)));
        const bodyObj = {
          message: `update ${filePath} via admin panel`,
          content: b64,
          branch: branch
        };
        if (sha) bodyObj.sha = sha;
        const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
          method: 'PUT',
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj)
        });
        if (updateRes.ok) {
          results.push({ path: filePath, ok: true });
        } else {
          const err = await updateRes.json().catch(() => ({}));
          results.push({ path: filePath, ok: false, error: err.message || `HTTP ${updateRes.status}` });
        }
      }
      onProgress(paths.length, paths.length, null);
      return results;
    }

    async function publishSubmissionConfig(cfg) {
      const { token, owner, repo, branch } = cfg;
      const filePath = 'data/submissions-config.json';
      const config = { owner, repo, branch, token, at: Date.now() };
      const content = JSON.stringify(config, null, 2);
      let sha = null;
      try {
        const shaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (shaRes.ok) { const d = await shaRes.json(); sha = d.sha; }
      } catch (e) {}
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const bodyObj = { message: 'publish submission config', content: b64, branch };
      if (sha) bodyObj.sha = sha;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });
      if (res.ok) return { ok: true };
      let errMsg = `HTTP ${res.status}`;
      try {
        const errData = await res.json();
        if (errData.message) errMsg += ' · ' + errData.message;
      } catch (e) {}
      return { ok: false, error: errMsg };
    }

    async function fetchSubmissionConfig() {
      try {
        const res = await fetch('data/submissions-config.json?v=' + Date.now());
        if (!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json') && !ct.includes('text/plain')) return null;
        const text = await res.text();
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return null;
        return JSON.parse(text);
      } catch (e) { return null; }
    }

    async function pushSubmissionToGitHub(submission) {
      const config = await fetchSubmissionConfig();
      if (!config || !config.owner || !config.repo) return { ok: false, reason: 'no-config' };
      const token = getSyncConfig().token || config.token;
      if (!token) return { ok: false, reason: 'no-token' };
      const { owner, repo, branch } = config;
      const filePath = `submissions/${submission.id}.json`;
      const content = JSON.stringify(submission, null, 2);
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const bodyObj = { message: `submission ${submission.id}`, content: b64, branch };
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });
      return { ok: res.ok };
    }

    async function fetchGitHubSubmissions() {
      const config = await fetchSubmissionConfig();
      if (!config || !config.owner || !config.repo) return [];
      const { owner, repo, branch } = config;
      const token = getSyncConfig().token || config.token;
      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `token ${token}`;
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/submissions?ref=${branch}`, {
          headers
        });
        if (!res.ok) return [];
        const files = await res.json();
        if (!Array.isArray(files)) return [];
        const results = [];
        for (const f of files) {
          if (!f.name.endsWith('.json')) continue;
          try {
            const fRes = await fetch(f.download_url);
            const data = await fRes.json();
            data._githubFile = f.path;
            data._githubSha = f.sha;
            results.push(data);
          } catch (e) {}
        }
        return results;
      } catch (e) { return []; }
    }

    async function deleteGitHubSubmission(filePath, sha) {
      const config = await fetchSubmissionConfig();
      if (!config) return false;
      const token = getSyncConfig().token || config.token;
      if (!token) return false;
      const { owner, repo, branch } = config;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'DELETE',
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `remove reviewed submission`, sha, branch })
      });
      return res.ok;
    }

    function drawSyncTab() {
      const body = document.getElementById('admin-tab-body');
      const cfg = getSyncConfig();
      const counts = {
        anomalies: (DATA.anomalies||[]).length,
        organizations: (DATA.organizations||[]).length,
        deities: (DATA.deities||[]).length,
        eras: (DATA.eras||[]).length,
        timelines: (DATA.timelines||[]).length
      };
      const total = Object.values(counts).reduce((s,n)=>s+n,0);
      body.innerHTML = `
        <div style="max-width:760px;">
          <div class="dash-card" style="border:1px solid var(--border);padding:16px 20px;background:var(--bg-2);margin-bottom:16px;">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">GitHub 仓库配置 · CONFIG</div>
            <div style="display:grid;gap:12px;">
              <div>
                <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">Personal Access Token (PAT)</label>
                <input type="password" id="sync-token" placeholder="ghp_xxxxxxxxxxxx" value="${escapeAttr(cfg.token||'')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">需要 repo 权限 · Settings → Developer settings → Personal access tokens</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 120px;gap:10px;">
                <div>
                  <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">用户名 / Owner</label>
                  <input type="text" id="sync-owner" placeholder="LUEzd8Lg" value="${escapeAttr(cfg.owner||'')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                </div>
                <div>
                  <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">仓库名 / Repo</label>
                  <input type="text" id="sync-repo" placeholder="LUEzd8Lg.github.io" value="${escapeAttr(cfg.repo||'')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                </div>
                <div>
                  <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">分支 / Branch</label>
                  <input type="text" id="sync-branch" placeholder="main" value="${escapeAttr(cfg.branch||'main')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                </div>
              </div>
            </div>
            <div style="margin-top:12px;">
              <button class="abtn" id="sync-save-btn">${ico('save',12)} 保存配置</button>
            </div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:16px 20px;background:var(--bg-2);margin-bottom:16px;">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">当前数据概览 · DATA SUMMARY</div>
            <table class="admin-table">
              <thead><tr><th>分类</th><th>条目数</th><th>对应文件</th></tr></thead>
              <tbody>
                <tr><td>异常档案</td><td class="atd-mono">${counts.anomalies}</td><td class="atd-mono">anomalies-urban.json + anomalies-operations.json</td></tr>
                <tr><td>组织名录</td><td class="atd-mono">${counts.organizations}</td><td class="atd-mono">organizations.json</td></tr>
                <tr><td>神祇图鉴</td><td class="atd-mono">${counts.deities}</td><td class="atd-mono">deities.json</td></tr>
                <tr><td>纪元卷宗</td><td class="atd-mono">${counts.eras}</td><td class="atd-mono">eras.json</td></tr>
                <tr><td>时间线</td><td class="atd-mono">${counts.timelines}</td><td class="atd-mono">timelines.json</td></tr>
                <tr style="border-top:2px solid var(--border);"><td style="font-weight:600;">总计</td><td class="atd-mono" style="font-weight:600;">${total}</td><td class="atd-mono">7 个文件（含 merged.js）</td></tr>
              </tbody>
            </table>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:16px 20px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">操作 · ACTIONS</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="abtn abtn-approve" id="sync-push-btn">${ico('cloud',14)} 推送数据到 GitHub</button>
              <button class="abtn" id="sync-export-btn">${ico('save',14)} 导出数据文件到本地</button>
              <button class="abtn" id="sync-pubsub-btn">${ico('cloud',14)} 发布投稿配置</button>
            </div>
            <div style="margin-top:10px;font-family:var(--f-mono);font-size:10px;color:var(--text-2);line-height:1.6;">
              「发布投稿配置」会将仓库信息和 Token 写入 data/submissions-config.json，使投稿者提交后自动推送至 GitHub，管理员可在审核面板拉取并审核。
            </div>
            <div id="sync-progress" style="margin-top:14px;font-family:var(--f-mono);font-size:11px;color:var(--text-2);"></div>
            <div id="sync-results" style="margin-top:10px;"></div>
          </div>
        </div>
      `;
      const saveBtn = document.getElementById('sync-save-btn');
      if (saveBtn) saveBtn.addEventListener('click', () => {
        const newCfg = {
          token: document.getElementById('sync-token').value.trim(),
          owner: document.getElementById('sync-owner').value.trim(),
          repo: document.getElementById('sync-repo').value.trim(),
          branch: document.getElementById('sync-branch').value.trim() || 'main'
        };
        saveSyncConfig(newCfg);
        SFX.export();
        banner('GitHub 配置已保存', 'ok');
      });
      const exportBtn = document.getElementById('sync-export-btn');
      if (exportBtn) exportBtn.addEventListener('click', () => {
        exportDataFiles();
        SFX.export();
        banner('数据文件已下载，请替换 data/ 目录下的文件', 'ok');
      });
      const pubsubBtn = document.getElementById('sync-pubsub-btn');
      if (pubsubBtn) pubsubBtn.addEventListener('click', async () => {
        const c = getSyncConfig();
        if (!c.token || !c.owner || !c.repo) {
          banner('请先填写并保存 GitHub 配置', 'err');
          return;
        }
        if (!confirm('发布投稿配置会将 Token 写入 data/submissions-config.json（公开文件），使所有用户都能推送投稿到 GitHub。\n\n注意：此 Token 会被公开，建议使用仅含 repo 权限的专用 Token。\n\n确认发布？')) return;
        pubsubBtn.disabled = true;
        pubsubBtn.textContent = '发布中...';
        try {
          const result = await publishSubmissionConfig(c);
          if (result.ok) {
            SFX.login();
            banner('投稿配置已发布到 GitHub（data/submissions-config.json）', 'ok');
          } else {
            banner('投稿配置发布失败：' + (result.error || '请检查 Token 权限'), 'err');
          }
        } catch (e) {
          banner('投稿配置发布失败：' + (e.message || '未知错误'), 'err');
        }
        pubsubBtn.disabled = false;
        pubsubBtn.innerHTML = ico('cloud',14) + ' 发布投稿配置';
      });
      const pushBtn = document.getElementById('sync-push-btn');
      if (pushBtn) pushBtn.addEventListener('click', async () => {
        const c = getSyncConfig();
        if (!c.token || !c.owner || !c.repo) {
          banner('请先填写并保存 GitHub 配置', 'err');
          return;
        }
        pushBtn.disabled = true;
        pushBtn.textContent = '推送中...';
        const progEl = document.getElementById('sync-progress');
        const resEl = document.getElementById('sync-results');
        try {
          const results = await pushToGitHub(c, (i, total, path) => {
            if (path) {
              progEl.innerHTML = `推送中 (${i+1}/${total}) · <span style="color:var(--gold-1);">${escapeHtml(path)}</span>`;
            } else {
              progEl.innerHTML = `<span style="color:#5a8a5a;">✓ 推送完成</span>`;
            }
          });
          const okCount = results.filter(r => r.ok).length;
          const failCount = results.length - okCount;
          resEl.innerHTML = results.map(r => `
            <div style="padding:6px 10px;border:1px solid var(--border);margin-top:4px;font-family:var(--f-mono);font-size:11px;display:flex;justify-content:space-between;align-items:center;">
              <span>${r.ok ? '✓' : '✗'} ${escapeHtml(r.path)}</span>
              <span style="color:${r.ok ? '#5a8a5a' : 'var(--red-1)'};">${r.ok ? '成功' : escapeHtml(r.error||'失败')}</span>
            </div>
          `).join('');
          SFX.login();
          banner(`推送完成：${okCount} 成功，${failCount} 失败`, failCount ? 'err' : 'ok');
        } catch (e) {
          progEl.innerHTML = `<span style="color:var(--red-1);">✗ 推送失败：${escapeHtml(e.message||'未知错误')}</span>`;
          banner('推送失败，请检查网络和 Token', 'err');
        }
        pushBtn.disabled = false;
        pushBtn.innerHTML = ico('cloud',14) + ' 推送数据到 GitHub';
      });
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
      let localSubs = r.ok ? r.list : [];
      // 拉取GitHub投稿
      let ghSubs = [];
      try { ghSubs = await fetchGitHubSubmissions(); } catch (e) {}
      // 缓存GitHub投稿供状态筛选复用
      let cachedGhSubs = ghSubs;
      // 合并：GitHub投稿（不在本地） + 本地投稿
      const localIds = new Set(localSubs.map(s => s.id));
      const ghOnly = ghSubs.filter(s => !localIds.has(s.id));
      let allSubs = [...ghOnly, ...localSubs];
      let subsPage = 1;
      const SUBS_PAGE_SIZE = 10;

      const sc = document.getElementById('admin-count-subs');
      if (sc) sc.textContent = allSubs.length;

      const ghCount = ghOnly.length;
      body.innerHTML = `
        <div class="admin-toolbar">
          <span class="admin-toolbar-note">共 ${allSubs.length} 条${r.fallback ? '（降级模式）' : ''}${ghCount ? ` · GitHub ${ghCount} 条` : ''}</span>
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
                ${s._githubFile ? '<span class="as-status as-status-github">GitHub</span>' : ''}
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
                <label class="af"><span>编号 ID（通过时使用，留空自动生成）</span><input data-k="id" value="${escapeAttr(s.id||'')}" placeholder="留空自动生成，如 001"/></label>
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
                <label class="af"><span>音频附件（通过时使用）</span>
                  <div class="af-cover-wrap">
                    <input data-k="audio" value="${escapeAttr(s.audio||'')}" placeholder="留空则无音频"/>
                    <label class="af-cover-upload-btn">
                      ${ico('audio',12)} 上传
                      <input type="file" class="af-audio-file" accept="audio/*" hidden>
                    </label>
                  </div>
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
          // 音频上传
          const audioFile = card.querySelector('.af-audio-file');
          const audioInputEl = card.querySelector('[data-k="audio"]');
          if (audioFile && !audioFile.dataset.bound) {
            audioFile.dataset.bound = '1';
            audioFile.addEventListener('change', async () => {
              const file = audioFile.files && audioFile.files[0];
              if (!file) return;
              if (!file.type.startsWith('audio/')) { banner('仅支持音频文件', 'err'); return; }
              try {
                const r = await API.uploadAudio(file);
                if (!r.ok) { banner(r.msg || '音频上传失败', 'err'); return; }
                if (audioInputEl) audioInputEl.value = r.url;
              } catch (e) { banner('音频上传失败', 'err'); }
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
            const r2 = await API.adminReview(s.id, 'approved', {
              note, patch,
              githubFile: s._githubFile || null,
              githubSha: s._githubSha || null
            });
            if (!r2.ok) { ap.disabled = false; ap.textContent = t; return banner(r2.msg || '通过失败', 'err'); }
            // 删除GitHub上的投稿文件
            if (s._githubFile && s._githubSha) {
              try { await deleteGitHubSubmission(s._githubFile, s._githubSha); } catch (e) {}
            }
            banner(`通过成功 · 已写入 ${r2.mergedEntry ? CAT_MAP[r2.mergedEntry.cat]?.name || r2.mergedEntry.cat : s.category}`, 'ok');
            ap.disabled = false; ap.textContent = t;
            drawSubsTab();
          });
          if (rj) rj.addEventListener('click', async () => {
            rj.disabled = true; const t = rj.textContent; rj.textContent = '处理中…';
            const { note } = readPatch();
            const r2 = await API.adminReview(s.id, 'rejected', {
              note,
              githubFile: s._githubFile || null,
              githubSha: s._githubSha || null
            });
            if (!r2.ok) { rj.disabled = false; rj.textContent = t; return banner(r2.msg || '退回失败', 'err'); }
            // 删除GitHub上的投稿文件
            if (s._githubFile && s._githubSha) {
              try { await deleteGitHubSubmission(s._githubFile, s._githubSha); } catch (e) {}
            }
            banner('已退回投稿' + (note ? `（备注：${note}）` : ''), 'ok');
            rj.disabled = false; rj.textContent = t;
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
              const subObj = allSubs.find(x => x.id === sid);
              const r2 = await API.adminReview(sid, 'approved', {
                patch,
                githubFile: subObj?._githubFile || null,
                githubSha: subObj?._githubSha || null
              });
              if (r2.ok) {
                ok++;
                if (subObj?._githubFile && subObj?._githubSha) {
                  try { await deleteGitHubSubmission(subObj._githubFile, subObj._githubSha); } catch (e) {}
                }
              } else fail++;
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
              const subObj = allSubs.find(x => x.id === sid);
              const r2 = await API.adminReview(sid, 'rejected', {
                note: note || '',
                githubFile: subObj?._githubFile || null,
                githubSha: subObj?._githubSha || null
              });
              if (r2.ok) {
                ok++;
                if (subObj?._githubFile && subObj?._githubSha) {
                  try { await deleteGitHubSubmission(subObj._githubFile, subObj._githubSha); } catch (e) {}
                }
              } else fail++;
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
        let localFiltered = res.ok ? res.list : [];
        // GitHub投稿始终为待审核状态，仅在 pending/all 时显示
        const localIds = new Set(localFiltered.map(s => s.id));
        let ghToAdd = [];
        if (v === 'pending' || v === 'all') {
          ghToAdd = cachedGhSubs.filter(s => !localIds.has(s.id));
        }
        allSubs = [...ghToAdd, ...localFiltered];
        subsPage = 1;
        // 更新计数
        const noteEl = body.querySelector('.admin-toolbar-note');
        if (noteEl) noteEl.textContent = `共 ${allSubs.length} 条${res.fallback ? '（降级模式）' : ''}${ghToAdd.length ? ` · GitHub ${ghToAdd.length} 条` : ''}`;
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
              <label class="af"><span>音频附件路径（data/audio/xxx.mp3 或上传）</span>
                <div class="af-cover-wrap">
                  <input data-f="audio" value="${escapeAttr(x.audio||'')}" placeholder="data/audio/xxx.mp3"/>
                  <label class="af-cover-upload-btn">
                    ${ico('audio',12)} 上传
                    <input type="file" class="af-audio-file-edit" accept="audio/*" hidden>
                  </label>
                </div>
                <div class="af-audio-status af-audio-status-edit">${x.audio ? `<span style="font-family:var(--f-mono);font-size:10px;color:var(--text-3)">${ico('audio',10)} 已附加音频</span>` : '<span style="font-family:var(--f-mono);font-size:10px;color:var(--text-4)">无音频</span>'}</div>
              </label>
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
        // 音频上传
        const editAudioFile = dlg.querySelector('.af-audio-file-edit');
        const editAudioInput = dlg.querySelector('[data-f="audio"]');
        const editAudioStatus = dlg.querySelector('.af-audio-status-edit');
        if (editAudioFile) {
          editAudioFile.addEventListener('change', async () => {
            const file = editAudioFile.files && editAudioFile.files[0];
            if (!file) return;
            if (!file.type.startsWith('audio/')) { banner('仅支持音频文件', 'err'); return; }
            if (editAudioStatus) editAudioStatus.innerHTML = '<span style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1)">上传中…</span>';
            try {
              const r = await API.uploadAudio(file);
              if (!r.ok) { banner(r.msg || '音频上传失败', 'err'); if (editAudioStatus) editAudioStatus.innerHTML = '<span style="font-family:var(--f-mono);font-size:10px;color:var(--red-2)">上传失败</span>'; return; }
              if (editAudioInput) editAudioInput.value = r.url;
              if (editAudioStatus) editAudioStatus.innerHTML = `<span style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1)">${ico('audio',10)} 已附加（${r.fallback?'本地':'服务器'}）</span>`;
            } catch (e) { banner('音频上传失败', 'err'); if (editAudioStatus) editAudioStatus.innerHTML = '<span style="font-family:var(--f-mono);font-size:10px;color:var(--red-2)">上传失败</span>'; }
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
      Theme.next();
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
      // 主题切换（柔和反极 / 全息）
      theme: () => {
        const t = Theme.get();
        if (t === 'holo') {
          _dualTone({ freq: 659, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 3200, sendReverb: 0.3 });
          _dualTone({ freq: 988, type1: 'sine', type2: 'triangle', dur: 0.12, vol: 0.18, release: 0.1, lp: 3200, delay: 0.06, sendReverb: 0.4 });
          _dualTone({ freq: 1319, type1: 'sine', type2: 'triangle', dur: 0.16, vol: 0.14, release: 0.12, lp: 4000, delay: 0.12, sendReverb: 0.5 });
        } else {
          const up = t === 'light';
          _dualTone({ freq: up ? 587 : 466, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 3200, sendReverb: 0.3 });
          _dualTone({ freq: up ? 880 : 349, type1: 'sine', type2: 'triangle', dur: 0.12, vol: 0.18, release: 0.1, lp: 3200, delay: 0.06, sendReverb: 0.4 });
        }
      },
      // 管理后台操作（柔和机械咔嗒）
      adminClick: () => {
        _noise({ dur: 0.04, vol: 0.12, filterFreq: 1200, filterType: 'lowpass', sendReverb: 0.2 });
        _tone({ freq: 146, type: 'sine', dur: 0.04, vol: 0.18, release: 0.04, lp: 800, sendReverb: 0.15 });
      },
    };

    return api;
  })();

  // ============ 背景音乐模块（Web Audio 合成 ambient drone）============
  const BGM = (() => {
    let _ctx = null;
    let _masterGain = null;
    let _nodes = [];      // 所有振荡器/滤波器节点，用于停止
    let _lfoNodes = [];   // LFO 节点
    let _melodyTimer = null; // 旋律定时器
    let _chordTimer = null;  // 和弦进行定时器
    let _arpTimer = null;    // 琶音定时器
    let _padOscs = [];       // pad 振荡器引用（用于和弦切换）
    let _chordIdx = 0;       // 当前和弦索引
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

    let _stopCleanupTimer = null;
    let _healthCheckTimer = null;

    function _getCtx() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!_ctx) {
        try {
          _ctx = new Ctx();
          _ctx.addEventListener('statechange', () => {
            if (_playing && _ctx && _ctx.state === 'suspended') {
              _ctx.resume().catch(() => {});
            }
          });
        } catch { return null; }
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
      masterLP.frequency.value = 700;
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
        g.gain.value = 0.012 - i * 0.002;

        // 每个 drone 有独立的慢速 LFO 调制音量（呼吸感）
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.03 + i * 0.012; // 更慢，0.03~0.066 Hz
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.012; // 调制深度降低
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        osc.connect(g);
        g.connect(masterLP);
        osc.start();
        lfo.start();
        _nodes.push(osc, g, lfo, lfoGain);
      });

      // === 高频泛音层（空灵氛围，极轻）===
      // E4 = 329.5Hz, A4 = 440Hz, C5 = 523Hz（A 小调和弦，降低八度避免刺耳）
      const padFreqs = [329.5, 440, 523];
      _padOscs = [];
      padFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = (i - 1) * 3;

        const g = ctx.createGain();
        g.gain.value = 0.006;

        // 慢速音量调制
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.02;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.003;
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        // 独立低通（更低，更柔和）
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;

        osc.connect(g);
        g.connect(lp);
        lp.connect(_masterGain);
        osc.start();
        lfo.start();
        _padOscs.push(osc);
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

      // === 旋律层 + 琶音层 + 和弦进行 ===
      _scheduleMelody();
      _scheduleChordChange();
      _scheduleArp();

      return true;
    }

    // A 自然小调音阶（Aeolian，比五声音阶更丰富）
    const _scale = [220, 246.9, 261.6, 293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3];
    // 旋律模式（更长、更有起伏的乐句）
    const _melodyPatterns = [
      [0, 2, 4, 7, 4, 2, 0],
      [4, 6, 8, 6, 4, 2, 0],
      [0, 4, 7, 9, 7, 4, 2],
      [7, 9, 11, 9, 7, 4, 2],
      [2, 4, 6, 4, 2, 0, 4],
      [0, 2, 4, 2, 6, 4, 2, 0],
      [4, 7, 9, 7, 4, 2, 0, 2],
      [9, 7, 4, 2, 0, 4, 2],
    ];
    // 和弦进行：Am - F - C - G (vi-IV-I-V，经典情感进行)
    const _chords = [
      [261.6, 329.6, 440],     // Am: C4, E4, A4
      [261.6, 349.2, 440],     // F:  C4, F4, A4
      [329.6, 392, 523.3],     // C:  E4, G4, C5
      [392, 493.9, 587.3],     // G:  G4, B4, D5
    ];
    // 低音根音
    const _bassNotes = [110, 87.4, 130.8, 98];
    // 和弦对应的琶音音
    const _arpNotes = [
      [220, 261.6, 329.6, 440],
      [174.6, 220, 261.6, 349.2],
      [130.8, 164.8, 196, 261.6],
      [196, 246.9, 293.7, 392],
    ];

    function _scheduleMelody() {
      if (!_playing) return;
      const delay = 4000 + Math.random() * 3000;
      _melodyTimer = setTimeout(() => {
        _playMelodyPhrase();
        _scheduleMelody();
      }, delay);
    }

    function _playMelodyPhrase() {
      if (!_playing || !_masterGain) return;
      const pattern = _melodyPatterns[Math.floor(Math.random() * _melodyPatterns.length)];
      const noteDelay = 900 + Math.random() * 300;
      pattern.forEach((idx, i) => {
        setTimeout(() => {
          if (_playing) _playMelodyNote(_scale[idx]);
        }, i * noteDelay);
      });
    }

    function _playMelodyNote(freq) {
      if (!_playing || !_masterGain) return;
      const ctx = _getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.016, now + 0.15);
      g.gain.linearRampToValueAtTime(0.010, now + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.linearRampToValueAtTime(0.003, now + 0.15);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.375;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.4;

      osc.connect(g);
      osc2.connect(g2);
      g.connect(lp);
      g2.connect(lp);
      lp.connect(_masterGain);
      lp.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(_masterGain);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 4.5);
      osc2.stop(now + 3.0);
    }

    function _scheduleChordChange() {
      if (!_playing) return;
      const delay = 14000 + Math.random() * 4000;
      _chordTimer = setTimeout(() => {
        _chordIdx = (_chordIdx + 1) % _chords.length;
        _changeChord(_chordIdx);
        _playBassNote(_bassNotes[_chordIdx]);
        _scheduleChordChange();
      }, delay);
    }

    function _changeChord(idx) {
      const ctx = _getCtx();
      if (!ctx) return;
      const freqs = _chords[idx];
      _padOscs.forEach((osc, i) => {
        if (osc && freqs[i]) {
          osc.frequency.exponentialRampToValueAtTime(freqs[i], ctx.currentTime + 3);
        }
      });
    }

    function _playBassNote(freq) {
      if (!_playing || !_masterGain) return;
      const ctx = _getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.020, now + 0.2);
      g.gain.linearRampToValueAtTime(0.012, now + 3.0);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 12.0);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.linearRampToValueAtTime(0.004, now + 0.2);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 8.0);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;

      osc.connect(g);
      osc2.connect(g2);
      g.connect(lp);
      g2.connect(lp);
      lp.connect(_masterGain);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 12.0);
      osc2.stop(now + 8.0);
    }

    function _scheduleArp() {
      if (!_playing) return;
      const delay = 2000 + Math.random() * 1500;
      _arpTimer = setTimeout(() => {
        _playArpPhrase();
        _scheduleArp();
      }, delay);
    }

    function _playArpPhrase() {
      if (!_playing || !_masterGain) return;
      const notes = _arpNotes[_chordIdx];
      const dir = Math.random() > 0.5 ? 1 : -1;
      const start = dir > 0 ? 0 : notes.length - 1;
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const idx = (start + dir * i + notes.length) % notes.length;
        setTimeout(() => {
          if (_playing) _playArpNote(notes[idx]);
        }, i * 350);
      }
    }

    function _playArpNote(freq) {
      if (!_playing || !_masterGain) return;
      const ctx = _getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.008, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.5;
      const fb = ctx.createGain();
      fb.gain.value = 0.4;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.3;

      osc.connect(g);
      g.connect(_masterGain);
      g.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(_masterGain);

      osc.start(now);
      osc.stop(now + 3.0);
    }

    function play() {
      if (_playing) return;
      // 清除可能残留的 stop 清理定时器，防止竞态
      if (_stopCleanupTimer) { clearTimeout(_stopCleanupTimer); _stopCleanupTimer = null; }
      const ctx = _getCtx();
      if (!ctx) return;
      if (_nodes.length === 0 || !_masterGain) {
        if (!_build()) return;
      }
      _playing = true;
      // 淡入
      const now = ctx.currentTime;
      _masterGain.gain.cancelScheduledValues(now);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
      _masterGain.gain.linearRampToValueAtTime(_volume, now + 2.0);
      _playBassNote(_bassNotes[0]);
      _scheduleMelody();
      _scheduleChordChange();
      _scheduleArp();
      _startHealthCheck();
      savePref();
      Bus.emit('bgm:changed', { playing: true });
    }

    function stop() {
      if (!_playing) return;
      _playing = false;
      const ctx = _getCtx();
      if (_melodyTimer) { clearTimeout(_melodyTimer); _melodyTimer = null; }
      if (_chordTimer) { clearTimeout(_chordTimer); _chordTimer = null; }
      if (_arpTimer) { clearTimeout(_arpTimer); _arpTimer = null; }
      if (_healthCheckTimer) { clearInterval(_healthCheckTimer); _healthCheckTimer = null; }
      if (ctx && _masterGain) {
        const now = ctx.currentTime;
        _masterGain.gain.cancelScheduledValues(now);
        _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
        _masterGain.gain.linearRampToValueAtTime(0, now + 1.5);
      }
      // 1.5 秒后停止所有节点
      _stopCleanupTimer = setTimeout(() => {
        _nodes.forEach(n => { try { n.stop && n.stop(); n.disconnect(); } catch {} });
        _nodes = [];
        _lfoNodes = [];
        _padOscs = [];
        _chordIdx = 0;
        _masterGain = null;
        _stopCleanupTimer = null;
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

    // 定期健康检查：确保音频上下文持续运行
    function _startHealthCheck() {
      if (_healthCheckTimer) clearInterval(_healthCheckTimer);
      _healthCheckTimer = setInterval(() => {
        if (!_playing) return;
        const ctx = _getCtx();
        if (!ctx) return;
        // 上下文被浏览器挂起 → 尝试恢复
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // 节点丢失 → 重建
        if (_nodes.length === 0 || !_masterGain) {
          if (_build()) {
            const now = ctx.currentTime;
            _masterGain.gain.setValueAtTime(0, now);
            _masterGain.gain.linearRampToValueAtTime(_volume, now + 1.5);
            _scheduleMelody();
            _scheduleChordChange();
            _scheduleArp();
          }
        }
        // 音量意外归零 → 恢复
        if (_masterGain && _masterGain.gain.value < 0.001 && _volume > 0) {
          const now = ctx.currentTime;
          _masterGain.gain.cancelScheduledValues(now);
          _masterGain.gain.setValueAtTime(0.0001, now);
          _masterGain.gain.linearRampToValueAtTime(_volume, now + 2.0);
        }
      }, 5000);
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

    // 页面可见性变化：恢复被浏览器挂起的音频
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && _playing) {
        const ctx = _getCtx();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // 节点丢失（浏览器回收）→ 重建
        if (_nodes.length === 0 || !_masterGain) {
          play();
        }
      }
    });

    return { play, stop, toggle, isPlaying, getVolume, setVolume };
  })();

  // ============ 在线音乐模块（网易云 API + 直接 URL）============
  const OnlineMusic = (() => {
    let _audio = null;
    let _playing = false;
    let _currentSong = null;
    let _apiBase = localStorage.getItem('wa_om_api') || '';
    let _history = [];
    try { _history = JSON.parse(localStorage.getItem('wa_om_history') || '[]'); } catch {}

    function _ensureAudio() {
      if (!_audio) {
        _audio = new Audio();
        _audio.volume = parseFloat(localStorage.getItem('wa_om_vol') || '0.5');
        _audio.addEventListener('ended', () => {
          _playing = false;
          Bus.emit('om:changed', { playing: false, ended: true });
        });
        _audio.addEventListener('error', () => {
          _playing = false;
          Bus.emit('om:changed', { playing: false, error: true });
        });
        _audio.addEventListener('play', () => {
          _playing = true;
          Bus.emit('om:changed', { playing: true });
        });
        _audio.addEventListener('pause', () => {
          _playing = false;
          Bus.emit('om:changed', { playing: false });
        });
      }
      return _audio;
    }

    async function search(keywords) {
      if (!_apiBase) return { ok: false, msg: '未配置 API 地址，请点击设置按钮配置' };
      try {
        const url = `${_apiBase}/search?keywords=${encodeURIComponent(keywords)}&limit=20`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 200 && data.result && data.result.songs) {
        return {
          ok: true,
          list: data.result.songs.map(s => ({
            id: s.id,
            name: s.name,
            artist: (s.artists || []).map(a => a.name).join(' / '),
            album: (s.album || {}).name || '',
          }))
        };
      }
      return { ok: false, msg: data.msg || '搜索失败' };
      } catch (e) {
        return { ok: false, msg: '网络错误：' + e.message };
      }
    }

    async function play(song) {
      if (BGM.isPlaying()) BGM.stop();
      const audio = _ensureAudio();

      if (song.url) {
        audio.src = song.url;
        try { await audio.play(); } catch {}
        _currentSong = song;
        _addToHistory(song);
        return { ok: true };
      }

      if (!_apiBase) return { ok: false, msg: '未配置 API 地址' };
      try {
        const res = await fetch(`${_apiBase}/song/url?id=${song.id}`);
        const data = await res.json();
        if (data.code === 200 && data.data && data.data[0] && data.data[0].url) {
          audio.src = data.data[0].url;
          try { await audio.play(); } catch {}
          _currentSong = song;
          _addToHistory(song);
          return { ok: true };
        }
        return { ok: false, msg: '获取播放链接失败（可能需要 VIP）' };
      } catch (e) {
        return { ok: false, msg: '网络错误：' + e.message };
      }
    }

    function playByUrl(url, name) {
      if (BGM.isPlaying()) BGM.stop();
      const audio = _ensureAudio();
      audio.src = url;
      audio.play().catch(() => {});
      _currentSong = { name: name || '自定义音乐', url };
      _addToHistory(_currentSong);
    }

    function stop() {
      if (_audio) { _audio.pause(); _audio.currentTime = 0; }
      _currentSong = null;
    }
    function pause() { if (_audio) _audio.pause(); }
    function resume() {
      if (_audio && _currentSong) {
        if (BGM.isPlaying()) BGM.stop();
        _audio.play().catch(() => {});
      }
    }
    function isPlaying() { return _playing; }
    function getCurrent() { return _currentSong; }
    function getApiBase() { return _apiBase; }
    function setApiBase(url) {
      _apiBase = (url || '').trim().replace(/\/$/, '');
      localStorage.setItem('wa_om_api', _apiBase);
    }
    function getHistory() { return _history; }
    function setVolume(v) {
      const vol = Math.max(0, Math.min(1, v));
      if (_audio) _audio.volume = vol;
      localStorage.setItem('wa_om_vol', vol);
    }
    function getVolume() { return _audio ? _audio.volume : parseFloat(localStorage.getItem('wa_om_vol') || '0.5'); }

    function _addToHistory(song) {
      _history = _history.filter(s => s.name !== song.name);
      _history.unshift({ name: song.name, artist: song.artist, url: song.url, id: song.id });
      if (_history.length > 30) _history = _history.slice(0, 30);
      localStorage.setItem('wa_om_history', JSON.stringify(_history));
    }

    return { search, play, playByUrl, stop, pause, resume, isPlaying, getCurrent, getApiBase, setApiBase, getHistory, setVolume, getVolume };
  })();

  // ============ 在线音乐 UI ============
  let _omModal = null;
  function openMusicPanel() {
    if (_omModal) { _omModal.remove(); _omModal = null; }
    const dlg = document.createElement('div');
    dlg.className = 'admin-modal';
    dlg.style.zIndex = '10001';
    dlg.innerHTML = `
      <div class="admin-modal-body om-panel">
        <h3 class="am-title">在线音乐 · ONLINE MUSIC</h3>
        <div class="om-tabs">
          <button class="om-tab active" data-tab="search">搜索</button>
          <button class="om-tab" data-tab="url">直链播放</button>
          <button class="om-tab" data-tab="history">历史</button>
          <button class="om-tab" data-tab="settings">设置</button>
        </div>
        <div class="om-body" id="om-body"></div>
        <div class="am-foot">
          <button class="abtn abtn-cancel" data-act="close">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);
    _omModal = dlg;

    dlg.addEventListener('click', e => { if (e.target === dlg) { dlg.remove(); _omModal = null; } });
    dlg.querySelector('[data-act="close"]').addEventListener('click', () => { dlg.remove(); _omModal = null; });

    const body = dlg.querySelector('#om-body');
    const tabs = dlg.querySelectorAll('.om-tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderTab(t.dataset.tab);
    }));

    function renderTab(tab) {
      if (tab === 'search') renderSearch();
      else if (tab === 'url') renderUrl();
      else if (tab === 'history') renderHistory();
      else if (tab === 'settings') renderSettings();
    }

    function renderSearch() {
      body.innerHTML = `
        <div class="om-search-row">
          <input type="text" id="om-search-input" placeholder="搜索歌曲 / 歌手…" class="admin-search-input" style="flex:1;min-width:0">
          <button class="abtn abtn-approve" id="om-search-btn">搜索</button>
        </div>
        <div id="om-results" class="om-results"></div>
      `;
      const input = body.querySelector('#om-search-input');
      const btn = body.querySelector('#om-search-btn');
      const results = body.querySelector('#om-results');
      async function doSearch() {
        const kw = input.value.trim();
        if (!kw) return;
        results.innerHTML = '<div class="om-loading">搜索中…</div>';
        const r = await OnlineMusic.search(kw);
        if (!r.ok) { results.innerHTML = `<div class="om-empty">${r.msg}</div>`; return; }
        if (!r.list.length) { results.innerHTML = '<div class="om-empty">无结果</div>'; return; }
        results.innerHTML = r.list.map(s => `
          <div class="om-song" data-id="${s.id}" data-name="${escapeAttr(s.name)}" data-artist="${escapeAttr(s.artist)}">
            <div class="om-song-info">
              <div class="om-song-name">${escapeHtml(s.name)}</div>
              <div class="om-song-artist">${escapeHtml(s.artist)}${s.album ? ' · ' + escapeHtml(s.album) : ''}</div>
            </div>
            <button class="om-play-btn">▶</button>
          </div>
        `).join('');
        results.querySelectorAll('.om-song').forEach(el => {
          el.querySelector('.om-play-btn').addEventListener('click', async () => {
            const song = { id: el.dataset.id, name: el.dataset.name, artist: el.dataset.artist };
            el.querySelector('.om-play-btn').textContent = '…';
            const r = await OnlineMusic.play(song);
            el.querySelector('.om-play-btn').textContent = r.ok ? '♪' : '▶';
            if (r.ok) {
              results.querySelectorAll('.om-song').forEach(x => x.classList.remove('playing'));
              el.classList.add('playing');
              syncOmUI();
            } else {
              banner(r.msg || '播放失败', 'err');
            }
          });
        });
      }
      btn.addEventListener('click', doSearch);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
      input.focus();
    }

    function renderUrl() {
      body.innerHTML = `
        <div class="om-url-section">
          <label class="af"><span>音频直链 URL（mp3 / m4a / wav 等）</span>
            <input type="text" id="om-url-input" placeholder="https://example.com/music.mp3" style="width:100%">
          </label>
          <label class="af"><span>名称（选填）</span>
            <input type="text" id="om-url-name" placeholder="自定义音乐名" style="width:100%">
          </label>
          <button class="abtn abtn-approve" id="om-url-play" style="margin-top:8px">播放</button>
        </div>
      `;
      body.querySelector('#om-url-play').addEventListener('click', () => {
        const url = body.querySelector('#om-url-input').value.trim();
        const name = body.querySelector('#om-url-name').value.trim();
        if (!url) { banner('请输入音频 URL', 'err'); return; }
        OnlineMusic.playByUrl(url, name);
        syncOmUI();
        banner('开始播放', 'ok');
      });
    }

    function renderHistory() {
      const hist = OnlineMusic.getHistory();
      if (!hist.length) { body.innerHTML = '<div class="om-empty">暂无播放历史</div>'; return; }
      body.innerHTML = hist.map(s => `
        <div class="om-song" data-name="${escapeAttr(s.name)}" data-artist="${escapeAttr(s.artist || '')}" data-url="${escapeAttr(s.url || '')}" data-id="${s.id || ''}">
          <div class="om-song-info">
            <div class="om-song-name">${escapeHtml(s.name)}</div>
            <div class="om-song-artist">${escapeHtml(s.artist || '')}</div>
          </div>
          <button class="om-play-btn">▶</button>
        </div>
      `).join('');
      body.querySelectorAll('.om-song').forEach(el => {
        el.querySelector('.om-play-btn').addEventListener('click', async () => {
          const song = { id: el.dataset.id, name: el.dataset.name, artist: el.dataset.artist, url: el.dataset.url };
          const r = await OnlineMusic.play(song);
          if (r.ok) syncOmUI(); else banner(r.msg || '播放失败', 'err');
        });
      });
    }

    function renderSettings() {
      const api = OnlineMusic.getApiBase();
      body.innerHTML = `
        <div class="om-settings">
          <label class="af"><span>网易云 API 地址</span>
            <input type="text" id="om-api-input" value="${escapeAttr(api)}" placeholder="https://your-api.vercel.app" style="width:100%">
          </label>
          <p style="font-size:11px;color:var(--text-3);margin-top:8px;line-height:1.8">
            需要部署网易云 API 服务（如 <a href="https://github.com/Binaryify/NeteaseCloudMusicApi" target="_blank" style="color:var(--silver-2)">NeteaseCloudMusicApi</a>）并填入地址。<br>
            可部署到 Vercel / Cloudflare Workers 等免费平台。<br>
            留空则只能使用直链播放功能。
          </p>
          <button class="abtn abtn-approve" id="om-api-save" style="margin-top:10px">保存</button>
        </div>
      `;
      body.querySelector('#om-api-save').addEventListener('click', () => {
        OnlineMusic.setApiBase(body.querySelector('#om-api-input').value);
        banner('API 地址已保存', 'ok');
      });
    }

    renderTab('search');
  }

  function syncOmUI() {
    const playing = OnlineMusic.isPlaying();
    const current = OnlineMusic.getCurrent();
    const lbl = document.getElementById('sb-om-label');
    if (lbl) lbl.textContent = playing ? '在线音乐：' + (current ? current.name : '播放中') : '在线音乐：关';
    const btn = document.getElementById('sb-om-toggle');
    if (btn) btn.style.color = playing ? 'var(--silver-2)' : '';
  }

  function initOmUI() {
    const btn = document.getElementById('sb-om-toggle');
    if (btn) btn.addEventListener('click', openMusicPanel);
    Bus.on('om:changed', syncOmUI);
    syncOmUI();
  }

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
    initOmUI();
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
