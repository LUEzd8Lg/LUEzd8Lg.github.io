/* ============================================================
   世界观察档案库 · 电影化视觉增强层 (fx.js)
   1. 登录门禁开机序列（CRT 通电线 / 引导日志 / 卡片装配 / 数据流雨）
   2. 登录成功闸门退出（ACCESS GRANTED 印章 + CRT 关屏折叠）
   3. 路由切换扫描光束转场 + 视图故障抖动
   4. 卡片磁吸倾斜 + 光标光泽（sheen）
   5. 区块标题字符解码显现
   全部尊重 prefers-reduced-motion；触摸设备自动禁用倾斜/光泽。
   ============================================================ */
(function () {
  'use strict';

  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FINE = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var GLYPHS = '0123456789ABCDEF<>/\\|+*#@$%&';

  /* ================= 1. 登录门禁 · 开机序列 ================= */
  var rainRaf = 0;
  var DESC_RAF = 0;

  function gateIntro(gate) {
    if (!gate) return;
    // 清理上次状态（登出后再次进入时重播）
    cancelAnimationFrame(rainRaf);
    cancelAnimationFrame(DESC_RAF);
    gate.classList.remove('fx-skip', 'fx-grant', 'fx-fade', 'fx-assemble', 'fx-poweron');
    gate._fxAssembled = false;
    var stale = gate.querySelectorAll('.fx-bootlog, .fx-powerline, .fx-rain, .fx-granted, .fx-descent');
    for (var i = 0; i < stale.length; i++) stale[i].remove();

    startRain(gate);

    if (RM) { gate.classList.add('fx-poweron', 'fx-assemble'); return; }

    // 用户自制「终端深潜」开场（descent-intro.html，约 11s，可跳过），完成后装配登录卡
    try { startIntro(gate, assembleGate); }
    catch (e) { assembleGate(gate); }   // 开场层初始化异常时直接装配，避免门禁卡死
  }

  // 登录卡装配 + 标题故障（幂等）
  function assembleGate(gate) {
    if (gate._fxAssembled) return;
    gate._fxAssembled = true;
    gate.classList.add('fx-assemble');
    var seq = gate.querySelectorAll(
      '.lg-head-top, .lg-logo, .lg-tag, .lg-tabs, ' +
      '.lg-form .lg-field, .lg-form .lg-mode-toggle, .lg-form .lg-submit, ' +
      '.lg-guest-row, .lg-foot, .lg-sidebar'
    );
    for (var i = 0; i < seq.length; i++) seq[i].style.animationDelay = (0.12 + i * 0.055) + 's';
    var title = gate.querySelector('.lg-title');
    if (title) {
      title.classList.add('fx-glitch');
      setTimeout(function () { title.classList.remove('fx-glitch'); }, 700);
    }
  }

  // 用户自制「终端深潜」开场：加载 descent-intro.html（iframe，隔离样式），完成后装配登录卡
  function startIntro(gate, assemble) {
    var ifr = document.createElement('iframe');
    ifr.className = 'descent-intro';
    ifr.setAttribute('src', 'descent-intro.html?v=2');
    ifr.setAttribute('allow', 'autoplay');
    ifr.setAttribute('title', '档案库开机序列 · 点击或按任意键跳过');
    ifr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:20;background:#000;';
    gate.appendChild(ifr);

    // 透明跳过层（盖在 iframe 上，点击即跳过；无文字、无悬浮提示）
    var skip = document.createElement('div');
    skip.style.cssText = 'position:absolute;inset:0;z-index:21;cursor:pointer;';
    gate.appendChild(skip);

    var done = false, failSafe = 0;
    function doneIntro() {
      if (done) return;
      done = true;
      ifr.remove(); skip.remove();
      gate.removeEventListener('pointerdown', onSkip);
      skip.removeEventListener('pointerdown', onSkipTap);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('message', onMsg);
      clearTimeout(failSafe);
      assemble(gate);
    }
    function onSkip() { doneIntro(); }
    function onSkipTap(e) { e.stopPropagation(); doneIntro(); }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (k === 'Escape' || k === 'Enter' || k === ' ' || (k && k.length === 1)) doneIntro();
    }
    function onMsg(ev) {
      if (ev.source === ifr.contentWindow && (ev.data === 'ARCHIVE_INTRO_DONE' || ev.data === 'ARCHIVE_INTRO_SKIP')) doneIntro();
    }
    gate.addEventListener('pointerdown', onSkip);
    skip.addEventListener('pointerdown', onSkipTap);
    document.addEventListener('keydown', onKey);
    window.addEventListener('message', onMsg);
    // 安全兜底：动画全长约 11s，13s 仍未完成则直接装配登录卡
    failSafe = setTimeout(doneIntro, 13000);
  }

  // C1 · 深潜档案层（canvas 生成式开场）
  var DESC_DUR = 8000;        // 总时长 8s
  var DESC_ASSEMBLE = 7100;   // 7.1s 幕下装配登录卡
  var DESC_SEED = (Math.random() * 1e6) | 0;

  function startDescent(gate, assemble) {
    var c = document.createElement('canvas');
    c.className = 'fx-descent';
    gate.appendChild(c);
    var ctx = c.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = c.width = Math.max(1, Math.round(gate.clientWidth * dpr));
      H = c.height = Math.max(1, Math.round(gate.clientHeight * dpr));
    }
    resize();
    window.addEventListener('resize', resize);

    // 离屏 CRT 噪点图
    var noise = document.createElement('canvas');
    noise.width = 64; noise.height = 64;
    var nctx = noise.getContext('2d');
    var nimg = nctx.createImageData(64, 64);
    var seed = DESC_SEED;

    var FLOORS = ['GATE-04', 'SUB-01', '收容区', '黑蚀档案层'];
    var ECS = ['EC-4483', 'EC-8844', 'EC-9044', 'EC-4471', 'EC-4522'];
    var TERMINAL = 'TERMINAL // 登录终端';
    var t0 = performance.now();
    var done = false, assembled = false;

    function doAssemble() { if (!assembled) { assembled = true; assemble(gate); } }
    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(DESC_RAF);
      window.removeEventListener('resize', resize);
      gate.removeEventListener('pointerdown', onSkip);
      document.removeEventListener('keydown', onKey);
      c.style.transition = 'opacity .5s ease';
      c.style.opacity = '0';
      setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 540);
    }
    function onSkip() { doAssemble(); finish(); }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (k === 'Escape' || k === 'Enter' || k === ' ' || (k && k.length === 1)) onSkip();
    }
    gate.addEventListener('pointerdown', onSkip);
    document.addEventListener('keydown', onKey);

    function frame(now) {
      if (done) return;
      var t = now - t0;
      if (!assembled && t >= DESC_ASSEMBLE) doAssemble();
      draw(t);
      if (t < DESC_DUR) DESC_RAF = requestAnimationFrame(frame);
      else finish();
    }

    function draw(t) {
      var p = Math.min(1, t / DESC_DUR);
      var d = p * p * p;                       // ease-in 下坠加速
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2;

      // 深色竖井渐变
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#05060a'); g.addColorStop(1, '#0c0e15');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // 井壁（近端随下坠张开）
      var hw = W * 0.34;
      ctx.strokeStyle = 'rgba(216,185,90,0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, H * 0.06); ctx.lineTo(cx - (hw + d * W * 0.45), H * 0.98);
      ctx.moveTo(cx, H * 0.06); ctx.lineTo(cx + (hw + d * W * 0.45), H * 0.98);
      ctx.stroke();

      // 层甲板线：向下滚动，间距随深度加大
      ctx.lineWidth = 1;
      var n = 16;
      for (var i = 0; i < n; i++) {
        var y = ((i / n + d * 1.6) % 1.0) * H;
        ctx.strokeStyle = 'rgba(170,178,200,' + (0.06 + 0.5 * (i / n)).toFixed(2) + ')';
        ctx.beginPath(); ctx.moveTo(W * 0.04, y); ctx.lineTo(W * 0.96, y); ctx.stroke();
      }

      // 两侧档案架剪影（向下滚动）
      ctx.fillStyle = 'rgba(20,22,30,0.9)';
      var rows = 12;
      for (var r = 0; r < rows; r++) {
        var ry = ((r / rows + d * 1.3) % 1.0) * H;
        var bh = H * 0.03;
        var bx = W * (0.02 + ((r + (DESC_SEED % 3)) % 4) * 0.012);
        ctx.fillRect(bx, ry, W * 0.03, bh);
        ctx.fillRect(W - bx - W * 0.03, ry, W * 0.03, bh);
      }

      // 中央楼层牌（末段停 TERMINAL）
      var label = p >= 0.82 ? TERMINAL : FLOORS[Math.min(Math.floor(p * 4.0), FLOORS.length - 1)];
      ctx.textAlign = 'center';
      ctx.font = '600 ' + Math.round(H * 0.045) + 'px "Courier New", monospace';
      ctx.fillStyle = 'rgba(216,185,90,0.9)';
      ctx.shadowColor = 'rgba(216,185,90,0.5)'; ctx.shadowBlur = 12;
      ctx.fillText(label, cx, H * (0.34 + 0.12 * Math.sin(p * Math.PI)));
      ctx.shadowBlur = 0;

      // 顶部层级计数
      ctx.font = Math.round(H * 0.02) + 'px "Courier New", monospace';
      ctx.fillStyle = 'rgba(170,178,200,0.6)';
      ctx.fillText('LVL ' + String(99 - Math.floor(p * 60)).padStart(3, '0'), cx, H * 0.08);

      // EC 编号左右交替闪烁
      var flash = Math.floor(t / 210);
      if (p < 0.8 && (flash % 2) === 0) {
        var ec = ECS[(flash + (DESC_SEED % 5)) % ECS.length];
        var side = (flash % 4) < 2 ? 1 : -1;
        ctx.font = Math.round(H * 0.026) + 'px "Courier New", monospace';
        ctx.fillStyle = 'rgba(170,170,187,0.85)';
        ctx.textAlign = side > 0 ? 'left' : 'right';
        ctx.fillText(ec, cx + side * W * 0.2, H * (0.3 + 0.5 * Math.abs(Math.sin(flash * 0.6))));
      }
      ctx.textAlign = 'center';

      // 扫描亮带
      var bandY = (t * 0.0004 % 1) * H;
      var grad = ctx.createLinearGradient(0, bandY - H * 0.06, 0, bandY + H * 0.06);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(210,225,255,0.10)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, bandY - H * 0.06, W, H * 0.12);

      // CRT 噪点（每帧抖动）
      for (var k = 0; k < nimg.data.length; k += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var v = (seed >>> 8) & 255;
        var a = v < 34 ? 46 : 0;
        nimg.data[k] = v; nimg.data[k + 1] = v; nimg.data[k + 2] = v; nimg.data[k + 3] = a;
      }
      nctx.putImageData(nimg, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(noise, 0, 0, 64, 64, 0, 0, W, H);

      // 四角暗角
      var vg = ctx.createRadialGradient(cx, H / 2, H * 0.3, cx, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    DESC_RAF = requestAnimationFrame(frame);
  }

  function typeInto(row, label, status) {
    var dots = ' ' + new Array(Math.max(3, 28 - label.length)).join('.') + ' ';
    var full = '> ' + label + dots;
    var i = 0;
    (function tick() {
      i++;
      row.textContent = full.slice(0, i);
      if (i < full.length) setTimeout(tick, 11);
      else {
        var s = document.createElement('span');
        s.className = 'fx-bootlog-ok';
        s.textContent = status;
        row.appendChild(s);
      }
    })();
  }

  // 门禁背景数据流雨（银色十六进制，低密度）
  function startRain(gate) {
    if (RM) return;
    var c = document.createElement('canvas');
    c.className = 'fx-rain';
    var wrap = gate.querySelector('.lg-wrap');
    gate.insertBefore(c, wrap || null);
    var ctx = c.getContext('2d');
    function resize() { c.width = gate.clientWidth; c.height = gate.clientHeight; }
    resize();
    window.addEventListener('resize', resize);

    function spawn(anyY) {
      return {
        x: Math.random() * c.width,
        y: anyY ? Math.random() * c.height : -60 - Math.random() * 240,
        sp: 0.5 + Math.random() * 1.6,
        len: 4 + ((Math.random() * 8) | 0)
      };
    }
    var COLS = Math.max(8, Math.floor(window.innerWidth / 110));
    var streams = [];
    for (var i = 0; i < COLS; i++) streams.push(spawn(true));

    (function frame() {
      if (!gate.isConnected || gate.style.display === 'none') {
        cancelAnimationFrame(rainRaf);
        window.removeEventListener('resize', resize);
        return;
      }
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.font = '11px "Cascadia Code", monospace';
      for (var i = 0; i < streams.length; i++) {
        var s = streams[i];
        for (var j = 0; j < s.len; j++) {
          var y = s.y - j * 14;
          if (y < -12 || y > c.height + 12) continue;
          var a = (1 - j / s.len) * (j === 0 ? 0.5 : 0.2);
          ctx.fillStyle = 'rgba(232,232,232,' + a.toFixed(3) + ')';
          ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], s.x, y);
        }
        s.y += s.sp;
        if (s.y - s.len * 14 > c.height) streams[i] = spawn(false);
      }
      rainRaf = requestAnimationFrame(frame);
    })();
  }

  /* ================= 2. 登录成功 · 闸门退出 ================= */
  function gateOut(gate, cb) {
    if (!gate || RM || gate.style.display === 'none') { if (cb) cb(); return; }
    cancelAnimationFrame(rainRaf);
    gate.classList.remove('fx-poweron', 'fx-assemble');
    gate.classList.add('fx-grant');

    var stamp = document.createElement('div');
    stamp.className = 'fx-granted';
    stamp.innerHTML = '<div class="fx-granted-inner">◈ ACCESS GRANTED<span>访问获准 · 档案库解封</span></div>';
    gate.appendChild(stamp);

    var wrap = gate.querySelector('.lg-wrap');
    var log = gate.querySelector('.fx-bootlog');
    setTimeout(function () {
      if (wrap) wrap.classList.add('fx-crt-off');
      if (log) log.style.opacity = '0';
      var rain = gate.querySelector('.fx-rain');
      if (rain) rain.style.opacity = '0';
    }, 540);
    setTimeout(function () { gate.classList.add('fx-fade'); }, 900);
    setTimeout(function () { if (cb) cb(); }, 1040);
  }

  /* ================= 3. 路由切换 · 档案抽屉转场 ================= */
  var pendingViewIn = false;

  function bindRouteWipe() {
    // 路由转场已由 app.js 的 route-wipe（全屏扫描帘）统一接管，
    // 停用 fx 侧重复的「抽屉退场 + 视图滑入」转场，避免双重过场叠加冲突。
    return;
  }

  /* ================= 4. 卡片磁吸倾斜 + 光标光泽 ================= */
  var TILT_SEL = '.cat-card, .doc-card, .entry-card, .deity-card, .timeline-entry, .core-item, .lib-card, .lg-card';

  function bindTilt() {
    if (RM || !FINE) return;
    var cur = null;
    document.addEventListener('mousemove', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(TILT_SEL) : null;
      if (t !== cur) {
        if (cur) resetCard(cur);
        cur = t;
        if (cur) enterCard(cur);
      }
      if (!cur) return;
      var r = cur.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      var max = cur.classList.contains('lg-card') ? 2.2 : 4;
      var rx = (0.5 - py) * max;
      var ry = (px - 0.5) * max;
      cur.style.transform =
        'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-3px)';
      cur.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      cur.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    }, { passive: true });

    document.addEventListener('mouseout', function (e) {
      if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) {
        resetCard(cur);
        cur = null;
      }
    }, { passive: true });
  }

  function enterCard(c) {
    c.classList.add('fx-tilt');
    c.style.transition = 'none';
    if (!c.querySelector('.fx-sheen')) {
      var s = document.createElement('i');
      s.className = 'fx-sheen';
      s.setAttribute('aria-hidden', 'true');
      c.appendChild(s);
    }
  }

  function resetCard(c) {
    c.classList.remove('fx-tilt');
    c.style.transition = '';
    c.style.transform = '';
  }

  /* ================= 5. 区块标题 · 字符解码显现 ================= */
  function bindDecode() {
    if (RM || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        scramble(en.target);
      });
    }, { threshold: 0.4 });

    function scan() {
      var list = document.querySelectorAll('.section-title-en:not([data-fx-decoded]), .search-summary q:not([data-fx-decoded])');
      for (var i = 0; i < list.length; i++) {
        list[i].setAttribute('data-fx-decoded', '1');
        io.observe(list[i]);
      }
    }
    scan();
    var vc = document.getElementById('view-container');
    if (vc) new MutationObserver(scan).observe(vc, { childList: true, subtree: true });
  }

  function scramble(el) {
    var finalText = el.textContent;
    if (!finalText || finalText.length < 2) return;
    var start = performance.now(), dur = 460;
    (function tick(now) {
      var t = Math.min(1, (now - start) / dur);
      var n = Math.floor(t * finalText.length);
      var out = '';
      for (var i = 0; i < finalText.length; i++) {
        out += i < n ? finalText[i]
          : (finalText[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = finalText;
    })(start);
  }

  /* ================= 7. 世界总图 · 描边生长 + 门标记脉冲 ================= */
  function initWorldMap() {
    var svg = document.querySelector('.wm-svg');
    if (!svg || svg.hasAttribute('data-fx-map')) return;
    svg.setAttribute('data-fx-map', '1');
    if (RM) return;

    var paths = [].slice.call(svg.querySelectorAll('.wm-land'));
    var lens = [];
    paths.forEach(function (p, i) {
      try { lens[i] = p.getTotalLength(); } catch (e) { lens[i] = 0; }
      if (!lens[i]) { p.style.fillOpacity = '1'; return; }
      p.style.strokeDasharray = lens[i] + 'px';
      p.style.strokeDashoffset = lens[i] + 'px';
      p.style.fillOpacity = '0';
      p.style.transition =
        'stroke-dashoffset 1.15s cubic-bezier(.4,0,.2,1) ' + (i * 190) + 'ms, ' +
        'fill-opacity .7s ease ' + (i * 190 + 720) + 'ms';
    });

    var gates = [].slice.call(svg.querySelectorAll('.wm-gate'));
    gates.forEach(function (g) { g.classList.add('fx-beacon'); });

    var labels = [].slice.call(svg.querySelectorAll('.wm-label, .wm-sub'));
    labels.forEach(function (l) {
      l.style.opacity = '0';
      l.style.transition = 'opacity .7s ease';
    });

    var wrap = svg.closest('.wm-wrap') || svg;
    wrap.classList.add('fx-map-wrap');

    var started = false;
    function play() {
      if (started) return;
      started = true;
      paths.forEach(function (p, i) {
        if (!lens[i]) { p.style.fillOpacity = '1'; return; }
        p.style.strokeDashoffset = '0';
        p.style.fillOpacity = '1';
      });
      labels.forEach(function (l, i) {
        setTimeout(function () { l.style.opacity = '1'; }, 260 + i * 110);
      });
    }

    if (!('IntersectionObserver' in window)) { play(); return; }
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      play();
    }, { threshold: 0.2 });
    io.observe(wrap);
    // 兜底：若观察器未触发，6 秒后直接绘制，避免地图永久隐没
    setTimeout(play, 6000);
  }

  /* ================= 8. 详情页 · 正文逐段显现（纯 CSS 入场，不依赖观察器） ================= */
  function detailReveal() {
    var body = document.getElementById('detail-body');
    if (!body || body.hasAttribute('data-fx-reveal')) return;
    body.setAttribute('data-fx-reveal', '1');
    if (RM) return;
    var kids = [].slice.call(body.children).filter(function (el) {
      return /^(P|H2|H3|H4|UL|OL|TABLE|BLOCKQUOTE|HR|DIV|FIGURE|PRE)$/.test(el.tagName);
    });
    kids.slice(0, 12).forEach(function (k, i) {
      k.style.setProperty('--fx-k', i);
      k.classList.add('fx-para');
    });
  }

  /* ================= 9. 环境视频层（可选素材，缺失自动忽略） ================= */
  function attachAmbient(host, src, opacity, anchorSel) {
    if (!host || RM || host.hasAttribute('data-fx-amb')) return;
    host.setAttribute('data-fx-amb', '1');
    var v = document.createElement('video');
    v.className = 'fx-ambient';
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    v.preload = 'auto';
    v.style.opacity = String(opacity);
    v.addEventListener('error', function () {
      v.remove();
      host.removeAttribute('data-fx-amb');
    });
    v.src = src;
    var anchor = anchorSel ? host.querySelector(anchorSel) : null;
    (anchor ? anchor.parentNode : host).insertBefore(v, anchor || host.firstChild);
    var pr = v.play();
    if (pr && pr.catch) pr.catch(function () {});
  }

  /* ================= 路由渲染后统一调度 ================= */
  // 列表卡片错峰入场编号（--fx-k 供 CSS 计算延迟）
  function cardStagger() {
    if (RM) return;
    var grids = document.querySelectorAll('.entry-grid:not([data-fx-stagger])');
    for (var g = 0; g < grids.length; g++) {
      grids[g].setAttribute('data-fx-stagger', '1');
      var cards = grids[g].children;
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.setProperty('--fx-k', Math.min(i, 16));
      }
    }
  }

  function afterRender() {
    initWorldMap();
    detailReveal();
    cardStagger();
    var vc = document.getElementById('view-container');
    if (pendingViewIn && vc) {
      pendingViewIn = false;
      vc.classList.remove('fx-view-in'); void vc.offsetWidth; vc.classList.add('fx-view-in');
      setTimeout(function () { vc.classList.remove('fx-view-in'); }, 700);
    }
    var hero = document.getElementById('hero-section');
    if (hero) attachAmbient(hero, 'data/hero-ambient.mp4', 0.55, '.hero-img');
    gateAmbient();
  }

  // 门禁屏视频：门禁显示期间 view-container 无子节点、不触发渲染钩子，
  // 需监听门禁自身的 style/class 变化，在可见时接入
  function gateAmbient() {
    var gate = document.getElementById('login-gate');
    if (!gate) return;
    if (gate.style.display !== 'none') attachAmbient(gate, 'data/login-ambient.mp4', 0.55, '.lg-scan');
  }

  function bindGateAmbient() {
    var gate = document.getElementById('login-gate');
    if (!gate) return;
    gateAmbient();
    if (!('MutationObserver' in window)) return;
    new MutationObserver(gateAmbient).observe(gate, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  function bindRenderHooks() {
    afterRender();
    var vc = document.getElementById('view-container');
    if (!vc || !('MutationObserver' in window)) return;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; afterRender(); });
    }).observe(vc, { childList: true });
  }

  /* ================= 启动 ================= */
  window.FX = { gateIntro: gateIntro, gateOut: gateOut, ambient: attachAmbient };
  bindRouteWipe();
  bindTilt();
  bindDecode();
  bindRenderHooks();
  bindGateAmbient();
})();
