// Last (Hu)man Standing — WebAR poster (MindAR image tracking + three.js)
//
// Split of work: the 3D layer is spectacle (big shapes, no small text);
// everything people read or tap is regular HTML, either pinned to the poster
// (talk tags) or in the bottom dock, so it stays legible however small the poster is on screen.

const CONFIG = {
  meetup: 'https://www.meetup.com/in-the-loop-ai-product-engineering-meetups/events/317147520/',
  maps: 'https://www.google.com/maps/search/?api=1&query=HUB385%20Zagreb',
  ics: 'assets/last-human-standing.ics',
  target: 'assets/poster.mind',
  eventStart: Date.UTC(2026, 10, 10, 17, 0), // 10 Nov 2026, 18:00 Zagreb (CET)
};

const TALKS = [
  { n: '01', color: '#4a5cff', title: 'Ctrl + Shift + Delegate – AI orkestracija u praksi', speaker: 'Darko Mijić', role: 'Head of AI @ Thespian' },
  { n: '02', color: '#9a5cf0', title: 'Dan s agentom – prijelaz na agentski razvoj, dobre strane i ožiljci', speaker: 'Filip Padežanin', role: 'Software Engineer @ Thespian' },
  { n: '03', color: '#d04fc4', title: 'Building Carry: AI s obje strane aplikacije', speaker: 'Ivan Martinović', role: 'Software Engineer @ Carry' },
];

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- shared UI ---------------- */

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
  document.querySelectorAll('[data-countdown]').forEach((el) => (el.textContent = countdownText()));
}
paintCountdowns();

function showError(msg) {
  const e = $('err');
  e.textContent = msg;
  e.hidden = false;
}

let toastTimer;
function toast(msg, ms = 3800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('off');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('off'), ms);
}

function openLink(url) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w) location.href = url;
}

/* ---------- sheet: one talk, or the whole agenda ---------- */
const sheetBody = $('sheetBody');

function talkRow(t, i) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'agenda-row';
  btn.innerHTML = '<span class="num"></span><span class="agenda-text"><strong></strong><span></span></span>';
  btn.querySelector('.num').textContent = t.n;
  btn.querySelector('.num').style.background = t.color;
  btn.querySelector('strong').textContent = t.title;
  btn.querySelector('.agenda-text > span').textContent = `${t.speaker} · ${t.role}`;
  btn.addEventListener('click', () => openTalk(i));
  return btn;
}

function openAgenda() {
  $('sheetEyebrow').textContent = 'Agenda · utorak u 18:00';
  sheetBody.replaceChildren(...TALKS.map(talkRow));
  showSheet();
}

function openTalk(i) {
  const t = TALKS[i];
  $('sheetEyebrow').textContent = `Predavanje ${i + 1} od ${TALKS.length}`;
  const head = document.createElement('div');
  head.className = 'talk-head';
  head.innerHTML = '<span class="num big"></span><h2 id="sheetTitle"></h2>';
  head.querySelector('.num').textContent = t.n;
  head.querySelector('.num').style.background = t.color;
  head.querySelector('h2').textContent = t.title;
  const who = document.createElement('p');
  who.className = 'who';
  const b = document.createElement('b');
  b.textContent = t.speaker;
  who.append(b, document.createElement('br'), t.role);
  const nav = document.createElement('div');
  nav.className = 'sheet-nav';
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'btn btn-ghost';
  all.textContent = 'Cijela agenda';
  all.addEventListener('click', openAgenda);
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn-ghost';
  next.textContent = i < TALKS.length - 1 ? 'Sljedeće ›' : 'Prvo ›';
  next.addEventListener('click', () => openTalk((i + 1) % TALKS.length));
  nav.append(all, next);
  sheetBody.replaceChildren(head, who, nav);
  showSheet();
}

function showSheet() {
  $('sheet').classList.add('open');
  $('sheet').setAttribute('aria-hidden', 'false');
  $('scrim').classList.add('on');
  document.body.classList.add('sheet-open');
}
function closeSheet() {
  $('sheet').classList.remove('open');
  $('sheet').setAttribute('aria-hidden', 'true');
  $('scrim').classList.remove('on');
  document.body.classList.remove('sheet-open');
}
$('sheetClose').addEventListener('click', closeSheet);
$('scrim').addEventListener('click', closeSheet);
addEventListener('keydown', (e) => e.key === 'Escape' && closeSheet());
$('agendaBtn').addEventListener('click', openAgenda);
document.querySelectorAll('.tag').forEach((el) => el.addEventListener('click', () => openTalk(+el.dataset.i)));

/* ---------------- AR ---------------- */

let ar = null; // { stop }
let launching = false;

async function launch() {
  if (launching || ar) return;
  $('err').hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Ovaj preglednik ne daje pristup kameri. Otvori stranicu u Safariju ili Chromeu na mobitelu.');
    return;
  }
  launching = true;
  // switch to the camera view right away, so loading never looks like a dead button
  closeSheet();
  $('intro').hidden = true;
  $('ar').hidden = false;
  $('hudTop').hidden = false;
  $('hudBottom').hidden = false;
  $('reticle').hidden = false;
  $('reticle').classList.remove('found');
  $('dot').classList.remove('live');
  $('status').textContent = 'Učitavam AR…';
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

$('close').addEventListener('click', () => {
  ar?.stop();
  ar = null;
  teardownUI();
});

function teardownUI() {
  closeSheet();
  $('ar').hidden = true;
  $('hudTop').hidden = true;
  $('hudBottom').hidden = true;
  $('reticle').hidden = true;
  $('tags').hidden = true;
  $('intro').hidden = false;
}

async function startAR() {
  const [THREE, { RoundedBoxGeometry }, { MindARThree }] = await Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('mindar-image-three'),
    document.fonts.load('600 64px Outfit'),
    document.fonts.load('400 64px Outfit'),
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

  /* poster space: target width = 1 unit, origin at centre; poster is 2160×2700 px */
  const PXW = 2160;
  const U = (px) => px / PXW;
  const P = (x, y, z = 0) => new THREE.Vector3(x / PXW - 0.5, 0.625 - y / PXW, z);

  /* occluder: hides anything behind the paper, so objects can rise out of / sink into it */
  const occluder = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.25), new THREE.MeshBasicMaterial({ colorWrite: false }));
  occluder.renderOrder = -1;
  root.add(occluder);

  function canvasPlane(wPx, hPx, draw, { res = 1.2, additive = false } = {}) {
    const c = document.createElement('canvas');
    c.width = Math.round(wPx * res);
    c.height = Math.round(hPx * res);
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const paint = () => {
      ctx.setTransform(res, 0, 0, res, 0, 0);
      ctx.clearRect(0, 0, wPx, hPx);
      draw(ctx, wPx, hPx);
      tex.needsUpdate = true;
    };
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(U(wPx), U(hPx)), mat);
    paint();
    mesh.userData.repaint = paint;
    return mesh;
  }
  const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const FONT = '"Outfit", system-ui, sans-serif';
  const taps = []; // meshes with userData.onTap

  /* ---------- 1. scan sweep + grid ---------- */
  const sweep = canvasPlane(2160, 240, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(154,92,240,0)');
    g.addColorStop(0.75, 'rgba(154,92,240,0.55)');
    g.addColorStop(0.97, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { res: 0.25, additive: true });
  sweep.position.z = 0.002;
  root.add(sweep);

  const grid = canvasPlane(2160, 2700, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(160,170,255,0.5)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= w; x += 108) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 108) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }, { res: 0.5, additive: true });
  grid.position.z = 0.001;
  root.add(grid);

  /* ---------- 2. "man" leaves the title ---------- */
  const slot = canvasPlane(360, 190, (ctx, w, h) => {
    roundRect(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.fillStyle = '#05060f';
    ctx.fill();
    const rim = ctx.createLinearGradient(0, 0, w, 0);
    rim.addColorStop(0, '#7b5cf5');
    rim.addColorStop(1, '#e05ad0');
    ctx.lineWidth = 7;
    ctx.strokeStyle = rim;
    ctx.setLineDash([18, 12]);
    ctx.stroke();
  }, { res: 1.5 });
  slot.position.copy(P(962, 618, 0.0015));
  root.add(slot);

  const glow = canvasPlane(900, 520, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(170,90,240,0.6)');
    g.addColorStop(1, 'rgba(170,90,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { res: 0.4, additive: true });
  const man = canvasPlane(440, 260, (ctx, w) => {
    ctx.font = `600 172px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const g = ctx.createLinearGradient(60, 0, w - 60, 0);
    g.addColorStop(0, '#8a6bff');
    g.addColorStop(1, '#ff6ae6');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillText('man', w / 2, 190);
  }, { res: 3 });
  const manGroup = new THREE.Group();
  manGroup.position.copy(P(961, 613));
  manGroup.add(glow, man);
  root.add(manGroup);

  /* ---------- 3. agent swarm from the logo ---------- */
  const AGENT_COLORS = [0x22c6f0, 0xf7c62f, 0xf0447a, 0x4a5cff];
  const agentGeo = new RoundedBoxGeometry(U(58), U(58), U(58), 2, U(12));
  const agents = [];
  const logo = P(214, 211, 0);
  const titleCenter = P(1000, 640, 0);
  const AGENTS = 22;
  for (let i = 0; i < AGENTS; i++) {
    const col = AGENT_COLORS[i % 4];
    const m = new THREE.Mesh(agentGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.1 }));
    m.userData = {
      delay: 0.5 + i * 0.07,
      a: U(980 + Math.random() * 260),
      b: U(230 + Math.random() * 140),
      tilt: 0.08 + Math.random() * 0.08,
      speed: (0.28 + Math.random() * 0.2) * (i % 2 ? 1 : -1),
      phase: (i / AGENTS) * Math.PI * 2,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2),
      scale: 0.75 + Math.random() * 0.5,
    };
    m.scale.setScalar(0.001);
    root.add(m);
    agents.push(m);
  }

  /* ---------- 4. talk tiles (3D) + row tap areas ---------- */
  const ROWS = [
    { badge: [240, 1062], top: 930, bottom: 1222 },
    { badge: [240, 1358], top: 1226, bottom: 1597 },
    { badge: [240, 1732], top: 1600, bottom: 1894 },
  ];
  const badges = ROWS.map((r, i) => {
    const t = TALKS[i];
    const depth = U(60);
    const g = new THREE.Group();
    const box = new THREE.Mesh(
      new RoundedBoxGeometry(U(128), U(128), depth, 4, U(24)),
      new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.35, metalness: 0.05, emissive: t.color, emissiveIntensity: 0.3 }),
    );
    const face = canvasPlane(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 58px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.n, w / 2, h / 2 + 3);
    }, { res: 3 });
    face.position.z = depth / 2 + 0.0008;
    g.add(box, face);
    g.position.copy(P(r.badge[0], r.badge[1], -depth));
    g.userData = { depth, delay: 0.35 + i * 0.18, i };
    root.add(g);

    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(U(1810), U(r.bottom - r.top)),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.position.copy(P(176 + 905, (r.top + r.bottom) / 2, 0.005));
    hit.userData.onTap = () => openTalk(i);
    root.add(hit);
    taps.push(hit);
    return g;
  });

  /* ---------- 5. big countdown over the QR band ---------- */
  const countdown = canvasPlane(1840, 400, (ctx, w, h) => {
    roundRect(ctx, 4, 4, w - 8, h - 8, 56);
    ctx.fillStyle = 'rgba(16,19,42,0.94)';
    ctx.fill();
    const edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, '#4a5cff');
    edge.addColorStop(0.5, '#9a5cf0');
    edge.addColorStop(1, '#d04fc4');
    ctx.lineWidth = 8;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 190px ${FONT}`;
    ctx.fillStyle = edge;
    ctx.fillText(cap(countdownText()), 80, 222);
    ctx.font = `500 76px ${FONT}`;
    ctx.fillStyle = '#c4c7d6';
    ctx.fillText('Utorak u 18:00 · HUB385', 84, 332);
  }, { res: 0.9 });
  countdown.userData.onTap = () => { location.href = CONFIG.ics; };
  countdown.material.opacity = 0;
  root.add(countdown);
  taps.push(countdown);

  /* ---------- HTML tags pinned to the talk rows ---------- */
  const tagsEl = $('tags');
  const tagEls = [...tagsEl.querySelectorAll('.tag')];
  const tagAnchors = [1140, 1512, 1808].map((y) => P(1990, y, 0.03)); // speaker lines: shorter than titles
  const edgeA = P(0, 1350), edgeB = P(2160, 1350);
  const proj = new THREE.Vector3();

  function toScreen(v, rect) {
    proj.copy(v).applyMatrix4(root.matrixWorld).project(camera);
    return [rect.left + ((proj.x + 1) / 2) * rect.width, rect.top + ((1 - proj.y) / 2) * rect.height];
  }

  function placeTags(t) {
    const show = root.visible && t > 1.2;
    tagsEl.hidden = !show;
    if (!show) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const [ax] = toScreen(edgeA, rect);
    const [bx] = toScreen(edgeB, rect);
    const posterW = Math.abs(bx - ax);
    const s = Math.min(1.1, Math.max(0.72, posterW / 360));
    const maxX = innerWidth - 10;
    tagEls.forEach((el, i) => {
      const [x, y] = toScreen(tagAnchors[i], rect);
      el.style.transform = `translate(${Math.min(x, maxX).toFixed(1)}px, ${y.toFixed(1)}px) translate(-100%, -50%) scale(${s.toFixed(3)})`;
    });
  }

  /* ---------- animation ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const back = (t) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const clock = new THREE.Clock();
  let foundAt = -1;
  let lostAt = 0;
  const tmp = new THREE.Vector3();

  function animate() {
    const now = clock.getElapsedTime();
    if (foundAt < 0 || !root.visible) { tagsEl.hidden = true; return; }
    const t = reduceMotion ? now - foundAt + 10 : now - foundAt;

    // sweep + grid
    const sp = clamp(t / 1.1);
    sweep.visible = sp < 1;
    sweep.position.y = 0.625 + U(120) - sp * (1.25 + U(240));
    grid.material.opacity = sp < 1 ? 0.4 * Math.sin(sp * Math.PI) : 0;
    grid.visible = grid.material.opacity > 0.001;

    // "man" flies out of the title towards the viewer
    const mp = easeOut(clamp((t - 0.6) / 1.3));
    slot.material.opacity = clamp((t - 0.5) / 0.3);
    man.material.opacity = clamp((t - 0.5) / 0.3);
    man.position.set(0, mp * U(220), 0.003 + mp * 0.2 + Math.sin(t * 1.6) * 0.008 * mp);
    man.scale.setScalar(1 + mp * 0.6);
    glow.position.set(0, man.position.y, man.position.z - 0.02);
    glow.scale.setScalar(1 + mp * 0.6);
    glow.material.opacity = mp * (0.45 + 0.15 * Math.sin(t * 2.2));
    manGroup.rotation.y = Math.sin(t * 0.9) * 0.15 * mp;

    // agents: leave the logo, settle into a wide tilted orbit that passes through the paper
    for (const a of agents) {
      const d = a.userData;
      const k = easeOut(clamp((t - d.delay) / 1.4));
      const ang = d.phase + t * d.speed;
      tmp.set(
        titleCenter.x + Math.cos(ang) * d.a,
        titleCenter.y + Math.sin(ang) * d.b,
        0.06 + Math.sin(ang) * d.tilt,
      );
      a.position.lerpVectors(logo, tmp, k);
      a.position.z += Math.sin(k * Math.PI) * 0.16;
      a.scale.setScalar(Math.max(0.001, d.scale * clamp((t - d.delay) / 0.3)));
      a.rotation.set(t * d.spin.x, t * d.spin.y, t * d.spin.z);
    }

    // talk tiles pop out of the paper
    for (const b of badges) {
      const d = b.userData;
      const k = clamp((t - d.delay) / 0.7);
      const lift = back(k);
      b.position.z = -d.depth + lift * (d.depth / 2 + U(110)) + Math.sin(t * 2 + d.i) * 0.004 * k;
      b.scale.setScalar(1 + 0.45 * easeOut(k));
      b.rotation.x = Math.sin(t * 1.3 + d.i) * 0.14 * k;
      b.rotation.y = Math.cos(t * 1.1 + d.i) * 0.22 * k;
    }

    // countdown card rises over the QR band
    const ck = clamp((t - 1.1) / 0.7);
    countdown.material.opacity = easeOut(ck);
    countdown.position.copy(P(1080, 2110 - easeOut(ck) * 40, 0.004 + back(ck) * 0.07 + Math.sin(t * 1.4) * 0.004));

    scene.updateMatrixWorld();
    placeTags(t);
  }

  /* ---------- tracking state ---------- */
  root.visible = false;
  let everFound = false;
  anchor.onTargetFound = () => {
    if (foundAt < 0 || clock.getElapsedTime() - lostAt > 6) foundAt = clock.getElapsedTime();
    $('reticle').classList.add('found');
    $('dot').classList.add('live');
    $('status').textContent = 'Poster pronađen';
    if (!everFound) {
      everFound = true;
      navigator.vibrate?.(12);
      setTimeout(() => toast('Dodirni „Detalji“ uz predavanje'), 1800);
    }
  };
  anchor.onTargetLost = () => {
    lostAt = clock.getElapsedTime();
    tagsEl.hidden = true;
    $('reticle').classList.remove('found');
    $('dot').classList.remove('live');
    $('status').textContent = 'Tražim poster…';
  };

  /* ---------- taps on the 3D layer ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onTap = (e) => {
    if (!root.visible || $('sheet').classList.contains('open')) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(taps, false);
    if (hits.length) hits[0].object.userData.onTap?.();
  };
  container.addEventListener('click', onTap);

  /* ---------- go ---------- */
  $('status').textContent = 'Pokrećem kameru…';
  await mindar.start();
  $('status').textContent = 'Tražim poster…';
  renderer.setAnimationLoop(() => {
    animate();
    renderer.render(scene, camera);
  });

  const tick = setInterval(() => { countdown.userData.repaint(); paintCountdowns(); }, 60000);

  return {
    stop() {
      clearInterval(tick);
      renderer.setAnimationLoop(null);
      container.removeEventListener('click', onTap);
      try { mindar.stop(); } catch {}
      renderer.dispose();
      container.replaceChildren();
    },
  };
}
