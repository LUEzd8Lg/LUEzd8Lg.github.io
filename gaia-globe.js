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
  const INLINE_GEO = {"v":2,"src":"gaia-map.jpg","w":1778,"h":884,"continents":[{"id":"zhong","label":"中洲","color":"#c9a227","cen":[-2.32,12.97],"pts":[[-59.53,50.29],[4.05,50.29],[5.26,46.83],[6.88,47.24],[11.34,44.59],[13.57,44.59],[13.36,43.78],[14.38,44.19],[15.79,42.76],[18.83,42.15],[17.82,41.33],[18.22,40.32],[23.49,39.71],[27.74,36.45],[25.11,33.80],[17.01,35.84],[18.63,33.39],[23.69,33.60],[25.31,32.58],[24.30,30.75],[31.59,29.73],[31.59,28.51],[36.04,29.93],[39.08,28.30],[42.11,28.51],[42.92,26.47],[43.53,27.49],[46.77,27.29],[46.37,26.06],[47.38,25.05],[50.42,24.84],[49.40,21.38],[51.02,23.21],[52.64,23.21],[52.85,20.77],[54.26,20.16],[55.28,17.71],[52.85,17.92],[54.67,16.49],[54.26,15.48],[55.48,15.68],[54.87,16.70],[56.69,18.33],[61.15,16.29],[60.54,14.46],[59.33,14.66],[58.31,11.20],[59.33,9.77],[58.92,7.94],[61.15,8.55],[61.75,5.50],[60.13,4.48],[59.33,1.43],[58.11,2.85],[56.09,2.04],[55.48,0.61],[54.06,0.61],[52.64,6.11],[52.44,3.87],[51.23,4.07],[51.02,2.44],[53.45,0.20],[54.06,-1.83],[48.80,-4.07],[49.00,0.20],[46.97,-0.20],[46.57,-1.43],[48.39,-2.65],[46.37,-4.48],[49.61,-5.29],[45.35,-6.52],[44.34,-9.16],[40.29,-12.83],[39.08,-12.42],[37.05,-15.68],[35.03,-15.07],[28.55,-21.18],[24.90,-20.16],[24.70,-21.38],[22.07,-21.79],[20.85,-20.36],[20.25,-21.79],[17.82,-21.99],[17.01,-20.16],[17.82,-18.12],[14.98,-19.34],[16.81,-19.55],[16.40,-21.38],[13.57,-21.58],[13.16,-19.34],[10.33,-21.58],[7.49,-20.16],[4.25,-20.16],[3.04,-21.58],[1.01,-20.97],[-4.25,-21.99],[-4.66,-21.18],[-10.93,-21.58],[-12.55,-19.75],[-17.41,-19.34],[-16.60,-20.36],[-13.57,-20.36],[-16.40,-21.58],[-17.21,-20.16],[-19.64,-19.55],[-18.02,-18.12],[-22.68,-17.92],[-24.70,-15.88],[-29.16,-17.10],[-29.16,-12.62],[-31.38,-13.03],[-31.99,-15.88],[-33.00,-14.46],[-34.83,-14.86],[-37.26,-12.62],[-39.28,-13.24],[-39.48,-11.00],[-40.09,-12.42],[-45.76,-12.22],[-46.37,-13.64],[-47.99,-12.01],[-52.85,-10.38],[-52.44,-9.16],[-53.66,-8.14],[-52.44,-5.70],[-53.86,-4.48],[-54.06,-0.81],[-53.25,2.44],[-54.67,1.63],[-58.31,3.26],[-58.52,6.52],[-57.30,7.94],[-58.31,11.61],[-55.07,14.25],[-55.07,16.29],[-51.63,18.94],[-51.83,20.36],[-50.42,19.75],[-51.02,20.77],[-49.61,20.77],[-47.99,19.14],[-48.19,20.77],[-46.97,21.18],[-46.77,22.60],[-45.15,22.81],[-43.13,25.25],[-41.30,25.05],[-40.70,26.67],[-39.28,27.08],[-39.28,29.52],[-36.24,30.75],[-35.23,33.80],[-28.35,35.23],[-32.19,35.43],[-36.45,33.39],[-42.11,36.65],[-42.11,37.87],[-39.89,38.69],[-39.48,39.91],[-38.27,39.71],[-36.04,41.54],[-34.83,40.93],[-35.43,47.85],[-39.08,48.67],[-38.27,45.81],[-36.65,46.43],[-35.84,43.98],[-40.09,42.15],[-42.92,42.76],[-43.13,40.72],[-46.37,40.32],[-50.21,42.35],[-54.06,46.83],[-56.29,47.85],[-58.52,47.24],[-59.53,50.29]]},{"id":"bei","label":"北洲","color":"#7fa8c9","cen":[-38.16,60.53],"pts":[[-58.11,77.58],[-58.11,75.34],[-57.10,74.93],[-55.68,75.54],[-54.47,75.14],[-54.26,77.58],[-53.05,76.36],[-51.83,76.56],[-51.63,75.54],[-49.81,75.34],[-49.81,74.73],[-50.62,74.73],[-50.21,74.12],[-49.81,74.52],[-48.39,74.12],[-48.19,73.30],[-46.37,73.10],[-44.54,72.08],[-43.94,70.86],[-41.51,71.67],[-38.88,70.66],[-37.66,71.06],[-36.65,70.25],[-36.65,69.23],[-37.66,69.03],[-36.04,68.01],[-33.81,67.81],[-33.00,70.25],[-30.78,70.66],[-30.57,70.05],[-33.41,68.21],[-30.37,65.97],[-32.60,63.53],[-31.38,62.92],[-29.97,64.14],[-26.12,63.94],[-25.51,62.92],[-26.32,62.71],[-26.32,61.49],[-25.71,61.90],[-25.71,60.88],[-28.14,60.48],[-26.73,60.48],[-26.73,59.25],[-24.70,58.03],[-23.89,59.25],[-24.09,60.27],[-23.28,60.48],[-23.89,60.88],[-23.69,62.92],[-22.07,63.94],[-22.47,64.95],[-23.49,64.95],[-23.49,65.97],[-22.07,66.58],[-20.85,65.97],[-20.85,66.79],[-20.04,66.79],[-20.04,65.57],[-19.44,65.77],[-19.03,64.75],[-17.21,64.55],[-15.79,63.53],[-15.79,61.29],[-14.98,60.48],[-12.35,62.10],[-11.95,63.33],[-10.53,61.29],[-11.95,60.48],[-10.12,60.27],[-9.92,59.46],[-9.11,59.66],[-8.10,58.85],[-4.25,59.66],[-3.24,63.73],[-1.62,62.10],[1.21,61.29],[1.42,64.75],[4.25,65.36],[5.87,64.14],[7.49,64.75],[8.30,66.18],[5.67,65.16],[5.26,67.81],[6.07,67.81],[6.68,66.79],[6.68,67.60],[9.31,67.60],[9.31,68.82],[10.12,69.03],[10.93,68.62],[10.93,67.40],[12.96,68.01],[12.35,66.38],[13.77,65.77],[12.35,64.95],[12.15,63.73],[9.52,64.34],[8.71,62.51],[6.28,62.92],[8.91,60.88],[8.10,60.68],[7.90,58.85],[5.67,58.85],[4.66,57.22],[6.28,56.61],[6.48,55.59],[7.29,55.79],[7.09,53.76],[8.91,52.74],[5.47,52.13],[6.07,53.35],[4.66,53.55],[4.25,52.74],[3.24,52.74],[3.44,50.29],[-60.13,50.29],[-60.13,52.13],[-61.55,55.38],[-62.97,56.40],[-65.80,54.57],[-67.83,54.57],[-68.44,54.16],[-67.83,53.96],[-68.03,53.35],[-70.66,53.76],[-71.47,53.35],[-71.07,52.94],[-72.28,53.14],[-71.27,54.57],[-71.47,55.38],[-72.69,55.18],[-73.30,53.35],[-75.12,51.52],[-78.56,50.90],[-79.17,52.33],[-81.39,52.74],[-80.99,54.57],[-78.16,54.98],[-76.74,56.81],[-74.71,56.40],[-73.70,57.01],[-73.70,58.64],[-76.33,60.07],[-74.71,60.68],[-76.74,60.88],[-76.74,62.31],[-74.71,61.70],[-75.12,62.31],[-71.68,63.12],[-70.66,64.14],[-68.84,64.14],[-68.64,65.57],[-70.06,64.95],[-70.66,65.77],[-70.26,66.99],[-71.27,68.42],[-70.66,68.62],[-70.87,69.64],[-68.64,70.25],[-67.42,71.47],[-68.03,72.90],[-67.02,72.49],[-63.17,73.71],[-64.18,75.34],[-63.78,76.97],[-58.52,76.97],[-58.11,77.58]]},{"id":"nan","label":"南洲","color":"#a98fb8","cen":[-63.80,-41.82],"pts":[[-83.22,-20.16],[-79.78,-20.97],[-78.76,-22.60],[-77.14,-22.60],[-75.93,-21.58],[-73.50,-21.58],[-71.47,-23.01],[-70.87,-26.06],[-70.26,-24.23],[-69.45,-24.03],[-68.64,-25.05],[-67.22,-25.05],[-66.61,-27.29],[-64.99,-28.51],[-62.56,-27.69],[-62.56,-28.71],[-60.54,-28.91],[-60.54,-29.52],[-61.55,-29.73],[-60.13,-30.34],[-57.30,-29.93],[-53.86,-32.78],[-50.82,-33.60],[-50.01,-36.45],[-49.61,-35.63],[-48.39,-36.45],[-45.56,-35.84],[-44.95,-36.65],[-43.33,-35.84],[-42.92,-36.45],[-42.52,-35.84],[-42.11,-37.06],[-39.69,-35.23],[-38.67,-35.43],[-38.07,-36.04],[-38.67,-36.45],[-37.86,-36.65],[-34.22,-36.04],[-34.42,-37.26],[-35.84,-37.87],[-38.27,-37.67],[-39.48,-38.89],[-37.86,-41.33],[-37.86,-43.98],[-35.43,-45.20],[-33.21,-42.96],[-33.61,-41.33],[-32.80,-39.10],[-33.41,-38.89],[-32.19,-38.69],[-32.19,-39.91],[-31.59,-39.71],[-31.99,-39.10],[-30.98,-39.10],[-30.57,-41.13],[-31.99,-41.95],[-29.97,-41.95],[-27.74,-43.17],[-28.14,-44.19],[-27.13,-45.41],[-23.89,-45.81],[-23.49,-46.83],[-22.27,-46.43],[-21.46,-49.07],[-22.68,-51.31],[-22.47,-54.16],[-24.50,-54.57],[-25.11,-53.14],[-26.12,-52.74],[-26.52,-54.37],[-27.94,-54.57],[-29.36,-56.40],[-30.78,-56.81],[-31.18,-59.25],[-30.57,-61.09],[-32.19,-60.48],[-33.21,-58.85],[-35.03,-58.44],[-36.24,-60.07],[-38.67,-60.27],[-39.28,-62.10],[-41.71,-62.10],[-42.52,-61.09],[-43.94,-61.09],[-46.97,-63.73],[-49.61,-64.95],[-51.63,-63.12],[-51.43,-62.31],[-49.61,-61.49],[-48.80,-61.90],[-47.38,-60.68],[-47.38,-59.05],[-46.57,-58.85],[-46.16,-57.42],[-44.14,-57.83],[-44.34,-56.40],[-44.14,-57.01],[-43.73,-56.40],[-42.52,-56.61],[-42.72,-55.18],[-40.29,-54.16],[-40.49,-52.53],[-39.69,-51.92],[-40.90,-51.11],[-41.30,-51.72],[-42.92,-51.72],[-43.53,-49.89],[-46.77,-50.70],[-48.39,-50.09],[-47.99,-50.70],[-48.80,-51.31],[-48.80,-52.74],[-50.42,-52.53],[-50.82,-53.76],[-53.25,-54.16],[-54.87,-56.20],[-57.50,-54.98],[-58.31,-55.79],[-58.52,-54.98],[-59.33,-55.79],[-61.15,-56.00],[-65.20,-55.18],[-69.65,-56.20],[-70.46,-55.79],[-70.66,-53.76],[-72.49,-53.35],[-74.51,-53.96],[-74.92,-53.14],[-78.16,-52.94],[-79.37,-51.72],[-81.19,-52.13],[-80.99,-52.74],[-82.00,-53.35],[-83.62,-53.35],[-84.63,-52.74],[-84.03,-51.31],[-85.65,-49.89],[-87.27,-50.29],[-86.66,-50.90],[-86.66,-53.35],[-88.08,-53.96],[-88.68,-53.35],[-88.08,-52.94],[-88.68,-51.31],[-87.67,-51.52],[-88.08,-50.50],[-90.71,-48.05],[-91.72,-48.26],[-91.32,-47.24],[-94.35,-45.81],[-94.56,-44.39],[-96.38,-43.37],[-94.15,-38.89],[-92.73,-39.10],[-92.53,-37.26],[-91.72,-38.69],[-90.10,-39.10],[-90.51,-37.47],[-89.70,-35.63],[-90.71,-34.82],[-91.72,-35.23],[-93.14,-34.21],[-95.37,-34.21],[-96.38,-35.84],[-99.21,-35.43],[-99.82,-36.24],[-100.83,-36.24],[-100.83,-36.86],[-102.86,-37.06],[-104.07,-36.45],[-104.07,-35.43],[-101.64,-33.80],[-102.65,-33.39],[-102.25,-31.76],[-100.43,-31.36],[-100.02,-30.34],[-97.39,-31.15],[-93.54,-29.52],[-91.52,-27.08],[-91.11,-24.64],[-88.48,-23.62],[-87.67,-22.40],[-84.43,-22.19],[-83.22,-20.16]]},{"id":"dong","label":"东洲","color":"#c9a86a","cen":[112.37,-33.80],"pts":[[109.94,-28.91],[111.36,-29.12],[110.96,-29.73],[111.97,-34.00],[113.79,-32.99],[116.83,-32.78],[117.23,-35.23],[119.66,-34.00],[121.69,-34.00],[121.69,-35.63],[120.67,-35.63],[120.27,-36.45],[124.12,-35.63],[123.91,-37.26],[124.72,-37.87],[124.72,-38.89],[123.10,-41.13],[125.13,-41.33],[125.33,-42.96],[123.91,-46.02],[123.91,-48.26],[121.69,-48.67],[121.48,-48.05],[121.08,-49.07],[120.88,-48.26],[117.84,-48.05],[116.83,-46.83],[113.99,-47.24],[111.56,-46.02],[109.13,-46.02],[108.32,-44.19],[106.50,-43.57],[106.91,-42.35],[106.30,-41.33],[107.31,-40.52],[106.50,-39.91],[106.91,-36.45],[105.29,-36.45],[104.88,-35.84],[106.30,-34.41],[106.70,-31.76],[109.13,-31.15],[109.34,-29.93],[110.55,-29.73],[109.94,-28.91]],"parts":[[[105.49,-17.31],[105.69,-18.53],[107.11,-19.55],[107.11,-20.57],[105.89,-20.77],[105.49,-21.79],[107.11,-22.40],[107.51,-24.23],[102.45,-24.64],[102.65,-25.25],[100.22,-26.88],[99.82,-28.71],[98.40,-29.52],[100.02,-29.93],[99.42,-31.36],[98.20,-31.97],[97.59,-33.39],[95.97,-33.19],[94.56,-35.23],[91.92,-35.84],[91.52,-36.86],[91.32,-35.84],[88.68,-35.43],[91.52,-32.99],[92.94,-33.39],[95.57,-31.97],[96.38,-29.52],[95.37,-29.12],[96.58,-27.69],[96.99,-23.82],[99.01,-21.79],[101.84,-21.58],[104.07,-18.94],[103.87,-17.71],[105.49,-17.92],[105.49,-17.31]],[[118.25,-15.88],[118.85,-16.29],[117.64,-17.92],[118.45,-18.12],[118.85,-17.51],[119.46,-18.33],[123.31,-16.49],[122.70,-18.53],[123.10,-19.55],[121.48,-20.16],[121.48,-22.19],[124.12,-20.77],[124.52,-21.79],[126.75,-21.79],[126.75,-22.60],[122.70,-23.42],[121.69,-25.45],[119.66,-26.47],[117.23,-26.27],[114.80,-27.08],[113.59,-26.67],[112.98,-25.25],[110.55,-25.45],[110.96,-24.03],[112.37,-22.81],[112.78,-23.62],[114.80,-23.62],[112.78,-22.60],[115.41,-21.38],[115.41,-19.95],[116.63,-20.77],[116.83,-17.31],[118.25,-15.88]]]}]};

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
    let zoom = 1;                        // 缩放
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

    /* ---------- 地形凹凸（法线扰动）+ 云层（最外层半透明） ---------- */
    let LX = -0.5, LY = -0.42, LZ = 0.76;     // 屏幕空间方向光（initLut 归一化）
    let bumpGX = null, bumpGY = null, bumpW = 0, bumpH = 0; // 高度图梯度
    const BUMP_K = 2.4;                       // 凹凸强度
    let cloudPix = null, cloudW = 0, cloudH = 0, cloudImg = null; // 云层灰度=透明度
    let cloudDrift = 0, lastDrift = NaN;      // 云层相对球体自转（度）
    const CLOUD_SPEED = 2.4;                  // 度/秒

    /* ---------- 大陆轮廓数据（内嵌，file:// 也能工作） ---------- */
    let continents = null;
    (function initGeo() {
      const g = INLINE_GEO;
      if (!g || !g.continents) return;
      g.continents.forEach(c => {
        if (!c.cen || c.cen.length !== 2) {
          let x = 0, y = 0;
          c.pts.forEach(p => { x += p[0]; y += p[1]; });
          c.cen = [x / c.pts.length, y / c.pts.length];
        }
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

    /* 加载凹凸高度图 / 云层灰度图（缺失时自动跳过对应效果） */
    function loadAuxImages() {
      const bump = new Image();
      bump.onload = () => {
        try {
          const tw = 720, th = 360;
          const c = document.createElement('canvas');
          c.width = tw; c.height = th;
          const cc = c.getContext('2d', { willReadFrequently: true });
          cc.drawImage(bump, 0, 0, tw, th);
          const d = cc.getImageData(0, 0, tw, th).data;
          const g = new Float32Array(tw * th);
          for (let i = 0, p = 0; i < g.length; i++, p += 4) {
            g[i] = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) / 255;
          }
          const gx = new Float32Array(tw * th), gy = new Float32Array(tw * th);
          for (let y = 0; y < th; y++) {
            const ym = y > 0 ? y - 1 : 0, yp = y < th - 1 ? y + 1 : th - 1;
            for (let x = 0; x < tw; x++) {
              const xm = x > 0 ? x - 1 : tw - 1, xp = x < tw - 1 ? x + 1 : 0;
              const idx = y * tw + x;
              /* 东西向按经度环绕取样，南北向取相邻行 */
              gx[idx] = g[y * tw + xp] - g[y * tw + xm];
              gy[idx] = g[yp * tw + x] - g[ym * tw + x];
            }
          }
          bumpGX = gx; bumpGY = gy; bumpW = tw; bumpH = th;
          lastRY = lastRX = NaN;
          if (reduced) draw(performance.now());
        } catch (e) {
          /* file:// 下 canvas 被污染，退化为无凹凸 */
          bumpGX = bumpGY = null;
        }
      };
      bump.onerror = () => {};
      bump.src = 'data/gaia-bump.jpg';

      const cloud = new Image();
      cloud.onload = () => {
        cloudImg = cloud;
        try {
          const tw = 720, th = 360;
          const c = document.createElement('canvas');
          c.width = tw; c.height = th;
          const cc = c.getContext('2d', { willReadFrequently: true });
          cc.drawImage(cloud, 0, 0, tw, th);
          const d = cc.getImageData(0, 0, tw, th).data;
          const g = new Float32Array(tw * th);
          for (let i = 0, p = 0; i < g.length; i++, p += 4) {
            g[i] = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) / 255;
          }
          cloudPix = g; cloudW = tw; cloudH = th;
          lastRY = lastRX = NaN;
          if (reduced) draw(performance.now());
        } catch (e) {
          /* 污染时保留 cloudImg，绘制阶段用直接贴图降级 */
          cloudPix = null;
        }
      };
      cloud.onerror = () => {};
      cloud.src = 'data/gaia-clouds.jpg';
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
      const ll = Math.hypot(LX, LY, LZ); LX /= ll; LY /= ll; LZ /= ll;
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
            let nd = sx * LX + sy * LY + sz * LZ;
            if (nd < 0) nd = 0;
            lutDiff[idx] = 0.12 + 0.88 * Math.pow(nd, 0.85);
            lutSpec[idx] = Math.pow(nd, 26);
          }
        }
      }
    }

    /* 球面纹理重建（逐像素反投影 + 凹凸光照 + 云层合成） */
    function renderSphere() {
      if (!texPix || !lutIn) return;
      const cosRX = Math.cos(rotX), sinRX = Math.sin(rotX);
      const ryDeg = rotY * 180 / Math.PI;
      let imgd;
      try { imgd = sphereCtx.getImageData(0, 0, S, S); } catch (e) { return; }
      const data = imgd.data;
      const n = S * S;
      const wMin = texW - 1, hMin = texH - 1;
      const hasBump = !!bumpGX, hasCloud = !!cloudPix;
      const bW = bumpW, cW = cloudW;
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
        const piB = tv * bW + tu;
        const diff = lutDiff[idx], spec = lutSpec[idx] * 255;

        /* 法线扰动：用高度图梯度在球面切空间做一次小角度偏转 */
        let shade = diff;
        if (hasBump) {
          const bgx = bumpGX[piB], bgy = bumpGY[piB];
          if (bgx !== 0 || bgy !== 0) {
            const invCL = 1 / Math.sqrt(Math.max(0.0001, 1 - yb * yb));
            const ex = (cosRX * sz - sinRX * sy) * invCL;   // 东向切线
            const ey = sinRX * sx * invCL;
            const ez = -cosRX * sx * invCL;
            const nx = sy * ez - sz * ey;                   // 北向切线
            const ny = sz * ex - sx * ez;
            const nz = sx * ey - sy * ex;
            const dl = -BUMP_K * (bgx * (ex * LX + ey * LY + ez * LZ)
                                  - bgy * (nx * LX + ny * LY + nz * LZ));
            shade = diff * (1 + dl);
            if (shade < 0.05) shade = 0.05; else if (shade > 1.8) shade = 1.8;
          }
        }

        let r = texPix[pi] * shade + spec;
        let g = texPix[pi + 1] * shade + spec;
        let b = texPix[pi + 2] * shade + spec;

        /* 云层：最外层半透明白色，随光照变暗，独立漂移 */
        if (hasCloud) {
          let clon = lonDeg + cloudDrift;
          clon = ((clon + 540) % 360) - 180;
          const cu = (clon + 180) / 360;
          const ctu = ((cu - Math.floor(cu)) * (cW - 1)) | 0;
          let ca = cloudPix[tv * cW + ctu];
          if (ca > 0.03) {
            ca = (ca - 0.03) * 1.05;
            if (ca > 0.92) ca = 0.92;
            const lit = 0.18 + 0.95 * diff;
            const cc0 = 226 * lit, cc1 = 234 * lit, cc2 = 244 * lit;
            r = r * (1 - ca) + cc0 * ca;
            g = g * (1 - ca) + cc1 * ca;
            b = b * (1 - ca) + cc2 * ca;
          }
        }

        data[k] = r > 255 ? 255 : r;
        data[k + 1] = g > 255 ? 255 : g;
        data[k + 2] = b > 255 ? 255 : b;
        data[k + 3] = 255;
      }
      sphereCtx.putImageData(imgd, 0, 0);
    }

    /* file:// fallback：canvas 被污染、getImageData 不可用。
       用「逐扫描带 + drawImage 切片」把等距柱状图正投影到球面正面，
       支持水平自转（rotY），纹理随球一起转，无需读取像素。 */
    function blitEquirect(img, lonDeg, alpha) {
      const iw = img.naturalWidth || 0, ih = img.naturalHeight || 0;
      if (iw < 2 || ih < 2) return;
      const step = Math.max(1, Math.round(R / 110));
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha == null ? prevAlpha : alpha;
      for (let y = Math.ceil(cy - R); y <= Math.floor(cy + R); y += step) {
        const n = (cy - y) / R;                   // 单位球 y 分量（up 为正）
        if (n < -1 || n > 1) continue;
        const lat = Math.asin(n < -1 ? -1 : (n > 1 ? 1 : n));
        const cosLat = Math.cos(lat);
        const hw = R * cosLat;                    // 该纬度处圆的半宽
        if (hw < 0.6) continue;
        const v = (Math.PI / 2 - lat) / Math.PI;  // 0=北极顶, 1=南极底
        const sy = v * (ih - 1);
        /* 屏幕左缘对应经度 = 90° - lonDeg；可见 180° 宽 = 半张图 */
        const leftDeg = 90 - lonDeg;
        let sx = ((leftDeg % 360) + 360) % 360 / 360 * iw;
        const sw = iw / 2;
        const dx = cx - hw, dw = hw * 2, dh = step + 0.6;
        if (sx + sw <= iw) {
          ctx.drawImage(img, sx, sy, sw, 1, dx, y, dw, dh);
        } else {
          /* 跨左右接缝：拆成两段 */
          const a = iw - sx;
          ctx.drawImage(img, sx, sy, a, 1, dx, y, dw * (a / sw), dh);
          ctx.drawImage(img, 0, sy, sw - a, 1, dx + dw * (a / sw), y, dw * ((sw - a) / sw), dh);
        }
      }
      ctx.globalAlpha = prevAlpha;
    }

    function drawSphereFallback() {
      if (!texImg) return false;
      const rotYDeg = rotY * 180 / Math.PI;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
      ctx.clip();
      /* 卫星影像：随球自转 */
      blitEquirect(texImg, rotYDeg, 1);
      /* 云层：叠加在球面之上，带独立漂移 */
      if (cloudImg) blitEquirect(cloudImg, rotYDeg + cloudDrift, 0.45);
      /* 叠加方向光照渐变（左上受光，背光面压暗） */
      const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx + R * 0.5, cy + R * 0.5, R * 1.3);
      shade.addColorStop(0.00, 'rgba(255,245,220,0.35)');
      shade.addColorStop(0.45, 'rgba(180,200,220,0.10)');
      shade.addColorStop(0.75, 'rgba(30,40,55,0.32)');
      shade.addColorStop(1.00, 'rgba(8,10,16,0.75)');
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
      const rotMoved = !Number.isFinite(lastRY) || Math.abs(rotY - lastRY) > eps || Math.abs(rotX - lastRX) > eps;
      const driftMoved = !!cloudPix && (!Number.isFinite(lastDrift) || Math.abs(cloudDrift - lastDrift) > 0.15);
      if (texPix && (rotMoved || driftMoved)) {
        renderSphere();
        lastRY = rotY; lastRX = rotX; lastDrift = cloudDrift;
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
        if (!reduced) cloudDrift += CLOUD_SPEED * dt;
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
    loadAuxImages();
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
