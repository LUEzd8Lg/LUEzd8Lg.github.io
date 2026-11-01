/* ============================================================
   gaia-stage3d.js — 盖亚全息星球 · three.js WebGL 舞台
   零构建。window.GaiaStage3D.mount(canvas, opts)      -> { destroy() }
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
    /* 程序化陨石坑贴图（Canvas 生成，不依赖外部文件，file:// 也能用） */
    function makeMoonTexture() {
      const w = 512, h = 256;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#6e1f26';
      g.fillRect(0, 0, w, h);
      /* 大尺度斑驳 */
      for (let i = 0; i < 160; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = 8 + Math.random() * 42;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        if (Math.random() < 0.5) {
          gr.addColorStop(0, 'rgba(122,44,50,0.35)');
          gr.addColorStop(1, 'rgba(122,44,50,0)');
        } else {
          gr.addColorStop(0, 'rgba(40,10,14,0.35)');
          gr.addColorStop(1, 'rgba(40,10,14,0)');
        }
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      /* 陨石坑：亮缘 + 暗心 */
      for (let i = 0; i < 130; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = 2 + Math.random() * 13;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(196,116,104,' + (0.14 + Math.random() * 0.22) + ')';
        g.lineWidth = 1 + Math.random() * 1.5;
        g.stroke();
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(18,4,7,0.5)');
        gr.addColorStop(1, 'rgba(18,4,7,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      const tex = new T.CanvasTexture(c);
      if ('colorSpace' in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      else if ('encoding' in tex && T.sRGBEncoding) tex.encoding = T.sRGBEncoding;
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      return tex;
    }

    const moonPivot = new T.Group();
    moonPivot.rotation.z = 16 * D2R;
    scene.add(moonPivot);
    const moonTex = makeMoonTexture();
    const moon = new T.Mesh(
      new T.SphereGeometry(0.062, 40, 28),
      new T.MeshStandardMaterial({
        map: moonTex,
        emissive: 0x2a070b, emissiveIntensity: 0.3,
        roughness: 0.94, metalness: 0.0
      })
    );
    moon.rotation.z = 0.4;
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
    }
  };
})();
