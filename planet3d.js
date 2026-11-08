/* =============================================================================
   盖亚 · 三维全比例尺地表引擎  (planet3d)
   -----------------------------------------------------------------------------
   一台相机、一条连续缩放：
     ① 行星层  球面贴图 + 36 区光点 + 四洲洲界 / 36 区区界（只落在大陆上）
     ② 大区层  贴球面的高清地表补丁（26 个单元网格 + 洲界 / 区界）
     ③ 街道层  单元地面的街道贴图 + 实例化楼房
   全部程序化生成，种子由「区号 / 单元号」决定 —— 同一格永远是同一座城。

   依赖：vendor/three.min.js + data/gaia-tex-data.js + data/gaia-zones.js
   对外接口：window.GaiaPlanet3D.mount(host) / .destroy() / .available()
             window.GaiaPlanet3D._debug.{ snapshot, flyToRegion, flyToCell, flyToSpace }
   ============================================================================= */
(function () {
  'use strict';

  var T = window.THREE;
  if (!T) {
    window.GaiaPlanet3D = {
      available: function () { return false; },
      mount: function () { return false; },
      destroy: function () {},
      _debug: null
    };
    return;
  }

  /* ---------------------------------------------------------------- 常量 */
  var D = Math.PI / 180;
  var R = 100;                 // 行星半径（世界单位）
  var PR = 100.06;             // 地表补丁 / 定标球半径
  var CELL_COLS = 6;           // 26 个单元铺成 6 列 × 5 行（最后一格留空）
  var CELL_ROWS = 5;
  var CELLS = 26;
  var RW = 32;                 // 区补丁经度跨度（度）
  var RH = 26;                 // 区补丁纬度跨度（度）
  var ZLON = 28;               // 区实际管辖经度跨度（补丁内留边）
  var ZLAT = 22.5;             // 区实际管辖纬度跨度

  var D_SPACE = 95;            // 行星层 / 大区层分界（相机到注视点距离）
  var D_CITY = 5.5;            // 大区层 / 街道层分界
  var FOV = 42;

  // 五级管控（世界观：白 / 灰 / 黄 / 红 / 黑）
  var LEVELS = {
    '白': { fill: '#e8e6e0', ink: '#1a1a1a', desc: '核心管控区' },
    '灰': { fill: '#8c8c8c', ink: '#141414', desc: '缓冲区' },
    '黄': { fill: '#c9a227', ink: '#1a1400', desc: '隔离区' },
    '红': { fill: '#a83a2e', ink: '#fff',    desc: '禁区' },
    '黑': { fill: '#2a2a2a', ink: '#bdbdbd', desc: '未定域' }
  };
  var LV_ORDER = ['白', '灰', '黄', '红', '黑'];

  /* ---------------------------------------------------------------- 随机 */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function rngOf(s) { return mulberry32(hashStr(s)); }
  function pick(rnd, arr) { return arr[(rnd() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [ (n >> 16) & 255, (n >> 8) & 255, n & 255 ];
  }
  function rgba(h, a) { var c = hexToRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ---------------------------------------------------------------- 地名 */
  // 36 个区：四洲各 9 个。名称统一为「1区 … 36区」，附正典地名作为副标。
  var REGIONS = [
    // 中州
    { n: '九原', c: '中州', lon: 18, lat: 26, lv: '白' },
    { n: '辉山', c: '中州', lon: 34, lat: 34, lv: '红' },
    { n: '圣湖', c: '中州', lon: 8,  lat: 12, lv: '白' },
    { n: '黑森林', c: '中州', lon: 44, lat: 20, lv: '黄' },
    { n: '灰塔', c: '中州', lon: 26, lat: 4,  lv: '灰' },
    { n: '巴罗萨', c: '中州', lon: 52, lat: 38, lv: '红' },
    { n: '午夜宫', c: '中州', lon: 12, lat: 40, lv: '白' },
    { n: '远星港', c: '中州', lon: 58, lat: 8,  lv: '灰' },
    { n: '东部高地', c: '中州', lon: 40, lat: 46, lv: '黄' }
  ];
  var REGION_TAIL = [
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
  ];
  REGIONS = REGIONS.concat(REGION_TAIL);
  REGIONS.forEach(function (r, i) {
    r.idx = i;
    r.id = 'R' + String(i + 1).padStart(2, '0');
    r.zi = i + 1;
    r.zone = String(i + 1) + '区';
  });

  // 用 data/gaia-zones.js 的陆地重心覆盖经纬（保证 36 个光点全落在大陆上）
  function applyZoneData() {
    var Z = window.GAIA_ZONES;
    if (!Z || !Z.zones || !Z.zones.length) return false;
    for (var i = 0; i < REGIONS.length; i++) {
      var z = Z.zones[i];
      if (!z) break;
      var r = REGIONS[i];
      r.lon = z.lon;
      r.lat = z.lat;
      r.zi = z.i;
      r.zone = z.n || (String(z.i) + '区');
    }
    window.__GAIA_ZONE_LINES = Z.lines || [];
    window.__GAIA_CONT_RINGS = Z.conts || [];
    return true;
  }
  applyZoneData();

  // 区管辖范围的经度跨度：按 1/cos(lat) 放大，让一个区在球面上是~方形。
  // 若固定 28° 经度，12区（72°N）实际只有 8.5° 弧长的窄竖条 —— 26 个单元、
  // 街区贴片全被横向压扁，屏幕上就是用户说的"比例坏"。
  var ZLON_CAP = 92;
  function zlonOf(ri) {
    var c = Math.max(0.30, Math.cos(REGIONS[ri].lat * D));
    return clamp(ZLON / c, ZLON, ZLON_CAP);
  }

  // 区补丁的真实覆盖范围：在管辖范围外各留 2° 边（羽化用），纬度恒 26°。
  // 物理宽 = rw·cos(lat) ≈ (zlon+4)·cos(lat) ≈ 28° 弧长，与 26° 纬度基本等宽高。
  function patchSpan(ri) {
    return { rw: Math.min(100, zlonOf(ri) + (RW - ZLON)), rh: RH };
  }

  /* ---------------------------------------------------------------- 坐标 */
  // 经纬 → 球面（与 SphereGeometry 顶点公式一致：x=-r·cosφ·cosθ, z=r·sinφ·cosθ）
  var _v0 = new T.Vector3();
  function latLonPos(latDeg, lonDeg, r) {
    var la = latDeg * D;
    var ph = (lonDeg + 180) * D;
    var cl = Math.cos(la);
    return new T.Vector3(-r * Math.cos(ph) * cl, r * Math.sin(la), r * Math.sin(ph) * cl);
  }
  function dirOf(latDeg, lonDeg) {
    return latLonPos(latDeg, lonDeg, 1);
  }
  // 球面上的「东」与「北」单位向量（局部切平面基底）
  function frameAt(latDeg, lonDeg) {
    var up = dirOf(latDeg, lonDeg);
    var up2 = dirOf(latDeg + 0.01, lonDeg);
    var east = up2.clone().cross(up);
    if (east.lengthSq() < 1e-9) east.set(1, 0, 0).cross(up);
    east.normalize();
    var north = up.clone().cross(east).normalize();
    return { up: up, east: east, north: north };
  }

  /* ---------------------------------------------------------------- 单元 */
  var UNIT_A = ['砂', '石', '铁', '灰', '霜', '雾', '盐', '木', '水', '火', '风', '雪', '岩', '苇', '荆'];
  var UNIT_B = ['脊', '原', '坳', '滩', '岭', '洼', '坪', '渡', '垣', '垄', '坂', '渠'];
  var TOWN_A = ['白', '乌', '槐', '青', '红', '石', '沙', '南', '北', '东', '西', '老', '新', '长', '高'];
  var TOWN_B = ['河', '桥', '岭', '屯', '堡', '集', '场', '窑', '岗', '湾', '铺', '寨'];

  function unitMeta(ri, ui) {
    var rnd = rngOf('U' + ri + ':' + ui);
    var name = pick(rnd, UNIT_A) + pick(rnd, UNIT_B);
    var region = REGIONS[ri];
    var li = LV_ORDER.indexOf(region.lv);
    var roll = rnd();
    if (roll > 0.82) li = Math.min(4, li + 1);
    else if (roll < 0.18) li = Math.max(0, li - 1);
    return {
      idx: ui,
      code: 'U' + String(ui + 1).padStart(2, '0'),
      name: name,
      lv: LV_ORDER[li],
      town: pick(rnd, TOWN_A) + pick(rnd, TOWN_B),
      pop: 1200 + ((rnd() * 46000) | 0)
    };
  }
  var unitCache = new Map();
  function getUnits(ri) {
    if (unitCache.has(ri)) return unitCache.get(ri);
    var arr = [];
    for (var i = 0; i < CELLS; i++) arr.push(unitMeta(ri, i));
    unitCache.set(ri, arr);
    return arr;
  }

  // 单元在补丁内的经纬矩形（经度跨度随纬度自适应，保证单元物理上是方格子）
  function cellRect(ri, ui) {
    var r = REGIONS[ri];
    var zl = zlonOf(ri);
    var col = ui % CELL_COLS, row = Math.floor(ui / CELL_COLS);
    var w = zl / CELL_COLS, h = ZLAT / CELL_ROWS;
    var lon0 = r.lon - zl / 2 + col * w, lon1 = lon0 + w;
    var latTop = r.lat + ZLAT / 2 - row * h, latBot = latTop - h;
    return { lon0: lon0, lon1: lon1, lat0: latBot, lat1: latTop };
  }
  function cellCenter(ri, ui) {
    var q = cellRect(ri, ui);
    return { lon: (q.lon0 + q.lon1) / 2, lat: (q.lat0 + q.lat1) / 2 };
  }
  // 单元贴片 / 楼房的世界尺寸（米制换算用，避免极区拉长）
  function cellSize(ri, ui) {
    var c = cellCenter(ri, ui);
    var w = R * Math.cos(c.lat * D) * (zlonOf(ri) / CELL_COLS) * D;
    var h = R * (ZLAT / CELL_ROWS) * D;
    return { w: Math.max(0.35, w), h: Math.max(0.35, h) };
  }


  /* ---------------------------------------------------------------- 贴图采样 */
  // 只有一张源图：0 级真图 L0-globe-day.jpg（由 loadL0() 灌进来，同时是区/街区层的采样源）。
  var MAP = { canvas: null, gw: 0, gh: 0, data: null, w: 0, h: 0, ready: false, fromAsset: false, srcW: 0 };


  // 把一张等距圆柱源图吃进 MAP：抹经纬网 → 气候调色 → 重算海洋遮罩（可选重烘全球底图）。
  // 内置占位图先吃一次；L0 真图（2048×1024）到位后再吃一次 —— 采样源分辨率翻倍，
  // 区层 32°×26° 底图从 91×74 像素变 182×148，放大后的拖痕随之减半。
  function ingestMap(img, opt) {
    opt = opt || {};
    var srcW = img.naturalWidth || img.width || 1024;
    var srcH = img.naturalHeight || img.height || 512;
    var c = document.createElement('canvas');
    c.width = srcW; c.height = srcH;
    var g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height);
    MAP.canvas = c;
    MAP.w = c.width; MAP.h = c.height; MAP.srcW = srcW;
    MAP.fromAsset = opt.fromAsset === true;
    try {
        var id = g.getImageData(0, 0, c.width, c.height);
        var d = id.data;
        var Wm = c.width, Hm = c.height;
        // 源图是占位图：上面烘焙了经纬网亮线。这里先按"整行/整列平均亮度异常"检测出来抹掉，
        // 否则区层放大后这些线会变成横贯整幅的发光带。
        var rowM = new Float32Array(Hm), colM = new Float32Array(Wm);
        var yy, xx, sq, ii, jj;
        for (yy = 0; yy < Hm; yy++) {
          sq = 0;
          for (xx = 0; xx < Wm; xx++) {
            ii = (yy * Wm + xx) * 4;
            sq += d[ii] * 0.299 + d[ii + 1] * 0.587 + d[ii + 2] * 0.114;
          }
          rowM[yy] = sq / Wm;
        }
        for (xx = 0; xx < Wm; xx++) {
          sq = 0;
          for (yy = 0; yy < Hm; yy++) {
            jj = (yy * Wm + xx) * 4;
            sq += d[jj] * 0.299 + d[jj + 1] * 0.587 + d[jj + 2] * 0.114;
          }
          colM[xx] = sq / Hm;
        }
        var hitRows = 0, hitCols = 0;
        if (opt.cleanGrid !== false) {
        for (yy = 2; yy < Hm - 2; yy++) {
          if (rowM[yy] > rowM[yy - 2] + 1.5 && rowM[yy] > rowM[yy + 2] + 1.5) {
            for (xx = 0; xx < Wm; xx++) {
              ii = (yy * Wm + xx) * 4;
              jj = ((yy - 2) * Wm + xx) * 4;
              var qb = ((yy + 2) * Wm + xx) * 4;
              d[ii] = (d[jj] + d[qb]) >> 1;
              d[ii + 1] = (d[jj + 1] + d[qb + 1]) >> 1;
              d[ii + 2] = (d[jj + 2] + d[qb + 2]) >> 1;
            }
            hitRows++;
          }
        }
        for (xx = 2; xx < Wm - 2; xx++) {
          if (colM[xx] > colM[xx - 2] + 1.5 && colM[xx] > colM[xx + 2] + 1.5) {
            for (yy = 0; yy < Hm; yy++) {
              ii = (yy * Wm + xx) * 4;
              jj = (yy * Wm + xx - 2) * 4;
              var qb2 = (yy * Wm + xx + 2) * 4;
              d[ii] = (d[jj] + d[qb2]) >> 1;
              d[ii + 1] = (d[jj + 1] + d[qb2 + 1]) >> 1;
              d[ii + 2] = (d[jj + 2] + d[qb2 + 2]) >> 1;
            }
            hitCols++;
          }
        }
        }
        // 一次性调色：陆地颜色改为「气候带 + 干旱度」调色板（与区层/街区层共用同一套色），
        // 源图只保留"哪里是荒漠、哪里是植被"的信息 —— 避免放大后变成一片黄绿水彩。
        var NG = noiseField('gL', 'gaia-globe', 512, 22, 3);
        var Wm2 = Wm, Hm2 = Hm;
        if (opt.retint !== false) {
        for (var i = 0; i < d.length; i += 4) {
          var r = d[i], gg = d[i + 1], b = d[i + 2];
          if ((b - Math.max(r, gg)) > 12) {
            // 海洋：压暗压深（源图太浅，看起来像塑料）
            d[i] = r * 0.56;
            d[i + 1] = gg * 0.66;
            d[i + 2] = b * 0.86;
          } else {
            var pix = i / 4;
            var px = pix % Wm2, py = (pix / Wm2) | 0;
            var latA = Math.abs(90 - py / Hm2 * 180);
            var nv = noiseSample(NG, 512, px / Wm2 * 512, py / Hm2 * 512);
            var trop = 1 - smooth(8, 24, latA);
            var tempB = smooth(14, 32, latA) * (1 - smooth(44, 58, latA));
            var bore = smooth(38, 54, latA) * (1 - smooth(60, 72, latA));
            var tund = smooth(54, 74, latA);
            var wS = trop + tempB + bore + tund;
            var pr = (58 * trop + 82 * tempB + 72 * bore + 126 * tund) / wS;
            var pg = (92 * trop + 102 * tempB + 88 * bore + 128 * tund) / wS;
            var pb = (48 * trop + 58 * tempB + 66 * bore + 118 * tund) / wS;
            var arid = clamp((r - gg * 0.96) / 34, 0, 1);
            var moist = clamp(0.55 + (nv - 0.5) * 1.05 - arid * 0.90, 0, 1);
            var des = smooth(0.52, 0.92, 1 - moist) * (1 - tund * 0.85);
            pr += (186 - pr) * des; pg += (164 - pg) * des; pb += (122 - pb) * des;
            // 源图亮度当高程：亮处偏岩灰
            var lm2 = (r + gg + b) / 765;
            var rk = clamp((lm2 - 0.52) / 0.40, 0, 1) * (0.22 + 0.30 * des);
            pr += (132 - pr) * rk; pg += (122 - pg) * rk; pb += (110 - pb) * rk;
            // 极地雪盖
            var snw = smooth(62, 74, latA);
            pr += (236 - pr) * snw; pg += (240 - pg) * snw; pb += (246 - pb) * snw;
            d[i] = pr; d[i + 1] = pg; d[i + 2] = pb;
          }
        }
        }
        g.putImageData(id, 0, 0);
        MAP.data = d;
        MAP.gridClean = hitRows + 'x' + hitCols;
        // 海洋遮罩：白=海，黑=陆（海面高光薄壳的 alphaMap；alphaMap 取绿通道）
        try {
          var omc = document.createElement('canvas');
          omc.width = Wm; omc.height = Hm;
          var omg = omc.getContext('2d');
          var oid = omg.createImageData(Wm, Hm), odd = oid.data;
          for (var oi = 0, oj = 0; oi < Wm * Hm; oi++, oj += 4) {
            var orb = d[oj], ogg = d[oj + 1], obb = d[oj + 2];
            var ov = (obb - Math.max(orb, ogg)) > 12 ? 255 : 0;
            odd[oj] = ov; odd[oj + 1] = ov; odd[oj + 2] = ov; odd[oj + 3] = 255;
          }
          omg.putImageData(oid, 0, 0);
          MAP.oceanMask = omc;
        } catch (eO) { MAP.oceanMask = null; }
    } catch (e) { return false; }
    return true;
  }

  // L0 真图到位后换代采样源，并按当前层级重建区/街区贴图（旧缓存全部作废）
  function ingestMapFromAsset(imgEl) {
    var sw = imgEl.naturalWidth || imgEl.width || 0;
    if (!sw || sw < MAP.w) return false;                 // 比现有源还小就别用
    if (!ingestMap(imgEl, { fromAsset: true, cleanGrid: false, retint: false, bakeGlobe: false })) return false;
    if (typeof REGION_TEX_CACHE !== 'undefined') {
      REGION_TEX_CACHE.forEach(function (t) { try { t.dispose(); } catch (e) {} });
      REGION_TEX_CACHE.clear();
    }
    CITY_TEX_CACHE.forEach(function (t) { try { t.dispose(); } catch (e) {} });
    CITY_TEX_CACHE.clear();
    curRegion = -1; curCity = -1;
    if (state.level >= 1) ensureRegion(state.ri);
    if (state.level === 2) ensureCity(state.ri, state.ui);
    return true;
  }
  // 等距圆柱采样：x=(lon+180)/360·W , y=(90-lat)/180·H
  // 双线性（原来最近邻）：区贴图要把源图 32° 宽的 91~182 像素铺满 1024，
  // 最近邻会把海岸线放大成 3~11 像素宽的台阶，看起来就是「锯齿 + 拖痕」。
  function sampleAt(lon, lat, out) {
    out = out || [0, 0, 0];
    if (!MAP.data) { out[0] = 26; out[1] = 34; out[2] = 40; return out; }
    var W = MAP.w, H = MAP.h, dd = MAP.data;
    var fx = (((lon + 180) % 360 + 360) % 360) / 360 * W - 0.5;
    var fy = (90 - lat) / 180 * H - 0.5;
    var x0 = Math.floor(fx), y0 = Math.floor(fy);
    var tx = fx - x0, ty = fy - y0;
    var xa = ((x0 % W) + W) % W, xb = (xa + 1) % W;
    var ya = y0 < 0 ? 0 : (y0 >= H ? H - 1 : y0);
    var yb = y0 + 1 < 0 ? 0 : (y0 + 1 >= H ? H - 1 : y0 + 1);
    var ia = (ya * W + xa) * 4, ib = (ya * W + xb) * 4;
    var ic = (yb * W + xa) * 4, ie = (yb * W + xb) * 4;
    out[0] = (dd[ia] * (1 - tx) + dd[ib] * tx) * (1 - ty) + (dd[ic] * (1 - tx) + dd[ie] * tx) * ty;
    out[1] = (dd[ia + 1] * (1 - tx) + dd[ib + 1] * tx) * (1 - ty) + (dd[ic + 1] * (1 - tx) + dd[ie + 1] * tx) * ty;
    out[2] = (dd[ia + 2] * (1 - tx) + dd[ib + 2] * tx) * (1 - ty) + (dd[ic + 2] * (1 - tx) + dd[ie + 2] * tx) * ty;
    return out;
  }
  function isOceanRGB(rgb) { return (rgb[2] - Math.max(rgb[0], rgb[1])) > 12; }

  /* ---------------------------------------------------------------- 程序化贴图 */
  function makeGlowTex() {
    var s = 128, c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0.00, 'rgba(255,255,255,1)');
    rg.addColorStop(0.18, 'rgba(255,255,255,0.72)');
    rg.addColorStop(0.42, 'rgba(255,255,255,0.20)');
    rg.addColorStop(1.00, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  function makeStarTex() {
    var s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.35, 'rgba(180,210,240,0.55)');
    rg.addColorStop(1, 'rgba(120,160,200,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
    return new T.CanvasTexture(c);
  }
  // 云层：等距圆柱画布，横向可无缝
  function makeCloudTex() {
    var W = 1024, H = 512, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var rnd = rngOf('clouds-gaia');
    g.clearRect(0, 0, W, H);
    for (var k = 0; k < 120; k++) {
      var latBias = rnd();
      var cx = rnd() * W;
      var cy = H * 0.12 + latBias * H * 0.76;
      var rx = 12 + rnd() * 52, ry = 5 + rnd() * 18;
      var a = 0.10 + rnd() * 0.30;
      var wrap = [-W, 0, W];
      for (var wi = 0; wi < 3; wi++) {
        var x = cx + wrap[wi];
        if (x + rx < -20 || x - rx > W + 20) continue;
        for (var q = 0; q < 3; q++) {
          var ox = (rnd() - 0.5) * rx * 1.2, oy = (rnd() - 0.5) * ry * 1.6;
          var rr = Math.max(6, (rx * 0.5) * (0.5 + rnd() * 0.7));
          var rg = g.createRadialGradient(x + ox, cy + oy, 0, x + ox, cy + oy, rr);
          rg.addColorStop(0, 'rgba(236,243,248,' + (a * 0.8).toFixed(3) + ')');
          rg.addColorStop(0.55, 'rgba(226,236,244,' + (a * 0.28).toFixed(3) + ')');
          rg.addColorStop(1, 'rgba(220,232,242,0)');
          g.fillStyle = rg;
          g.beginPath();
          g.ellipse(x + ox, cy + oy, rr, rr * (ry / rx) * 0.7 + rr * 0.25, 0, 0, 6.2832);
          g.fill();
        }
      }
    }
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = T.RepeatWrapping;
    return t;
  }
  // 边缘羽化 alpha 遮罩（配合 alphaMap 使用，绿色通道）
  function makeFadeMask(w, h, bandX, bandY) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    var im = g.getImageData(0, 0, w, h);
    var d = im.data;
    for (var y = 0; y < h; y++) {
      var ay = Math.min(smooth(0, bandY, y), smooth(0, bandY, h - 1 - y));
      for (var x = 0; x < w; x++) {
        var ax = Math.min(smooth(0, bandX, x), smooth(0, bandX, w - 1 - x));
        var v = Math.round(255 * Math.min(ax, ay));
        var i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    var t = new T.CanvasTexture(c);
    return t;
  }

  /* ---------------------------------------------------------------- 矢量叠加 */
  // 把 GAIA_ZONES 的洲界 / 区界画到某张经纬窗口画布上
  function drawBoundaries(g, W, H, rect, opt) {
    opt = opt || {};
    var lonMin = rect.lon0, lonMax = rect.lon1, latMin = rect.lat0, latMax = rect.lat1;
    var toXY = function (lon, lat) {
      return [ (lon - lonMin) / (lonMax - lonMin) * W, (latMax - lat) / (latMax - latMin) * H ];
    };
    var zoneLines = window.__GAIA_ZONE_LINES || [];
    var rings = window.__GAIA_CONT_RINGS || [];
    if (zoneLines.length) {
      g.save();
      g.lineWidth = opt.zoneWidth || 1.6;
      g.strokeStyle = opt.zoneColor || 'rgba(191,178,122,0.30)';
      g.setLineDash(opt.dash || [14, 8]);
      for (var i = 0; i < zoneLines.length; i++) {
        var pts = zoneLines[i].pts;
        g.beginPath();
        for (var j = 0; j < pts.length; j++) {
          var p = toXY(pts[j][0], pts[j][1]);
          if (j === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
        }
        g.stroke();
      }
      g.restore();
    }
    if (rings.length) {
      g.save();
      g.lineWidth = opt.ringWidth || 2.4;
      g.strokeStyle = opt.ringColor || 'rgba(231,197,107,0.46)';
      for (var k = 0; k < rings.length; k++) {
        var ring = rings[k].ring;
        if (!ring || ring.length < 3) continue;
        g.beginPath();
        for (var m = 0; m < ring.length; m++) {
          var q = toXY(ring[m][0], ring[m][1]);
          if (m === 0) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]);
        }
        g.stroke();
      }
      g.restore();
    }
  }

  /* ---------------------------------------------------------------- 程序化噪声 */
  // 可平铺 fBm 值噪声场
  // startCells 决定基础频率：越小 → 地貌越宏观；越大 → 细节越碎
  var NOISE_FIELDS = {};
  function noiseField(key, seed, N, startCells, octaves) {
    if (NOISE_FIELDS[key]) return NOISE_FIELDS[key];
    N = N || 512; startCells = startCells || 4; octaves = octaves || 6;
    var rnd = rngOf(seed || key);
    var lats = [], amps = [], total = 0;
    for (var o = 0; o < octaves; o++) {
      var cs = startCells << o;
      var arr = new Float32Array(cs * cs);
      for (var t0 = 0; t0 < arr.length; t0++) arr[t0] = rnd();
      lats.push(arr); amps.push(1 / Math.pow(1.9, o));
      total += amps[o];
    }
    var out = new Float32Array(N * N);
    var vmin = 1e9, vmax = -1e9;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var v = 0;
        for (var k = 0; k < octaves; k++) {
          var cs2 = startCells << k, L = lats[k];
          var fx = x / N * cs2, fy = y / N * cs2;
          var x0 = fx | 0, y0 = fy | 0;
          var tx = fx - x0, ty = fy - y0;
          tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          var x1 = (x0 + 1) === cs2 ? 0 : x0 + 1;
          var y1 = (y0 + 1) === cs2 ? 0 : y0 + 1;
          var v00 = L[y0 * cs2 + x0], v10 = L[y0 * cs2 + x1];
          var v01 = L[y1 * cs2 + x0], v11 = L[y1 * cs2 + x1];
          v += (((v00 * (1 - tx) + v10 * tx) * (1 - ty)) +
                ((v01 * (1 - tx) + v11 * tx) * ty)) * amps[k];
        }
        var val = v / total;
        out[y * N + x] = val;
        if (val < vmin) vmin = val;
        if (val > vmax) vmax = val;
      }
    }
    // 归一化到 0..1，保证对比度
    var sp = vmax - vmin || 1;
    for (var i2 = 0; i2 < out.length; i2++) out[i2] = (out[i2] - vmin) / sp;
    NOISE_FIELDS[key] = out;
    return out;
  }
  // 可平铺双线性取样（N 必须是 2 的幂）
  function noiseSample(NF, N, gx, gy) {
    var m = N - 1;
    var x0 = Math.floor(gx), y0 = Math.floor(gy);
    var tx = gx - x0, ty = gy - y0;
    var xa = x0 & m, xb = (x0 + 1) & m, ya = y0 & m, yb = (y0 + 1) & m;
    var v00 = NF[ya * N + xa], v10 = NF[ya * N + xb];
    var v01 = NF[yb * N + xa], v11 = NF[yb * N + xb];
    return ((v00 * (1 - tx) + v10 * tx) * (1 - ty)) +
           ((v01 * (1 - tx) + v11 * tx) * ty);
  }

  // 可分离盒式模糊（就地处理 Float32 数组），用来压掉源图 JPEG 8×8 块效应
  function boxBlurArr(a, W_, H_, r) {
    var tmp = new Float32Array(W_ * H_);
    var x, y, sum, cnt, row;
    for (y = 0; y < H_; y++) {
      row = y * W_;
      sum = 0; cnt = 0;
      for (x = -r; x <= r; x++) { if (x >= 0 && x < W_) { sum += a[row + x]; cnt++; } }
      for (x = 0; x < W_; x++) {
        tmp[row + x] = sum / (cnt || 1);
        var ad = x + r + 1, rm = x - r;
        if (ad < W_) { sum += a[row + ad]; cnt++; }
        if (rm >= 0) { sum -= a[row + rm]; cnt--; }
      }
    }
    for (x = 0; x < W_; x++) {
      sum = 0; cnt = 0;
      for (y = -r; y <= r; y++) { if (y >= 0 && y < H_) { sum += tmp[y * W_ + x]; cnt++; } }
      for (y = 0; y < H_; y++) {
        a[y * W_ + x] = sum / (cnt || 1);
        var ad2 = y + r + 1, rm2 = y - r;
        if (ad2 < H_) { sum += tmp[ad2 * W_ + x]; cnt++; }
        if (rm2 >= 0) { sum -= tmp[rm2 * W_ + x]; cnt--; }
      }
    }
  }

  /* ---------------------------------------------------------------- 地形烘焙 */
  // 源图（1536×768）只够全球尺度；一旦放大就必然模糊。
  // 所以这里做三件事：① 保留源图的自然色（不再洗成灰蓝档案色）
  //              ② 用 fBm 高程场补出源图没有的细节
  //              ③ 用高程场做西北向山体阴影，得到真实起伏感
  function bakeTerrain(rect, W, H, S, opt) {
    opt = opt || {};
    var seed = opt.seedKey || 'terrain';
    var rf = opt.relief === undefined ? 1.0 : opt.relief;
    // 独立归一化的噪声频段（中景丘陵 / 细节粗糙度 / 域扭曲 / 脊状山脉）
    // 细节层用比 512 更高的分辨率（1024 贴图上看不出"放大"，放大后仍有 1-2px 的岩石颗粒）
    var NM = noiseField('bM', 'gaia-mid', 512, 20, 3);
    var NDN = W >= 768 ? 768 : 384;
    var ND = noiseField('bD', 'gaia-detail', NDN, 44, 4);
    var NS = 512;
    var zr = rngOf('N' + seed);
    var o1x = zr() * NS, o1y = zr() * NS;
    var o2x = zr() * NS, o2y = zr() * NS;
    var o3x = zr() * NDN, o3y = zr() * NDN;
    var sat = opt.sat === undefined ? 0.94 : opt.sat;

    // ---- ① 源图抽样（S×S）：自然色 + 信息通道（R=亮度 G=陆地占比）
    var sc = document.createElement('canvas'); sc.width = S; sc.height = S;
    var sctx = sc.getContext('2d');
    var colIm = sctx.createImageData(S, S), infIm = sctx.createImageData(S, S);
    var a0 = colIm.data, b0 = infIm.data;
    var rgb = [0, 0, 0];
    for (var sy = 0; sy < S; sy++) {
      var latS = rect.lat1 - (sy + 0.5) / S * (rect.lat1 - rect.lat0);
      for (var sx = 0; sx < S; sx++) {
        var lonS = rect.lon0 + (sx + 0.5) / S * (rect.lon1 - rect.lon0);
        sampleAt(lonS, latS, rgb);
        var q0 = (sy * S + sx) * 4;
        a0[q0] = rgb[0]; a0[q0 + 1] = rgb[1]; a0[q0 + 2] = rgb[2]; a0[q0 + 3] = 255;
        b0[q0] = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
        b0[q0 + 1] = isOceanRGB(rgb) ? 0 : 255;
        b0[q0 + 3] = 255;
      }
    }
    sctx.putImageData(colIm, 0, 0);
    var sInf = document.createElement('canvas'); sInf.width = S; sInf.height = S;
    sInf.getContext('2d').putImageData(infIm, 0, 0);

    // ---- ② 双线性放大到 W×H
    var big = document.createElement('canvas'); big.width = W; big.height = H;
    var bcg = big.getContext('2d', { willReadFrequently: true });
    bcg.imageSmoothingEnabled = true;
    // 放大时叠一层轻微模糊：抹掉源图 JPEG 的 8×8 块边界与海岸锯齿（细节由 fBm 补）
    bcg.filter = 'blur(' + (opt.blur === undefined ? 4 : opt.blur) + 'px)';
    bcg.drawImage(sc, 0, 0, W, H);
    bcg.filter = 'none';
    var bi = document.createElement('canvas'); bi.width = W; bi.height = H;
    var bic = bi.getContext('2d', { willReadFrequently: true });
    bic.imageSmoothingEnabled = true;
    bic.drawImage(sInf, 0, 0, W, H);
    var col = bcg.getImageData(0, 0, W, H);
    var inf = bic.getImageData(0, 0, W, H);
    var cd = col.data, fd = inf.data;

    // 干旱度线索做降采样：源图是 AI 重绘的，色块边界很硬，逐像素取会渗出"贴纸一样的绿斑"。
    // 先按 48×48 采一次、再逐像素双线性插值 —— 只保留"哪一片偏干"的宏观信息。
    var AC = 48, aridG = new Float32Array(AC * AC), aTmp = [0, 0, 0];
    for (var ay = 0; ay < AC; ay++) {
      for (var ax = 0; ax < AC; ax++) {
        var aLat = rect.lat1 - (ay + 0.5) / AC * (rect.lat1 - rect.lat0);
        var aLon = rect.lon0 + (ax + 0.5) / AC * (rect.lon1 - rect.lon0);
        sampleAt(aLon, aLat, aTmp);
        aridG[ay * AC + ax] = clamp((aTmp[0] - aTmp[1] * 0.96) / 34, 0, 1);
      }
    }
    function aridAt(u, v) {
      var fx = u * AC - 0.5, fy = v * AC - 0.5;
      var x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      var xa = x0 < 0 ? 0 : (x0 >= AC ? AC - 1 : x0), xb = xa + 1 >= AC ? AC - 1 : xa + 1;
      var ya = y0 < 0 ? 0 : (y0 >= AC ? AC - 1 : y0), yb = ya + 1 >= AC ? AC - 1 : ya + 1;
      return (aridG[ya * AC + xa] * (1 - tx) + aridG[ya * AC + xb] * tx) * (1 - ty) +
             (aridG[yb * AC + xa] * (1 - tx) + aridG[yb * AC + xb] * tx) * ty;
    }

    // ---- ③ 高程场：源图宏观明暗 + 域扭曲 fBm + 脊状噪声（山脉沿构造走向拉长）
    var W2 = W, H2 = H;
    var kx = NS / W2, ky = NS / H2;
    var NW = noiseField('bW', 'gaia-warp', 512, 8, 2);
    var NR = noiseField('bR', 'gaia-ridge', 512, 15, 3);
    var h0 = new Float32Array(W2 * H2);    // 源图宏观亮度（只留大陆尺度的明暗）
    var nmF = new Float32Array(W2 * H2);   // 中景起伏
    var nrF = new Float32Array(W2 * H2);   // 脊状山脉
    var dFt = new Float32Array(W2 * H2);   // 细碎粗糙度
    var mskF = new Float32Array(W2 * H2);  // 源图陆地占比（0/1，后面会模糊成"距离场"）
    var mmF = new Float32Array(W2 * H2);   // 山地遮罩：只有这里才起伏，平原保持平缓
    var lwF = new Float32Array(W2 * H2);   // 分形扰动后的陆地占比（>0.5 是陆地）
    var NLo = noiseField('bL', 'gaia-low', 512, 6, 3);
    var o6x = zr() * NS, o6y = zr() * NS;
    var o4x = zr() * NS, o4y = zr() * NS, o5x = zr() * NS, o5y = zr() * NS;
    for (var y = 0; y < H2; y++) {
      for (var x = 0; x < W2; x++) {
        var k = y * W2 + x;
        h0[k] = fd[k * 4] * 0.00392;
        mskF[k] = fd[k * 4 + 1] * 0.00392;
        dFt[k] = noiseSample(ND, NDN, x * (NDN / W2) + o3x, y * (NDN / H2) + o3y);
        // 域扭曲：同一片地貌沿"南北向构造"拉伸，避免揉皱纸式的均匀碎屑
        var w1 = noiseSample(NW, NS, x * kx * 0.75 + o4x, y * ky * 0.75 + o4y);
        var w2 = noiseSample(NW, NS, x * kx * 0.75 + o5x, y * ky * 0.75 + o5y);
        var gxm = x * kx + (w1 - 0.5) * 30;
        var gym = y * ky + (w2 - 0.5) * 30;
        var nmV = noiseSample(NM, NS, gxm + o2x, gym + o2y);
        // 脊状噪声改为各向同性：原来 0.72/1.32 的拉伸在区层放大后就是一排排骨牌式的横向波纹
        var nrV = 1 - Math.abs(noiseSample(NR, NS, gxm * 1.0 + o1x, gym * 1.05 + o1y) * 2 - 1);
        var loV = noiseSample(NLo, NS, x * kx * 0.45 + o6x, y * ky * 0.45 + o6y);
        nmF[k] = nmV; nrF[k] = nrV;
        mmF[k] = smooth(0.34, 0.68, loV);          // 0 = 平原/盆地，1 = 山地
        h0[k] = 0.30 * h0[k] + 0.18 * loV;
      }
    }
    // 陆地遮罩模糊成"到海岸的距离场"：阈值化可复原原海岸线，叠加噪声则长出分形海湾
    boxBlurArr(mskF, W2, H2, 6);
    for (var k4 = 0; k4 < lwF.length; k4++) {
      lwF[k4] = mskF[k4] + (nmF[k4] - 0.5) * 0.52 + (dFt[k4] - 0.5) * 0.34;
    }
    // 源图亮度做一次大半径模糊：只保留宏观地貌明暗，不让 JPEG 块边界变成"发光边"。
    // 真图是 AI 重绘的，笔触有明显的横向涂抹 —— 半径必须远大于笔触宽度，否则这些笔触
    // 会在区层放大后变成一整片横向波纹（就是用户说的"抹开的油画"）。
    boxBlurArr(h0, W2, H2, Math.max(14, Math.round(W2 * 0.028)));
    var eF = new Float32Array(W2 * H2);
    for (var k3 = 0; k3 < eF.length; k3++) {
      var mm3 = mmF[k3];
      eF[k3] = 0.30 * h0[k3] + mm3 * (0.40 * nmF[k3] + 0.36 * nrF[k3]) +
               0.10 * (nmF[k3] - 0.5) + 0.05 * (nrF[k3] - 0.5) +
               0.10 * (dFt[k3] - 0.5) * (0.30 + 0.70 * mm3);
    }

    // ---- ④ 法线光照（光来自西北）+ 按高程上色 + 海岸过渡
    var LX = -0.58, LY = -0.62, LZ = 0.53;
    var ll = Math.sqrt(LX * LX + LY * LY + LZ * LZ);
    LX /= ll; LY /= ll; LZ /= ll;
    for (var y2 = 0; y2 < H2; y2++) {
      var latAt = rect.lat1 - (y2 + 0.5) / H2 * (rect.lat1 - rect.lat0);
      var r0 = y2 * W2;
      for (var x2 = 0; x2 < W2; x2++) {
        var k2 = r0 + x2, q2 = k2 * 4;
        var cov = smooth(0.40, 0.60, lwF[k2]);         // 0 海 → 1 陆（柔边，不再是硬阈值）
        var rough = 0.38 + 0.62 * mmF[k2];              // 平原平滑、山地才有高频起伏
        var xm1 = x2 < 5 ? 0 : x2 - 5, xp1 = x2 + 5 >= W2 ? W2 - 1 : x2 + 5;
        var ym1 = y2 < 5 ? 0 : y2 - 5, yp1 = y2 + 5 >= H2 ? H2 - 1 : y2 + 5;
        var xm2 = x2 < 2 ? 0 : x2 - 2, xp2 = x2 + 2 >= W2 ? W2 - 1 : x2 + 2;
        var ym2 = y2 < 2 ? 0 : y2 - 2, yp2 = y2 + 2 >= H2 ? H2 - 1 : y2 + 2;
        var xm3 = x2 < 1 ? 0 : x2 - 1, xp3 = x2 + 1 >= W2 ? W2 - 1 : x2 + 1;
        var ym3 = y2 < 1 ? 0 : y2 - 1, yp3 = y2 + 1 >= H2 ? H2 - 1 : y2 + 1;
        var gx = (((eF[r0 + xp1] - eF[r0 + xm1]) * 3.0 +
                   (eF[r0 + xp2] - eF[r0 + xm2]) * 3.4) * rough +
                  (dFt[r0 + xp3] - dFt[r0 + xm3]) * 0.26 * rough) * rf;
        var gy = (((eF[yp1 * W2 + x2] - eF[ym1 * W2 + x2]) * 3.0 +
                   (eF[yp2 * W2 + x2] - eF[ym2 * W2 + x2]) * 3.4) * rough +
                  (dFt[yp3 * W2 + x2] - dFt[ym3 * W2 + x2]) * 0.26 * rough) * rf;
        var invN = 1 / Math.sqrt(gx * gx + gy * gy + 1);
        var lam = (-gx * LX - gy * LY + LZ) * invN;
        var shade = clamp(0.52 + lam * 0.62, 0.42, 1.42);

        var R = cd[q2], G = cd[q2 + 1], B = cd[q2 + 2];
        var lumr = 0.299 * R + 0.587 * G + 0.114 * B;
        R = lumr + (R - lumr) * sat; G = lumr + (G - lumr) * sat; B = lumr + (B - lumr) * sat;

        // 海洋：按"离岸距离"做深浅渐变（近岸浅、远海深），源图亮度只做轻微扰动
        var deep = clamp((0.45 - lwF[k2]) * 3.0, 0, 1);
        var lumN = lumr / 255;
        var oR = 44 - 30 * deep + (lumN - 0.3) * 16;
        var oG = 104 - 60 * deep + (lumN - 0.3) * 20;
        var oB = 140 - 58 * deep + (lumN - 0.3) * 18;
        var wave = 0.95 + (dFt[k2] - 0.5) * 0.26 + (nmF[k2] - 0.5) * 0.20;
        oR *= wave; oG *= wave; oB *= wave;
        // 浅滩：贴岸的蓝绿（等效大陆棚，只留窄窄一圈，颜色压低避免"发光边"）
        var shw = (1 - cov) * smooth(0.34, 0.50, lwF[k2]) * 0.20;
        oR += (52 - oR) * shw; oG += (120 - oG) * shw; oB += (138 - oB) * shw;

        // 陆地：气候带 + 干旱度调色板（源图只当"干旱线索"，不再直接放大它的颜色）
        var latAbs = Math.abs(latAt);
        var trop = 1 - smooth(8, 24, latAbs);
        var tempB = smooth(14, 32, latAbs) * (1 - smooth(44, 58, latAbs));
        // 寒带针叶林带延到 64°~78° 才转苔原：原来 54° 就开始发灰，区层放大后
        // 与 L0 真图（那片还是深绿森林）对不上，zoom 时会突然"变灰"
        var bore = smooth(38, 54, latAbs) * (1 - smooth(64, 78, latAbs));
        var tund = smooth(64, 80, latAbs);
        var wSum = trop + tempB + bore + tund;
        var bR = (48 * trop + 92 * tempB + 74 * bore + 126 * tund) / wSum;
        var bG = (98 * trop + 116 * tempB + 94 * bore + 128 * tund) / wSum;
        var bB = (50 * trop + 60 * tempB + 64 * bore + 118 * tund) / wSum;
        // 干旱度：源图偏黄（R > G）→ 荒漠；再叠湿气噪声打破"整片同色"
        var aridSrc = aridAt(x2 / W2, y2 / H2);
        var moist = clamp(0.55 + (nmF[k2] - 0.5) * 0.90 + (dFt[k2] - 0.5) * 0.40 - aridSrc * 0.90, 0, 1);
        var des = smooth(0.52, 0.92, 1 - moist) * (1 - tund * 0.85);
        bR += (186 - bR) * des; bG += (164 - bG) * des; bB += (122 - bB) * des;
        // 高程：高处露岩（灰褐），雪线以上见雪
        var eT = clamp((eF[k2] - 0.42) / 0.38, 0, 1);
        var rk = eT * (0.30 + 0.34 * des);
        var lR = bR + (132 - bR) * rk;
        var lG = bG + (122 - bG) * rk;
        var lB = bB + (110 - bB) * rk;
        var sn = smooth(0.80, 0.97, eF[k2]) * smooth(42, 56, latAbs);
        lR += (236 - lR) * sn; lG += (240 - lG) * sn; lB += (246 - lB) * sn;

        // 植被/土壤斑块：高频色相扰动（湿润区更明显），破掉"喷枪渐变"
        var vegA = dFt[k2] - 0.5, vegB = nmF[k2] - 0.5;
        var amp = 0.55 + 0.45 * moist;
        lR += (vegA * 26 + vegB * -6) * amp;
        lG += (vegA * 20 + vegB * -14) * amp;
        lB += (vegA * 12 + vegB * -4) * amp;

        // 农田拼贴：低地 + 湿润 + 平缓处出现矩形田块（真实的农业镶嵌感）
        var slp = clamp(Math.sqrt(gx * gx + gy * gy) / (0.55 * rf), 0, 1);
        var farm = smooth(0.48, 0.80, moist) * (1 - eT) * (1 - slp) * 0.85;
        if (farm > 0.04) {
          var ca = 0.866, sa = 0.5;                       // 固定 30° 旋转，避免与屏幕/网格对齐
          var ux1 = (x2 * ca - y2 * sa) * 0.045;
          var uy1 = (x2 * sa + y2 * ca) * 0.062;
          var ux2 = (x2 * ca - y2 * sa) * 0.017 + 11.3;
          var uy2 = (x2 * sa + y2 * ca) * 0.021 + 7.7;
          var h1 = ((Math.floor(ux1) * 73856093) ^ (Math.floor(uy1) * 19349663)) >>> 0;
          var h2 = ((Math.floor(ux2) * 83492791) ^ (Math.floor(uy2) * 26699233)) >>> 0;
          var f1 = (h1 % 997) / 997 - 0.5;
          var f2b = (h2 % 991) / 991 - 0.5;
          lR += (f1 * 30 + f2b * 14) * farm;
          lG += (f1 * 26 + f2b * 10) * farm;
          lB += (f1 * 10 + f2b * 6) * farm;
        }

        var f2 = 1 + (shade - 1) * cov;     // 阴影只作用于陆地
        var cR = (oR + (lR - oR) * cov) * f2;
        var cG = (oG + (lG - oG) * cov) * f2;
        var cB = (oB + (lB - oB) * cov) * f2;

        // 沙滩：覆盖过渡带上的暖色细带
        var beach = cov * (1 - cov) * 4 * 0.28;
        cR += (214 - cR) * beach; cG += (198 - cG) * beach; cB += (162 - cB) * beach;

        // 微颗粒：最近距离看也不"平涂"，有胶片颗粒级的质感
        var grain = 1 + (dFt[k2] - 0.5) * 0.06 + (((x2 + y2 * 17) & 7) / 7 - 0.5) * 0.025;
        cR *= grain; cG *= grain; cB *= grain;

        cd[q2] = clamp(cR, 0, 255);
        cd[q2 + 1] = clamp(cG, 0, 255);
        cd[q2 + 2] = clamp(cB, 0, 255);
      }
    }
    bcg.putImageData(col, 0, 0);
    return big;
  }

  /* ---------------------------------------------------------------- 区地表画布 */
  // 1024×1024：真实地形底 + 26 单元网格 + 洲界/区界
  var REGION_TEX_CACHE = new Map();
  function strokeGraticule(g, rect, W, H) {
    g.strokeStyle = 'rgba(150,180,200,0.065)';
    g.lineWidth = 1;
    var stepDeg = 2;
    var lonStart = Math.ceil(rect.lon0 / stepDeg) * stepDeg;
    for (var L = lonStart; L <= rect.lon1; L += stepDeg) {
      var px = (L - rect.lon0) / (rect.lon1 - rect.lon0) * W;
      g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke();
    }
    var latStart = Math.ceil(rect.lat0 / 5) * 5;
    for (var A = latStart; A <= rect.lat1; A += 5) {
      var py = (rect.lat1 - A) / (rect.lat1 - rect.lat0) * H;
      g.beginPath(); g.moveTo(0, py); g.lineTo(W, py); g.stroke();
    }
  }

  function regionCanvas(ri) {
    if (REGION_TEX_CACHE.has(ri)) return REGION_TEX_CACHE.get(ri);
    var r = REGIONS[ri];
    var SP = patchSpan(ri);
    // 贴图宽高比必须等于补丁的「物理」宽高比（rw·cos(lat) : rh），否则像素被横向拉长 1.3~2 倍，
    // 山脊和噪声会在屏幕上变成一片横向波纹（就是 12区 那种"抹开的油画"）。
    var aw = SP.rw * Math.cos(clamp(r.lat, -80, 80) * D);
    var W = 1280, H = Math.max(900, Math.min(1700, Math.round(W * SP.rh / aw)));
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d', { willReadFrequently: true });
    var rect = { lon0: r.lon - SP.rw / 2, lon1: r.lon + SP.rw / 2, lat0: r.lat - SP.rh / 2, lat1: r.lat + SP.rh / 2 };
    // 出图参考用：关掉所有叠加层，只留纯地表（tools/_dump-ref.mjs 会置 true）
    var ov = !window.GAIA_NO_OVERLAY;

    // 1) 地形底：真图源 5.69 px/° → 32° 宽只有 182 像素，所以抽样密度提到 640，
    //    放大时只做 2.4px 轻模糊（原来 384 + 4px 会把海岸/山脊抹成"油画拖痕"）
    g.drawImage(bakeTerrain(rect, W, H, 640, { seedKey: 'R' + ri, relief: 1.0, blur: 2.4 }), 0, 0);

    // 2) 经纬网（极弱，避免"刻度纸"感）
    g.save();
    if (ov) strokeGraticule(g, rect, W, H);
    g.restore();

    // 3) 26 单元网格（只画在补丁中 87.5% 的管辖范围内）
    var zl = zlonOf(ri);
    var mx = (SP.rw - zl) / 2, my = (SP.rh - ZLAT) / 2;   // 边距（度）
    if (ov) {
    g.save();
    g.strokeStyle = 'rgba(176,196,208,0.30)';
    g.lineWidth = 2;
    for (var cx = 0; cx <= CELL_COLS; cx++) {
      var lonx = r.lon - zl / 2 + cx * (zl / CELL_COLS);
      var px2 = (lonx - rect.lon0) / (rect.lon1 - rect.lon0) * W;
      g.beginPath(); g.moveTo(px2, H * (my / SP.rh)); g.lineTo(px2, H * (1 - my / SP.rh)); g.stroke();
    }
    for (var cy = 0; cy <= CELL_ROWS; cy++) {
      var laty = r.lat + ZLAT / 2 - cy * (ZLAT / CELL_ROWS);
      var py2 = (rect.lat1 - laty) / (rect.lat1 - rect.lat0) * H;
      g.beginPath(); g.moveTo(W * (mx / SP.rw), py2); g.lineTo(W * (1 - mx / SP.rw), py2); g.stroke();
    }
    g.restore();
    // 管辖范围外框
    g.save();
    g.strokeStyle = 'rgba(231,197,107,0.34)';
    g.lineWidth = 2;
    g.strokeRect(W * (mx / SP.rw), H * (my / SP.rh), W * (1 - 2 * mx / SP.rw), H * (1 - 2 * my / SP.rh));
    g.restore();
    }

    // 4) 洲界 / 区界
    if (ov) drawBoundaries(g, W, H, rect, {});

    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    REGION_TEX_CACHE.set(ri, tex);
    // 只保留最近 2 张，避免显存膨胀
    if (REGION_TEX_CACHE.size > 2) {
      var firstKey = REGION_TEX_CACHE.keys().next().value;
      if (firstKey !== ri) {
        var old = REGION_TEX_CACHE.get(firstKey);
        REGION_TEX_CACHE.delete(firstKey);
        if (old) old.dispose();
      }
    }
    return tex;
  }

  /* ---------------------------------------------------------------- 城市网格 */
  // 贴图与楼房必须共用同一张"路网"，否则近看会发现楼压在街上或压在马路上。
  // 坐标是 0..1 的归一化单元坐标，中心街区密、向外间距按 1.12 递增（城中心密、郊区疏）。
  var CITY_GRID_CACHE = new Map();
  function axisLines(rnd, n) {
    var half = Math.floor(n / 2);
    var left = [], right = [];
    var d = 0, s = 0.012 + rnd() * 0.004;
    for (var i = 0; i < half; i++) {
      s *= 1.09;                      // 中心街区密、向外呈几何放大（郊区街区明显更大）
      d += s;
      left.push(0.5 - d);
      right.push(0.5 + d);
    }
    var arr = left.reverse().concat(right);
    if (arr.length < 2) return [0, 1];
    var lo = arr[0], hi = arr[arr.length - 1];
    for (var k = 0; k < arr.length; k++) arr[k] = (arr[k] - lo) / (hi - lo);
    return [0].concat(arr, [1]);
  }
  function cityGrid(ri, ui) {
    var key = ri + ':' + ui;
    if (CITY_GRID_CACHE.has(key)) return CITY_GRID_CACHE.get(key);
    var rnd = rngOf('G' + key);
    var rot = (rnd() - 0.5) * 0.24;
    var NV = 20 + ((rnd() * 8) | 0);
    var NH = 20 + ((rnd() * 8) | 0);
    var rg = { rot: rot, vx: axisLines(rnd, NV), hy: axisLines(rnd, NH) };
    CITY_GRID_CACHE.set(key, rg);
    return rg;
  }
  // 城市覆盖区遮罩：中心厚、边缘碎（96×96 上算，放大时自动变成柔边）
  var URBAN_MASK_CACHE = new Map();
  function urbanMask(key) {
    if (URBAN_MASK_CACHE.has(key)) return URBAN_MASK_CACHE.get(key);
    var s = 96, c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d', { willReadFrequently: true });
    var im = g.createImageData(s, s);
    var NF = noiseField('UM', 'gaia-urban', 512, 5, 3);
    var rnd = rngOf('M' + key);
    var ox = rnd() * 512, oy = rnd() * 512;
    for (var y = 0; y < s; y++) {
      for (var x = 0; x < s; x++) {
        var dx = (x / s - 0.5) * 2, dy = (y / s - 0.5) * 2;
        var rad = Math.sqrt(dx * dx + dy * dy);
        var n = noiseSample(NF, 512, x / s * 288 + ox, y / s * 288 + oy);
        var a = clamp(1.55 - rad * 0.55 - (1 - n) * 0.50, 0, 1);
        a = a * a * (3 - 2 * a);
        var q = (y * s + x) * 4;
        im.data[q] = 255; im.data[q + 1] = 255; im.data[q + 2] = 255;
        im.data[q + 3] = a * 255;
      }
    }
    g.putImageData(im, 0, 0);
    URBAN_MASK_CACHE.set(key, c);
    return c;
  }

  /* 楼栋清单：贴图屋顶与 3D 体块共用同一份数据（u/v/w/d 为归一化单元坐标，h 为世界单位高度） */
  var CITY_LOT_CACHE = new Map();
  function cityLots(ri, ui) {
    var key = ri + ':' + ui;
    if (CITY_LOT_CACHE.has(key)) return CITY_LOT_CACHE.get(key);
    var GR = cityGrid(ri, ui);
    var rnd = rngOf('B' + key);
    var cc = cellCenter(ri, ui);
    var sz = cellSize(ri, ui);
    var rot = GR.rot, cr = Math.cos(rot), sr = Math.sin(rot);
    var rgb = [0, 0, 0];
    var out = [];
    for (var bi = 0; bi < GR.vx.length - 1; bi++) {
      for (var bj = 0; bj < GR.hy.length - 1; bj++) {
        var u0 = GR.vx[bi], u1 = GR.vx[bi + 1], v0 = GR.hy[bj], v1 = GR.hy[bj + 1];
        var bw = u1 - u0, bh = v1 - v0;
        if (bw < 0.010 || bh < 0.010) continue;
        // 中心密、边缘疏；中心切成 2×2，外围整块 1 栋
        var cen = Math.hypot(u0 + u1 - 1, v0 + v1 - 1);
        var density = clamp(1.18 - cen * 0.74, 0.32, 1);
        var per = cen < 0.45 ? 3 : (cen < 0.95 ? 2 : 1);
        var iu0 = u0 + bw * 0.16, iu1 = u1 - bw * 0.16;
        var iv0 = v0 + bh * 0.16, iv1 = v1 - bh * 0.16;
        var cw = (iu1 - iu0) / per, ch = (iv1 - iv0) / per;
        for (var sx = 0; sx < per; sx++) {
          for (var sy = 0; sy < per; sy++) {
            if (rnd() > density) continue;
            var gu = iu0 + (sx * 2 + 1) * cw * 0.5;
            var gv = iv0 + (sy * 2 + 1) * ch * 0.5;
            var lw = cw * (0.64 + rnd() * 0.28);
            var lh = ch * (0.64 + rnd() * 0.28);
            var sq = Math.min(lw, lh);
            lw = sq * (0.94 + rnd() * 0.16);
            lh = sq * (0.94 + rnd() * 0.16);
            var wx = (gu - 0.5) * sz.w, wy = (gv - 0.5) * sz.h;
            var lx = wx * cr - wy * sr, ly = wx * sr + wy * cr;
            var lonP = cc.lon + lx / (R * Math.cos(cc.lat * D) * D);
            var latP = cc.lat + ly / (R * D);
            sampleAt(lonP, latP, rgb);
            if (isOceanRGB(rgb)) continue;
            var tall = rnd(), tone = rnd(), warm = rnd() < 0.16, flat = rnd() < 0.12;
            // 高度：以低层为主，核心区零星塔楼；flat 为厂房/仓库
            var hh = 0.008 + tall * tall * 0.026 + clamp(1 - cen * 0.8, 0, 1) * 0.028;
            if (cen < 0.26 && rnd() < 0.07) hh += 0.045;
            if (flat) hh *= 0.30;
            var col;
            if (warm) col = [0.66 + tone * 0.16, 0.55 + tone * 0.16, 0.47 + tone * 0.14];
            else { var vv = 0.52 + tone * 0.32; col = [vv * 1.03, vv, vv * 0.95]; }
            out.push({
              u: gu, v: gv, w: lw, d: lh, h: hh,
              cr: col[0], cg: col[1], cb: col[2]
            });
          }
        }
      }
    }
    CITY_LOT_CACHE.set(key, out);
    if (CITY_LOT_CACHE.size > 4) {
      var fk = CITY_LOT_CACHE.keys().next().value;
      if (fk !== key) CITY_LOT_CACHE.delete(fk);
    }
    return out;
  }

  /* ---------------------------------------------------------------- 街区画布 */
  // 1024×1024：单元地面（真实地形 + 城市覆盖区 + 道路网 + 地块 + 城市核心）
  var CITY_TEX_CACHE = new Map();
  function cityCanvas(ri, ui, res) {
    var W = res || 1024, H = W, k = W / 1024;
    var key = ri + ':' + ui + (k === 1 ? '' : '@' + W);
    if (CITY_TEX_CACHE.has(key)) return CITY_TEX_CACHE.get(key);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d', { willReadFrequently: true });
    var r = REGIONS[ri];
    var q = cellRect(ri, ui);
    var rect = { lon0: q.lon0, lon1: q.lon1, lat0: q.lat0, lat1: q.lat1 };

    // 1) 真实地形（比区贴图更近、细节更强）。地形固定按 1024 烘焙后再放大：
    //    3 级只把路网/屋顶画得更细（矢量），不必为 2048 再跑一遍 400 万像素的高程循环。
    g.drawImage(bakeTerrain(rect, 1024, 1024, 320, { seedKey: 'C' + ri + ':' + ui, relief: 1.35 }), 0, 0, W, H);

    // 2) 城市覆盖区：灰褐色的建成区斑块（中心成片、边缘碎裂），保留底下的地形明暗
    var umc = document.createElement('canvas'); umc.width = W; umc.height = H;
    var ug = umc.getContext('2d', { willReadFrequently: true });
    ug.imageSmoothingEnabled = true;
    ug.fillStyle = '#827d75';
    ug.fillRect(0, 0, W, H);
    ug.globalCompositeOperation = 'destination-in';
    ug.drawImage(urbanMask(key), 0, 0, W, H);
    ug.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.84;
    g.drawImage(umc, 0, 0);
    g.globalAlpha = 1;

    // 3) 路网 + 街区 + 屋顶（与 genBuildings 共用 cityGrid / cityLots，楼一定落在街区里）
    var GR = cityGrid(ri, ui);
    var rnd = rngOf('C' + ri + ':' + ui);   // 与分辨率无关：2/3 级布局完全一致
    var vx = GR.vx, hy = GR.hy;
    var szc = cellSize(ri, ui);
    var pxPerUnit = W / Math.max(0.01, szc.w);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(GR.rot);

    // 3a) 街区底色：城区偏灰、郊区偏绿，少量公园（公园里点树冠）
    for (var bi = 0; bi < vx.length - 1; bi++) {
      for (var bj = 0; bj < hy.length - 1; bj++) {
        var x0 = (vx[bi] - 0.5) * W, x1 = (vx[bi + 1] - 0.5) * W;
        var y0 = (hy[bj] - 0.5) * H, y1 = (hy[bj + 1] - 0.5) * H;
        var ww = x1 - x0, hh = y1 - y0;
        if (ww < 5 || hh < 5) continue;
        var cen = Math.hypot(vx[bi] + vx[bi + 1] - 1, hy[bj] + hy[bj + 1] - 1);
        var urb = clamp(1 - cen * 0.85, 0, 1);
        var roll = rnd();
        if (roll < 0.07) {
          g.fillStyle = 'rgba(64,90,52,' + (0.15 + rnd() * 0.12).toFixed(2) + ')';
          g.fillRect(x0 + k, y0 + k, ww - 2 * k, hh - 2 * k);
          g.fillStyle = 'rgba(36,56,30,0.30)';
          var nt = Math.min(30, ((ww * hh) / (380 * k * k)) | 0);
          for (var t = 0; t < nt; t++) {
            g.beginPath();
            g.arc(x0 + 3 * k + rnd() * (ww - 6 * k), y0 + 3 * k + rnd() * (hh - 6 * k), (1 + rnd() * 1.7) * k, 0, 6.2832);
            g.fill();
          }
        } else {
          // 地块：混凝土 / 沥青 / 裸土混合，越靠中心越灰暗（衬出亮色路网）
          var tone = 0.45 + rnd() * 0.55;
          g.fillStyle = 'rgba(' +
            Math.round(96 + 26 * tone) + ',' +
            Math.round(92 + 24 * tone) + ',' +
            Math.round(86 + 22 * tone) + ',' +
            (0.20 + urb * 0.34 + rnd() * 0.10).toFixed(2) + ')';
          g.fillRect(x0 + k, y0 + k, ww - 2 * k, hh - 2 * k);
        }
        // 地块内的巷子（极淡，避免整体像坐标纸）
        g.strokeStyle = 'rgba(198,194,184,0.05)';
        g.lineWidth = k;
        var na = 1 + ((rnd() * 3) | 0);
        for (var s2 = 1; s2 <= na; s2++) {
          var yy = y0 + hh * s2 / (na + 1);
          g.beginPath(); g.moveTo(x0 + 2 * k, yy); g.lineTo(x1 - 2 * k, yy); g.stroke();
        }
      }
    }

    // 3b) 道路：按街区间距分级 —— 间距大的主干道宽而亮、有暗边；密集处只画细巷道
    var HAL = W * 0.94;
    g.lineCap = 'butt';
    function drawAxis(axis, vertical) {
      for (var i = 0; i < axis.length; i++) {
        var gapA = i > 0 ? axis[i] - axis[i - 1] : 0.12;
        var gapB = i < axis.length - 1 ? axis[i + 1] - axis[i] : 0.12;
        var gap = Math.max(gapA, gapB);
        var major = gap > 0.090, mid = gap > 0.048;
        var core = (major ? 4.6 : (mid ? 2.6 : 1.5)) * k;
        var P = (axis[i] - 0.5) * W;
        // 沥青路面（比街区更暗）—— 卫星图里街道是深色缝
        g.strokeStyle = 'rgba(56,54,50,' + (major ? 0.52 : (mid ? 0.40 : 0.28)) + ')';
        g.lineWidth = core;
        g.beginPath();
        if (vertical) { g.moveTo(P, -HAL); g.lineTo(P, HAL); } else { g.moveTo(-HAL, P); g.lineTo(HAL, P); }
        g.stroke();
        // 主干道再加一条浅色中心线 + 路肩
        if (major) {
          g.strokeStyle = 'rgba(206,202,192,0.30)';
          g.lineWidth = 1.2 * k;
          g.beginPath();
          if (vertical) { g.moveTo(P, -HAL); g.lineTo(P, HAL); } else { g.moveTo(-HAL, P); g.lineTo(HAL, P); }
          g.stroke();
        }
      }
    }
    drawAxis(vx, true);
    drawAxis(hy, false);

    // 3c) 屋顶：与 3D 体块同一份 cityLots，画"东南向墙体 + 屋面 + 受光/背光边"
    var lots = cityLots(ri, ui);
    for (var li = 0; li < lots.length; li++) {
      var L = lots[li];
      var bwPx = Math.max(2 * k, L.w * W), bhPx = Math.max(2 * k, L.d * H);
      var cxPx = (L.u - 0.5) * W, cyPx = (L.v - 0.5) * H;
      var rx0 = cxPx - bwPx / 2, ry0 = cyPx - bhPx / 2;
      var wall = Math.min(bwPx * 0.9, Math.max(0.8 * k, L.h * pxPerUnit * 0.85));
      g.fillStyle = 'rgba(52,48,43,0.62)';
      g.fillRect(rx0 + wall * 0.75, ry0 + wall * 0.95, bwPx, bhPx);
      g.fillStyle = 'rgb(' +
        Math.round(L.cr * 255) + ',' + Math.round(L.cg * 255) + ',' + Math.round(L.cb * 255) + ')';
      g.fillRect(rx0, ry0, bwPx, bhPx);
      // 西北受光边 / 东南背光边
      g.lineWidth = k;
      g.strokeStyle = 'rgba(255,255,250,0.22)';
      g.beginPath();
      g.moveTo(rx0 + 0.5, ry0 + bhPx - 0.5); g.lineTo(rx0 + 0.5, ry0 + 0.5); g.lineTo(rx0 + bwPx - 0.5, ry0 + 0.5);
      g.stroke();
      g.strokeStyle = 'rgba(20,18,16,0.30)';
      g.beginPath();
      g.moveTo(rx0 + bwPx - 0.5, ry0 + 0.5); g.lineTo(rx0 + bwPx - 0.5, ry0 + bhPx - 0.5); g.lineTo(rx0 + 0.5, ry0 + bhPx - 0.5);
      g.stroke();
      // 屋面设备 / 天窗
      if (bwPx > 7 * k) {
        g.fillStyle = 'rgba(40,38,34,0.20)';
        var nw = 1 + ((rnd() * 3) | 0);
        for (var wq = 0; wq < nw; wq++) {
          g.fillRect(rx0 + 2 * k + rnd() * (bwPx - 5 * k), ry0 + 2 * k + rnd() * (bhPx - 5 * k),
            Math.max(1.5 * k, bwPx * 0.16), Math.max(1.5 * k, bhPx * 0.16));
        }
      }
    }
    g.restore();

    // 4) 城市核心：一圈更亮的高密度街区（暖色，像卫星图里的市中心）
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(GR.rot);
    var coreR = W * (0.17 + rnd() * 0.09);
    var rgc = g.createRadialGradient(0, 0, 0, 0, 0, coreR);
    rgc.addColorStop(0.0, 'rgba(206,192,158,0.22)');
    rgc.addColorStop(0.55, 'rgba(160,155,140,0.13)');
    rgc.addColorStop(1.0, 'rgba(120,120,120,0)');
    g.fillStyle = rgc;
    g.beginPath(); g.arc(0, 0, coreR, 0, 6.2832); g.fill();
    g.restore();

    // 4) 单元边界（相邻单元的分界，金线极细）
    g.save();
    g.strokeStyle = 'rgba(231,197,107,0.30)';
    g.lineWidth = 3 * k;
    g.strokeRect(1.5 * k, 1.5 * k, W - 3 * k, H - 3 * k);
    g.restore();

    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    CITY_TEX_CACHE.set(key, tex);
    if (CITY_TEX_CACHE.size > 3) {
      var fk = CITY_TEX_CACHE.keys().next().value;
      if (fk !== key) { var oldc = CITY_TEX_CACHE.get(fk); CITY_TEX_CACHE.delete(fk); if (oldc) oldc.dispose(); }
    }
    return tex;
  }

  /* ---------------------------------------------------------------- 3 级：深放大 */
  // 整个单元用 2048 版本重绘（道路/屋顶按 2× 矢量精度上色），
  // 等效 438 px/°；alt < 3.6 时叠在 2 级地面上交叉淡入，越靠近越不糊。
  function detailCanvas(ri, ui) { return cityCanvas(ri, ui, 2048); }

  function ensureDetail(ri, ui) {
    var key = ri + ':' + ui;
    if (detailGroup && curDetail === key) return detailGroup;
    disposeGroup(detailGroup);
    detailGroup = new T.Group();
    curDetail = key;
    scene.add(detailGroup);

    var q = cellRect(ri, ui);
    var RAD = PR + 0.146;                 // 比街区地面高 0.006：不遮楼、不 z-fight
    var phiStart = (q.lon0 + 180) * D, phiLen = (q.lon1 - q.lon0) * D;
    var thetaStart = (90 - q.lat1) * D, thetaLen = (q.lat1 - q.lat0) * D;
    var geo = new T.SphereGeometry(RAD, 96, 80, phiStart, phiLen, thetaStart, thetaLen);
    var posA = geo.attributes.position, uvs = [];
    for (var i = 0; i < posA.count; i++) {
      var px = posA.getX(i), py = posA.getY(i), pz = posA.getZ(i);
      var lat = Math.asin(clamp(py / RAD, -1, 1)) / D;
      var lonDeg = Math.atan2(pz, -px) / D - 180;
      uvs.push((lonDeg - q.lon0) / (q.lon1 - q.lon0), (lat - q.lat0) / (q.lat1 - q.lat0));
    }
    geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));

    var fade = makeFadeMask(512, 512, 44, 44);
    var mesh = new T.Mesh(geo, new T.MeshBasicMaterial({
      map: detailCanvas(ri, ui), alphaMap: fade, transparent: true, depthWrite: true
    }));
    mesh.renderOrder = 7;
    detailGroup.add(mesh);
    // 有真图就用真图（1024 真影像放大后仍比程序化 2048 更像卫星图）
    applyAsset(cellAssetName(ri, ui), function (t) {
      if (!mesh.material) return;
      mesh.material.map = t;
      mesh.material.needsUpdate = true;
    });
    detailGroup.visible = false;
    return detailGroup;
  }

  // 2 级且高度足够低时才需要 3 级贴图（一次性，不逐象限重建）
  function ensureDetailAtAnchor() {
    if (state.level !== 2 || !anchor || state.alt > 4.2) return;
    if (detailGroup && curDetail === (state.ri + ':' + state.ui)) return;
    ensureDetail(state.ri, state.ui);
  }

  /* ---------------------------------------------------------------- 真图接入 */
  // 只加载 assets/planet/ 里「确实存在」的真图（清单由 tools/gen-assets.mjs
  // 生成到 assets/planet/gaia-planet-images.js）；缺失就继续用程序化占位图，不产生 404。
  var ASSET_TEX = {};
  function assetPad(n) { return String(n).padStart(2, '0'); }
  function hasImg(name) {
    var L = window.GAIA_PLANET_IMAGES;
    return !!(L && L.indexOf && L.indexOf(name) >= 0);
  }
  function applyAsset(name, apply) {
    if (!hasImg(name)) return false;
    if (ASSET_TEX[name]) { apply(ASSET_TEX[name]); return true; }
    if (ASSET_TEX[name] === false) return false;
    ASSET_TEX[name] = false;
    var img = new Image();
    img.onload = function () {
      // file:// 下每张图源算跨源，贴图会被 WebGL 拒绝（texSubImage2D SecurityError）。
      // 先做一次画布读回探测：读不出来就保持程序化占位图，别把报错刷满控制台。
      try {
        var cv = document.createElement('canvas');
        cv.width = cv.height = 1;
        cv.getContext('2d').drawImage(img, 0, 0, 1, 1);
        cv.getContext('2d').getImageData(0, 0, 1, 1);
      } catch (e) { ASSET_TEX[name] = false; return; }
      var tx = new T.Texture(img);
      tx.__shared = true;
      tx.colorSpace = T.SRGBColorSpace;
      tx.anisotropy = 8;
      tx.minFilter = T.LinearFilter;
      tx.generateMipmaps = false;
      tx.needsUpdate = true;
      ASSET_TEX[name] = tx;
      apply(tx);
    };
    // file:// 下本地图片算跨源，WebGL 上传会被拒；优先用 tools/inline-assets.mjs
    // 内联出来的 data URI（同源，双击打开也能出真图）。
    var dataUri = window.GAIA_ASSET_DATA && window.GAIA_ASSET_DATA[name];
    img.src = dataUri || ('assets/planet/' + name);
    return true;
  }
  function cellAssetName(ri, ui) {
    return 'L3-cell-R' + assetPad(ri + 1) + '-U' + assetPad(ui + 1) + '.jpg';
  }

  /* ---------------------------------------------------------------- 球面折线 */
  // Chaikin 角切割：把粗糙的采样折线磨成平滑海岸线
  function smoothPts(pts, iter) {
    var out = pts;
    for (var it = 0; it < (iter || 2); it++) {
      if (out.length < 3) return out;
      var res = [];
      var n = out.length;
      var closed = (out[0][0] === out[n - 1][0] && out[0][1] === out[n - 1][1]);
      var last = closed ? n - 1 : n - 1;
      for (var i = 0; i < last; i++) {
        var a = out[i], b = out[(i + 1) % n];
        res.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        res.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      if (closed) res.push(res[0]);
      out = res;
    }
    return out;
  }

  function pushPoly(arr, pts, radius) {
    pts = smoothPts(pts, 2);
    for (var i = 0; i < pts.length - 1; i++) {
      var a = latLonPos(pts[i][1], pts[i][0], radius).normalize();
      var b = latLonPos(pts[i + 1][1], pts[i + 1][0], radius).normalize();
      var ang = Math.acos(clamp(a.dot(b), -1, 1));
      var steps = Math.max(1, Math.ceil(ang / (1.5 * D)));
      var prev = a;
      for (var k = 1; k <= steps; k++) {
        var v = a.clone().lerp(b, k / steps).normalize().multiplyScalar(radius);
        arr.push(prev.x, prev.y, prev.z, v.x, v.y, v.z);
        prev = v;
      }
    }
  }
  function lineFromPolys(polys, radius, color, opacity, order) {
    var pos = [];
    for (var i = 0; i < polys.length; i++) {
      var pts = polys[i].pts || polys[i];
      if (pts && pts.length > 1) pushPoly(pos, pts, radius);
    }
    if (!pos.length) return null;
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    var mat = new T.LineBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false });
    var obj = new T.LineSegments(geo, mat);
    obj.renderOrder = order || 3;
    return obj;
  }


  /* ---------------------------------------------------------------- 场景 */
  var host = null, renderer = null, scene = null, camera = null, raycaster = null;
  var spaceGroup = null, planetMesh = null, cloudMesh = null, atmMesh = null, starMesh = null;
  var markerMesh = null, markerGlow = null;
  var ambLight = null, dirLight = null;
  var sunDir = null, shadeMesh = null, shadeMat = null, nightLights = null, lightsMat = null, glintMesh = null;
  var regionGroup = null, cityGroup = null, detailGroup = null;
  var curRegion = -1, curCity = -1, curDetail = '';
  var W = 1, H = 1;

  function disposeGroup(g) {
    if (!g) return;
    if (g.parent) g.parent.remove(g);
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        var m = o.material;
        var maps = [m.map, m.alphaMap, m.emissiveMap];
        for (var i = 0; i < maps.length; i++) {
          if (maps[i] && !maps[i].__shared) maps[i].dispose();
        }
        m.dispose();
      }
    });
  }

  // 给整组材质打上基准透明度标记，供层级淡入淡出使用
  function tagFade(g) {
    if (!g) return g;
    g.traverse(function (o) {
      if (!o.material) return;
      if (o.userData.__baseOpacity === undefined) {
        o.userData.__baseOpacity = (o.material.opacity === undefined) ? 1 : o.material.opacity;
      }
      o.material.transparent = true;
    });
    return g;
  }

  function buildSpace() {
    spaceGroup = new T.Group();
    scene.add(spaceGroup);

    // 行星（贴图由 loadL0() 挂上；没有占位图，加载前是纯色球）
    var mat = new T.MeshPhongMaterial({
      map: null,
      color: 0x2b3c46,
      specular: 0x2c4048,
      shininess: 14,
      emissive: 0x0a1014,
      emissiveIntensity: 1
    });
    planetMesh = new T.Mesh(new T.SphereGeometry(R, 128, 64), mat);
    spaceGroup.add(planetMesh);

    // ---------------- 海面高光 ----------------
    buildGlint();

    // ---------------- 晨昏线 ----------------
    // 太阳方向固定在世界空间；用一个"乘法混合"的暗面罩把夜半球压暗，
    // 比改行星材质更安全（不动贴图的色彩空间），而且能随高度整段淡入淡出。
    sunDir = new T.Vector3(300, 170, 360).normalize();
    shadeMat = new T.ShaderMaterial({
      uniforms: {
        uSun: { value: sunDir },
        uNight: { value: 0.14 },
        uEdge: { value: 0.22 }
      },
      vertexShader: [
        'varying vec3 vWP;',
        'void main(){',
        '  vWP = position;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uSun; uniform float uNight; uniform float uEdge;',
        'varying vec3 vWP;',
        'void main(){',
        '  float d = dot(normalize(vWP), uSun);',
        '  float k = smoothstep(-uEdge, uEdge, d);',   // 1 = 昼, 0 = 夜
        '  float s = mix(uNight, 1.0, k);',
        '  gl_FragColor = vec4(s, s, s, 1.0);',
        '}'
      ].join('\n'),
      transparent: true,
      blending: T.MultiplyBlending,
      depthWrite: false
    });
    shadeMesh = new T.Mesh(new T.SphereGeometry(R * 1.004, 96, 48), shadeMat);
    shadeMesh.renderOrder = 1;
    spaceGroup.add(shadeMesh);

    // 夜面灯火延后到贴图就绪后构建（mount 时 MAP.data 还没有）

    // 云层
    var cloudTex = makeCloudTex();
    cloudTex.__shared = true;
    cloudMesh = new T.Mesh(
      new T.SphereGeometry(R * 1.016, 96, 48),
      new T.MeshBasicMaterial({
        map: cloudTex, transparent: true, opacity: 0.42,
        depthWrite: false, blending: T.AdditiveBlending, vertexColors: true
      })
    );
    // 云也要吃晨昏线：按太阳夹角给每个顶点乘一个亮度
    var cpos2 = cloudMesh.geometry.attributes.position;
    var ccols = [];
    for (var ci3 = 0; ci3 < cpos2.count; ci3++) {
      var cvx = cpos2.getX(ci3), cvy = cpos2.getY(ci3), cvz = cpos2.getZ(ci3);
      var cdv = new T.Vector3(cvx, cvy, cvz).normalize().dot(sunDir);
      var ck = 0.06 + 0.94 * clamp(cdv * 2.2 + 0.30, 0, 1);
      ccols.push(ck, ck, ck);
    }
    cloudMesh.geometry.setAttribute('color', new T.Float32BufferAttribute(ccols, 3));
    cloudMesh.renderOrder = 2;
    spaceGroup.add(cloudMesh);

    // 大气（Fresnel）
    var atmMat = new T.ShaderMaterial({
      uniforms: {
        uColor: { value: new T.Color(0x86bcd6) },
        uPower: { value: 2.9 },
        uIntensity: { value: 0.78 }
      },
      vertexShader: [
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
        '  vN = normalize(normalMatrix * normal);',
        '  vV = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uPower; uniform float uIntensity;',
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float f = pow(1.0 - abs(dot(vN, vV)), uPower);',
        '  gl_FragColor = vec4(uColor, f * uIntensity);',
        '}'
      ].join('\n'),
      side: T.BackSide,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    atmMesh = new T.Mesh(new T.SphereGeometry(R * 1.045, 64, 48), atmMat);
    atmMesh.renderOrder = 2;
    spaceGroup.add(atmMesh);

    // 星尘
    var sPos = [], sCol = [];
    var sr = rngOf('stars-gaia');
    for (var si = 0; si < 1400; si++) {
      var u = sr() * 2 - 1, th = sr() * 6.2832;
      var rr = 620 + sr() * 900;
      var sp2 = Math.sqrt(1 - u * u);
      sPos.push(Math.cos(th) * sp2 * rr, u * rr, Math.sin(th) * sp2 * rr);
      var b = 0.55 + sr() * 0.45;
      sCol.push(b * 0.86, b * 0.92, b);
    }
    var sGeo = new T.BufferGeometry();
    sGeo.setAttribute('position', new T.Float32BufferAttribute(sPos, 3));
    sGeo.setAttribute('color', new T.Float32BufferAttribute(sCol, 3));
    var starTex = makeStarTex(); starTex.__shared = true;
    starMesh = new T.Points(sGeo, new T.PointsMaterial({
      size: 9, map: starTex, vertexColors: true, transparent: true,
      opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    }));
    starMesh.renderOrder = 0;
    scene.add(starMesh);

    // 洲界（实线金）与 36 区区界（细虚线感 → 细实线）
    var rings = (window.__GAIA_CONT_RINGS || []).map(function (c) { return { pts: c.ring }; });
    var zlines = (window.__GAIA_ZONE_LINES || []).map(function (l) { return { pts: l.pts }; });
    var zoom = lineFromPolys(zlines, R + 0.32, 0xbfb27a, 0.26, 3);
    if (zoom) spaceGroup.add(zoom);
    var rline = lineFromPolys(rings, R + 0.45, 0xe7c56b, 0.62, 4);
    if (rline) spaceGroup.add(rline);

    // 36 区光点
    var mPos = [], mCol = [];
    for (var mi = 0; mi < REGIONS.length; mi++) {
      var rg2 = REGIONS[mi];
      var p = latLonPos(rg2.lat, rg2.lon, R + 0.55);
      mPos.push(p.x, p.y, p.z);
      var c2 = hexToRgb(LEVELS[rg2.lv].fill);
      mCol.push(c2[0] / 255, c2[1] / 255, c2[2] / 255);
    }
    var mGeo = new T.BufferGeometry();
    mGeo.setAttribute('position', new T.Float32BufferAttribute(mPos, 3));
    mGeo.setAttribute('color', new T.Float32BufferAttribute(mCol, 3));
    var glowTex = makeGlowTex(); glowTex.__shared = true;
    markerGlow = new T.Points(mGeo, new T.PointsMaterial({
      size: 5.6, map: glowTex, vertexColors: true, transparent: true,
      opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    }));
    markerGlow.renderOrder = 6;
    spaceGroup.add(markerGlow);

    // 微小球心（让光点更像实体）
    var inst = new T.InstancedMesh(
      new T.SphereGeometry(1.05, 10, 8),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
      REGIONS.length
    );
    var dummy = new T.Object3D();
    for (var ni = 0; ni < REGIONS.length; ni++) {
      var rg3 = REGIONS[ni];
      var pp = latLonPos(rg3.lat, rg3.lon, R + 0.5);
      dummy.position.copy(pp);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      inst.setMatrixAt(ni, dummy.matrix);
      var cc = hexToRgb(LEVELS[rg3.lv].fill);
      inst.setColorAt(ni, new T.Color(cc[0] / 255, cc[1] / 255, cc[2] / 255));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.renderOrder = 6;
    markerMesh = inst;
    spaceGroup.add(inst);

    // 光照
    var dir = new T.DirectionalLight(0xfff2df, 2.1);
    dir.position.set(300, 170, 360);
    scene.add(dir);
    dirLight = dir;
    var amb = new T.AmbientLight(0x9fb6c4, 0.24);
    scene.add(amb);
    ambLight = amb;
    var rim = new T.DirectionalLight(0x6f9fc4, 0.45);
    rim.position.set(-260, -120, -300);
    scene.add(rim);

    // 贴图若已就绪（先于 buildSpace 加载完成），这里补建夜灯
    buildNightLights();
  }

  /* ---------------------------------------------------------------- 海面高光 */
  // 真图 L0 接入后，用真图重算「白=海」遮罩，否则高光会落到陆地上。
  function rebuildOceanFromImage(img) {
    try {
      var w = 1024, h = 512;
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var g = c.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      var d = g.getImageData(0, 0, w, h).data;
      var mask = document.createElement('canvas');
      mask.width = w; mask.height = h;
      var mg = mask.getContext('2d');
      var mid = mg.createImageData(w, h), md = mid.data;
      for (var i = 0, p = 0; i < d.length; i += 4, p += 4) {
        var r = d[i], gg = d[i + 1], b = d[i + 2];
        var lum = r * 0.3 + gg * 0.59 + b * 0.11;
        // 深蓝为主：蓝明显高过红绿；极夜高纬的暗水也给过
        var isSea = (b > gg + 8 && b > r + 20) || (lum < 70 && b >= r + 5);
        var v = isSea ? 255 : 0;
        md[p] = v; md[p + 1] = v; md[p + 2] = v; md[p + 3] = 255;
      }
      mg.putImageData(mid, 0, 0);
      MAP.oceanMask = mask;
      if (glintMesh) {
        var old = glintMesh.material.alphaMap;
        var t2 = new T.CanvasTexture(mask);
        t2.colorSpace = T.SRGBColorSpace;
        t2.__shared = true;
        glintMesh.material.alphaMap = t2;
        glintMesh.material.needsUpdate = true;
        if (old && !old.__shared) old.dispose();
      }
    } catch (e) { /* 读不到像素就保持原遮罩 */ }
  }

  // 白=海的遮罩做 alphaMap，加法混合：只有太阳照到海上时才有镜面反光，陆地自动透明。
  function buildGlint() {
    if (glintMesh || !MAP.oceanMask || !spaceGroup) return;
    var omTex = new T.CanvasTexture(MAP.oceanMask);
    omTex.colorSpace = T.SRGBColorSpace;
    glintMesh = new T.Mesh(new T.SphereGeometry(R * 1.008, 96, 64), new T.MeshPhongMaterial({
      color: 0x000000,
      specular: 0x8fb6cc,
      shininess: 26,
      alphaMap: omTex,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending
    }));
    glintMesh.renderOrder = 2;
    glintMesh.visible = false;
    spaceGroup.add(glintMesh);
  }

  /* ---------------------------------------------------------------- 夜面灯火 */
  // 在陆地上撒城镇灯点：簇团（城市/沿岸）+ 分散村落，按太阳夹角预先调暗，
  // 只在夜半球出现。贴图就绪后才能建（要查海陆），所以从 buildSpace / onMapReady 两处调用。
  function buildNightLights() {
    if (nightLights || !MAP.data || !spaceGroup) return;
    var sunV = sunDir || new T.Vector3(300, 170, 360).normalize();
    var nPos = [], nCol = [];
    var nrng = rngOf('night-lights');
    var rgb = [0, 0, 0];

    function pushLight(lon, lat, bright, warm) {
      if (lat > 84 || lat < -84) return;
      sampleAt(lon, lat, rgb);
      if (isOceanRGB(rgb)) return;
      var p = latLonPos(lat, lon, 1);
      var k = clamp(-p.dot(sunV) * 1.7, 0, 1);   // 昼面 0，夜面 1
      if (k <= 0.03) return;
      var b = bright * k * 1.5;
      var q = latLonPos(lat, lon, R * 1.006);
      nPos.push(q.x, q.y, q.z);
      if (warm) nCol.push(b, b * 0.83, b * 0.54);
      else nCol.push(b * 0.86, b * 0.92, b);
    }

    // ① 城市簇心：偏向温带人口带
    var centers = [], tries = 0;
    while (centers.length < 720 && tries < 120000) {
      tries++;
      var lat = (nrng() * 2 - 1);
      lat = (lat < 0 ? -1 : 1) * Math.pow(Math.abs(lat), 0.82) * 76;
      var lon = -180 + nrng() * 360;
      var w = 0.30 + 0.70 * Math.exp(-Math.pow((Math.abs(lat) - 40) / 26, 2));
      if (nrng() > w) continue;
      sampleAt(lon, lat, rgb);
      if (isOceanRGB(rgb)) continue;
      centers.push([lon, lat]);
    }
    for (var ci = 0; ci < centers.length; ci++) {
      var cl = centers[ci];
      var n = 6 + ((nrng() * 18) | 0);
      var rad = 0.35 + nrng() * 1.6;
      var core = 0.55 + nrng() * 0.45;
      for (var j = 0; j < n; j++) {
        var ang = nrng() * 6.2832, rr = Math.pow(nrng(), 0.65) * rad;
        pushLight(cl[0] + Math.cos(ang) * rr, cl[1] + Math.sin(ang) * rr * 0.75,
                  core * (0.35 + nrng() * 0.65), true);
      }
      pushLight(cl[0], cl[1], core * 1.35, true);
    }
    // ② 分散村落（稀疏、偏暗）
    var scat = 0;
    tries = 0;
    while (scat < 5200 && tries < 220000) {
      tries++;
      var la3 = (nrng() * 2 - 1) * 74;
      var lo3 = -180 + nrng() * 360;
      var w3 = 0.30 + 0.70 * Math.exp(-Math.pow((Math.abs(la3) - 40) / 30, 2));
      if (nrng() > w3) continue;
      pushLight(lo3, la3, 0.20 + nrng() * 0.38, nrng() > 0.78);
      scat++;
    }

    if (nPos.length < 300) return;
    var ng = new T.BufferGeometry();
    ng.setAttribute('position', new T.Float32BufferAttribute(nPos, 3));
    ng.setAttribute('color', new T.Float32BufferAttribute(nCol, 3));
    var ntex = makeGlowTex(); ntex.__shared = true;
    lightsMat = new T.PointsMaterial({
      size: 2.6, map: ntex, vertexColors: true, transparent: true,
      opacity: 0.95, depthWrite: false, depthTest: true,
      blending: T.AdditiveBlending, sizeAttenuation: true
    });
    nightLights = new T.Points(ng, lightsMat);
    nightLights.renderOrder = 3;
    spaceGroup.add(nightLights);
  }

  // 区补丁贴球面 —— 与行星球面完全重合，只是分辨率高得多
  function ensureRegion(ri) {
    if (regionGroup && curRegion === ri) return regionGroup;
    disposeGroup(regionGroup);
    regionGroup = new T.Group();
    var myGroup = regionGroup;
    curRegion = ri;
    regionAppear = 0;                 // 新区补丁从 0 淡入：真图解完时不会"啪"地弹出来
    scene.add(regionGroup);

    var r = REGIONS[ri];
    var SP = patchSpan(ri);
    var lonMin = r.lon - SP.rw / 2, lonMax = r.lon + SP.rw / 2;
    var latMin = r.lat - SP.rh / 2, latMax = r.lat + SP.rh / 2;
    var phiStart = (lonMin + 180) * D, phiLen = (lonMax - lonMin) * D;
    var thetaStart = (90 - latMax) * D, thetaLen = (latMax - latMin) * D;

    var segU = 108, segV = 92;
    var geo = new T.SphereGeometry(PR, segU, segV, phiStart, phiLen, thetaStart, thetaLen);
    // 重算 UV：必须映射到"补丁局部矩形"（0..1 铺满这张 1536 贴图），
    // 若直接给全球 UV，贴图只会被采样到 1/11 的窄条 —— 看起来就是一片糊。
    var posA = geo.attributes.position;
    var uvs = [];
    for (var i = 0; i < posA.count; i++) {
      var px = posA.getX(i), py = posA.getY(i), pz = posA.getZ(i);
      var lat = Math.asin(clamp(py / PR, -1, 1)) / D;
      var lonDeg = Math.atan2(pz, -px) / D - 180;   // phi = (lon+180)°，别忘减 180
      while (lonDeg < lonMin) lonDeg += 360;        // 大跨度补丁可能跨 ±180
      while (lonDeg >= lonMin + 360) lonDeg -= 360;
      // 贴图顶行是北（bakeTerrain 从 lat1 往下画），而 three 纹理默认 flipY=true：
      // v=1 对应图片顶行 → 北必须是 v=1。写成 (latMax-lat)/rh 会把每块补丁上下颠倒。
      uvs.push((lonDeg - lonMin) / SP.rw, (lat - latMin) / SP.rh);
    }
    geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));

    // 羽化带按「物理 2.2°」换算到 UV 像素：补丁越宽（高纬），横向羽化像素越少。
    // 否则高纬补丁的 26px 羽化会吃掉 2.4° 的管辖范围，区边缘被糊掉一截。
    var fade = makeFadeMask(512, 512, Math.max(9, Math.round(512 * 2.2 / SP.rw)), Math.round(512 * 2.2 / SP.rh));
    var assetName = 'L2-region-R' + assetPad(ri + 1) + '.jpg';
    var mesh = null;

    function attachRegion(map) {
      // 异步回调可能晚于切区：只往「自己那个组」挂，别挂到别的区身上
      if (!regionGroup || myGroup !== regionGroup) return;
      map.__shared = true;
      map.anisotropy = renderer ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 8;
      map.minFilter = T.LinearFilter; map.generateMipmaps = false;
      mesh = new T.Mesh(geo, new T.MeshBasicMaterial({
        map: map, alphaMap: fade, transparent: true, depthWrite: true, depthTest: true
      }));
      mesh.renderOrder = 5;
      regionGroup.add(mesh);
      tagFade(mesh);
    }

    // 有真图就不烘焙（bakeTerrain 同步要 1.8s，正是缩放卡顿的元凶）：
    // 直接等真图解完再挂网格，这期间露出下面的 0 级真图，视觉上就是一次干净的交叉淡入。
    if (hasImg(assetName)) {
      applyAsset(assetName, attachRegion);
    } else {
      attachRegion(regionCanvas(ri));
    }

    // 26 单元网格（经度跨度随纬度自适应，与 cellRect 完全一致）
    var gridPolys = [];
    var zl = zlonOf(ri);
    var lx0 = r.lon - zl / 2, lx1 = r.lon + zl / 2;
    var ly0 = r.lat - ZLAT / 2, ly1 = r.lat + ZLAT / 2;
    for (var c = 0; c <= CELL_COLS; c++) {
      var lo = lx0 + c * (zl / CELL_COLS);
      gridPolys.push({ pts: [[lo, ly0], [lo, ly1]] });
    }
    for (var rw2 = 0; rw2 <= CELL_ROWS; rw2++) {
      var la = ly0 + rw2 * (ZLAT / CELL_ROWS);
      gridPolys.push({ pts: [[lx0, la], [lx1, la]] });
    }
    var gridObj = lineFromPolys(gridPolys, PR + 0.03, 0xb4c6d2, 0.30, 7);
    if (gridObj) regionGroup.add(gridObj);

    // 洲界 / 区界（近景也可见）
    var zl = (window.__GAIA_ZONE_LINES || []).map(function (l) { return { pts: l.pts }; });
    var zo = lineFromPolys(zl, PR + 0.04, 0xc9ba86, 0.36, 8);
    if (zo) regionGroup.add(zo);
    var rg = (window.__GAIA_CONT_RINGS || []).map(function (c) { return { pts: c.ring }; });
    var ro = lineFromPolys(rg, PR + 0.05, 0xf0d488, 0.72, 9);
    if (ro) regionGroup.add(ro);

    tagFade(regionGroup);
    return regionGroup;
  }

  // 单元街区：地面贴片 + 实例化楼房
  function ensureCity(ri, ui) {
    if (cityGroup && curCity === ui && curRegion === ri) return cityGroup;
    disposeGroup(cityGroup);
    disposeGroup(detailGroup);
    detailGroup = null; curDetail = '';
    cityGroup = new T.Group();
    curCity = ui;
    scene.add(cityGroup);

    var cc = cellCenter(ri, ui);
    var fr = frameAt(cc.lat, cc.lon);
    var size = cellSize(ri, ui);
    // 街区地面必须高出区补丁 0.14：4.667° 的弦在边缘会下垂约 0.08，贴着放会被区球面顶穿
    var LIFT = 0.14;
    var center = fr.up.clone().multiplyScalar(PR + LIFT);
    var basis = new T.Matrix4().makeBasis(fr.east, fr.north, fr.up);
    var quat = new T.Quaternion().setFromRotationMatrix(basis);

    // 用球面片（而不是平面）铺地面，曲率天然吻合；UV 重映射到本单元矩形
    var cQ = cellRect(ri, ui);
    var cPhi = (cQ.lon0 + 180) * D, cPhiLen = (cQ.lon1 - cQ.lon0) * D;
    var cTheta = (90 - cQ.lat1) * D, cThetaLen = (cQ.lat1 - cQ.lat0) * D;
    var fade = makeFadeMask(512, 512, 108, 96);   // 街区补丁边界更柔，避免"方块贴片"感
    var tex = cityCanvas(ri, ui);
    tex.__shared = true;
    tex.anisotropy = 8; tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
    var cgeo = new T.SphereGeometry(PR + LIFT, 44, 38, cPhi, cPhiLen, cTheta, cThetaLen);
    var cpos = cgeo.attributes.position, cuvs = [];
    for (var ci = 0; ci < cpos.count; ci++) {
      var cpz = cpos.getZ(ci), cpx = cpos.getX(ci);
      var clon = Math.atan2(cpz, -cpx) / D - 180;
      var clat = Math.asin(clamp(cpos.getY(ci) / (PR + LIFT), -1, 1)) / D;
      cuvs.push((clon - cQ.lon0) / (cQ.lon1 - cQ.lon0), (clat - cQ.lat0) / (cQ.lat1 - cQ.lat0));
    }
    cgeo.setAttribute('uv', new T.Float32BufferAttribute(cuvs, 2));
    var ground = new T.Mesh(cgeo, new T.MeshBasicMaterial({ map: tex, alphaMap: fade, transparent: true, depthWrite: true }));
    ground.renderOrder = 6;
    ground.userData.__ground = true;
    cityGroup.add(ground);
    var assetName = cellAssetName(ri, ui);
    var hasReal = hasImg(assetName);
    applyAsset(assetName, function (t) {
      if (!ground.material) return;
      ground.material.map = t;
      ground.material.needsUpdate = true;
      ground.userData.__asset = true;
      // 真图到货后再按影像估算楼体（不能另发一次 applyAsset：加载中会被 false 哨兵挡掉）
      if (hasReal && t && t.image) buildInstanced(estimateBuildings(ri, ui, size, t.image));
    });

    // 建筑群：程序化单元用 cityLots；有真图的单元从影像自身估算屋顶位置，
    // 保证楼体落在影像里真实的街区上，而不是压在错误的路网。
    var myCityGroup = cityGroup;
    function buildInstanced(list) {
      if (!list || !list.length || myCityGroup !== cityGroup) return;
      var boxGeo = new T.BoxGeometry(1, 1, 1);
      var bmat = new T.MeshLambertMaterial({ color: 0xffffff });
      var mesh = new T.InstancedMesh(boxGeo, bmat, list.length);
      var dummy = new T.Object3D();
      var cTmp = new T.Color();
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        // 楼基按球面曲率下沉（越靠边下垂越多），否则远处楼会浮在地面上
        var sag = (b.x * b.x + b.y * b.y) / (2 * R);
        dummy.position.copy(center)
          .addScaledVector(fr.east, b.x)
          .addScaledVector(fr.north, b.y)
          .addScaledVector(fr.up, b.h / 2 - sag);
        dummy.quaternion.copy(quat);
        dummy.rotateZ(b.rot);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        cTmp.setRGB(b.cr, b.cg, b.cb);
        mesh.setColorAt(i, cTmp);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.renderOrder = 8;
      myCityGroup.add(mesh);
    }
    if (!hasReal) buildInstanced(genBuildings(ri, ui, size, cc));

    // 街道灯带（沿主干道的暖色点）
    var lp = [], lc = [];
    var rnd = rngOf('L' + ri + ':' + ui);
    for (var k = 0; k < 60; k++) {
      var lx = (rnd() - 0.5) * size.w * 0.92;
      var ly = (rnd() - 0.5) * size.h * 0.92;
      var pt = center.clone().addScaledVector(fr.east, lx).addScaledVector(fr.north, ly).addScaledVector(fr.up, 0.06);
      lp.push(pt.x, pt.y, pt.z);
      var warm = rnd();
      lc.push(1, 0.82 + 0.16 * warm, 0.62 + 0.2 * warm);
    }
    var lgeo = new T.BufferGeometry();
    lgeo.setAttribute('position', new T.Float32BufferAttribute(lp, 3));
    lgeo.setAttribute('color', new T.Float32BufferAttribute(lc, 3));
    var ltex = makeGlowTex(); ltex.__shared = true;
    var lights = new T.Points(lgeo, new T.PointsMaterial({
      size: 0.030, map: ltex, vertexColors: true, transparent: true, opacity: 0.55,
      depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    }));
    lights.renderOrder = 9;
    cityGroup.add(lights);

    tagFade(cityGroup);
    return cityGroup;
  }

  // 楼房生成：种子固定 —— 同一单元永远是同一座城；数据来自 cityLots（贴图屋顶同源）
  function genBuildings(ri, ui, size, cc) {
    var lots = cityLots(ri, ui);
    var GR = cityGrid(ri, ui);
    var rot = GR.rot, cr = Math.cos(rot), sr = Math.sin(rot);
    var out = [];
    for (var i = 0; i < lots.length; i++) {
      var L = lots[i];
      var gx = (L.u - 0.5) * size.w, gy = (L.v - 0.5) * size.h;
      out.push({
        x: gx * cr - gy * sr, y: gx * sr + gy * cr,
        w: L.w * size.w, d: L.d * size.h, h: L.h, rot: rot,
        cr: L.cr, cg: L.cg, cb: L.cb
      });
    }
    return out;
  }

  // 从真影像估算楼体：贴图缩到 256² 采样，按颜色/对比度分出植被、水面、道路、
  // 建成区，只在建成区放盒体。影像顶端 = 北 = v=1（贴图 flipY=true）。
  function estimateBuildings(ri, ui, size, img) {
    var N = 256;
    var cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var g2 = cv.getContext('2d');
    var data;
    try {
      g2.drawImage(img, 0, 0, N, N);
      data = g2.getImageData(0, 0, N, N).data;
    } catch (e) { return null; }        // file:// 跨源读不出就退回无楼
    var rnd = rngOf('E' + ri + ':' + ui);
    var S = 64, step = N / S;          // 64×64：一格约等于影像里一栋屋顶
    var out = [];
    for (var sy = 0; sy < S; sy++) {
      for (var sx = 0; sx < S; sx++) {
        if (sx < 1 || sy < 1 || sx > S - 2 || sy > S - 2) continue;   // 贴片边缘留白
        var bx = Math.floor(sx * step), by = Math.floor(sy * step);
        var half = Math.floor(step / 2);
        var co = (((by + half) * N) + (bx + half)) * 4;
        var rc = data[co], gc = data[co + 1], bc = data[co + 2];
        var r = 0, gg = 0, bb = 0, n = 0, vmin = 255, vmax = 0;
        for (var oy = 0; oy < step; oy += 2) {
          for (var ox = 0; ox < step; ox += 2) {
            var o = (((by + oy) * N) + (bx + ox)) * 4;
            var rr = data[o], gv = data[o + 1], bv = data[o + 2];
            r += rr; gg += gv; bb += bv; n++;
            var l0 = 0.299 * rr + 0.587 * gv + 0.114 * bv;
            if (l0 < vmin) vmin = l0;
            if (l0 > vmax) vmax = l0;
          }
        }
        if (!n) continue;
        r /= n; gg /= n; bb /= n;
        var lum = 0.299 * r + 0.587 * gg + 0.114 * bb;
        var con = vmax - vmin;
        var green = gg - (r + bb) / 2;
        if (green > 10) continue;                    // 植被 / 农田
        if (bb > Math.max(r, gg) + 12) continue;     // 水面
        if (lum > 168 && con < 36) continue;         // 亮而均匀 = 道路 / 空地
        if (con < 14) continue;                      // 太平 = 沥青路 / 水面 / 空旷地
        var p = 0.20 + clamp(con / 70, 0, 1) * 0.44 + clamp((150 - lum) / 70, 0, 1) * 0.16;
        if (rnd() > p) continue;
        var u = (sx + 0.5) / S, v = 1 - (sy + 0.5) / S;
        var fw = (0.20 + rnd() * 0.12) / S, fd = (0.20 + rnd() * 0.12) / S;
        var hh = 0.003 + clamp(con / 110, 0, 1) * 0.006 + rnd() * 0.003;
        out.push({
          x: (u - 0.5) * size.w, y: (v - 0.5) * size.h,
          w: fw * size.w, d: fd * size.h, h: hh,
          rot: (rnd() - 0.5) * 0.18,
          cr: clamp(rc / 255 * 0.78, 0, 1),
          cg: clamp(gc / 255 * 0.76, 0, 1),
          cb: clamp(bc / 255 * 0.74, 0, 1)
        });
      }
    }
    return out;
  }


  /* ---------------------------------------------------------------- 状态 */
  var state = {
    level: 0,          // 0 行星 · 1 大区 · 2 街道
    ri: 0,
    ui: 0,
    yaw: 1.62,          // 默认视角与太阳错开 ~50°，全球视图就能看到晨昏线与夜面灯火
    pitch: 0.30,
    pitchVis: 0.30,     // 实际参与取景的俯仰：切层时平滑过渡，拖拽时立即跟手
    alt: 300,          // 行星层=到球心距离；地表层=到地面距离
    altT: 300,
    altOff: 0,         // 层级切换的视觉补偿：0↔1 级 alt 尺度差 R，用这个衰减量把镜头距离接平
    dragging: false
  };
  var anchor = new T.Vector3(0, 0, 0);
  var anchorT = new T.Vector3(0, 0, 0);
  var pointer = new T.Vector2(0, 0);
  var pointerNdc = new T.Vector2(0, 0);
  var hasPointer = false;

  function surfacePointOf(ri, ui, isCity) {
    if (isCity) {
      var cc = cellCenter(ri, ui);
      return latLonPos(cc.lat, cc.lon, PR);
    }
    var r = REGIONS[ri];
    return latLonPos(r.lat, r.lon, PR);
  }

  function anchorForLevel() {
    if (state.level === 0) return new T.Vector3(0, 0, 0);
    if (state.level === 2) return surfacePointOf(state.ri, state.ui, true);
    return surfacePointOf(state.ri, state.ui, false);
  }
  // 0↔1 切层时锚点必须"一步到位"，不能从原点插值 —— 否则相机先被拉近 100、再滑回，
  // 观感就是俯冲时突然怼近又弹开。锚点落在相机正下方的地表点时，镜头位置/朝向完全连续。
  function snapAnchor() {
    anchorT.copy(anchorForLevel());
    anchor.copy(anchorT);
  }

  /* ---------------------------------------------------------------- HUD */
  var hud = null, labels = null, zoneLbl = [], cellLbl = [], townLbl = null;
  var patchedHudRegions = false;

  function buildHud() {
    hud = document.createElement('div');
    hud.className = 'planet-hud';
    hud.innerHTML = [
      '<div class="ph-top">',
      '  <div class="ph-crumb" id="ph-crumb"></div>',
      '  <div class="ph-actions">',
      '    <button type="button" class="ph-btn" id="ph-out" title="缩小一级">－</button>',
      '    <button type="button" class="ph-btn" id="ph-in" title="放大一级">＋</button>',
      '    <button type="button" class="ph-btn" id="ph-reset" title="回到星球">⟲ 星球</button>',
      '  </div>',
      '</div>',
      '<div class="ph-left" id="ph-regions"></div>',
      '<div class="ph-right" id="ph-info"></div>',
      '<div class="ph-scale" id="ph-scale"></div>',
      '<div class="ph-tip" id="ph-tip">滚轮缩放 · 拖拽旋转 · 点击进入下一级</div>'
    ].join('\n');
    host.appendChild(hud);

    hud.querySelector('#ph-in').addEventListener('click', function () { zoomStep(1.7); });
    hud.querySelector('#ph-out').addEventListener('click', function () { zoomStep(1 / 1.7); });
    hud.querySelector('#ph-reset').addEventListener('click', function () { flyToSpace(); });
    renderRegionList();
  }

  function renderRegionList() {
    var box = hud && hud.querySelector('#ph-regions');
    if (!box) return;
    var html = '<div class="ph-panel-title"><span class="ph-collapse" id="ph-collapse" title="收起 / 展开">▤</span>三十六区<span>REGIONS · 36</span></div><div class="ph-region-grid">';
    for (var i = 0; i < REGIONS.length; i++) {
      var r = REGIONS[i];
      html += '<button type="button" class="ph-region" data-ri="' + i + '" title="' + r.zone + ' · ' + r.n + ' · ' + r.c + ' · ' + LEVELS[r.lv].desc + '">'
        + '<i style="background:' + LEVELS[r.lv].fill + '"></i>'
        + '<em>' + (i + 1) + '</em>'
        + '<span>' + r.zone + '</span>'
        + '</button>';
    }
    html += '</div>';
    box.innerHTML = html;
    var col = box.querySelector('#ph-collapse');
    if (col) col.addEventListener('click', function (ev) {
      ev.stopPropagation();
      box.classList.toggle('collapsed');
    });
    var btns = box.querySelectorAll('.ph-region');
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          flyToRegion(parseInt(btn.dataset.ri, 10));
        });
      })(btns[b]);
    }
  }

  function renderCellGrid() {
    var box = hud && hud.querySelector('#ph-cells');
    if (!box) return;
    var units = getUnits(state.ri);
    var html = '';
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      html += '<button type="button" class="ph-cell" data-ui="' + i + '">'
        + '<i style="background:' + LEVELS[u.lv].fill + '"></i>'
        + '<span>' + u.code + '</span>'
        + '<em>' + u.name + '</em>'
        + '</button>';
    }
    box.innerHTML = html;
    var btns = box.querySelectorAll('.ph-cell');
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          flyToCell(parseInt(btn.dataset.ui, 10));
        });
      })(btns[b]);
    }
  }

  function updateHud() {
    if (!hud) return;
    var crumb = hud.querySelector('#ph-crumb');
    var info = hud.querySelector('#ph-info');
    var r = REGIONS[state.ri];
    var unit = getUnits(state.ri)[state.ui];

    if (state.level === 0) {
      crumb.innerHTML = '<b>盖亚</b><span>GAIA · 四洲 · 三十六区</span>';
      info.innerHTML = [
        '<div class="ph-panel-title">档案<span>OVERVIEW</span></div>',
        '<div class="ph-kv"><span>大陆</span><b>4 洲</b></div>',
        '<div class="ph-kv"><span>行政区</span><b>36 个区</b></div>',
        '<div class="ph-kv"><span>末端单元</span><b>936 个</b></div>',
        '<div class="ph-kv"><span>管控层级</span><b>白 / 灰 / 黄 / 红 / 黑</b></div>',
        '<div class="ph-legend">' + LV_ORDER.map(function (k) {
          return '<span><i style="background:' + LEVELS[k].fill + '"></i>' + k + '</span>';
        }).join('') + '</div>',
        '<div class="ph-hintline">光点即区治；金实线为洲界，细线为区界。<br>点击光点进入该区。</div>'
      ].join('');
    } else if (state.level === 1) {
      crumb.innerHTML = '<a href="javascript:void(0)" data-nav="space">盖亚</a> › <b>' + r.zone + '</b><span>' + r.n + ' · ' + r.c + '</span>';
      info.innerHTML = [
        '<div class="ph-panel-title">' + r.zone + '<span>' + r.n + ' · ' + r.c + ' · ' + r.id + '</span></div>',
        '<div class="ph-kv"><span>管控等级</span><b style="color:' + LEVELS[r.lv].fill + '">' + r.lv + '区 · ' + LEVELS[r.lv].desc + '</b></div>',
        '<div class="ph-kv"><span>下辖单元</span><b>26 个</b></div>',
        '<div class="ph-kv"><span>城镇</span><b>' + getUnits(state.ri).slice(0, 4).map(function (u) { return u.town; }).join('、') + '…</b></div>',
        '<div class="ph-hintline">继续放大 → 单元 → 街道与楼房</div>'
      ].join('');
    } else {
      crumb.innerHTML = '<a href="javascript:void(0)" data-nav="space">盖亚</a> › '
        + '<a href="javascript:void(0)" data-nav="region">' + r.zone + '</a> › <b>' + unit.code + ' ' + unit.name + '单元</b>';
      info.innerHTML = [
        '<div class="ph-panel-title">' + unit.name + '单元<span>' + unit.code + '</span></div>',
        '<div class="ph-kv"><span>所属区</span><b>' + r.zone + '（' + r.c + '）</b></div>',
        '<div class="ph-kv"><span>管控等级</span><b style="color:' + LEVELS[unit.lv].fill + '">' + unit.lv + ' · ' + LEVELS[unit.lv].desc + '</b></div>',
        '<div class="ph-kv"><span>城镇</span><b>' + unit.town + '</b></div>',
        '<div class="ph-kv"><span>登记人口</span><b>' + unit.pop.toLocaleString() + '</b></div>',
        '<div class="ph-hintline">滚轮缩回可退回单元与区</div>'
      ].join('');
    }
    if (crumb) {
      var navs = crumb.querySelectorAll('[data-nav]');
      for (var i = 0; i < navs.length; i++) {
        (function (a) {
          a.addEventListener('click', function () {
            if (a.dataset.nav === 'space') flyToSpace();
            else flyToRegion(state.ri);
          });
        })(navs[i]);
      }
    }

    // 单元面板
    var old = hud.querySelector('#ph-cells-wrap');
    if (old) old.parentNode.removeChild(old);
    if (state.level >= 1) {
      var wrap = document.createElement('div');
      wrap.id = 'ph-cells-wrap';
      wrap.className = 'ph-cell-panel';
      wrap.innerHTML = '<div class="ph-panel-title">' + r.zone + ' · 单元<span>UNITS · 26</span></div><div class="ph-cell-grid" id="ph-cells"></div>';
      info.appendChild(wrap);
      renderCellGrid();
    }
    var cells = hud.querySelectorAll('.ph-cell');
    for (var c = 0; c < cells.length; c++) {
      cells[c].classList.toggle('active', state.level === 2 && parseInt(cells[c].dataset.ui, 10) === state.ui);
    }
    var regs = hud.querySelectorAll('.ph-region');
    for (var d = 0; d < regs.length; d++) {
      regs[d].classList.toggle('active', state.level >= 1 && parseInt(regs[d].dataset.ri, 10) === state.ri);
    }
    updateScaleText();
    updateLabelsStatic();
  }

  var lastScaleTxt = '';
  function updateScaleText() {
    var el = hud && hud.querySelector('#ph-scale');
    if (!el) return;
    var txt;
    if (state.level === 0) txt = 'SCALE · 行星';
    else if (state.level === 2) txt = 'SCALE · 街区';
    else txt = 'SCALE · 单元';
    if (txt !== lastScaleTxt) { el.textContent = txt; lastScaleTxt = txt; }
  }

  /* ---------------------------------------------------------------- 标注层 */
  function buildLabelLayer() {
    labels = document.createElement('div');
    labels.className = 'planet3d-labels';
    host.appendChild(labels);
    zoneLbl = [];
    for (var i = 0; i < REGIONS.length; i++) {
      var el = document.createElement('div');
      el.className = 'p3d-lbl';
      el.innerHTML = '<i style="background:' + LEVELS[REGIONS[i].lv].fill + '"></i>' + REGIONS[i].zone;
      labels.appendChild(el);
      zoneLbl.push(el);
    }
    cellLbl = [];
    for (var u = 0; u < CELLS; u++) {
      var e2 = document.createElement('div');
      e2.className = 'p3d-lbl p3d-lbl-warn';
      labels.appendChild(e2);
      cellLbl.push(e2);
    }
    townLbl = document.createElement('div');
    townLbl.className = 'p3d-lbl p3d-lbl-town';
    labels.appendChild(townLbl);
  }

  var _proj = new T.Vector3();
  function placeLabel(el, worldPos, extra, op) {
    _proj.copy(worldPos).project(camera);
    if (_proj.z > 1 || _proj.z < -1) { el.style.display = 'none'; return false; }
    var x = (_proj.x + 1) / 2 * W;
    var y = (-_proj.y + 1) / 2 * H;
    if (x < -80 || x > W + 80 || y < -40 || y > H + 40) { el.style.display = 'none'; return false; }
    var a = op === undefined ? 1 : op;
    if (a < 0.03) { el.style.display = 'none'; return false; }
    el.style.display = 'block';
    el.style.opacity = a.toFixed(2);
    el.style.left = x.toFixed(1) + 'px';
    el.style.top = y.toFixed(1) + 'px';
    el.style.transform = extra || 'translate(-50%,-50%)';
    return true;
  }
  function facesCamera(worldPos) {
    var n = worldPos.clone().normalize();
    var v = camera.position.clone().sub(worldPos);
    if (v.lengthSq() < 1e-6) return true;
    v.normalize();
    return n.dot(v) > 0.16;
  }

  function updateLabelsStatic() {
    // 单元标签文字随区切换而变
    if (!labels) return;
    var units = getUnits(state.ri);
    for (var i = 0; i < CELLS; i++) {
      cellLbl[i].textContent = units[i].code + ' ' + units[i].name;
    }
    townLbl.textContent = units[state.ui].town;
  }

  var zoneFade = 1;   // 洲/区标签：进区后快速淡出（它们只属于全球视图）
  function updateLabels(spaceOpacity) {
    if (!labels) return;
    var i, p;
    // 区标签在全球视图该显示，一旦下钻进区就该立刻让位 —— 否则会浮在区补丁上，
    // 画面里一堆"X区"标签横穿地表，正是过渡看起来乱的原因之一。
    var zTarget = state.level === 0 ? 1 : 0;
    zoneFade += (zTarget - zoneFade) * 0.10;
    // 标签跟着补丁一起淡出，避免俯冲时"啪"地整片消失
    var zfade = smooth(0.18, 0.55, spaceOpacity) * zoneFade;
    var showZones = zfade > 0.03;
    for (i = 0; i < REGIONS.length; i++) {
      var el = zoneLbl[i];
      if (!showZones) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      var r = REGIONS[i];
      p = latLonPos(r.lat, r.lon, R + 1);
      if (!facesCamera(p)) { el.style.display = 'none'; continue; }
      placeLabel(el, p, null, zfade);
    }
    var showCells = state.level >= 1 && state.alt < 80;
    // 单元标签也用"视觉距离"：切层时 state.alt 会跳 -R，直接用它会整片瞬间弹出
    var avl = Math.max(0.42, state.alt + state.altOff);
    var cfade = smooth(78, 56, avl);
    for (i = 0; i < CELLS; i++) {
      var el2 = cellLbl[i];
      if (!showCells) { if (el2.style.display !== 'none') el2.style.display = 'none'; continue; }
      var q = cellRect(state.ri, i);
      var cpt = latLonPos((q.lat0 + q.lat1) / 2, (q.lon0 + q.lon1) / 2, PR + 0.2);
      if (!facesCamera(cpt)) { el2.style.display = 'none'; continue; }
      placeLabel(el2, cpt, null, cfade);
    }
    if (townLbl) {
      if (state.level !== 2) townLbl.style.display = 'none';
      else {
        var cc = cellCenter(state.ri, state.ui);
        var tp = latLonPos(cc.lat, cc.lon, PR + 0.5);
        placeLabel(townLbl, tp, 'translate(-50%,-160%)');
      }
    }
  }


  /* ---------------------------------------------------------------- 相机 */
  var curSpaceOpacity = 1;
  var poVis = 0;               // 区补丁可见度（带时间低通，避免切层硬切）
  var regionAppear = 1;        // 新补丁自身的淡入进度（真图异步到货时补一次柔和进场）

  function camDir() {
    if (state.level === 0) {
      var p = clamp(state.pitchVis, -1.35, 1.35);
      return new T.Vector3(Math.cos(p) * Math.sin(state.yaw), Math.sin(p), Math.cos(p) * Math.cos(state.yaw)).normalize();
    }
    var n = anchor.clone();
    if (n.lengthSq() < 1e-9) n.copy(surfacePointOf(state.ri, state.ui, state.level === 2));
    n.normalize();
    var t1 = new T.Vector3(0, 1, 0).cross(n);
    if (t1.lengthSq() < 1e-5) t1.set(1, 0, 0);
    t1.normalize();
    var t2 = n.clone().cross(t1).normalize();
    var pit = clamp(state.pitchVis, 0, 1.18);   // 允许 0：切层瞬间正对地表，镜头不横移
    var d = n.clone().multiplyScalar(Math.cos(pit))
      .addScaledVector(t1, Math.sin(pit) * Math.cos(state.yaw))
      .addScaledVector(t2, Math.sin(pit) * Math.sin(state.yaw));
    return d.normalize();
  }

  function updateCamera(dt) {
    anchorT.copy(anchorForLevel());
    var ka = 1 - Math.exp(-4.0 * dt);
    anchor.lerp(anchorT, ka);
    state.alt = state.altT + (state.alt - state.altT) * Math.exp(-4.2 * dt);
    // 俯仰也做平滑：切层改的是 pitch（目标），实际取景用 pitchVis，镜头不会瞬间摆一下
    state.pitchVis += (state.pitch - state.pitchVis) * (1 - Math.exp(-6.0 * dt));
    // 层级切换留下的距离差按指数衰减：镜头平滑滑过去，而不是瞬间跳一下
    state.altOff *= Math.exp(-5.4 * dt);
    state.altOff = clamp(state.altOff, -220, 220);
    if (Math.abs(state.altOff) < 0.02) state.altOff = 0;

    var dir = camDir();
    var av = Math.max(0.42, state.alt + state.altOff);
    if (state.level === 0) {
      camera.position.copy(dir).multiplyScalar(R + av);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.copy(anchor).addScaledVector(dir, av);
      // 相机 up 必须是「当地正北」，不能用径向 —— 用径向等于把整幅贴图按 pitch 滚转，
      // 地表网格会斜成平行四边形（这就是"比例坏"的来源）。
      var nrm = anchor.clone();
      if (nrm.lengthSq() < 1e-9) nrm.set(0, 1, 0);
      nrm.normalize();
      var upNorth = new T.Vector3(0, 1, 0).addScaledVector(nrm, -nrm.y);
      if (upNorth.lengthSq() < 1e-6) upNorth.set(1, 0, 0);   // 极点附近取经线方向
      upNorth.normalize();
      camera.up.copy(upNorth);
      camera.lookAt(anchor);
    }
  }

  /* ---------------------------------------------------------------- 拾取 */
  function toLatLon(v) {
    // 命中点在半径 PR≈100 的球面上，必须先归一化 —— 直接用 y 会被 clamp 成 1，
    // 纬度恒为 ±90°，任何点击都会跳到"离极点最近的区"（点 2区 飞到 12区 的根因）。
    var l = v.length() || 1;
    var x = v.x / l, y = v.y / l, z = v.z / l;
    var lat = Math.asin(clamp(y, -1, 1)) / D;
    var lon = Math.atan2(z, -x) / D - 180;
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return { lat: lat, lon: lon };
  }
  function centerHit() {
    raycaster.setFromCamera(new T.Vector2(0, 0), camera);
    var sph = new T.Sphere(new T.Vector3(0, 0, 0), PR);
    var p = raycaster.ray.intersectSphere(sph, new T.Vector3());
    if (!p) {
      var fallback = state.level === 0
        ? latLonPos(REGIONS[state.ri].lat, REGIONS[state.ri].lon, PR)
        : anchor.clone();
      if (fallback.lengthSq() < 1e-9) fallback.set(0, PR, 0);
      return toLatLon(fallback.clone().normalize());
    }
    return toLatLon(p);
  }
  function nearestRegionAt(ll) {
    var hv = dirOf(ll.lat, ll.lon), best = -1, bd = 1e9;
    for (var i = 0; i < REGIONS.length; i++) {
      var ang = Math.acos(clamp(hv.dot(dirOf(REGIONS[i].lat, REGIONS[i].lon)), -1, 1));
      if (ang < bd) { bd = ang; best = i; }
    }
    return best;
  }
  function cellAt(ri, ll) {
    for (var i = 0; i < CELLS; i++) {
      var q = cellRect(ri, i);
      if (ll.lon >= q.lon0 && ll.lon <= q.lon1 && ll.lat >= q.lat0 && ll.lat <= q.lat1) return i;
    }
    return -1;
  }

  /* ---------------------------------------------------------------- 层级 */
  function nearestCellAt(ri, ll) {
    var hv = dirOf(ll.lat, ll.lon), best = 0, bd = 1e9;
    for (var i = 0; i < CELLS; i++) {
      var c = cellCenter(ri, i);
      var ang = Math.acos(clamp(hv.dot(dirOf(c.lat, c.lon)), -1, 1));
      if (ang < bd) { bd = ang; best = i; }
    }
    return best;
  }
  function levelFor(a) {
    if (state.level === 0) return a > 156 ? 0 : 1;
    // 1↔2 的分界放在 14：街区贴图（1024 铺 4.667°）在此刻刚好盖满屏幕（可见约 3.8°），
    // 若等更低才接管，中间那段区贴图会被放大 8~10 倍（就是"糊"的来源）
    if (state.level === 1) { if (a > 61) return 0; return a <= 14 ? 2 : 1; }
    return a > 16 ? 1 : 2;
  }

  function enterLevel(lv) {
    var prev = state.level;
    if (lv === prev) return;
    var hit = null;
    if (prev === 0 && lv >= 1) hit = centerHit();
    if (prev === 1 && lv === 2) hit = centerHit();
    state.level = lv;

    if (prev === 0 && lv >= 1) {
      var a0 = state.alt;
      state.altT = Math.max(4.4, state.altT - R);
      state.alt = Math.max(4.4, state.alt - R);
      state.altOff += a0 - state.alt;      // 镜头距离不断层，随后自然衰减
      state.pitch = 0.14;
      var b = nearestRegionAt(hit);
      if (b >= 0) state.ri = b;
    }
    if (prev >= 1 && lv === 0) {
      var a1 = state.alt;
      state.altT += R;
      state.alt += R;
      state.altOff += a1 - state.alt;
      state.pitch = Math.max(0.3, state.pitch);
    }
    if (prev === 0 && lv >= 1) {
      // 俯冲进入区层：锚点先落在"屏幕正下方那块地表"，方向保持径向 ——
      // 这样切层那一帧相机位置/朝向完全不变，随后再平滑滑向区中心。
      // 注意必须 copy：anchor.set(vec3) 会把整个 Vector3 塞进 x，坐标变成对象/NaN
      if (hit) anchor.copy(latLonPos(hit.lat, hit.lon, PR));
      else anchor.set(0, 0, 0);
      anchorT.copy(anchor);
      state.pitchVis = 0;
    } else if (lv === 0) {
      // 回到行星层：把全局 yaw/pitch 对齐到当前镜头方向，避免视线甩一下
      var cp = camera.position;
      if (cp.lengthSq() > 0.01) {
        state.yaw = Math.atan2(cp.x, cp.z);
        state.pitchVis = Math.asin(clamp(cp.y / cp.length(), -1, 1));
        state.pitch = Math.max(0.3, state.pitchVis);
      }
      anchor.set(0, 0, 0); anchorT.set(0, 0, 0);
    }
    if (lv >= 1) ensureRegion(state.ri);
    if (lv === 2) {
      if (hit) {
        var c = cellAt(state.ri, hit);
        if (c >= 0) state.ui = c;
      }
      ensureCity(state.ri, state.ui);
    }
    updateHud();
  }

  function applyAlt(next) {
    state.altT = clamp(next, 0.55, 460);
    var lv = levelFor(state.altT);
    if (lv !== state.level) enterLevel(lv);
  }
  function zoomStep(f) { applyAlt(state.altT * f); }

  /* ---------------------------------------------------------------- 导航 */
  function flyToRegion(ri) {
    if (ri < 0 || ri >= REGIONS.length) return;
    state.ri = ri;
    if (state.level === 0) {
      var hit = centerHit();
      var a0 = state.alt;
      state.level = 1;
      state.altT = Math.max(4.4, state.altT - R);
      state.alt = Math.max(40, state.alt - R);
      state.altOff += a0 - state.alt;
      // 同上：先接在当前视线正下方的地表点，再滑向目标区中心
      if (hit) anchor.copy(latLonPos(hit.lat, hit.lon, PR));
      else snapAnchor();
      anchorT.copy(anchor);
      state.pitchVis = 0;
    }
    state.pitch = 0.14;
    ensureRegion(ri);
    state.altT = Math.min(state.altT, 34);
    updateHud();
  }
  function flyToCell(ui) {
    if (ui < 0 || ui >= CELLS) return;
    state.ui = ui;
    if (state.level === 0) flyToRegion(state.ri);
    if (state.level === 1) state.level = 2;
    ensureRegion(state.ri);
    ensureCity(state.ri, ui);
    state.pitch = Math.max(0.18, state.pitch);
    // 进街区层默认站高一点：6 比原来的 4.6 多看到约 30% 的城区范围；
    // 再高（约 >7）单个单元贴图就盖不满屏幕，四角会露出下面更糊的区层贴图
    state.altT = Math.min(state.altT, 6);
    updateHud();
  }
  function flyToSpace() {
    if (state.level !== 0) {
      var a0 = state.alt;
      state.level = 0;
      state.alt = state.alt + R;
      state.altOff += a0 - state.alt;
      state.altT = R + 200;
      state.pitch = 0.42;
      var cp0 = camera.position;
      if (cp0.lengthSq() > 0.01) {
        state.yaw = Math.atan2(cp0.x, cp0.z);
        state.pitchVis = Math.asin(clamp(cp0.y / cp0.length(), -1, 1));
      }
      anchor.set(0, 0, 0); anchorT.set(0, 0, 0);
    } else {
      state.altT = 300;
    }
    updateHud();
  }

  /* ---------------------------------------------------------------- 每帧 */
  var running = false, raf = 0, lastTime = 0;

  function updateVisibility(dt) {
    // av = 相机到地表的"视觉距离"。0↔1 级切换时 alt 会跳 ±R，但 altOff 正好抵消，
    // av 是连续的 —— 所有跨层淡入淡出都必须用它，否则切层那一瞬会"啪"地弹出补丁。
    var av = Math.max(0.42, state.alt + state.altOff);
    // 光点：高空明显，俯冲后淡出（避免近距离光斑膨胀）
    var mo = smooth(52, 92, av);
    // 区补丁：从切层距离(156)开始就缓慢渐显，一路到贴近地表才完全接管。
    // 区间拉宽 + 时间低通，进/出区层都是连续交叉淡入淡出，不会"啪"地换图。
    var po = smooth(150, 62, av);
    var air = smooth(18, 60, av);
    curSpaceOpacity = mo;
    poVis += (po - poVis) * (1 - Math.exp(-5.0 * (dt || 0.016)));
    if (poVis > 0.999) poVis = 1;
    // 太空层用"太阳方向光 + 低环境光"得到晨昏线；下钻后补足环境光避免地表发黑
    if (ambLight) ambLight.intensity = 0.42 + 0.22 * clamp((90 - av) / 58, 0, 1);
    if (dirLight) dirLight.intensity = 3.0 - 1.0 * clamp((90 - av) / 58, 0, 1);
    // 晨昏线只在太空层有效：往下钻时把暗面系数抬到 1.0（等于失效），避免下钻后地表半黑
    if (shadeMat) {
      shadeMat.uniforms.uNight.value = 0.14 + 0.86 * clamp((156 - av) / 96, 0, 1);
    }
    if (shadeMesh) shadeMesh.visible = av > 60;
    if (nightLights && lightsMat) {
      nightLights.visible = av > 70;
      lightsMat.opacity = 0.9 * clamp((av - 70) / 130, 0, 1);
    }
    if (spaceGroup) {
      spaceGroup.visible = true;
      if (planetMesh) { planetMesh.material.transparent = true; planetMesh.material.opacity = 1; planetMesh.material.depthWrite = true; }
      if (cloudMesh) cloudMesh.material.opacity = 0.62 * air;
      if (glintMesh) { glintMesh.visible = av > 70; glintMesh.material.opacity = 0.85 * smooth(70, 110, av); }
      if (atmMesh) atmMesh.material.uniforms.uIntensity.value = 0.78 * air;
      if (markerGlow) {
        // 世界单位尺寸随高度收缩，避免俯冲时光斑膨胀成一大团
        markerGlow.material.size = 2.6 * clamp(av / 260, 0.10, 1);
        markerGlow.material.opacity = 0.95 * mo;
        markerGlow.visible = mo > 0.02;
      }
      if (markerMesh) {
        // 球心光点只在太空层有意义，下钻后必须彻底消失（否则会变成一团白斑）
        var mcore = smooth(110, 210, av);
        markerMesh.material.opacity = 0.9 * mcore;
        markerMesh.material.transparent = true;
        markerMesh.visible = mcore > 0.02;
      }
    }
    if (starMesh) starMesh.material.opacity = 0.85;
    if (regionGroup) {
      // 不要用 state.level 判可见：1→0 切层时 level 立刻变 0，补丁会"啪"地消失、
      // 直接露出发糊的全球底图。改成只跟 poVis 走，让它随 av 连续淡出。
      var useP = poVis > 0.006;
      regionGroup.visible = useP;
      if (useP) {
        regionAppear = Math.min(1, regionAppear + (dt || 0.016) / 0.45);
        var ro2 = poVis * regionAppear;
        regionGroup.traverse(function (o) {
          if (!o.material || !o.userData.__baseOpacity) return;
          o.material.opacity = o.userData.__baseOpacity * ro2;
        });
      }
    }
    var dco = 0;
    if (cityGroup) {
      cityGroup.visible = state.level === 2;
      if (state.level === 2) {
        var co = smooth(16, 10, state.alt);
        dco = smooth(3.6, 2.6, state.alt);   // 3 级深放大：alt<3.6 淡入
        cityGroup.traverse(function (o) {
          if (!o.material || o.userData.__baseOpacity === undefined) return;
          // 深放大补丁接管时，街区地面让位（不必和 3 级贴图重影），楼体保持
          var mul = o.userData.__ground ? (1 - 0.94 * dco) : 1;
          o.material.opacity = o.userData.__baseOpacity * co * mul;
        });
      }
    }
    if (detailGroup) {
      detailGroup.visible = state.level === 2 && dco > 0.01;
      if (detailGroup.visible) {
        detailGroup.traverse(function (o) {
          if (!o.material) return;
          o.material.opacity = dco;
        });
      }
    }
  }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    var dt = lastTime ? Math.min(0.06, (now - lastTime) / 1000) : 0.016;
    lastTime = now;
    updateCamera(dt);
    ensureDetailAtAnchor();
    updateVisibility(dt);
    if (state.level === 0 && !state.dragging && state.alt > 100) state.yaw += dt * 0.022;
    if (cloudMesh && state.level === 0) cloudMesh.rotation.y += dt * 0.013;
    try { renderer.render(scene, camera); } catch (e) { /* 忽略单帧异常 */ }
    updateLabels(curSpaceOpacity);
    updateScaleText();
  }

  /* ---------------------------------------------------------------- 交互 */
  function bindEvents(cv) {
    var downX = 0, downY = 0, moved = 0, lx = 0, ly = 0, down = false, clickTimer = 0;

    function ndc(e) {
      var r = cv.getBoundingClientRect();
      pointerNdc.set(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1));
    }
    function overUi(e) { return e.target && e.target.closest && e.target.closest('.planet-hud'); }

    cv.addEventListener('pointerdown', function (e) {
      if (overUi(e)) return;
      down = true; moved = 0;
      downX = lx = e.clientX; downY = ly = e.clientY;
      state.dragging = true;
      cv.style.cursor = 'grabbing';
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', function (e) {
      ndc(e); pointer.set(e.clientX, e.clientY); hasPointer = true;
      if (!down) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (state.level === 0) {
        state.yaw -= dx * 0.0062;
        state.pitch = clamp(state.pitch + dy * 0.0055, -1.3, 1.3);
      } else {
        state.yaw -= dx * 0.0062;
        state.pitch = clamp(state.pitch + dy * 0.0045, 0.07, 1.15);
      }
      state.pitchVis = state.pitch;   // 拖拽立即跟手，不做平滑
    });
    function endDrag(e) {
      if (!down) return;
      down = false;
      state.dragging = false;
      cv.style.cursor = 'grab';
      var dist = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
      if (dist < 6 && moved < 8) {
        // 单击延后 220ms 执行：若紧接着来的是双击，就取消，避免「点了两下飞两层」
        var cx = e.clientX, cy = e.clientY;
        clickTimer = setTimeout(function () { clickTimer = 0; clickAt({ clientX: cx, clientY: cy }); }, 220);
      }
    }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', function () {
      down = false; state.dragging = false; cv.style.cursor = 'grab';
    });
    cv.addEventListener('wheel', function (e) {
      if (overUi(e)) return;
      e.preventDefault();
      var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // 单次滚轮有可能给出上千像素（触控板甩动/空格+滚轮），夹住避免一跳到底
      d = clamp(d, -400, 400);
      applyAlt(state.altT * Math.exp(d * 0.0012));
    }, { passive: false });
    // 双击地表：全球层 → 飞到最近的区；区层 → 飞进该单元；街区层 → 继续深放大
    cv.addEventListener('dblclick', function (e) {
      if (overUi(e)) return;
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = 0; }   // 双击接管，取消单击那一下
      var r = cv.getBoundingClientRect();
      var nd = new T.Vector2(
        ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1,
        -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1)
      );
      raycaster.setFromCamera(nd, camera);
      var p = raycaster.ray.intersectSphere(new T.Sphere(new T.Vector3(0, 0, 0), PR), new T.Vector3());
      if (!p) return;
      var ll = toLatLon(p);
      if (state.level === 0) {
        var best = nearestRegionAt(ll), bd = 1e9;
        var hv = dirOf(ll.lat, ll.lon);
        for (var i = 0; i < REGIONS.length; i++) {
          var ang = Math.acos(clamp(hv.dot(dirOf(REGIONS[i].lat, REGIONS[i].lon)), -1, 1)) / D;
          if (ang < bd) bd = ang;
        }
        if (best >= 0 && bd < 26) flyToRegion(best);   // 点到大洋里就不乱飞
      } else if (state.level === 1) {
        var c = cellAt(state.ri, ll);
        if (c < 0) c = nearestCellAt(state.ri, ll);   // 视角还在滑动时点偏了，退到最近单元
        flyToCell(c);
      } else {
        applyAlt(state.altT * 0.5);
      }
    });

    window.addEventListener('resize', resize);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { resize(); });
      ro.observe(host);
      host.__p3dRO = ro;
    }
  }

  function clickAt(e) {
    var r = null;
    var cv = renderer && renderer.domElement;
    if (!cv) return;
    r = cv.getBoundingClientRect();
    pointerNdc.set(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1));
    raycaster.setFromCamera(pointerNdc, camera);
    var p = raycaster.ray.intersectSphere(new T.Sphere(new T.Vector3(0, 0, 0), PR), new T.Vector3());
    if (!p) return;
    var ll = toLatLon(p);
    if (state.level === 0) {
      var ri = nearestRegionAt(ll);
      // 离最近的区超过 26° 视为点在空旷海面，不硬飞
      var hv = dirOf(ll.lat, ll.lon), bd = 1e9;
      for (var i = 0; i < REGIONS.length; i++) {
        var ang = Math.acos(clamp(hv.dot(dirOf(REGIONS[i].lat, REGIONS[i].lon)), -1, 1)) / D;
        if (ang < bd) bd = ang;
      }
      if (ri >= 0 && bd < 26) flyToRegion(ri);
    } else if (state.level === 1) {
      var ui = cellAt(state.ri, ll);
      if (ui >= 0) flyToCell(ui);
    }
  }

  function resize() {
    if (!renderer || !host) return;
    var r = host.getBoundingClientRect();
    W = Math.max(320, Math.round(r.width) || 800);
    H = Math.max(320, Math.round(r.height) || 600);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    if (camera) { camera.aspect = W / H; camera.updateProjectionMatrix(); }
  }

  /* ---------------------------------------------------------------- 生命周期 */
  function available() {
    try {
      if (!window.WebGLRenderingContext) return false;
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------------------- 0 级贴图去「画味」 */
  // AI 重绘把中州大陆中部的大沙漠画成一坨软过渡的土黄色块，转到正面时读起来
  // 像一刷抹开的颜料。这里只在陆地上叠一层程序化地形明暗（fBm 体块 + 脊状 +
  // 西北向受光），让它在球面上读成地形，而不是色块。海面保持原样（高光壳负责）。
  var GLOBE_DETAIL = null;
  function detailizeGlobe(img) {
    try {
      var W = 2048, H = 1024;
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      var im = g.getImageData(0, 0, W, H), d = im.data;

      var HW = 1024, HH = 512, N = 512;
      var NB = noiseField('gB', 'gaia-globe-body', N, 6, 4);
      var NR = noiseField('gR', 'gaia-globe-ridge', N, 12, 2);
      var hgt = new Float32Array(HW * HH);
      var hx, hy;
      for (hy = 0; hy < HH; hy++) {
        var gy = (hy + 0.5) / HH * N;
        for (hx = 0; hx < HW; hx++) {
          var gx = (hx + 0.5) / HW * N;
          var nb = noiseSample(NB, N, gx, gy);
          var nr = noiseSample(NR, N, gx * 2 + 0.31, gy * 2 + 0.77);
          var rr = 1 - Math.abs(nr * 2 - 1);
          hgt[hy * HW + hx] = nb * 0.72 + rr * 0.28;
        }
      }
      // 西北向受光：dx 向东增大、dy 向南增大，朝西北的坡（dx>0,dy>0）更亮
      var shd = new Float32Array(HW * HH);
      for (hy = 0; hy < HH; hy++) {
        var yU = ((hy - 1 + HH) % HH) * HW, yD = ((hy + 1) % HH) * HW, yC = hy * HW;
        for (hx = 0; hx < HW; hx++) {
          var xL = (hx - 1 + HW) & (HW - 1), xR = (hx + 1) & (HW - 1);
          var dx = hgt[yC + xR] - hgt[yC + xL];
          var dy = hgt[yD + hx] - hgt[yU + hx];
          shd[yC + hx] = 1 + (dx + dy) * 3.0;
        }
      }
      var px, py, i;
      // 局部对比（unsharp）：AI 重绘的软边地形整体发糊，这里用半分辨率的模糊底做
      // 非锐化掩模，把海岸/山脊/沙丘边缘拉回来（只用于陆地，海面跳过）。
      var BW = 1024, BH = 512;
      var bl = new Uint8Array(BW * BH * 3);
      var oy, ox, yy, xx, jj, sr, sg, sb, n2;
      for (hy = 0; hy < BH; hy++) {
        for (hx = 0; hx < BW; hx++) {
          sr = 0; sg = 0; sb = 0; n2 = 0;
          for (oy = -1; oy <= 1; oy++) {
            yy = hy * 2 + oy;
            if (yy < 0 || yy >= H) continue;
            for (ox = -1; ox <= 1; ox++) {
              xx = hx * 2 + ox;
              if (xx < 0 || xx >= W) continue;
              jj = (yy * W + xx) * 4;
              sr += d[jj]; sg += d[jj + 1]; sb += d[jj + 2]; n2++;
            }
          }
          var kb = (hy * BW + hx) * 3;
          bl[kb] = sr / n2; bl[kb + 1] = sg / n2; bl[kb + 2] = sb / n2;
        }
      }

      for (py = 0; py < H; py++) {
        var fy = py / H * HH - 0.5;
        var y0 = Math.floor(fy), ty = fy - y0;
        if (y0 < 0) { y0 = 0; ty = 0; }
        if (y0 > HH - 2) { y0 = HH - 2; ty = 1; }
        var r0 = (y0 & (HH - 1)) * HW, r1 = (y0 + 1) * HW;
        var row = py * W;
        var byi = Math.min(BH - 1, Math.floor(py / H * BH));
        for (px = 0; px < W; px++) {
          i = (row + px) * 4;
          var r = d[i], gg = d[i + 1], b = d[i + 2];
          var lum = r * 0.3 + gg * 0.59 + b * 0.11;
          // 海面不动（与 rebuildOceanFromImage 同一判据）
          if ((b > gg + 8 && b > r + 20) || (lum < 70 && b >= r + 5)) continue;
          var fx = px / W * HW - 0.5;
          var x0 = Math.floor(fx), tx = fx - x0;
          var xa = x0 & (HW - 1), xb = (x0 + 1) & (HW - 1);
          var s = ((shd[r0 + xa] * (1 - tx) + shd[r0 + xb] * tx) * (1 - ty) +
                   (shd[r1 + xa] * (1 - tx) + shd[r1 + xb] * tx) * ty);
          if (s < 0.78) s = 0.78; else if (s > 1.22) s = 1.22;
          var bxi = Math.min(BW - 1, Math.floor(px / W * BW));
          var kb2 = (byi * BW + bxi) * 3;
          var ur = r + (r - bl[kb2]) * 0.52;
          var ug = gg + (gg - bl[kb2 + 1]) * 0.52;
          var ub = b + (b - bl[kb2 + 2]) * 0.52;
          d[i] = ur * s > 255 ? 255 : (ur * s < 0 ? 0 : ur * s);
          d[i + 1] = ug * s > 255 ? 255 : (ug * s < 0 ? 0 : ug * s);
          d[i + 2] = ub * s > 255 ? 255 : (ub * s < 0 ? 0 : ub * s);
        }
      }
      g.putImageData(im, 0, 0);
      GLOBE_DETAIL = c;
      return c;
    } catch (e) { return null; }
  }

  // 只加载 0 级真图：它是全球贴图，也是区层 / 街区层的采样源。
  function loadL0() {
    // 有 L0 真图就整张替换，并用真图重算海洋遮罩（海面高光依赖它）
    applyAsset('L0-globe-day.jpg', function (t) {
      // 采样源：区层/街区层都从 2048×1024 真图抽地形
      ingestMapFromAsset(t.image);
      if (!planetMesh) return;
      var det = detailizeGlobe(t.image);
      if (det) {
        var dtex = new T.CanvasTexture(det);
        dtex.colorSpace = T.SRGBColorSpace;
        dtex.anisotropy = 8;
        dtex.__shared = true;
        var old0 = planetMesh.material.map;
        planetMesh.material.map = dtex;
        if (old0 && !old0.__shared) old0.dispose();
      } else {
        planetMesh.material.map = t;
      }
      planetMesh.material.color.set(0xffffff);
      planetMesh.material.needsUpdate = true;
      rebuildOceanFromImage(t.image);

      // 依赖 MAP / 海洋遮罩的部件，必须等真图灌进来之后再建
      REGION_TEX_CACHE.forEach(function (tt) { try { tt.dispose(); } catch (e) {} });
      REGION_TEX_CACHE.clear();
      CITY_TEX_CACHE.forEach(function (tt) { try { tt.dispose(); } catch (e) {} });
      CITY_TEX_CACHE.clear();
      buildGlint();
      buildNightLights();
      disposeGroup(detailGroup); detailGroup = null; curDetail = '';
      var ri = curRegion;
      curRegion = -1; curCity = -1;
      if (ri >= 0 && state.level >= 1) ensureRegion(ri);
      if (state.level === 2) ensureCity(state.ri, state.ui);
    });
  }

  function mount(container) {
    if (!container) return false;
    if (container.__p3dMounted) destroy();
    host = container;

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(FOV, 1, 0.1, 3600);
    raycaster = new T.Raycaster();
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(1, 1);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setClearColor(0x05080b, 1);
    var cv = renderer.domElement;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;';
    host.appendChild(cv);

    state.level = 0; state.ri = 0; state.ui = 0;
    state.yaw = 2.25; state.pitch = 0.26; state.pitchVis = 0.26;
    state.alt = 300; state.altT = 300;
    anchor.set(0, 0, 0); anchorT.set(0, 0, 0);
    curRegion = -1; curCity = -1;
    regionGroup = null; cityGroup = null;

    buildSpace();
    loadL0();
    buildHud();
    buildLabelLayer();
    bindEvents(cv);
    resize();
    updateHud();
    updateVisibility();

    running = true;
    lastTime = 0;
    raf = requestAnimationFrame(loop);
    container.__p3dMounted = true;
    return true;
  }

  function destroy() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    window.removeEventListener('resize', resize);
    if (host) {
      if (host.__p3dRO) { try { host.__p3dRO.disconnect(); } catch (e) {} host.__p3dRO = null; }
      host.innerHTML = '';
      host.__p3dMounted = false;
    }
    disposeGroup(regionGroup); regionGroup = null; curRegion = -1;
    disposeGroup(cityGroup); cityGroup = null; curCity = -1;
    disposeGroup(detailGroup); detailGroup = null; curDetail = '';
    disposeGroup(spaceGroup); spaceGroup = null;
    planetMesh = cloudMesh = atmMesh = starMesh = markerMesh = markerGlow = glintMesh = nightLights = null;
    if (renderer) {
      try { renderer.dispose(); } catch (e) {}
      if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      renderer = null;
    }
    scene = null; camera = null; raycaster = null;
    hud = null; labels = null; zoneLbl = []; cellLbl = []; townLbl = null;
    host = null;
  }

  window.GaiaPlanet3D = {
    available: available,
    mount: mount,
    destroy: destroy,
    _regions: REGIONS,
    _debug: {
      texDump: function (what, ri, ui, a, b) {
        try {
          var t2;
          if (what === 'deep') t2 = detailCanvas(ri, ui);
          else if (what === 'hi') t2 = cityCanvas(ri, ui, 2048);
          else if (what === 'city') t2 = cityCanvas(ri, ui);
          else t2 = regionCanvas(ri);
          var cv = t2.image || t2;
          return cv.toDataURL('image/png');
        } catch (e) { return 'ERR:' + e.message; }
      },
      snapshot: function () {
        return {
          level: state.level,
          region: state.ri,
          zone: REGIONS[state.ri] ? REGIONS[state.ri].zone : '',
          place: REGIONS[state.ri] ? REGIONS[state.ri].n : '',
          unit: state.ui,
          alt: +state.alt.toFixed(2),
          altT: +state.altT.toFixed(2),
          yaw: +state.yaw.toFixed(3),
          pitch: +state.pitch.toFixed(3),
          pos: camera ? [ +camera.position.x.toFixed(1), +camera.position.y.toFixed(1), +camera.position.z.toFixed(1) ] : null,
          zones: REGIONS.length,
          lines: (window.__GAIA_ZONE_LINES || []).length,
          camDist: camera ? +camera.position.length().toFixed(1) : null,
          fov: camera ? camera.fov : null,
          aspect: camera ? +camera.aspect.toFixed(3) : null,
          up: camera ? [ +camera.up.x.toFixed(2), +camera.up.y.toFixed(2), +camera.up.z.toFixed(2) ] : null,
          look: camera ? (function () { var v = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); return [ +v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2) ]; })() : null,
        };
      },
      flyToRegion: flyToRegion,
      flyToCell: flyToCell,
      flyToSpace: flyToSpace,
      setAlt: applyAlt,
      camera: function () { return camera; },
      scene: function () { return scene; },
      planet: function () { return planetMesh; },
      state: state
    }
  };
})();
