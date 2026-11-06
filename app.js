// Last (Hu)man Standing — WebAR poster (MindAR image tracking + three.js)
//
// When the camera finds the poster, a copy of the invitation peels off the paper,
// flies towards the viewer until it fills the screen, and hands over to a full-screen
// HTML invitation (sharp text, real buttons) with its own entrance animation.

const CONFIG = {
  meetup: 'https://www.meetup.com/in-the-loop-ai-product-engineering-meetups/events/317147520/',
  maps: 'https://www.google.com/maps/search/?api=1&query=HUB385%20Zagreb',
  target: 'assets/poster.mind',
  posterImage: 'assets/poster-ar.png',
  eventStart: Date.UTC(2026, 10, 10, 17, 0), // 10 Nov 2026, 18:00 Zagreb (CET)
};
const COLORS = ['#22c6f0', '#f7c62f', '#f0447a', '#4a5cff', '#9a5cf0'];

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- shared bits ---------------- */

document.querySelectorAll('[data-link="meetup"]').forEach((a) => (a.href = CONFIG.meetup));
document.querySelectorAll('[data-link="maps"]').forEach((a) => (a.href = CONFIG.maps));

function countdownText(now = Date.now()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' });
  const day = (t) => Date.parse(fmt.format(t));
  const days = Math.round((day(CONFIG.eventStart) - day(now)) / 86400000);
  const diff = CONFIG.eventStart - now;
  if (diff < -3 * 3600e3) return 'održano';
  if (diff <= 0) return 'upravo traje';
  if (days === 0) return 'danas';
  if (days === 1) return 'sutra';
  return `za ${days} ${days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana'}`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function paintCountdowns() {
  document.querySelectorAll('[data-countdown-cap]').forEach((el) => (el.textContent = cap(countdownText())));
}
paintCountdowns();
setInterval(paintCountdowns, 60000);

function showError(msg) {
  const e = $('err');
  e.textContent = msg;
  e.hidden = false;
}

/* ---------------- floating "agents" behind the invitation ---------------- */

const fx = (() => {
  const canvas = $('fx');
  const ctx = canvas.getContext('2d');
  let parts = [], raf = 0, last = 0, w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function spawn(burst) {
    parts = Array.from({ length: 24 }, (_, i) => {
      const p = {
        x: burst ? w / 2 + (Math.random() - 0.5) * w * 0.5 : Math.random() * w,
        y: burst ? h * 0.45 + (Math.random() - 0.5) * h * 0.4 : Math.random() * h,
        size: 7 + Math.random() * 20,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 1.4,
        alpha: 0.18 + Math.random() * 0.32,
        dx: (Math.random() - 0.5) * 14,
        dy: -(6 + Math.random() * 22),
      };
      if (burst) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 250 + Math.random() * 650;
        p.vx = Math.cos(ang) * sp;
        p.vy = Math.sin(ang) * sp;
      } else {
        p.vx = p.dx;
        p.vy = p.dy;
      }
      return p;
    });
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      const s = p.size;
      const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.18, p.color);
      g.addColorStop(1, p.color);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.22);
      ctx.fill();
      ctx.restore();
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const m = 40;
    for (const p of parts) {
      const k = Math.min(1, dt * 2.4); // drag towards the slow drift
      p.vx += (p.dx - p.vx) * k;
      p.vy += (p.dy - p.vy) * k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y < -m) { p.y = h + m; p.x = Math.random() * w; }
      if (p.x < -m) p.x = w + m;
      if (p.x > w + m) p.x = -m;
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  return {
    start(burst) {
      cancelAnimationFrame(raf);
      resize();
      spawn(burst && !reduceMotion);
      if (reduceMotion) { draw(); return; }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    resize,
  };
})();
addEventListener('resize', () => fx.resize());

/* ---------------- invitation ---------------- */

const invite = $('invite');
function showInvite({ solid = false } = {}) {
  invite.classList.toggle('solid', solid);
  invite.hidden = false;
  invite.querySelector('.inv-scroll').scrollTop = 0;
  // restart the entrance choreography every time
  invite.classList.remove('show');
  void invite.offsetWidth;
  invite.classList.add('show');
  fx.start(!solid);
  $('hudTop').hidden = true;
  $('hudBottom').hidden = true;
  $('reticle').hidden = true;
}
function hideInvite() {
  invite.classList.remove('show');
  invite.hidden = true;
  fx.stop();
}
$('openInvite').addEventListener('click', () => showInvite({ solid: true }));
$('replay').addEventListener('click', () => {
  hideInvite();
  if (ar) ar.rescan();
  else launch();
});

/* ---------------- camera / AR ---------------- */

let ar = null; // { stop, rescan, skip }
let launching = false;

async function launch() {
  if (launching || ar) return;
  $('err').hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Ovaj preglednik ne daje pristup kameri. Otvori stranicu u Safariju ili Chromeu na mobitelu.');
    return;
  }
  launching = true;
  hideInvite();
  $('intro').hidden = true;
  $('ar').hidden = false;
  showScanUI('Učitavam AR…');
  try {
    // ask for the camera first, so a refusal gets a clear message
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    stream.getTracks().forEach((t) => t.stop());
    ar = await startAR();
  } catch (e) {
    console.error(e);
    teardownUI();
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    const noCam = e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError');
    showError(denied
      ? 'Pristup kameri je odbijen. Dopusti kameru za ovu stranicu (ikona lokota pokraj adrese) i pokušaj ponovno.'
      : noCam
        ? 'Nije pronađena kamera. Otvori ovu stranicu na mobitelu.'
        : 'AR se nije uspio pokrenuti. Provjeri vezu i pokušaj ponovno.');
  } finally {
    launching = false;
  }
}
$('start').addEventListener('click', launch);

// Visitors arriving from the poster's QR code are on a phone: start the camera without an extra tap.
if (matchMedia('(pointer: coarse)').matches) launch();

function showScanUI(status) {
  $('hudTop').hidden = false;
  $('hudBottom').hidden = false;
  $('reticle').hidden = false;
  $('reticle').classList.remove('found');
  $('dot').classList.remove('live');
  $('status').textContent = status;
}

$('close').addEventListener('click', () => {
  ar?.stop();
  ar = null;
  teardownUI();
});
$('skip').addEventListener('click', () => (ar ? ar.skip() : showInvite({ solid: true })));

function teardownUI() {
  hideInvite();
  $('ar').hidden = true;
  $('hudTop').hidden = true;
  $('hudBottom').hidden = true;
  $('reticle').hidden = true;
  $('intro').hidden = false;
}

async function startAR() {
  const [THREE, { RoundedBoxGeometry }, { MindARThree }] = await Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('mindar-image-three'),
  ]);

  const container = $('ar');
  container.replaceChildren();

  const mindar = new MindARThree({
    container,
    imageTargetSrc: CONFIG.target,
    uiLoading: 'no',
    uiScanning: 'no',
    uiError: 'no',
    filterMinCF: 0.0001,
    filterBeta: 0.004,
    warmupTolerance: 3,
    missTolerance: 8,
  });
  const { renderer, scene, camera } = mindar;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f60, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(0.4, 0.8, 1.2);
  scene.add(sun);

  const anchor = mindar.addAnchor(0);
  const root = anchor.group;

  const posterTex = await new THREE.TextureLoader().loadAsync(CONFIG.posterImage);
  posterTex.colorSpace = THREE.SRGBColorSpace;
  posterTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* ---------- scan sweep + grid on the paper ---------- */
  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.11),
    new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      map: canvasTexture(8, 128, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(154,92,240,0)');
        g.addColorStop(0.75, 'rgba(154,92,240,0.6)');
        g.addColorStop(0.97, 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }),
    }),
  );
  sweep.position.z = 0.002;
  root.add(sweep);

  const grid = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.25),
    new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      map: canvasTexture(1080, 1350, (ctx, w, h) => {
        ctx.strokeStyle = 'rgba(160,170,255,0.55)';
        ctx.lineWidth = 2;
        for (let x = 0; x <= w; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y <= h; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      }),
    }),
  );
  grid.position.z = 0.001;
  root.add(grid);

  /* ---------- the flying invitation ---------- */
  const flyer = new THREE.Group();
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.25),
    new THREE.MeshBasicMaterial({ map: posterTex, transparent: true, toneMapped: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.45),
    new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      map: canvasTexture(480, 580, (ctx, w, h) => {
        const pad = 40;
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#4a5cff');
        g.addColorStop(0.5, '#9a5cf0');
        g.addColorStop(1, '#d04fc4');
        ctx.filter = 'blur(16px)';
        ctx.strokeStyle = g;
        ctx.lineWidth = 26;
        ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
        ctx.filter = 'none';
        ctx.lineWidth = 4;
        ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
      }),
    }),
  );
  halo.position.z = -0.002;
  flyer.add(halo, card);
  flyer.visible = false;
  scene.add(flyer);

  /* ---------- burst of agent cubes ---------- */
  const cubeGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
  const cubes = Array.from({ length: 26 }, (_, i) => {
    const col = COLORS[i % COLORS.length];
    const m = new THREE.Mesh(cubeGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.3 }));
    m.visible = false;
    m.userData = { p0: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), size: 0 };
    scene.add(m);
    return m;
  });

  /* ---------- choreography ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clock = new THREE.Clock();

  let phase = 'scan'; // scan → reveal (on paper) → flight → done
  let t0 = 0;
  let paused = false;
  const start = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3() };
  const lift = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const end = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 };
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  let handedOver = false;
  let armedAt = 0;

  // where the card must sit (camera at origin, looking down -z) to fill the visible screen
  function computeEndPose() {
    const e = camera.projectionMatrix.elements;
    const d = 1;
    const rect = renderer.domElement.getBoundingClientRect();
    const halfW = d / e[0], halfH = d / e[5];
    const visW = 2 * halfW * (innerWidth / rect.width);
    const visH = 2 * halfH * (innerHeight / rect.height);
    end.scale = Math.min((visW * 0.94) / 1, (visH * 0.86) / 1.25);
    const cx = ((innerWidth / 2 - rect.left) / rect.width) * 2 - 1;
    const cy = 1 - ((innerHeight / 2 - rect.top) / rect.height) * 2;
    end.pos.set(cx * halfW, cy * halfH, -d);
    end.quat.identity();
  }

  function beginFlight(now) {
    root.updateMatrixWorld(true);
    root.matrixWorld.decompose(start.pos, start.quat, start.scale);
    const s0 = start.scale.x;
    tmpV.set(0, 0, 1).applyQuaternion(start.quat);
    lift.pos.copy(start.pos).addScaledVector(tmpV, 0.16 * s0);
    lift.quat.copy(start.quat).multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.18));
    computeEndPose();
    flyer.position.copy(start.pos);
    flyer.quaternion.copy(start.quat);
    flyer.scale.setScalar(s0);
    card.material.opacity = 0;
    halo.material.opacity = 0;
    flyer.visible = true;

    // cubes start on the paper and burst towards the viewer
    const dist = start.pos.length();
    cubes.forEach((c) => {
      const u = c.userData;
      u.p0.set((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.15, 0.02).multiplyScalar(s0).applyQuaternion(start.quat).add(start.pos);
      u.v.copy(u.p0).multiplyScalar(-(0.45 + Math.random() * 0.35));
      u.v.x += (Math.random() - 0.5) * dist * 0.9;
      u.v.y += (Math.random() - 0.5) * dist * 1.2;
      u.spin.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      u.size = s0 * (0.035 + Math.random() * 0.04);
      u.delay = 0.3 + Math.random() * 0.35;
      c.position.copy(u.p0);
      c.scale.setScalar(0.0001);
      c.visible = true;
    });
    phase = 'flight';
    t0 = now;
    handedOver = false;
  }

  function finish() {
    phase = 'done';
    flyer.visible = false;
    cubes.forEach((c) => (c.visible = false));
    sweep.visible = false;
    grid.visible = false;
    if (!paused) {
      try { mindar.pause(true); paused = true; } catch {}
    }
  }

  function animate() {
    const now = clock.getElapsedTime();

    // start the reveal whenever the poster is tracked and we're armed (covers rescans while it stays in view)
    if (phase === 'scan' && root.visible && now > armedAt) {
      if (reduceMotion) { phase = 'done'; showInvite(); return; }
      navigator.vibrate?.(12);
      phase = 'reveal';
      t0 = now;
    }

    if (phase === 'reveal') {
      const t = now - t0;
      const sp = clamp(t / 0.9);
      sweep.visible = sp < 1;
      sweep.position.y = 0.68 - sp * 1.36;
      grid.visible = true;
      grid.material.opacity = 0.45 * Math.sin(clamp(t / 1.0) * Math.PI);
      if (t > 0.75) beginFlight(now);
      return;
    }

    if (phase !== 'flight') return;
    const u = now - t0;
    const s0 = start.scale.x;
    grid.material.opacity = Math.max(0, grid.material.opacity - 0.03);

    // 1) peel off the paper
    if (u < 0.55) {
      const k = easeOut(u / 0.55);
      flyer.position.lerpVectors(start.pos, lift.pos, k);
      flyer.quaternion.slerpQuaternions(start.quat, lift.quat, k);
      flyer.scale.setScalar(s0 * (1 + 0.04 * k));
      card.material.opacity = clamp(u / 0.15);
      halo.material.opacity = k;
    } else {
      // 2) fly to the camera and fill the screen
      const k = easeInOut(clamp((u - 0.55) / 0.95));
      flyer.position.lerpVectors(lift.pos, end.pos, k);
      flyer.position.y += Math.sin(k * Math.PI) * 0.08 * s0; // slight arc
      flyer.quaternion.slerpQuaternions(lift.quat, end.quat, k);
      flyer.scale.setScalar(THREE.MathUtils.lerp(s0 * 1.04, end.scale, k));
      halo.material.opacity = 1 - 0.6 * k;
      // 3) hand over to the HTML invitation
      if (u > 1.3 && !handedOver) {
        handedOver = true;
        showInvite();
      }
      if (u > 1.4) card.material.opacity = 1 - clamp((u - 1.4) / 0.35);
      halo.material.opacity *= card.material.opacity;
    }

    for (const c of cubes) {
      const d = c.userData;
      const a = clamp((u - d.delay) / 1.3);
      if (a <= 0) continue;
      c.position.copy(d.p0).addScaledVector(d.v, easeOut(a));
      c.scale.setScalar(Math.max(0.0001, d.size * Math.sin(Math.min(1, a * 1.15) * Math.PI) * 1.4));
      c.rotation.set(d.spin.x * a, d.spin.y * a, d.spin.z * a);
      c.visible = a < 1;
    }

    if (u > 1.9) finish();
  }

  /* ---------- tracking ---------- */
  anchor.onTargetFound = () => {
    $('reticle').classList.add('found');
    $('dot').classList.add('live');
    $('status').textContent = 'Poster pronađen';
  };
  anchor.onTargetLost = () => {
    $('reticle').classList.remove('found');
    $('dot').classList.remove('live');
    $('status').textContent = 'Tražim poster…';
    if (phase === 'reveal') { // lost before lift-off: start over when it is found again
      phase = 'scan';
      sweep.visible = false;
      grid.visible = false;
    }
  };

  /* ---------- go ---------- */
  sweep.visible = false;
  grid.visible = false;
  $('status').textContent = 'Pokrećem kameru…';
  await mindar.start();
  $('status').textContent = 'Tražim poster…';
  renderer.setAnimationLoop(() => {
    animate();
    renderer.render(scene, camera);
  });

  return {
    rescan() {
      finish();
      phase = 'scan';
      armedAt = clock.getElapsedTime() + 0.6; // let tracking settle after unpausing
      if (paused) {
        try { mindar.unpause(); } catch {}
        paused = false;
      }
      showScanUI('Tražim poster…');
    },
    skip() {
      finish();
      showInvite();
    },
    stop() {
      renderer.setAnimationLoop(null);
      try { mindar.stop(); } catch {}
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
