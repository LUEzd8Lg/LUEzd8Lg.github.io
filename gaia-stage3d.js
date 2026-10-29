/* ============================================================
   gaia-stage3d.js — 盖亚全息星球 · three.js WebGL 舞台 + 城市近景
   零构建。window.GaiaStage3D.mount(canvas, opts)      -> { destroy() }
            window.GaiaStage3D.mountCity(canvas, opts)  -> { destroy() }
            window.GaiaStage3D.available()              -> bool
   任何一步失败（无 WebGL / 无 three / file:// 纹理受限）都回落到
   gaia-globe.js 的 Canvas2D 渲染，保证 planet 页永不空白。
   ============================================================ */
(function () {
  'use strict';

  const D2R = Math.PI / 180;
  const TILE_M = 8;                 // 每张立面贴图覆盖的建筑面积（米）

  /* ---------- 环境探测 ---------- */

  function webglOK() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      return !!gl;
    } catch (e) { return false; }
  }

  function available() {
    if (!window.THREE) return false;
    /* 贴图走内联 base64（GAIA_TEX），file:// 下也不会污染画布，可直接用 WebGL */
    return webglOK();
  }

  function fallback(canvas, opts) {
    if (window.GaiaGlobe && typeof window.GaiaGlobe.mount === 'function') {
      try { return window.GaiaGlobe.mount(canvas, opts || {}); } catch (e) {}
    }
    return { destroy: function () {} };
  }

  /* ---------- 通用工具 ---------- */

  function makeRenderer(canvas, T) {
    const renderer = new T.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const gl = renderer.getContext();
    renderer.__maxAniso = (gl.getExtension('EXT_texture_filter_anisotropic') && gl.getParameter(gl.getExtension('EXT_texture_filter_anisotropic').MAX_TEXTURE_MAX_ANISOTROPY_EXT)) || 1;
    if ('outputColorSpace' in renderer && T.SRGBColorSpace) {
      renderer.outputColorSpace = T.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && T.sRGBEncoding) {
      renderer.outputEncoding = T.sRGBEncoding;
    }
    if (T.ACESFilmicToneMapping) {
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }
    return renderer;
  }

  function setColorSpace(tex, T, srgb) {
    if (srgb) {
      if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      else if ('encoding' in tex && T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
    }
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  function disposeTree(root) {
    if (!root) return;
    root.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      const m = o.material;
      if (!m) return;
      const arr = Array.isArray(m) ? m : [m];
      arr.forEach(function (mat) {
        if (!mat) return;
        if (mat.map && mat.map.dispose) mat.map.dispose();
        if (mat.bumpMap && mat.bumpMap.dispose) mat.bumpMap.dispose();
        if (mat.normalMap && mat.normalMap.dispose) mat.normalMap.dispose();
        if (mat.alphaMap && mat.alphaMap.dispose) mat.alphaMap.dispose();
        if (mat.dispose) mat.dispose();
      });
    });
  }

  function bindResize(canvas, camera, renderer, extra) {
    function apply() {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (extra) extra(w, h);
    }
    apply();
    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(apply);
      ro.observe(canvas.parentNode || canvas);
    } else {
      window.addEventListener('resize', apply);
    }
    return function () {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', apply);
    };
  }

  /* ============================================================
     一、星球轨道观测
     ============================================================ */

  const ATMO_VS = [
    'varying vec3 vN;',
    'varying vec3 vV;',
    'void main(){',
    '  vN = normalize(normalMatrix * normal);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vV = normalize(-mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  const ATMO_FS = [
    'varying vec3 vN;',
    'varying vec3 vV;',
    'uniform vec3 uColor;',
    'uniform float uPow;',
    'uniform float uInt;',
    'void main(){',
    '  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);',
    '  gl_FragColor = vec4(uColor, f * uInt);',
    '}'
  ].join('\n');

  function mountGlobe(canvas, opts) {
    const T = window.THREE;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = makeRenderer(canvas, T);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, 0.05, 400);

    const world = new T.Group();          // 整颗球（拖拽 = 旋转它）
    scene.add(world);

    /* ---- 星球本体 ---- */
    const earthMat = new T.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.94, metalness: 0.02
    });
    const earth = new T.Mesh(new T.SphereGeometry(1, 96, 64), earthMat);
    world.add(earth);

    /* ---- 云层 ---- */
    const cloudMat = new T.MeshStandardMaterial({
      color: 0xdde9f6, transparent: true, opacity: 0.62, roughness: 1, metalness: 0,
      depthWrite: false
    });
    const clouds = new T.Mesh(new T.SphereGeometry(1.012, 80, 52), cloudMat);
    world.add(clouds);

    /* ---- 大气辉光（Fresnel） ---- */
    const atmo = new T.Mesh(new T.SphereGeometry(1.055, 64, 44), new T.ShaderMaterial({
      uniforms: {
        uColor: { value: new T.Color(0x69b6f2) },
        uPow: { value: 3.6 },
        uInt: { value: 0.72 }
      },
      vertexShader: ATMO_VS, fragmentShader: ATMO_FS,
      side: T.BackSide, blending: T.AdditiveBlending, transparent: true, depthWrite: false
    }));
    scene.add(atmo);

    /* ---- 星空 ---- */
    function starLayer(count, radius, size, opacity, spread) {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        const r = radius + Math.random() * spread;
        pos[i * 3] = s * Math.cos(a) * r;
        pos[i * 3 + 1] = u * r;
        pos[i * 3 + 2] = s * Math.sin(a) * r;
        const t = 0.55 + Math.random() * 0.45;
        col[i * 3] = t; col[i * 3 + 1] = t * (0.92 + Math.random() * 0.08); col[i * 3 + 2] = 1.0;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.PointsMaterial({
        size: size, vertexColors: true, transparent: true, opacity: opacity,
        depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
      });
      const p = new T.Points(g, m);
      scene.add(p);
      return p;
    }
    starLayer(1600, 24, 0.16, 0.75, 30);
    starLayer(500, 18, 0.30, 0.35, 20);

    /* ---- 红月 ---- */
    const moonPivot = new T.Group();
    moonPivot.rotation.z = 16 * D2R;
    scene.add(moonPivot);
    const moon = new T.Mesh(
      new T.SphereGeometry(0.062, 24, 16),
      new T.MeshStandardMaterial({ color: 0x7a2129, emissive: 0x521018, emissiveIntensity: 0.55, roughness: 0.85 })
    );
    moon.position.set(2.35, 0, 0);
    moonPivot.add(moon);

    /* ---- 光照 ---- */
    const sun = new T.DirectionalLight(0xfff3dd, 3.4);
    sun.position.set(-3.2, 2.1, 2.6);
    scene.add(sun);
    const rimLight = new T.DirectionalLight(0x4b7fb5, 0.85);
    rimLight.position.set(2.6, -1.2, -2.4);
    scene.add(rimLight);
    scene.add(new T.AmbientLight(0x2b3746, 0.55));

    /* ---- 贴图（优先用内联 base64，file:// 下也不会污染画布） ---- */
    const TEX = window.GAIA_TEX || {};
    const loader = new T.TextureLoader();
    loader.load(TEX.map || 'data/gaia-map.jpg', function (tex) {
      setColorSpace(tex, T, true);
      tex.anisotropy = renderer.__maxAniso;
      earthMat.map = tex;
      earthMat.needsUpdate = true;
    }, undefined, function () {});

    loader.load(TEX.bump || 'data/gaia-bump.jpg', function (tex) {
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.anisotropy = renderer.__maxAniso;
      earthMat.bumpMap = tex;
      earthMat.bumpScale = 0.035;
      earthMat.needsUpdate = true;
    }, undefined, function () {});

    loader.load(TEX.clouds || 'data/gaia-clouds.jpg', function (tex) {
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.anisotropy = renderer.__maxAniso;
      cloudMat.alphaMap = tex;
      cloudMat.needsUpdate = true;
    }, undefined, function () {});

    /* ---- 相机 & 交互 ---- */
    let dist = 3.55;
    let dragging = false, lastX = 0, lastY = 0, touched = false;

    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);

    /* 初始姿态：略带俯仰，便于看到北半球 */
    world.quaternion.setFromEuler(new T.Euler(0.16, -0.55, 0, 'YXZ'));

    /* 真·轨迹球：按屏幕位移在任意方向累计旋转，不设上下限 —— 可 360° 任意翻转 */
    const qTmp = new T.Quaternion();
    const axTmp = new T.Vector3();
    const spinAxis = new T.Vector3(0, 1, 0);
    const upAxis = new T.Vector3(0, 1, 0);
    let spinSpeed = 0;

    function spin(dx, dy) {
      const len = Math.hypot(dx, dy);
      if (len < 1e-4) return;
      axTmp.set(dy, dx, 0).normalize();          // 屏幕位移 → 世界旋转轴
      const ang = len * 0.0055;
      qTmp.setFromAxisAngle(axTmp, ang);
      world.quaternion.premultiply(qTmp).normalize();
      spinAxis.copy(axTmp);
      spinSpeed = ang;
    }

    function onDown(e) {
      dragging = true; touched = true; spinSpeed = 0;
      lastX = e.clientX; lastY = e.clientY;
      canvas.classList.add('gg-grabbing');
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (er) {} }
    }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      spin(dx, dy);
    }
    function onUp(e) {
      dragging = false;
      canvas.classList.remove('gg-grabbing');
      if (canvas.releasePointerCapture) { try { canvas.releasePointerCapture(e.pointerId); } catch (er) {} }
    }
    function onWheel(e) {
      e.preventDefault();
      touched = true;
      dist = Math.max(1.85, Math.min(7.5, dist * Math.exp(e.deltaY * 0.0011)));
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const unbindResize = bindResize(canvas, camera, renderer);

    /* ---- 主循环 ---- */
    const clock = new T.Clock();
    let raf = 0, alive = true, lost = false;

    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestore() { lost = false; }
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestore);

    function frame() {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (lost) return;
      if (document.hidden || !canvas.isConnected) return;

      const dt = Math.min(clock.getDelta(), 0.05);

      if (!dragging) {
        if (spinSpeed > 0.0004) {
          /* 甩动惯性 */
          qTmp.setFromAxisAngle(spinAxis, spinSpeed);
          world.quaternion.premultiply(qTmp).normalize();
          spinSpeed *= 0.95;
        } else if (!reduced && !touched) {
          /* 静置自转：绕自身极轴，慢速 */
          qTmp.setFromAxisAngle(upAxis, 0.045 * dt);
          world.quaternion.multiply(qTmp).normalize();
        }
      }
      clouds.rotation.y += (reduced ? 0.006 : 0.02) * dt;
      moonPivot.rotation.y += 0.16 * dt;

      renderer.render(scene, camera);
    }
    frame();

    return {
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestore);
        unbindResize();
        disposeTree(scene);
        renderer.dispose();
        canvas.classList.remove('gg-grabbing');
      }
    };
  }

  /* ============================================================
     二、城市近景
     ============================================================ */

  /* 盒体 UV 按真实尺寸平铺，避免一栋楼只有一张贴图 */
  function scaleBoxUV(g, w, h, d) {
    const uv = g.attributes.uv;
    const a = uv.array;
    const su = [d, d, w, w, w, w];
    const sv = [h, h, d, d, h, h];
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = (f * 4 + k) * 2;
        a[i] *= su[f] / TILE_M;
        a[i + 1] *= sv[f] / TILE_M;
      }
    }
    uv.needsUpdate = true;
  }

  function glowTexture(T) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,236,190,1)');
    rg.addColorStop(0.25, 'rgba(255,208,130,0.65)');
    rg.addColorStop(0.6, 'rgba(255,170,90,0.16)');
    rg.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    const tex = new T.CanvasTexture(c);
    if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function mountCity(canvas, opts) {
    const T = window.THREE;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = makeRenderer(canvas, T);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMappingExposure = 1.55;

    const scene = new T.Scene();
    /* 雾要淡到不糊住 150m 外的楼，又要在地面尽头把边缘吃掉 */
    scene.fog = new T.FogExp2(0x3a4757, 0.0028);

    const camera = new T.PerspectiveCamera(46, 1, 0.5, 1400);

    /* ---- 程序化环境贴图：让玻璃/石材有东西可反射 ---- */
    const envRT = (function () {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 512;
      const g = c.getContext('2d');
      const lg = g.createLinearGradient(0, 0, 0, 512);
      lg.addColorStop(0.00, '#1b2b3f');
      lg.addColorStop(0.38, '#3d5470');
      lg.addColorStop(0.50, '#9c8a72');
      lg.addColorStop(0.56, '#43474d');
      lg.addColorStop(1.00, '#1a1d22');
      g.fillStyle = lg;
      g.fillRect(0, 0, 1024, 512);
      const sx = 1024 * 0.20, sy = 512 * 0.28;
      const rg = g.createRadialGradient(sx, sy, 0, sx, sy, 200);
      rg.addColorStop(0, 'rgba(255,240,210,1)');
      rg.addColorStop(0.22, 'rgba(255,206,152,0.55)');
      rg.addColorStop(1, 'rgba(255,180,120,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 1024, 512);

      const tex = new T.CanvasTexture(c);
      tex.mapping = T.EquirectangularReflectionMapping;
      if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      const pmrem = new T.PMREMGenerator(renderer);
      const rt = pmrem.fromEquirectangular(tex);
      pmrem.dispose();
      tex.dispose();
      scene.environment = rt.texture;
      return rt;
    })();

    /* ---- 天空 ---- */
    const skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: {
        uTop: { value: new T.Color(0x101c2c) },
        uBot: { value: new T.Color(0x3a4757) },
        uSun: { value: new T.Vector3(-0.55, 0.18, 0.5).normalize() }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'varying vec3 vP; uniform vec3 uTop,uBot,uSun;',
        'void main(){',
        '  vec3 d = normalize(vP);',
        '  float k = smoothstep(-0.10, 0.62, d.y);',
        '  vec3 c = mix(uBot, uTop, k);',
        '  float s = pow(max(dot(d, uSun), 0.0), 9.0);',
        '  c += vec3(0.52, 0.34, 0.17) * s * 0.85;',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n')
    });
    scene.add(new T.Mesh(new T.SphereGeometry(700, 32, 18), skyMat));

    /* ---- 光照 ---- */
    const sun = new T.DirectionalLight(0xffe9c8, 3.5);
    sun.position.set(-95, 78, 86);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -105; sc.right = 105; sc.top = 105; sc.bottom = -105; sc.near = 1; sc.far = 420;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.06;
    scene.add(sun);
    const fill = new T.DirectionalLight(0x6d94b8, 0.85);
    fill.position.set(60, 30, -70);
    scene.add(fill);
    scene.add(new T.AmbientLight(0x3d5169, 0.65));
    scene.add(new T.HemisphereLight(0x6d8aa8, 0x1f2329, 0.45));

    /* ---- 材质 ---- */
    const loader = new T.TextureLoader();
    function tex(file, srgb, rp) {
      const t = loader.load('data/city/' + file, function (x) {
        setColorSpace(x, T, srgb);
        x.anisotropy = Math.min(8, renderer.__maxAniso);
      }, undefined, function () {});
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(rp || 1, rp || 1);
      return t;
    }

    const brickA = tex('brick-a.jpg', true), brickN = tex('brick-n.jpg', false);
    const glassA = tex('glass-a.jpg', true), glassN = tex('glass-n.jpg', false);
    const stoneA = tex('stone-a.jpg', true), stoneN = tex('stone-n.jpg', false);

    const matBrick = new T.MeshStandardMaterial({ map: brickA, normalMap: brickN, roughness: 0.9, metalness: 0.03, envMapIntensity: 0.5 });
    const matGlass = new T.MeshStandardMaterial({ map: glassA, normalMap: glassN, roughness: 0.2, metalness: 0.05, envMapIntensity: 1.15 });
    const matStone = new T.MeshStandardMaterial({ map: stoneA, normalMap: stoneN, roughness: 0.82, metalness: 0.06, envMapIntensity: 0.6 });
    const roofMat = new T.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.95, metalness: 0.05, envMapIntensity: 0.35 });

    const city = new T.Group();
    scene.add(city);

    function addBox(w, h, d, mat, x, y, z, roofed) {
      const g = new T.BoxGeometry(w, h, d);
      scaleBoxUV(g, w, h, d);
      const mats = roofed
        ? [mat, mat, roofMat, roofMat, mat, mat]
        : mat;
      const m = new T.Mesh(g, mats);
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      city.add(m);
      return m;
    }

    /* ---- 地面 ---- */
    const gRep = 1500 / TILE_M;
    const ground = new T.Mesh(
      new T.PlaneGeometry(1500, 1500),
      new T.MeshStandardMaterial({
        map: tex('asphalt-a.jpg', true, gRep),
        normalMap: tex('asphalt-n.jpg', false, gRep),
        roughness: 0.96, metalness: 0.04
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    city.add(ground);

    /* ---- 街区布局 ---- */
    const PITCH = 48, BLOCK = 34, ROAD = PITCH - BLOCK;   // 34m 街区 / 14m 道路
    let seed = 20261028;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

    /* 人行道 + 路缘 */
    const curbMat = new T.MeshStandardMaterial({ color: 0x5b5f66, roughness: 0.9, metalness: 0.05 });
    const walkMat = new T.MeshStandardMaterial({
      map: tex('stone-a.jpg', true, 4), normalMap: tex('stone-n.jpg', false, 4),
      roughness: 0.88, metalness: 0.04
    });

    const blocks = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) blocks.push({ x: i * PITCH, z: j * PITCH, i: i, j: j });

    blocks.forEach(function (b) {
      /* 抬起的街区基座（人行道） */
      const pad = new T.Mesh(new T.BoxGeometry(BLOCK, 0.45, BLOCK), walkMat);
      pad.position.set(b.x, 0.225, b.z);
      pad.receiveShadow = true;
      city.add(pad);

      /* 路缘石：四边薄框 */
      const cw = BLOCK + 0.6;
      [[0, cw / 2], [0, -cw / 2], [cw / 2, 0], [-cw / 2, 0]].forEach(function (p, k) {
        const horiz = k < 2;
        const cg = new T.BoxGeometry(horiz ? cw : 0.5, 0.5, horiz ? 0.5 : cw);
        const cm = new T.Mesh(cg, curbMat);
        cm.position.set(b.x + p[0], 0.25, b.z + p[1]);
        cm.receiveShadow = true;
        city.add(cm);
      });
    });

    /* ---- 建筑生成 ---- */
    const heat = [];   // 记录建筑占位，避免重叠
    const beacons = []; // 塔顶航空障碍灯
    function free(x, z, r) {
      for (let i = 0; i < heat.length; i++) {
        const d = Math.hypot(heat[i].x - x, heat[i].z - z);
        if (d < heat[i].r + r) return false;
      }
      return true;
    }

    function lowRise(x, z) {
      const w = 9 + rnd() * 5, d = 9 + rnd() * 5, h = 7 + rnd() * 13;
      addBox(w, h, d, matBrick, x, 0.45, z, true);
      /* 屋顶设备 / 女儿墙 */
      const pw = w + 0.6, pd = d + 0.6;
      const par = new T.Mesh(new T.BoxGeometry(pw, 0.7, pd), roofMat);
      par.position.set(x, 0.45 + h + 0.35, z);
      par.castShadow = true;
      city.add(par);
      if (rnd() > 0.45) {
        const bw = 1.6 + rnd() * 1.6, bh = 1.2 + rnd() * 1.4, bd = 1.4 + rnd() * 1.6;
        const box = new T.Mesh(new T.BoxGeometry(bw, bh, bd), roofMat);
        box.position.set(x + (rnd() - 0.5) * (w * 0.4), 0.45 + h + 0.7 + bh / 2, z + (rnd() - 0.5) * (d * 0.4));
        box.castShadow = true;
        city.add(box);
      }
      heat.push({ x: x, z: z, r: Math.max(w, d) * 0.6 });
    }

    function midRise(x, z) {
      const w = 11 + rnd() * 4, d = 11 + rnd() * 4, h = 26 + rnd() * 30;
      addBox(w, h, d, matGlass, x, 0.45, z, true);
      /* 退台 */
      if (rnd() > 0.4) {
        const h2 = 5 + rnd() * 9;
        addBox(w * 0.68, h2, d * 0.68, matGlass, x, 0.45 + h, z, true);
      }
      heat.push({ x: x, z: z, r: Math.max(w, d) * 0.65 });
    }

    function landmark(x, z) {
      const w = 18, d = 18;
      /* 裙房 */
      addBox(w + 6, 12, d + 6, matStone, x, 0.45, z, true);
      /* 塔身：三段收分 */
      let y = 12.45;
      const steps = [[w, 34], [w * 0.82, 22], [w * 0.62, 14]];
      steps.forEach(function (s) {
        addBox(s[0], s[1], s[0], matGlass, x, y, z, true);
        /* 每段顶部石材环 */
        const ring = new T.Mesh(new T.BoxGeometry(s[0] + 1.2, 1.1, s[0] + 1.2), matStone);
        ring.position.set(x, y + s[1] - 0.55, z);
        ring.castShadow = true;
        city.add(ring);
        y += s[1];
      });
      /* 尖顶 */
      const spire = new T.Mesh(new T.ConeGeometry(w * 0.28, 15, 6), matStone);
      spire.position.set(x, y + 7.5, z);
      spire.castShadow = true;
      city.add(spire);
      const tip = new T.Mesh(new T.CylinderGeometry(0.22, 0.34, 10, 6), roofMat);
      tip.position.set(x, y + 15 + 5, z);
      city.add(tip);
      const beacon = new T.Mesh(
        new T.SphereGeometry(0.9, 12, 10),
        new T.MeshBasicMaterial({ color: 0xff5a4a })
      );
      beacon.position.set(x, y + 15 + 10, z);
      city.add(beacon);
      beacons.push(beacon);
      heat.push({ x: x, z: z, r: 16 });
    }

    blocks.forEach(function (b) {
      if (b.i === 0 && b.j === 0) { landmark(b.x, b.z); return; }

      /* 每街区 2×2 地块；中心街区偏高层 */
      const central = Math.abs(b.i) + Math.abs(b.j) === 1;
      for (let s = -1; s <= 1; s += 2) {
        for (let t = -1; t <= 1; t += 2) {
          if (rnd() < 0.10) continue;
          const px = b.x + s * 8.2 + (rnd() - 0.5) * 1.6;
          const pz = b.z + t * 8.2 + (rnd() - 0.5) * 1.6;
          if (!free(px, pz, 7)) continue;
          const tall = central ? rnd() < 0.45 : rnd() < 0.14;
          if (tall) midRise(px, pz); else lowRise(px, pz);
        }
      }
      /* 街区一角的小广场设施：树池 */
      if (rnd() > 0.5) {
        const tx = b.x + (rnd() > 0.5 ? 12 : -12), tz = b.z + (rnd() > 0.5 ? 12 : -12);
        if (free(tx, tz, 3)) {
          const trunk = new T.Mesh(new T.CylinderGeometry(0.28, 0.36, 3.2, 6), new T.MeshStandardMaterial({ color: 0x3a2b22, roughness: 1 }));
          trunk.position.set(tx, 0.45 + 1.6, tz);
          trunk.castShadow = true; city.add(trunk);
          const crown = new T.Mesh(new T.IcosahedronGeometry(2.2, 0), new T.MeshStandardMaterial({ color: 0x2c4a2c, roughness: 1, flatShading: true }));
          crown.position.set(tx, 0.45 + 4.4, tz);
          crown.castShadow = true; city.add(crown);
          heat.push({ x: tx, z: tz, r: 3 });
        }
      }
    });

    /* ---- 路灯 ---- */
    const glowTex = glowTexture(T);
    const poleMat = new T.MeshStandardMaterial({ color: 0x24282d, roughness: 0.7, metalness: 0.5 });
    const lampMat = new T.MeshBasicMaterial({ color: 0xffdca6 });
    const lampGlow = new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.85 });

    function streetLamp(x, z) {
      const pole = new T.Mesh(new T.CylinderGeometry(0.14, 0.18, 8, 6), poleMat);
      pole.position.set(x, 0.45 + 4, z);
      pole.castShadow = true;
      city.add(pole);
      const arm = new T.Mesh(new T.BoxGeometry(1.6, 0.16, 0.16), poleMat);
      arm.position.set(x + 0.8, 0.45 + 7.9, z);
      city.add(arm);
      const lamp = new T.Mesh(new T.BoxGeometry(0.9, 0.16, 0.4), lampMat);
      lamp.position.set(x + 1.5, 0.45 + 7.8, z);
      city.add(lamp);
      const sp = new T.Sprite(lampGlow);
      sp.scale.set(4.5, 4.5, 1);
      sp.position.set(x + 1.5, 0.45 + 7.7, z);
      city.add(sp);
    }
    [-24, 24].forEach(function (rx) {
      for (let k = -3; k <= 3; k++) streetLamp(rx, k * 19 + 9);
      for (let k = -3; k <= 3; k++) streetLamp(k * 19 + 9, rx);
    });

    /* ---- 道路虚线（InstancedMesh 省 draw call） ---- */
    const dashGeo = new T.PlaneGeometry(0.22, 3);
    const dashMat = new T.MeshBasicMaterial({ color: 0xc9c4b4, transparent: true, opacity: 0.55 });
    const dashCount = 2 * 22 * 2;
    const dashes = new T.InstancedMesh(dashGeo, dashMat, dashCount);
    const dummy = new T.Object3D();
    let di = 0;
    [-24, 24].forEach(function (rx) {
      for (let k = -10; k < 11; k++) {
        if (di >= dashCount - 2) break;
        dummy.position.set(rx, 0.04, k * 7);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        dashes.setMatrixAt(di++, dummy.matrix);
        dummy.position.set(k * 7, 0.04, rx);
        dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        dummy.updateMatrix();
        dashes.setMatrixAt(di++, dummy.matrix);
      }
    });
    dashes.count = di;
    dashes.instanceMatrix.needsUpdate = true;
    city.add(dashes);

    /* ---- 相机交互（环绕） ---- */
    const target = new T.Vector3(0, 46, 0);
    let radius = 180, theta = 0.62, phi = 1.2;
    let dragging = false, lastX = 0, lastY = 0, autoSpin = !reduced;

    function placeCamera() {
      const sp = Math.sin(phi), cp = Math.cos(phi);
      camera.position.set(
        target.x + radius * sp * Math.sin(theta),
        target.y + radius * cp,
        target.z + radius * sp * Math.cos(theta)
      );
      camera.lookAt(target);
    }
    placeCamera();

    function onDown(e) {
      dragging = true; autoSpin = false;
      lastX = e.clientX; lastY = e.clientY;
      canvas.classList.add('gg-grabbing');
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (er) {} }
    }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      theta -= dx * 0.005;
      phi = Math.max(0.18, Math.min(1.42, phi - dy * 0.004));
      placeCamera();
    }
    function onUp(e) {
      dragging = false;
      canvas.classList.remove('gg-grabbing');
      if (canvas.releasePointerCapture) { try { canvas.releasePointerCapture(e.pointerId); } catch (er) {} }
    }
    function onWheel(e) {
      e.preventDefault();
      radius = Math.max(45, Math.min(300, radius * Math.exp(e.deltaY * 0.0011)));
      placeCamera();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const unbindResize = bindResize(canvas, camera, renderer);

    /* 场景是静态的：阴影只烘焙一次，之后每帧省掉整张 shadow map */
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    /* ---- 主循环 ---- */
    const clock = new T.Clock();
    let raf = 0, alive = true, lost = false, tAcc = 0;

    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestore() { lost = false; }
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestore);

    function frame() {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (lost) return;
      if (document.hidden || !canvas.isConnected) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      tAcc += dt;
      if (autoSpin) {
        theta += 0.028 * dt;
        placeCamera();
      }
      /* 塔顶航空障碍灯呼吸 */
      const pulse = 0.75 + 0.35 * Math.sin(tAcc * 2.6);
      for (let i = 0; i < beacons.length; i++) beacons[i].scale.setScalar(pulse);
      renderer.render(scene, camera);
    }
    frame();

    return {
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestore);
        unbindResize();
        disposeTree(scene);
        glowTex.dispose();
        if (envRT && envRT.dispose) envRT.dispose();
        renderer.dispose();
        canvas.classList.remove('gg-grabbing');
      }
    };
  }

  /* ============================================================
     对外接口
     ============================================================ */

  window.GaiaStage3D = {
    available: available,
    mount: function (canvas, opts) {
      opts = opts || {};
      if (!available() || !canvas) return fallback(canvas, opts);
      try {
        return mountGlobe(canvas, opts);
      } catch (e) {
        console.warn('[GaiaStage3D] 3D 星球启动失败，回落 Canvas2D：', e);
        return fallback(canvas, opts);
      }
    },
    mountCity: function (canvas, opts) {
      opts = opts || {};
      if (!available() || !canvas) return fallback(canvas, opts);
      try {
        return mountCity(canvas, opts);
      } catch (e) {
        console.warn('[GaiaStage3D] 城市近景启动失败，回落 Canvas2D：', e);
        return fallback(canvas, opts);
      }
    }
  };
})();
