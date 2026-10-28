/* ============================================================
   gaia-globe.js — 盖亚全息星球 · Canvas 2D 软渲染
   零依赖 IIFE。window.GaiaGlobe.mount(canvas, opts) -> { destroy() }
   opts: { mode:'mini'|'full', autoRotate, onPick(beacon) }
   ============================================================ */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;

  /* ---------- 内嵌：四洲轮廓数据（消除 fetch 依赖，file:// 协议也能工作） ---------- */
  const INLINE_GEO = {"v":1,"src":"gaia-map.jpg","continents":[
    {"id":"zhong","label":"中州","color":"#c9a227","pts":[[-91.84,56.71],[12.68,56.92],[16.16,53.84],[17.18,51.16],[21.48,50.96],[22.7,47.26],[28.23,40.89],[34.36,40.89],[37.64,42.95],[39.07,42.33],[35.8,38.22],[33.95,32.26],[37.64,32.26],[45.82,29.79],[55.64,25.68],[57.68,23.22],[61.57,21.78],[63.2,18.49],[63.2,11.1],[64.02,10.27],[63.61,0.82],[61.77,0.21],[60.14,-2.67],[56.45,-4.73],[54,-4.73],[45.82,-12.12],[40.91,-15],[36.61,-19.73],[36.2,-22.6],[30.27,-27.33],[28.23,-27.33],[25.36,-24.04],[21.27,-23.63],[12.68,-23.63],[10.64,-24.86],[9,-24.04],[-2.86,-23.63],[-6.95,-24.86],[-11.86,-24.45],[-14.32,-26.1],[-17.18,-26.1],[-18.61,-25.07],[-19.64,-21.99],[-21.68,-21.99],[-25.77,-24.86],[-27.2,-23.42],[-25.57,-18.9],[-26.18,-18.29],[-29.86,-21.58],[-39.68,-14.59],[-43.36,-15.82],[-49.5,-14.18],[-51.95,-14.59],[-55.43,-10.27],[-55.02,-4.93],[-55.84,-2.88],[-64.84,0.82],[-61.98,5.34],[-62.8,7.81],[-55.43,18.08],[-56.25,21.78],[-46.23,27.33],[-43.77,30.21],[-40.09,31.44],[-39.89,32.88],[-43.36,35.14],[-45,35.14],[-45.2,38.22],[-51.14,40.48],[-55.23,45.41],[-57.27,45.82],[-59.73,44.59],[-63.41,53.22],[-78.95,46.23],[-85.09,48.7],[-86.11,52.19],[-91.84,56.3]]},
    {"id":"bei","label":"北洲","color":"#7fa8c9","pts":[[-54.2,90],[-54.82,87.33],[-60.14,85.27],[-63.82,86.51],[-69.95,86.1],[-70.36,81.58],[-81.61,75.62],[-82.43,74.38],[-82.02,71.51],[-83.66,69.86],[-85.7,64.52],[-90.61,59.59],[12.27,59.38],[15.34,62.88],[16.57,67.4],[13.91,72.12],[7.77,74.18],[4.09,72.12],[1.23,72.12],[-0.2,73.15],[-0.82,77.88],[-5.32,74.18],[-8.18,75],[-11.45,74.18],[-12.89,72.74],[-12.48,69.45],[-14.73,70.07],[-20.25,79.73],[-20.25,82.6],[-25.98,87.95],[-25.36,88.97],[-22.09,88.97],[-20.66,90]]},
    {"id":"dong","label":"东洲","color":"#c9a86a","pts":[[114.75,-0.41],[121.5,-2.67],[126.61,-7.4],[129.48,-13.15],[132.75,-15.21],[132.34,-18.08],[137.66,-25.07],[132.34,-30.41],[133.16,-33.29],[137.25,-36.16],[136.43,-40.27],[133.16,-43.15],[133.57,-47.67],[131.93,-50.14],[132.34,-54.66],[130.7,-57.12],[132.55,-65.96],[123.55,-62.26],[122.32,-63.08],[115.36,-62.67],[106.77,-67.19],[105.34,-64.93],[106.98,-62.47],[103.3,-59.18],[106.16,-57.95],[106.57,-56.71],[105.55,-55.68],[97.77,-54.04],[96.14,-51.99],[91.23,-51.16],[89.39,-48.9],[89.39,-43.15],[87.95,-41.71],[81.41,-43.36],[79.57,-42.33],[85.3,-36.99],[86.11,-35.34],[85.7,-32.47],[87.34,-31.23],[91.02,-24.25],[93.89,-23.01],[92.25,-19.73],[94.3,-14.79],[95.73,-13.77],[101.45,-14.59],[102.07,-13.56],[101.25,-11.1],[103.3,-5.75],[106.77,-5.14],[109.23,-2.67],[114.55,-0.62]]},
    {"id":"nan","label":"南洲","color":"#a98fb8","pts":[[-83.66,-18.49],[-82.23,-18.29],[-78.14,-21.16],[-72,-19.11],[-65.45,-22.81],[-60.95,-22.81],[-58.09,-28.56],[-51.14,-32.26],[-49.09,-32.26],[-47.05,-29.79],[-43.77,-32.26],[-37.23,-32.26],[-34.77,-30.62],[-31.5,-30.21],[-28.84,-40.68],[-27.41,-42.12],[-25.36,-42.12],[-24.55,-44.18],[-21.48,-44.79],[-21.07,-49.73],[-22.3,-54.66],[-27.2,-57.53],[-29.45,-62.26],[-31.91,-62.26],[-35.18,-60.62],[-39.89,-64.52],[-40.91,-66.78],[-45.82,-65.14],[-52.36,-67.19],[-55.23,-65.14],[-58.5,-64.73],[-62.18,-61.44],[-70.36,-62.26],[-72.82,-59.79],[-80.18,-59.79],[-81.82,-61.85],[-85.5,-61.85],[-90.41,-66.37],[-96.14,-67.19],[-94.7,-63.7],[-95.32,-62.26],[-98.59,-63.08],[-103.3,-62.47],[-103.7,-56.3],[-101.25,-52.6],[-103.09,-50.34],[-105.75,-50.14],[-105.75,-46.85],[-102.48,-43.97],[-103.7,-42.74],[-104.11,-38.63],[-107.8,-34.93],[-105.55,-34.32],[-104.11,-31.23],[-100.64,-28.56],[-93.68,-28.15],[-90.41,-23.22],[-87.55,-21.16],[-85.91,-21.16],[-83.86,-18.7]]}
  ]};

  function readPalette() {
    let gold = '#c9a227', ice = '#7fa8c9', dim = '#5a6a78';
    try {
      const cs = getComputedStyle(document.documentElement);
      const g = cs.getPropertyValue('--gold-1').trim();
      if (g) gold = g;
      const t = cs.getPropertyValue('--text-2').trim();
      if (t) dim = t;
    } catch (e) {}
    return { gold, ice, dim };
  }

  function mount(canvas, opts) {
    opts = opts || {};
    const mode = opts.mode === 'full' ? 'full' : 'mini';
    const full = mode === 'full';
    const interactive = full && opts.interactive !== false;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, R = 0, cx = 0, cy = 0;
    let stars = [];
    let rotY = -0.6, rotX = 0.16;        // 当前姿态（弧度）
    let velY = 0;                        // 拖拽惯性
    let zoom = 1;                        // 缩放（仅 full）
    let moonA = 0.9;                     // 红月轨道角
    let dragging = false, lastX = 0, lastY = 0, moved = 0;
    let raf = null, alive = true, visible = true, lastT = 0;
    let pal = readPalette();
    const autoSpeed = reduced ? 0 : (full ? 0.05 : 0.04); // rad/s

    /* ---------- 球面纹理（卫星影像贴图 + 方向光照，可读作真实行星） ---------- */
    let texW = 0, texH = 0, texPix = null;   // 逐像素采样模式需要
    let texImg = null;                        // 原始 Image 对象（file:// 下被 canvas 污染时 fallback 用）
    let tainted = false;                      // canvas 是否被污染（getImageData 抛 SecurityError）
    const S = 300;                            // 离屏纹理球直径（px）
    let sphereMap = null, sphereCtx = null;   // 预投影球面贴图
    let lutX = null, lutY = null, lutZ = null; // 单位球屏幕投影 LUT
    let lutIn = new Uint8Array(0);
    let lutDiff = null, lutSpec = null;       // 预计算光照
    let lastRY = NaN, lastRX = NaN;           // 上次重建纹理时的姿态

    /* ---------- 大陆轮廓数据（内嵌，file:// 也能工作） ---------- */
    let continents = null;
    (function initGeo() {
      const g = INLINE_GEO;
      if (!g || !g.continents) return;
      g.continents.forEach(c => {
        let x = 0, y = 0;
        c.pts.forEach(p => { x += p[0]; y += p[1]; });
        c.cen = [x / c.pts.length, y / c.pts.length];
      });
      continents = g.continents;
    })();

    /* 加载卫星影像贴图并采样到 2:1 小图（最近邻采样，性能优先） */
    function loadMapImage() {
      const img = new Image();
      img.onload = () => {
        texImg = img;
        const tw = 720, th = 360;
        const c = document.createElement('canvas');
        c.width = tw; c.height = th;
        const cc = c.getContext('2d', { willReadFrequently: true });
        cc.drawImage(img, 0, 0, tw, th);
        try {
          const d = cc.getImageData(0, 0, tw, th);
          texPix = d.data; texW = tw; texH = th;
          tainted = false;
          lastRY = lastRX = NaN;              // 触发重建
        } catch (e) {
          /* canvas 被污染（file:// 协议下 Image 加载），无法 getImageData → fallback 直接贴图 */
          tainted = true;
          texPix = null;
        }
        if (reduced) draw(performance.now());
      };
      img.onerror = () => { texPix = null; texImg = null; };
      img.src = 'data/gaia-map.jpg';
    }

    /* 预计算单位球屏幕投影 LUT 与光照系数 */
    function initLut() {
      sphereMap = document.createElement('canvas');
      sphereMap.width = S; sphereMap.height = S;
      sphereCtx = sphereMap.getContext('2d', { willReadFrequently: true });
      const n = S * S;
      lutX = new Float32Array(n);
      lutY = new Float32Array(n);
      lutZ = new Float32Array(n);
      lutIn = new Uint8Array(n);
      lutDiff = new Float32Array(n);
      lutSpec = new Float32Array(n);
      const half = S / 2;
      /* 方向光源（屏幕空间：左上偏前） */
      let Lx = -0.5, Ly = -0.42, Lz = 0.76;
      const ll = Math.hypot(Lx, Ly, Lz); Lx /= ll; Ly /= ll; Lz /= ll;
      for (let j = 0; j < S; j++) {
        const sy = 1 - (j + 0.5) / half;
        for (let i = 0; i < S; i++) {
          const sx = (i + 0.5) / half - 1;
          const r2 = sx * sx + sy * sy;
          const idx = j * S + i;
          if (r2 > 1) { lutIn[idx] = 0; lutZ[idx] = -2; }
          else {
            const sz = Math.sqrt(1 - r2);
            lutX[idx] = sx; lutY[idx] = sy; lutZ[idx] = sz;
            lutIn[idx] = 1;
            let nd = sx * Lx + sy * Ly + sz * Lz;
            if (nd < 0) nd = 0;
            lutDiff[idx] = 0.12 + 0.88 * Math.pow(nd, 0.85);
            lutSpec[idx] = Math.pow(nd, 26);
          }
        }
      }
    }

    /* 球面纹理重建（逐像素反投影 + 叠加光照） */
    function renderSphere() {
      if (!texPix || !lutIn) return;
      const cosRX = Math.cos(rotX), sinRX = Math.sin(rotX);
      const ryDeg = rotY * 180 / Math.PI;
      let imgd;
      try { imgd = sphereCtx.getImageData(0, 0, S, S); } catch (e) { return; }
      const data = imgd.data;
      const n = S * S;
      const wMin = texW - 1, hMin = texH - 1;
      for (let idx = 0, k = 0; idx < n; idx++, k += 4) {
        if (!lutIn[idx]) { data[k + 3] = 0; continue; }
        const sx = lutX[idx], sy = lutY[idx], sz = lutZ[idx];
        const yb = sy * cosRX + sz * sinRX;
        const zb = -sy * sinRX + sz * cosRX;
        const lat = Math.asin(yb < -1 ? -1 : (yb > 1 ? 1 : yb));
        let lonDeg = Math.atan2(sx, zb) * 180 / Math.PI - ryDeg;
        lonDeg = ((lonDeg + 540) % 360) - 180;
        const u = (lonDeg + 180) / 360;
        const v = (90 - lat * 180 / Math.PI) / 180;
        const tu = ((u - Math.floor(u)) * wMin) | 0;
        let tv = (v * hMin) | 0;
        if (tv < 0) tv = 0; else if (tv > hMin) tv = hMin;
        const pi = (tv * texW + tu) * 4;
        const diff = lutDiff[idx], spec = lutSpec[idx] * 255;
        let r = texPix[pi] * diff + spec;
        let g = texPix[pi + 1] * diff + spec;
        let b = texPix[pi + 2] * diff + spec;
        data[k] = r > 255 ? 255 : r;
        data[k + 1] = g > 255 ? 255 : g;
        data[k + 2] = b > 255 ? 255 : b;
        data[k + 3] = 255;
      }
      sphereCtx.putImageData(imgd, 0, 0);
    }

    /* file:// fallback：直接贴图 + 叠加光照渐变（不走 getImageData） */
    function drawSphereFallback() {
      if (!texImg) return false;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
      ctx.clip();
      /* 直接贴 equirectangular 图到圆内（近似，不做逐像素球面映射） */
      ctx.drawImage(texImg, cx - R, cy - R, R * 2, R * 2);
      /* 叠加方向光照渐变（左上受光，背光面压暗） */
      const shade = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.1, cx + R * 0.5, cy + R * 0.5, R * 1.3);
      shade.addColorStop(0.00, 'rgba(255,245,220,0.55)');
      shade.addColorStop(0.35, 'rgba(180,200,220,0.18)');
      shade.addColorStop(0.70, 'rgba(30,40,55,0.35)');
      shade.addColorStop(1.00, 'rgba(8,10,16,0.82)');
      ctx.fillStyle = shade;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      return true;
    }

    /* ---------- 尺寸与星空 ---------- */
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2;
      R = Math.min(W, H) * (full ? 0.33 : 0.36) * zoom;
      pal = readPalette();
      seedStars();
      if (reduced) draw(performance.now());
    }

    function seedStars() {
      stars = [];
      const n = full ? 220 : 130;
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() < 0.08 ? 1.4 : 0.8,
          ph: Math.random() * TAU,
          sp: 0.4 + Math.random() * 1.6,
          red: Math.random() < 0.05
        });
      }
    }

    /* ---------- 球面投影 ---------- */
    function project(latDeg, lonDeg, rad) {
      const lat = latDeg * D2R, lon = lonDeg * D2R + rotY;
      const cl = Math.cos(lat);
      const x = cl * Math.sin(lon);
      const y = Math.sin(lat);
      const z = cl * Math.cos(lon);
      const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
      const rr = (rad || 1) * R;
      return { x: cx + x * rr, y: cy - y2 * rr, z: z2 };
    }

    function strokeSphereLine(fn, color, width, alphaMax) {
      const N = 96;
      ctx.lineWidth = width;
      let prev = null, path = null, pathA = 0;
      const flush = () => {
        if (path) { ctx.strokeStyle = color; ctx.globalAlpha = pathA; ctx.stroke(path); path = null; }
      };
      for (let i = 0; i <= N; i++) {
        const p = fn(i / N);
        if (p.z > 0.02) {
          const a = alphaMax * Math.min(1, (p.z - 0.02) / 0.25);
          if (!path) { path = new Path2D(); path.moveTo(p.x, p.y); pathA = a; }
          else {
            if (Math.abs(a - pathA) > 0.12) { flush(); path = new Path2D(); path.moveTo(prev.x, prev.y); pathA = a; }
            path.lineTo(p.x, p.y);
            pathA = Math.max(pathA, a);
          }
        } else flush();
        prev = p;
      }
      flush();
      ctx.globalAlpha = 1;
    }

    /* ---------- 绘制 ---------- */
    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      /* 星空 */
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = reduced ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph));
        ctx.globalAlpha = tw * (s.red ? 0.9 : 0.7);
        ctx.fillStyle = s.red ? '#c66a5a' : '#c8d4e2';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;

      /* 大气外晕（球体后方） */
      const atm = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.55);
      atm.addColorStop(0, 'rgba(110,150,190,0.16)');
      atm.addColorStop(0.55, 'rgba(110,150,190,0.05)');
      atm.addColorStop(1, 'rgba(110,150,190,0)');
      ctx.fillStyle = atm;
      ctx.fillRect(0, 0, W, H);

      /* 红月（在球后方时先画） */
      const mp = moonPos(t);
      if (mp.z < 0) drawMoon(mp);

      /* 球体本体：优先逐像素球面映射+光照 → canvas 被污染时 fallback 直接贴图+渐变 */
      const eps = 0.004;
      if (texPix && (!Number.isFinite(lastRY) || Math.abs(rotY - lastRY) > eps || Math.abs(rotX - lastRX) > eps)) {
        renderSphere();
        lastRY = rotY; lastRX = rotX;
      }
      if (texPix) {
        ctx.drawImage(sphereMap, cx - R, cy - R, R * 2, R * 2);
      } else if (!drawSphereFallback()) {
        /* 彻底无贴图：深色渐变球兜底 */
        const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
        body.addColorStop(0, 'rgba(24,32,42,0.96)');
        body.addColorStop(0.7, 'rgba(10,14,20,0.97)');
        body.addColorStop(1, 'rgba(6,9,13,0.98)');
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
        ctx.fillStyle = body; ctx.fill();
      }

      /* 大气 limb 辉光 */
      const limbG = ctx.createRadialGradient(cx, cy, R * 0.84, cx, cy, R * 1.02);
      limbG.addColorStop(0, 'rgba(90,150,200,0)');
      limbG.addColorStop(0.55, 'rgba(110,170,220,0.06)');
      limbG.addColorStop(0.8, 'rgba(140,200,240,0.28)');
      limbG.addColorStop(0.93, 'rgba(160,215,255,0.6)');
      limbG.addColorStop(1, 'rgba(170,220,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, TAU);
      ctx.fillStyle = limbG; ctx.fill();
      ctx.restore();

      /* 经纬网格 */
      const gridCol = 'rgba(140,175,205,1)';
      for (let lat = -75; lat <= 75; lat += 15) {
        const emph = lat === 0;
        strokeSphereLine(u => project(lat, u * 360), emph ? 'rgba(201,162,39,1)' : gridCol, emph ? 0.9 : 0.55, emph ? 0.16 : 0.07);
      }
      for (let lon = 0; lon < 360; lon += 15) {
        strokeSphereLine(u => project(-90 + u * 180, lon), gridCol, 0.55, 0.05);
      }

      /* 洲域信标 */
      const marks = continents || INLINE_GEO.continents;
      for (const b of marks) {
        const lat = Math.max(-70, Math.min(70, b.cen[1]));
        const lon = b.cen[0];
        const p = project(lat, lon, 1.0);
        if (p.z <= 0.05) continue;
        const depth = Math.min(1, p.z);
        const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 0.002 + lat);
        ctx.globalAlpha = depth * pulse;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU);
        ctx.fillStyle = b.color; ctx.fill();
        ctx.globalAlpha = depth * pulse * 0.35;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, TAU);
        ctx.strokeStyle = b.color; ctx.lineWidth = 1; ctx.stroke();
        if (full) {
          ctx.globalAlpha = depth * 0.9;
          ctx.fillStyle = 'rgba(215,222,232,0.9)';
          ctx.font = '11px "Courier New", monospace';
          ctx.fillText(b.label, p.x + 12, p.y + 4);
        }
        ctx.globalAlpha = 1;
      }

      /* 边缘光 */
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R * 0.7, cy + R * 0.7);
      rim.addColorStop(0, 'rgba(170,200,225,0.55)');
      rim.addColorStop(0.45, 'rgba(150,180,210,0.12)');
      rim.addColorStop(1, 'rgba(120,150,185,0.02)');
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
      ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();

      /* 红月（在球前方时后画） */
      if (mp.z >= 0) drawMoon(mp);

      /* 刻度仪环 */
      drawRing(t);
    }

    function moonPos(t) {
      const a = moonA + (reduced ? 0 : t * 0.00004);
      const Rm = 1.62;
      const x = Math.sin(a) * Rm, z = Math.cos(a) * Rm;
      const y = -0.22;
      const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
      const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
      return { x: cx + x * R, y: cy - y2 * R, z: z2 };
    }

    function drawMoon(mp) {
      const mr = R * 0.075;
      const g = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, mr * 3.2);
      g.addColorStop(0, 'rgba(190,70,60,0.5)');
      g.addColorStop(0.4, 'rgba(160,50,46,0.16)');
      g.addColorStop(1, 'rgba(160,50,46,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mp.x, mp.y, mr * 3.2, 0, TAU); ctx.fill();
      const disc = ctx.createRadialGradient(mp.x - mr * 0.3, mp.y - mr * 0.3, 0, mp.x, mp.y, mr);
      disc.addColorStop(0, 'rgba(216,110,96,0.95)');
      disc.addColorStop(1, 'rgba(120,34,32,0.95)');
      ctx.beginPath(); ctx.arc(mp.x, mp.y, mr, 0, TAU);
      ctx.fillStyle = disc; ctx.fill();
    }

    function drawRing(t) {
      const rr = R * 1.24;
      ctx.strokeStyle = 'rgba(150,170,195,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      const ticks = 72;
      const drift = reduced ? 0 : t * 0.00012;
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * TAU + drift;
        const long = i % 6 === 0;
        const r1 = rr, r2 = rr + (long ? 7 : 4);
        ctx.strokeStyle = long ? 'rgba(201,162,39,0.55)' : 'rgba(140,175,205,0.3)';
        ctx.lineWidth = long ? 1.2 : 0.7;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.stroke();
      }
      const arcA = (reduced ? 0 : t * 0.0003) % TAU;
      ctx.strokeStyle = 'rgba(201,162,39,0.6)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, rr, arcA, arcA + 0.5); ctx.stroke();
      if (full) {
        ctx.fillStyle = 'rgba(150,170,195,0.5)';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText('GAIA-04 · HOLOGRAPHIC SURVEY', cx - rr, cy + rr + 18);
      }
    }

    /* ---------- 帧循环 ---------- */
    function frame(t) {
      if (!alive) return;
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
      lastT = t;
      if (visible) {
        if (!dragging) {
          rotY += (autoSpeed + velY) * dt;
          velY *= 0.94;
        }
        draw(t);
      }
      raf = requestAnimationFrame(frame);
    }

    /* ---------- 交互 ---------- */
    function onDown(e) {
      dragging = true; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      canvas.classList.add('gg-grabbing');
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      rotY += dx * 0.005;
      rotX = Math.max(-1.1, Math.min(1.1, rotX + dy * 0.004));
      velY = dx * 0.12;
    }
    function onUp() {
      dragging = false;
      canvas.classList.remove('gg-grabbing');
    }
    function onWheel(e) {
      e.preventDefault();
      zoom = Math.max(0.75, Math.min(1.8, zoom * (e.deltaY > 0 ? 0.92 : 1.09)));
      R = Math.min(W, H) * 0.33 * zoom;
    }

    if (interactive && !reduced) {
      canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
    }

    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
      io.observe(canvas);
    }
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    initLut();
    loadMapImage();
    resize();
    if (reduced) draw(performance.now());
    else raf = requestAnimationFrame(frame);

    return {
      destroy() {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        if (io) io.disconnect();
        window.removeEventListener('resize', onResize);
        if (interactive && !reduced) {
          canvas.removeEventListener('pointerdown', onDown);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          canvas.removeEventListener('wheel', onWheel);
        }
      }
    };
  }

  window.GaiaGlobe = { mount };
})();
