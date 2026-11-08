/* =============================================================================
   盖亚 · 星球视图  (Gaia Planet)
   -----------------------------------------------------------------------------
   连续缩放的地表渲染器：
     ① 行星（球面投影，36 区标记）
     ② 区   （26 个单元的网格与主干道）
     ③ 单元 （城镇街区）
     ④ 城镇 （街道 + 楼房，带高度挤出）
   全部程序化生成，种子由「区号/单元号」决定 —— 同一格永远是同一座城。

   依赖：无。纯 Canvas 2D + DOM。
   对外接口：window.GaiaPlanet.mount(container) / .destroy()
   ============================================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 常量
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  const REGION_W = 1200;      // 区在世界坐标里的边长
  const CELL_COLS = 6;        // 26 个单元铺成 6 列 × 5 行（最后一格留空）
  const CELL_ROWS = 5;
  const CELLS = 26;
  const CELL_W = REGION_W / CELL_COLS;
  const CELL_H = REGION_W / CELL_ROWS;
  const MIN_SCALE = 0.22;   // 最远：整个区
  const MAX_SCALE = 8.5;    // 最近：街区（再近就钻进楼里，只剩色块）

  // 五级管控（世界观：白/灰/黄/红/黑）
  const LEVELS = {
    '白': { fill: '#e8e6e0', ink: '#1a1a1a', glow: 'rgba(232,230,224,0.55)', desc: '核心管控区' },
    '灰': { fill: '#8c8c8c', ink: '#141414', glow: 'rgba(140,140,140,0.5)',  desc: '缓冲区' },
    '黄': { fill: '#c9a227', ink: '#1a1400', glow: 'rgba(201,162,39,0.55)',  desc: '隔离区' },
    '红': { fill: '#a83a2e', ink: '#fff',    glow: 'rgba(168,58,46,0.6)',    desc: '禁区' },
    '黑': { fill: '#2a2a2a', ink: '#bdbdbd', glow: 'rgba(60,60,60,0.7)',     desc: '未定域' }
  };

  // ---------------------------------------------------------------- 随机
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  const pick = (rnd, arr) => arr[(rnd() * arr.length) | 0];

  // ---------------------------------------------------------------- 地名
  // 36 个区：四洲各 9 个，尽量取正典地名
  const REGIONS = [
    // 中州
    { n: '九原', c: '中州', lon: 18, lat: 26, lv: '白' },
    { n: '辉山', c: '中州', lon: 34, lat: 34, lv: '红' },
    { n: '圣湖', c: '中州', lon: 8,  lat: 12, lv: '白' },
    { n: '黑森林', c: '中州', lon: 44, lat: 20, lv: '黄' },
    { n: '灰塔', c: '中州', lon: 26, lat: 4,  lv: '灰' },
    { n: '巴罗萨', c: '中州', lon: 52, lat: 38, lv: '红' },
    { n: '午夜宫', c: '中州', lon: 12, lat: 40, lv: '白' },
    { n: '远星港', c: '中州', lon: 58, lat: 8,  lv: '灰' },
    { n: '东部高地', c: '中州', lon: 40, lat: 46, lv: '黄' },
    // 北洲
    { n: '永夜森林', c: '北洲', lon: -40, lat: 58, lv: '黄' },
    { n: '银湖', c: '北洲', lon: -22, lat: 50, lv: '灰' },
    { n: '霜落', c: '北洲', lon: -55, lat: 46, lv: '灰' },
    { n: '冰城', c: '北洲', lon: -30, lat: 66, lv: '白' },
    { n: '奥罗拉瑞斯', c: '北洲', lon: -62, lat: 62, lv: '灰' },
    { n: '诺克图恩', c: '北洲', lon: -14, lat: 62, lv: '白' },
    { n: '天翼遗骸', c: '北洲', lon: -48, lat: 36, lv: '黄' },
    { n: '极光带', c: '北洲', lon: -70, lat: 72, lv: '黑' },
    { n: '冻土', c: '北洲', lon: -8,  lat: 72, lv: '灰' },
    // 东洲
    { n: '东屿海沟', c: '东洲', lon: 96, lat: 16, lv: '红' },
    { n: '无名城', c: '东洲', lon: 82, lat: 26, lv: '灰' },
    { n: '黑潮城', c: '东洲', lon: 108, lat: 30, lv: '灰' },
    { n: '火城', c: '东洲', lon: 90, lat: 8,  lv: '黄' },
    { n: '皮里安', c: '东洲', lon: 116, lat: 18, lv: '白' },
    { n: '山主遗丘', c: '东洲', lon: 100, lat: 38, lv: '黄' },
    { n: '白沙', c: '东洲', lon: 76, lat: 10, lv: '黑' },
    { n: '白烛', c: '东洲', lon: 120, lat: 38, lv: '灰' },
    { n: '黑潮海岸', c: '东洲', lon: 88, lat: 44, lv: '灰' },
    // 南洲
    { n: '南裂谷', c: '南洲', lon: 16, lat: -46, lv: '红' },
    { n: '白色巢穴', c: '南洲', lon: 4,  lat: -58, lv: '红' },
    { n: '瑞穆', c: '南洲', lon: 30, lat: -38, lv: '白' },
    { n: '睡城', c: '南洲', lon: 44, lat: -52, lv: '黄' },
    { n: '索姆', c: '南洲', lon: 58, lat: -42, lv: '灰' },
    { n: '奥涅', c: '南洲', lon: 10, lat: -30, lv: '白' },
    { n: '梦晶', c: '南洲', lon: 36, lat: -66, lv: '黄' },
    { n: '黑火', c: '南洲', lon: 62, lat: -62, lv: '黑' },
    { n: '南部山脉', c: '南洲', lon: 48, lat: -28, lv: '灰' }
  ].map((r, i) => Object.assign(r, { idx: i, id: 'R' + String(i + 1).padStart(2, '0') }));

  // 单元名用词
  const UNIT_A = ['砂', '石', '铁', '灰', '霜', '雾', '盐', '木', '水', '火', '风', '雪', '岩', '苇', '荆'];
  const UNIT_B = ['脊', '原', '坳', '滩', '岭', '洼', '坪', '渡', '垣', '垄', '坂', '渠'];
  const TOWN_A = ['白', '乌', '槐', '青', '红', '石', '沙', '南', '北', '东', '西', '老', '新', '长', '高'];
  const TOWN_B = ['河', '桥', '岭', '屯', '堡', '集', '场', '窑', '岗', '湾', '铺', '寨'];

  function unitMeta(ri, ui) {
    const rnd = mulberry32(hashStr('U' + ri + ':' + ui));
    const name = pick(rnd, UNIT_A) + pick(rnd, UNIT_B);
    const region = REGIONS[ri];
    // 单元等级：多数继承区等级，少数降/升一级
    const order = ['白', '灰', '黄', '红', '黑'];
    let li = order.indexOf(region.lv);
    const roll = rnd();
    if (roll > 0.82) li = Math.min(4, li + 1);
    else if (roll < 0.18) li = Math.max(0, li - 1);
    const town = pick(rnd, TOWN_A) + pick(rnd, TOWN_B);
    return { idx: ui, code: 'U' + String(ui + 1).padStart(2, '0'), name, lv: order[li], town, pop: 1200 + ((rnd() * 46000) | 0) };
  }

  // 缓存
  const unitCache = new Map();
  function getUnits(ri) {
    if (unitCache.has(ri)) return unitCache.get(ri);
    const arr = [];
    for (let i = 0; i < CELLS; i++) arr.push(unitMeta(ri, i));
    unitCache.set(ri, arr);
    return arr;
  }

  // ---------------------------------------------------------------- 城镇生成
  // 返回 单元局部坐标 (0..CELL_W, 0..CELL_H) 内的街道与楼房
  const townCache = new Map();
  function genTown(ri, ui) {
    const key = ri + ':' + ui;
    if (townCache.has(key)) return townCache.get(key);
    const rnd = mulberry32(hashStr('T' + key));
    const W = CELL_W, H = CELL_H;

    // 主干道：略有倾斜
    const rot = (rnd() - 0.5) * 0.28;
    const cx = W / 2, cy = H / 2;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const toLocal = (x, y) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos });

    // 街道网格：若干条南北 / 东西向道路
    const vCount = 2 + ((rnd() * 2) | 0);
    const hCount = 2 + ((rnd() * 3) | 0);
    const vx = [], hy = [];
    for (let i = 0; i < vCount; i++) vx.push(-W * 0.42 + (i + 0.5) * (W * 0.84 / vCount) + (rnd() - 0.5) * 14);
    for (let i = 0; i < hCount; i++) hy.push(-H * 0.42 + (i + 0.5) * (H * 0.84 / hCount) + (rnd() - 0.5) * 14);
    vx.sort((a, b) => a - b); hy.sort((a, b) => a - b);

    const boundsX = [-W * 0.46].concat(vx, [W * 0.46]);
    const boundsY = [-H * 0.46].concat(hy, [H * 0.46]);

    const buildings = [];
    const streets = { vx, hy, rot, cx, cy };

    const density = 0.55 + rnd() * 0.4;
    for (let bi = 0; bi < boundsX.length - 1; bi++) {
      for (let bj = 0; bj < boundsY.length - 1; bj++) {
        const x0 = boundsX[bi], x1 = boundsX[bi + 1];
        const y0 = boundsY[bj], y1 = boundsY[bj + 1];
        const bw = x1 - x0, bh = y1 - y0;
        if (bw < 16 || bh < 16) continue;
        // 街区内切分地块
        const nx = Math.max(1, Math.round(bw / 26));
        const ny = Math.max(1, Math.round(bh / 26));
        for (let a = 0; a < nx; a++) {
          for (let b = 0; b < ny; b++) {
            if (rnd() > density) continue;                    // 空地
            const pad = 3 + rnd() * 4;
            const lx0 = x0 + (bw / nx) * a + pad;
            const ly0 = y0 + (bh / ny) * b + pad;
            const lw = Math.max(6, (bw / nx) - pad * 2 - rnd() * 3);
            const lh = Math.max(6, (bh / ny) - pad * 2 - rnd() * 3);
            const p = toLocal(lx0 + lw / 2, ly0 + lh / 2);
            buildings.push({
              x: p.x, y: p.y, w: lw, h: lh,
              hgt: 5 + Math.pow(rnd(), 2.2) * 52,           // 高度：多数矮，少数塔
              tone: rnd()
            });
          }
        }
      }
    }
    // 中央地标
    const c = toLocal(0, 0);
    buildings.push({ x: c.x, y: c.y, w: 15, h: 15, hgt: 44, tone: 0.5, landmark: true });

    buildings.sort((p, q) => p.y - q.y);
    const out = { streets, buildings, rot };
    townCache.set(key, out);
    return out;
  }

  // ---------------------------------------------------------------- 工具
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // 球面正交投影
  function projectGlobe(latDeg, lonDeg, rotLon, rotLat, R, cx, cy) {
    const lat = latDeg * DEG, lon = (lonDeg - rotLon) * DEG;
    const x = R * Math.cos(lat) * Math.sin(lon);
    const y = -R * (Math.cos(rotLat) * Math.sin(lat) - Math.sin(rotLat) * Math.cos(lat) * Math.cos(lon));
    const z = Math.cos(rotLat) * Math.cos(lat) * Math.cos(lon) + Math.sin(rotLat) * Math.sin(lat);
    return { x: cx + x, y: cy + y, z };
  }

  // ---------------------------------------------------------------- 主体
  let host = null, canvas = null, ctx = null, dpr = 1;
  let W = 0, H = 0;
  let raf = null, dirty = true;
  let bound = false;

  const state = {
    mode: 'globe',                 // globe | surface
    g: { rotLon: 30, rotLat: 18, radius: 0.36 },   // radius 相对屏幕短边
    s: { region: 0, cx: REGION_W / 2, cy: REGION_W / 2, scale: 0.6 }, // scale = px / world unit
    anim: null,                    // {from, to, t0, dur, kind}
    hoverRegion: -1,
    hoverCell: -1,
    selectedCell: -1,
    zoomHintT: 0
  };

  // ---------- 生命周期
  function mount(el) {
    host = el;
    host.innerHTML = '';
    host.classList.add('planet-host');

    canvas = document.createElement('canvas');
    canvas.className = 'planet-canvas';
    host.appendChild(canvas);
    ctx = canvas.getContext('2d');

    buildHud();
    resize();
    updateHud();
    if (!bound) { bindEvents(); bound = true; }
    animateIn();
    requestFrame();
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (host) { host.innerHTML = ''; host.classList.remove('planet-host'); }
    host = canvas = ctx = null;
    dirty = true;
  }

  function resize() {
    if (!canvas || !host) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    W = Math.max(320, Math.round(r.width));
    H = Math.max(360, Math.round(r.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    markDirty();
  }

  // ---------- HUD
  let hud = null;
  function buildHud() {
    hud = document.createElement('div');
    hud.className = 'planet-hud';
    hud.innerHTML = `
      <div class="ph-top">
        <div class="ph-crumb" id="ph-crumb"></div>
        <div class="ph-actions">
          <button type="button" class="ph-btn" id="ph-out" title="缩小一级">－</button>
          <button type="button" class="ph-btn" id="ph-in" title="放大一级">＋</button>
          <button type="button" class="ph-btn" id="ph-reset" title="回到星球">⟲ 星球</button>
        </div>
      </div>
      <div class="ph-left" id="ph-regions"></div>
      <div class="ph-right" id="ph-info"></div>
      <div class="ph-scale" id="ph-scale"></div>
      <div class="ph-tip" id="ph-tip">滚轮 / 双指缩放 · 拖拽平移 · 点击进入下一级</div>
    `;
    host.appendChild(hud);

    hud.querySelector('#ph-in').addEventListener('click', () => zoomStep(1.8));
    hud.querySelector('#ph-out').addEventListener('click', () => zoomStep(1 / 1.8));
    hud.querySelector('#ph-reset').addEventListener('click', () => flyToGlobe());
    renderRegionList();
  }

  function renderRegionList() {
    const box = hud && hud.querySelector('#ph-regions');
    if (!box) return;
    box.innerHTML = `
      <div class="ph-panel-title"><span class="ph-collapse" id="ph-collapse" title="收起 / 展开">▤</span>三十六区<span>REGIONS · 36</span></div>
      <div class="ph-region-grid">
        ${REGIONS.map(r => `
          <button type="button" class="ph-region" data-ri="${r.idx}" title="${r.c} · ${r.n} · ${LEVELS[r.lv].desc}">
            <i style="background:${LEVELS[r.lv].fill}"></i>
            <em>${String(r.idx + 1).padStart(2, '0')}</em>
            <span>${r.n}</span>
          </button>`).join('')}
      </div>`;
    const col = box.querySelector('#ph-collapse');
    if (col) col.addEventListener('click', (ev) => {
      ev.stopPropagation();
      box.classList.toggle('collapsed');
      markDirty();
    });
    box.querySelectorAll('.ph-region').forEach(b => {
      b.addEventListener('click', () => flyToRegion(parseInt(b.dataset.ri, 10)));
    });
  }

  function updateHud() {
    if (!hud) return;
    const crumb = hud.querySelector('#ph-crumb');
    const info = hud.querySelector('#ph-info');
    const scaleEl = hud.querySelector('#ph-scale');

    if (state.mode === 'globe') {
      crumb.innerHTML = `<b>盖亚</b><span>GAIA · 行星视图</span>`;
      info.innerHTML = `
        <div class="ph-panel-title">档案<span>OVERVIEW</span></div>
        <div class="ph-kv"><span>行政区</span><b>36 个区</b></div>
        <div class="ph-kv"><span>末端单元</span><b>936 个</b></div>
        <div class="ph-kv"><span>管控层级</span><b>白 / 灰 / 黄 / 红 / 黑</b></div>
        <div class="ph-legend">
          ${Object.keys(LEVELS).map(k => `<span><i style="background:${LEVELS[k].fill}"></i>${k}区</span>`).join('')}
        </div>
        <div class="ph-hintline">点击任意光点进入该区</div>`;
      scaleEl.textContent = 'SCALE · 行星';
    } else {
      const r = REGIONS[state.s.region];
      const unit = state.selectedCell >= 0 ? getUnits(state.s.region)[state.selectedCell] : null;
      crumb.innerHTML = unit
        ? `<a href="javascript:void(0)" data-nav="globe">盖亚</a> › <a href="javascript:void(0)" data-nav="region">${r.n}区</a> › <b>${unit.code} ${unit.name}单元</b>`
        : `<a href="javascript:void(0)" data-nav="globe">盖亚</a> › <b>${r.n}区</b>`;
      crumb.querySelectorAll('[data-nav]').forEach(a => {
        a.addEventListener('click', () => {
          if (a.dataset.nav === 'globe') flyToGlobe();
          else { state.selectedCell = -1; zoomToRegionOverview(true); }
        });
      });
      const units = getUnits(state.s.region);
      info.innerHTML = unit
        ? `
        <div class="ph-panel-title">${unit.name}单元<span>${unit.code}</span></div>
        <div class="ph-kv"><span>所属区</span><b>${r.n}区（${r.c}）</b></div>
        <div class="ph-kv"><span>管控等级</span><b style="color:${LEVELS[unit.lv].fill}">${unit.lv}区 · ${LEVELS[unit.lv].desc}</b></div>
        <div class="ph-kv"><span>城镇</span><b>${unit.town}</b></div>
        <div class="ph-kv"><span>登记人口</span><b>${unit.pop.toLocaleString()}</b></div>
        <div class="ph-hintline">继续放大约 2 次可见街道与楼房轮廓</div>`
        : `
        <div class="ph-panel-title">${r.n}区<span>${r.c} · ${r.id}</span></div>
        <div class="ph-kv"><span>管控等级</span><b style="color:${LEVELS[r.lv].fill}">${r.lv}区 · ${LEVELS[r.lv].desc}</b></div>
        <div class="ph-kv"><span>下辖单元</span><b>26 个</b></div>
        <div class="ph-kv"><span>城镇</span><b>${units.map(u => u.town).slice(0, 4).join('、')}…</b></div>
        <div class="ph-legend">${Object.keys(LEVELS).map(k => `<span><i style="background:${LEVELS[k].fill}"></i>${k}</span>`).join('')}</div>
        <div class="ph-hintline">点击方块进入单元</div>`;
      // 比例尺
      const pxPerUnit = state.s.scale;
      const target = 120;
      const worldLen = target / pxPerUnit;
      const nice = niceNumber(worldLen);
      scaleEl.textContent = `SCALE · ${nice >= 1 ? Math.round(nice) + ' 单位' : '街区内'}`;
    }

    hud.querySelectorAll('.ph-region').forEach(b => {
      b.classList.toggle('active', state.mode === 'surface' && parseInt(b.dataset.ri, 10) === state.s.region);
    });
  }

  function niceNumber(v) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, v))));
    const n = v / p;
    return (n > 5 ? 10 : n > 2 ? 5 : n > 1 ? 2 : 1) * p;
  }

  // ---------- 交互
  function bindEvents() {
    let dragging = false, lx = 0, ly = 0, moved = 0;
    let pinch = null;

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY;
      canvas.classList.add('grabbing');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) { trackHover(e); return; }
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (state.mode === 'globe') {
        state.g.rotLon -= dx * 0.32 / Math.max(0.4, state.g.radius * Math.min(W, H) / 300);
        state.g.rotLat = clamp(state.g.rotLat + dy * 0.28, -85, 85);
      } else {
        state.s.cx -= dx / state.s.scale;
        state.s.cy -= dy / state.s.scale;
      }
      markDirty();
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('grabbing');
      if (moved < 5) handleClick(e);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', () => { dragging = false; canvas.classList.remove('grabbing'); });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0016);
      zoomAt(e.clientX, e.clientY, k);
    }, { passive: false });

    // 双指
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinch = dist2(e.touches);
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        const d = dist2(e.touches);
        const k = d / pinch;
        pinch = d;
        const t = e.touches;
        zoomAt((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2, k);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { pinch = null; }, { passive: true });

    window.addEventListener('resize', () => { resize(); updateHud(); });
    // 键盘
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', (e) => {
      if (e.key === '+' || e.key === '=') zoomStep(1.8);
      else if (e.key === '-') zoomStep(1 / 1.8);
      else if (e.key === '0') flyToGlobe();
    });
  }

  function dist2(t) {
    const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  function trackHover(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (state.mode === 'globe') {
      const r = globeHitTest(mx, my);
      if (r !== state.hoverRegion) { state.hoverRegion = r; markDirty(); }
      canvas.style.cursor = r >= 0 ? 'pointer' : 'grab';
    } else {
      const c = cellHitTest(mx, my);
      if (c !== state.hoverCell) { state.hoverCell = c; markDirty(); }
      canvas.style.cursor = c >= 0 ? 'pointer' : 'grab';
    }
  }

  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (state.mode === 'globe') {
      const r = globeHitTest(mx, my);
      if (r >= 0) flyToRegion(r);
    } else {
      const c = cellHitTest(mx, my);
      if (c >= 0) {
        if (state.selectedCell !== c) {
          state.selectedCell = c;
          zoomToCell(c);
        } else {
          // 再点一次 → 继续放大到街道
          const t = cellCenterWorld(c);
          animateCam(t.x, t.y, state.s.scale * 1.7);
        }
        updateHud();
      }
    }
  }

  function zoomStep(k) {
    if (state.mode === 'globe') {
      state.g.radius = clamp(state.g.radius * (k > 1 ? 1.25 : 0.8), 0.12, 0.62);
      markDirty(); return;
    }
    zoomAt(W / 2, H / 2, k);
  }

  function zoomAt(sx, sy, k) {
    if (state.mode === 'globe') {
      const before = state.g.radius;
      state.g.radius = clamp(state.g.radius * k, 0.12, 0.62);
      // 放大到一定程度自动飞入最近的区
      if (state.g.radius > 0.5 && k > 1) {
        const r = globeHitTest(sx, sy);
        if (r >= 0) { flyToRegion(r); return; }
      }
      if (before !== state.g.radius) markDirty();
      return;
    }
    const before = worldAt(sx, sy);
    state.s.scale = clamp(state.s.scale * k, MIN_SCALE, MAX_SCALE);
    const after = worldAt(sx, sy);
    state.s.cx += before.x - after.x;
    state.s.cy += before.y - after.y;
    // 边界：不让相机跑出区
    clampCam();
    markDirty();
    updateHud();
  }

  function clampCam() {
    const halfW = W / 2 / state.s.scale;
    const halfH = H / 2 / state.s.scale;
    const m = REGION_W * 0.02;
    state.s.cx = clamp(state.s.cx, Math.min(halfW, REGION_W / 2) - m, Math.max(REGION_W - halfW, REGION_W / 2) + m);
    state.s.cy = clamp(state.s.cy, Math.min(halfH, REGION_W / 2) - m, Math.max(REGION_W - halfH, REGION_W / 2) + m);
  }

  function worldAt(sx, sy) {
    return {
      x: state.s.cx + (sx - W / 2) / state.s.scale,
      y: state.s.cy + (sy - H / 2) / state.s.scale
    };
  }
  function screenAt(wx, wy) {
    return {
      x: (wx - state.s.cx) * state.s.scale + W / 2,
      y: (wy - state.s.cy) * state.s.scale + H / 2
    };
  }

  function cellRect(i) {
    const col = i % CELL_COLS, row = (i / CELL_COLS) | 0;
    return { x: col * CELL_W, y: row * CELL_H, w: CELL_W, h: CELL_H };
  }
  function cellCenterWorld(i) {
    const r = cellRect(i);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
  function cellHitTest(mx, my) {
    const p = worldAt(mx, my);
    const col = Math.floor(p.x / CELL_W), row = Math.floor(p.y / CELL_H);
    if (col < 0 || col >= CELL_COLS || row < 0 || row >= CELL_ROWS) return -1;
    const i = row * CELL_COLS + col;
    return i < CELLS ? i : -1;
  }

  function globeHitTest(sx, sy) {
    const R0 = Math.min(W, H) * state.g.radius;
    const cx = W / 2, cy = H / 2;
    let best = -1, bestD = Infinity;
    for (const r of REGIONS) {
      const p = projectGlobe(r.lat, r.lon, state.g.rotLon, state.g.rotLat, R0, cx, cy);
      if (p.z <= 0.02) continue;
      const d = Math.hypot(p.x - sx, p.y - sy);
      const rad = Math.max(9, R0 * 0.035) + 6;
      if (d < rad && d < bestD) { best = r.idx; bestD = d; }
    }
    return best;
  }

  // ---------- 动画
  function animateIn() {
    state.g.radius = 0.06;
    animate(() => ({ v: state.g.radius }), { v: 0.4 }, 900, (v) => { state.g.radius = v.v; });
  }

  function animate(fromFn, to, dur, apply) {
    const t0 = performance.now();
    const from = fromFn();
    state.anim = { t0, dur, from, to, apply };
    markDirty();
  }

  function flyToRegion(ri) {
    const r = REGIONS[ri];
    state.mode = 'surface';
    state.s.region = ri;
    state.selectedCell = -1;
    state.s.cx = REGION_W / 2;
    state.s.cy = REGION_W / 2;
    const targetScale = Math.max(0.5, Math.min(W, H) / (REGION_W * 0.92));
    state.s.scale = targetScale * 0.35;
    animate(() => ({ v: state.s.scale }), { v: targetScale }, 620, (v) => {
      state.s.scale = v.v;
    });
    updateHud();
    renderRegionList();
  }

  function zoomToRegionOverview(smooth) {
    const targetScale = Math.max(0.5, Math.min(W, H) / (REGION_W * 0.92));
    animate(() => ({ v: state.s.scale }), { v: targetScale }, smooth ? 420 : 1, (v) => {
      state.s.scale = v.v;
      state.s.cx = lerp(state.s.cx, REGION_W / 2, 0.25);
      state.s.cy = lerp(state.s.cy, REGION_W / 2, 0.25);
      markDirty();
    });
  }

  function zoomToCell(i) {
    const c = cellCenterWorld(i);
    const target = Math.min(W, H) / (CELL_W * 1.15);
    animate(() => ({ x: state.s.cx, y: state.s.cy, s: state.s.scale }),
      { x: c.x, y: c.y, s: target }, 520, (v) => {
        state.s.cx = v.x; state.s.cy = v.y; state.s.scale = v.s;
      });
  }

  function animateCam(x, y, scale) {
    animate(() => ({ x: state.s.cx, y: state.s.cy, s: state.s.scale }),
      { x, y, s: clamp(scale, MIN_SCALE, MAX_SCALE) }, 520, (v) => {
        state.s.cx = v.x; state.s.cy = v.y; state.s.scale = v.s;
      });
  }

  function flyToGlobe() {
    const target = 0.4;
    state.mode = 'globe';
    state.selectedCell = -1;
    animate(() => ({ v: state.g.radius }), { v: target }, 620, (v) => { state.g.radius = v.v; });
    updateHud();
    renderRegionList();
  }

  // ---------- 绘制循环
  // 事件驱动的单帧循环：只有 dirty 或动画中才持续申请帧。
  // markDirty() 必须能「唤醒」已停下的循环，否则拖拽/缩放不会重绘。
  let inLoop = false;
  function markDirty() {
    dirty = true;
    if (!raf && !inLoop) raf = requestAnimationFrame(loop);
  }

  function requestFrame() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    raf = null;
    if (!ctx) return;
    inLoop = true;
    if (state.anim) {
      const a = state.anim;
      const t = clamp((now - a.t0) / a.dur, 0, 1);
      const e = ease(t);
      const v = {};
      for (const k in a.to) v[k] = lerp(a.from[k], a.to[k], e);
      a.apply(v);
      dirty = true;
      if (t >= 1) state.anim = null;
    }
    if (dirty) { draw(); dirty = false; }
    inLoop = false;
    if (state.anim) raf = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (state.mode === 'globe') drawGlobe();
    else drawSurface();
  }

  // ---------- 行星
  function drawGlobe() {
    const cx = W / 2, cy = H / 2;
    const R0 = Math.min(W, H) * state.g.radius;

    // 星空
    ctx.save();
    const bg = ctx.createRadialGradient(cx, cy, R0 * 0.6, cx, cy, Math.max(W, H) * 0.8);
    bg.addColorStop(0, '#0a0d10');
    bg.addColorStop(1, '#020304');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (!drawGlobe._stars) {
      const rnd = mulberry32(20260101);
      drawGlobe._stars = Array.from({ length: 260 }, () => ({ x: rnd(), y: rnd(), r: rnd() * 1.2 + 0.2, a: rnd() * 0.5 + 0.1 }));
    }
    ctx.fillStyle = 'rgba(232,232,232,0.5)';
    for (const s of drawGlobe._stars) {
      ctx.globalAlpha = s.a;
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 大气辉光
    const glow = ctx.createRadialGradient(cx, cy, R0 * 0.92, cx, cy, R0 * 1.22);
    glow.addColorStop(0, 'rgba(150,190,210,0.20)');
    glow.addColorStop(0.5, 'rgba(90,130,160,0.07)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R0 * 1.22, 0, TAU); ctx.fill();

    // 海洋
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.clip();
    const sea = ctx.createRadialGradient(cx - R0 * 0.35, cy - R0 * 0.4, R0 * 0.1, cx, cy, R0 * 1.5);
    sea.addColorStop(0, '#12222b');
    sea.addColorStop(0.55, '#0b161d');
    sea.addColorStop(1, '#050a0d');
    ctx.fillStyle = sea;
    ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);

    // 经纬网
    ctx.strokeStyle = 'rgba(150,190,210,0.10)';
    ctx.lineWidth = 0.7;
    for (let lon = -180; lon < 180; lon += 15) {
      ctx.beginPath();
      let started = false;
      for (let lat = -90; lat <= 90; lat += 3) {
        const p = projectGlobe(lat, lon, state.g.rotLon, state.g.rotLat, R0, cx, cy);
        if (p.z > 0) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        } else started = false;
      }
      ctx.stroke();
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const p = projectGlobe(lat, lon, state.g.rotLon, state.g.rotLat, R0, cx, cy);
        if (p.z > 0) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        } else started = false;
      }
      ctx.stroke();
    }

    // 大陆：按 区 分布的松散板块
    drawContinents(R0, cx, cy);

    // 区标记
    for (const r of REGIONS) {
      const p = projectGlobe(r.lat, r.lon, state.g.rotLon, state.g.rotLat, R0, cx, cy);
      if (p.z <= 0.02) continue;
      const lv = LEVELS[r.lv];
      const isHover = state.hoverRegion === r.idx;
      const rad = Math.max(2.6, R0 * (isHover ? 0.028 : 0.017)) * (0.6 + p.z * 0.6);

      ctx.beginPath();
      ctx.arc(p.x, p.y, rad * 2.4, 0, TAU);
      ctx.fillStyle = lv.glow;
      ctx.globalAlpha = 0.18 + p.z * 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, TAU);
      ctx.fillStyle = lv.fill;
      ctx.fill();

      if (isHover || R0 > Math.min(W, H) * 0.36) {
        ctx.font = `${Math.max(9, Math.min(13, rad * 2.4))}px ui-monospace, Consolas, monospace`;
        ctx.fillStyle = 'rgba(235,235,235,0.9)';
        ctx.textAlign = 'left';
        ctx.fillText(r.n, p.x + rad + 5, p.y + 3.5);
      }
    }

    // 边缘压暗
    const rim = ctx.createRadialGradient(cx, cy, R0 * 0.72, cx, cy, R0);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = rim;
    ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
    ctx.restore();

    // 轮廓
    ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU);
    ctx.strokeStyle = 'rgba(160,200,220,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 大陆板块：以每洲 9 个区的位置为锚，生成圆润的多边形
  function drawContinents(R0, cx, cy) {
    const groups = {};
    for (const r of REGIONS) (groups[r.c] = groups[r.c] || []).push(r);
    for (const key in groups) {
      const arr = groups[key];
      const pts = arr.map(r => {
        const p = projectGlobe(r.lat, r.lon, state.g.rotLon, state.g.rotLat, R0, cx, cy);
        return { x: p.x, y: p.y, z: p.z };
      });
      // 用区中心做凸包近似 -> 用 blob 连接
      const vis = pts.filter(p => p.z > -0.15);
      if (vis.length < 2) continue;
      const mx = vis.reduce((s, p) => s + p.x, 0) / vis.length;
      const my = vis.reduce((s, p) => s + p.y, 0) / vis.length;
      const rad = vis.reduce((s, p) => s + Math.hypot(p.x - mx, p.y - my), 0) / vis.length * 1.5 + R0 * 0.05;

      ctx.beginPath();
      const N = 26;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TAU;
        const wob = 0.72 + 0.28 * Math.sin(a * 3.1 + key.length) * Math.cos(a * 5.3 + key.charCodeAt(0));
        const rr = rad * wob;
        const x = mx + Math.cos(a) * rr, y = my + Math.sin(a) * rr * 0.82;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const land = ctx.createLinearGradient(mx, my - rad, mx, my + rad);
      land.addColorStop(0, 'rgba(58,66,58,0.92)');
      land.addColorStop(0.5, 'rgba(40,48,44,0.92)');
      land.addColorStop(1, 'rgba(24,30,28,0.92)');
      ctx.fillStyle = land;
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,180,160,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ---------- 区 / 单元 / 城镇
  function drawSurface() {
    const s = state.s;
    const r = REGIONS[s.region];
    const units = getUnits(s.region);

    // 底色
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#080b0d');
    g.addColorStop(1, '#040607');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 地表纹理（缓存的噪声块）
    drawGroundTexture();

    // 区边界外压暗
    const tl = screenAt(0, 0), br = screenAt(REGION_W, REGION_W);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill('evenodd');
    ctx.restore();

    // 单元格
    const cellPx = CELL_W * s.scale;
    const showTowns = cellPx > 260;

    for (let i = 0; i < CELLS; i++) {
      const u = units[i];
      const rect = cellRect(i);
      const p0 = screenAt(rect.x, rect.y);
      const pw = rect.w * s.scale, ph = rect.h * s.scale;
      if (p0.x + pw < -40 || p0.x > W + 40 || p0.y + ph < -40 || p0.y > H + 40) continue;

      const lv = LEVELS[u.lv];
      // 地块底色
      ctx.fillStyle = 'rgba(18,22,24,0.85)';
      ctx.fillRect(p0.x, p0.y, pw, ph);

      // 等级色晕
      const rg = ctx.createRadialGradient(p0.x + pw / 2, p0.y + ph / 2, 0, p0.x + pw / 2, p0.y + ph / 2, pw * 0.72);
      rg.addColorStop(0, hexA(lv.fill, 0.10));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(p0.x, p0.y, pw, ph);

      // 城镇
      if (showTowns) drawTown(i, p0, pw, ph, s.scale);
      else drawTownCluster(i, p0, pw, ph, lv);

      // 边界
      const isHover = state.hoverCell === i;
      const isSel = state.selectedCell === i;
      ctx.strokeStyle = isSel ? lv.fill : (isHover ? 'rgba(232,232,232,0.7)' : 'rgba(120,140,150,0.28)');
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(p0.x + 0.5, p0.y + 0.5, pw - 1, ph - 1);

      // 标签
      if (cellPx > 84) {
        const label = `${u.code} ${u.name}`;
        const fs = clamp(cellPx * 0.055, 9, 15);
        ctx.font = `${fs}px ui-monospace, Consolas, monospace`;
        ctx.textAlign = 'left';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(4,6,7,0.72)';
        ctx.fillRect(p0.x + 6, p0.y + 6, tw + 10, fs + 8);
        ctx.fillStyle = lv.fill;
        ctx.fillText(label, p0.x + 11, p0.y + 6 + fs + 1);

        if (cellPx > 190) {
          ctx.font = `${fs * 0.92}px ui-monospace, Consolas, monospace`;
          ctx.fillStyle = 'rgba(200,210,214,0.55)';
          ctx.fillText(`${u.town} · ${u.lv}区`, p0.x + 11, p0.y + 6 + fs * 2.05 + 4);
        }
      }
    }

    // 主干道（单元之间）
    drawArterials(units, s.scale);

    // 暗角
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGroundTexture() {
    if (!drawGroundTexture._pat) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const rnd = mulberry32(7);
      g.fillStyle = 'rgba(255,255,255,0.02)';
      for (let i = 0; i < 900; i++) {
        g.fillRect(rnd() * 128, rnd() * 128, 1, 1);
      }
      drawGroundTexture._pat = c;
    }
    const p = drawGroundTexture._pat;
    const s = state.s;
    const offX = (-s.cx * s.scale + W / 2) % 128;
    const offY = (-s.cy * s.scale + H / 2) % 128;
    for (let x = offX - 128; x < W; x += 128) {
      for (let y = offY - 128; y < H; y += 128) {
        ctx.drawImage(p, x, y);
      }
    }
  }

  function drawArterials(units, scale) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,170,180,0.16)';
    ctx.lineWidth = Math.max(1, 2.2 * Math.min(3, scale / 0.8));
    for (let row = 0; row <= CELL_ROWS; row++) {
      const y = row * CELL_H;
      const a = screenAt(0, y), b = screenAt(REGION_W, y);
      if (a.y < -20 || a.y > H + 20) continue;
      ctx.beginPath(); ctx.moveTo(a.x - 40, a.y); ctx.lineTo(b.x + 40, b.y); ctx.stroke();
    }
    for (let col = 0; col <= CELL_COLS; col++) {
      const x = col * CELL_W;
      const a = screenAt(x, 0), b = screenAt(x, REGION_W);
      if (a.x < -20 || a.x > W + 20) continue;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 40); ctx.lineTo(b.x, b.y + 40); ctx.stroke();
    }
    ctx.restore();
  }


  // 中距离：用聚落光点代替空方块（远看像卫星夜景）
  function drawTownCluster(ui, p0, pw, ph, lv) {
    const key = state.s.region + ':' + ui;
    if (!drawTownCluster._cache) drawTownCluster._cache = new Map();
    let pts = drawTownCluster._cache.get(key);
    if (!pts) {
      const rnd = mulberry32(hashStr('C' + key));
      const n = 26 + ((rnd() * 22) | 0);
      pts = [];
      for (let i = 0; i < n; i++) {
        // 中心密、边缘疏
        const a = rnd() * TAU, rr = Math.pow(rnd(), 0.6) * 0.32;
        pts.push({ x: 0.5 + Math.cos(a) * rr, y: 0.5 + Math.sin(a) * rr * 0.9, s: 0.5 + rnd() });
      }
      drawTownCluster._cache.set(key, pts);
    }
    ctx.save();
    for (const p of pts) {
      const x = p0.x + p.x * pw, y = p0.y + p.y * ph;
      const r = clamp(pw * 0.012 * p.s * 2.2, 0.6, 3.2);
      ctx.fillStyle = hexA(lv.fill, 0.30);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    // 中心地标
    ctx.fillStyle = hexA(lv.fill, 0.55);
    ctx.beginPath(); ctx.arc(p0.x + pw / 2, p0.y + ph / 2, clamp(pw * 0.016, 1, 4), 0, TAU); ctx.fill();
    ctx.restore();
  }
  // 绘制一个单元的城镇
  function drawTown(ui, p0, pw, ph, scale) {
    const town = genTown(state.s.region, ui);
    const s = state.s;
    const ox = p0.x, oy = p0.y;
    const cw = CELL_W, ch = CELL_H;

    // 把 单元局部坐标 (0..cell) 映射到屏幕
    // genTown 生成的是以 单元中心 为原点的旋转坐标，需还原到 单元 左上角
    const cxm = cw / 2, cym = ch / 2;
    const px = (lx, ly) => ({ x: ox + lx * scale, y: oy + ly * scale });

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, pw, ph);
    ctx.clip();

    // 街道：先画路面
    const streets = town.streets;
    ctx.lineCap = 'butt';
    const drawStreet = (x1, y1, x2, y2, wpx, color) => {
      const a = px(x1, y1), b = px(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = wpx;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };

    // 旋转坐标下的街道端点
    const rot = streets.rot, cos = Math.cos(rot), sin = Math.sin(rot);
    const toLocal = (x, y) => ({ x: cxm + x * cos - y * sin, y: cym + x * sin + y * cos });
    const L = cw * 0.5;

    // 底：土色
    ctx.fillStyle = 'rgba(30,28,24,0.9)';
    ctx.fillRect(ox, oy, pw, ph);

    // 东西向
    for (const hy of streets.hy) {
      const a = toLocal(-L, hy), b = toLocal(L, hy);
      drawStreet(a.x, a.y, b.x, b.y, Math.max(2.5, 7 * scale), 'rgba(58,58,56,0.95)');
      drawStreet(a.x, a.y, b.x, b.y, Math.max(0.8, 1.2 * scale), 'rgba(190,180,150,0.22)');
    }
    // 南北向
    for (const vx of streets.vx) {
      const a = toLocal(vx, -L), b = toLocal(vx, L);
      drawStreet(a.x, a.y, b.x, b.y, Math.max(2.5, 7 * scale), 'rgba(58,58,56,0.95)');
      drawStreet(a.x, a.y, b.x, b.y, Math.max(0.8, 1.2 * scale), 'rgba(190,180,150,0.22)');
    }

    // 楼房（带高度挤出）
    const hScale = 0.55;
    ctx.save();
    for (const bld of town.buildings) {
      const bx = bld.x, by = bld.y;
      const bw = Math.max(1.2, bld.w * scale);
      const bh = Math.max(1.2, bld.h * scale);
      const sx = ox + bx * scale - bw / 2;
      const sy = oy + by * scale - bh / 2;
      if (sx + bw < ox || sx > ox + pw || sy + bh < oy || sy > oy + ph) continue;

      const hgt = Math.max(0.8, bld.hgt * scale * hScale);
      const tone = bld.tone;
      const base = bld.landmark
        ? '#6d5a38'
        : (tone > 0.86 ? '#4a5560' : tone > 0.6 ? '#3a4148' : '#2c3238');
      const roof = bld.landmark
        ? '#9c8438'
        : (tone > 0.86 ? '#6f7d8a' : tone > 0.6 ? '#59636c' : '#454d55');

      // 屋顶相对基底的偏移：模拟俯视略斜的视角
      const ox2 = hgt * 0.34, oy2 = hgt;
      const rx = sx - ox2, ry = sy - oy2;

      // 投影
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.moveTo(sx + hgt * 0.18, sy + bh);
      ctx.lineTo(sx + bw + hgt * 0.18, sy + bh);
      ctx.lineTo(sx + bw + hgt * 0.18, sy + bh + hgt * 0.16);
      ctx.lineTo(sx + hgt * 0.18, sy + bh + hgt * 0.16);
      ctx.closePath(); ctx.fill();

      // 正立面（朝下）
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.moveTo(sx, sy + bh);
      ctx.lineTo(sx + bw, sy + bh);
      ctx.lineTo(rx + bw, ry + bh);
      ctx.lineTo(rx, ry + bh);
      ctx.closePath(); ctx.fill();

      // 侧立面（朝右）
      ctx.fillStyle = shade(base, -0.28);
      ctx.beginPath();
      ctx.moveTo(sx + bw, sy);
      ctx.lineTo(sx + bw, sy + bh);
      ctx.lineTo(rx + bw, ry + bh);
      ctx.lineTo(rx + bw, ry);
      ctx.closePath(); ctx.fill();

      // 屋顶
      ctx.fillStyle = roof;
      ctx.fillRect(rx, ry, bw, bh);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = Math.max(0.4, scale * 0.06);
      ctx.strokeRect(rx, ry, bw, bh);

      // 窗光：打在正立面上（放大后才有）
      if (scale > 3.0 && hgt > 5) {
        const cols = Math.max(1, Math.round(bw / 4));
        const rows = Math.max(1, Math.round(hgt / 6));
        const wW = bw / cols * 0.42, wH = hgt / rows * 0.4;
        for (let cix = 0; cix < cols; cix++) {
          for (let riy = 0; riy < rows; riy++) {
            const seed = (cix * 7 + riy * 13 + ((tone * 1000) | 0)) % 5;
            if (seed === 0) continue;
            const wx = sx + (cix + 0.3) * (bw / cols) + ox2 * 0.15;
            const wy = sy + bh - (riy + 0.55) * (hgt / rows);
            ctx.fillStyle = seed === 1 ? 'rgba(226,196,120,0.42)' : 'rgba(200,180,140,0.20)';
            ctx.fillRect(wx, wy, wW, wH);
          }
        }
      }
    }
    ctx.restore();   // 结束楼房绘制的 save（配对：clip 之外的那层）

    // 地标标注
    if (scale > 2.4) {
      const c = toLocal(0, 0);
      const sp = px(c.x, c.y);
      ctx.font = `${clamp(10 * scale * 0.5, 9, 14)}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(232,232,232,0.75)';
      ctx.fillText(units0Name(ui), sp.x, sp.y - 26 * 0.55 * scale * 0.5 - 8);
    }
    ctx.restore();
  }

  function units0Name(ui) {
    return getUnits(state.s.region)[ui].town;
  }

  function shade(hex, amt) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? (1 + amt) : 1;
    r = Math.round(clamp(r * f + (amt > 0 ? 255 * amt : 0), 0, 255));
    g = Math.round(clamp(g * f + (amt > 0 ? 255 * amt : 0), 0, 255));
    b = Math.round(clamp(b * f + (amt > 0 ? 255 * amt : 0), 0, 255));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // ---------------------------------------------------------------- 导出
  window.GaiaPlanet = {
    mount, destroy,
    // 供外部调试
    _state: state,
    _regions: REGIONS
  };
})();
