/* ============================================================================
   HUD SCENE — three.js (r128, UMD) holographic globe for the homepage hub.

   Loaded after three.min.js by the conditional loader in index.html. Exposes
   `window.HudScene` and dispatches `hud:scene-ready` once, whether or not
   three.js actually arrived — hud.js checks `window.THREE` and otherwise keeps
   the CSS orb fallback.

   Composition (all additive, unlit, low poly):
     - dark core sphere (depth-writes so back-side wires are hidden)
     - cyan wireframe globe
     - ~800 points on a fibonacci sphere
     - three thin torus rings (cyan / blue / amber) on different axes
     - 72 radial tick segments (reticle) in the equatorial plane
   ============================================================================ */

(function () {
  'use strict';

  var HudScene = {
    supportsWebGL: function () {
      try {
        var c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
      } catch (e) {
        return false;
      }
    },

    mount: function (canvas) {
      var THREE = window.THREE;
      var host = canvas.parentElement;

      var renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
      camera.position.z = 4.2;

      var rig = new THREE.Group();
      scene.add(rig);

      // Core — hides the far hemisphere of the wireframe for a cleaner read
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(0.965, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x03141f, transparent: true, opacity: 0.92 })
      );
      rig.add(core);

      // Wireframe globe
      var globe = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 32, 24)),
        new THREE.LineBasicMaterial({
          color: 0x37d5ff,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      rig.add(globe);

      // Points on a fibonacci sphere
      var COUNT = 800;
      var positions = new Float32Array(COUNT * 3);
      var golden = Math.PI * (3 - Math.sqrt(5));
      for (var i = 0; i < COUNT; i++) {
        var y = 1 - (i / (COUNT - 1)) * 2;
        var r = Math.sqrt(1 - y * y);
        var theta = golden * i;
        positions[i * 3] = Math.cos(theta) * r * 1.012;
        positions[i * 3 + 1] = y * 1.012;
        positions[i * 3 + 2] = Math.sin(theta) * r * 1.012;
      }
      var pointsGeo = new THREE.BufferGeometry();
      pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var points = new THREE.Points(
        pointsGeo,
        new THREE.PointsMaterial({
          color: 0x7ff3ff,
          size: 0.022,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      rig.add(points);

      // Gimbal rings
      function ring(radius, tube, color, opacity) {
        return new THREE.Mesh(
          new THREE.TorusGeometry(radius, tube, 6, 160),
          new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
      }
      var rings = new THREE.Group();
      var r1 = ring(1.32, 0.006, 0x37d5ff, 0.85);
      r1.rotation.x = 1.22;
      var r2 = ring(1.48, 0.005, 0x2f7cff, 0.65);
      r2.rotation.x = 1.4;
      r2.rotation.z = 0.52;
      var r3 = ring(1.62, 0.004, 0xffb347, 0.55);
      r3.rotation.y = 1.05;
      rings.add(r1, r2, r3);
      rig.add(rings);

      // Reticle ticks in the equatorial plane
      var TICKS = 72;
      var tickPos = new Float32Array(TICKS * 6);
      for (var t = 0; t < TICKS; t++) {
        var a = (t / TICKS) * Math.PI * 2;
        var inner = t % 6 === 0 ? 1.72 : 1.76;
        var outer = 1.8;
        tickPos[t * 6] = Math.cos(a) * inner;
        tickPos[t * 6 + 1] = 0;
        tickPos[t * 6 + 2] = Math.sin(a) * inner;
        tickPos[t * 6 + 3] = Math.cos(a) * outer;
        tickPos[t * 6 + 4] = 0;
        tickPos[t * 6 + 5] = Math.sin(a) * outer;
      }
      var tickGeo = new THREE.BufferGeometry();
      tickGeo.setAttribute('position', new THREE.BufferAttribute(tickPos, 3));
      var ticks = new THREE.LineSegments(
        tickGeo,
        new THREE.LineBasicMaterial({
          color: 0x37d5ff,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ticks.rotation.x = 1.25;
      rig.add(ticks);

      // Sizing — the globe (world radius 1) is fitted to the same pixel radius
      // as the CSS orb's sphere, so the radial nav nodes orbit outside it.
      var orbSphere = document.querySelector('.hud-orb__sphere');
      var TAN_HALF_FOV = Math.tan((camera.fov / 2) * Math.PI / 180);
      var OUTER = 1.85; // outermost element (reticle ticks) in world units

      function targetPixelRadius(w, h) {
        var r = 0;
        if (orbSphere) r = orbSphere.getBoundingClientRect().width / 2;
        if (!r) r = Math.min(w, h) * 0.2;
        // Never let the outer rings leave the canvas
        return Math.min(r, (Math.min(w, h) / 2) / OUTER);
      }

      function resize() {
        var rect = canvas.getBoundingClientRect();
        var w = rect.width || host.clientWidth || 300;
        var h = rect.height || host.clientHeight || 300;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        var rPx = targetPixelRadius(w, h);
        camera.position.z = (h / 2) / (rPx * TAN_HALF_FOV);
        camera.updateProjectionMatrix();
      }
      resize();
      var ro = null;
      if (window.ResizeObserver) {
        ro = new ResizeObserver(resize);
        ro.observe(host);
      } else {
        window.addEventListener('resize', resize);
      }

      // Loop
      var clock = new THREE.Clock();
      var targetX = 0, targetY = 0;
      var raf = null;
      var running = false;

      function frame() {
        if (!running) return;
        var dt = Math.min(clock.getDelta(), 0.05);
        globe.rotation.y += 0.08 * dt;
        points.rotation.y += 0.08 * dt;
        core.rotation.y += 0.08 * dt;
        r1.rotation.y += 0.12 * dt;
        r2.rotation.y -= 0.08 * dt;
        r3.rotation.x += 0.05 * dt;
        ticks.rotation.z -= 0.02 * dt;
        rig.rotation.x += (targetY * 0.25 - rig.rotation.x) * 0.05;
        rig.rotation.y += (targetX * 0.35 - rig.rotation.y) * 0.05;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      }

      function resume() {
        if (running) return;
        running = true;
        clock.start();
        raf = requestAnimationFrame(frame);
      }

      function pause() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      }

      resume();

      return {
        pause: pause,
        resume: resume,
        setParallax: function (nx, ny) { targetX = nx; targetY = ny; },
        destroy: function () {
          pause();
          if (ro) ro.disconnect();
          renderer.dispose();
        }
      };
    }
  };

  window.HudScene = HudScene;
  window.dispatchEvent(new Event('hud:scene-ready'));
})();
