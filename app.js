// Last (Hu)man Standing — WebAR poster (MindAR image tracking + three.js)

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
document.querySelectorAll('[data-countdown]').forEach((el) => (el.textContent = countdownText()));

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

/* talk sheet */
let sheetIndex = 0;
function openSheet(i) {
  sheetIndex = i;
  const t = TALKS[i];
  $('sheetNum').textContent = t.n;
  $('sheetNum').style.background = t.color;
  $('sheetEyebrow').textContent = `Predavanje ${i + 1} od ${TALKS.length}`;
  $('sheetTitle').textContent = t.title;
  const who = $('sheetWho');
  who.replaceChildren();
  const b = document.createElement('b');
  b.textContent = t.speaker;
  who.append(b, ` · ${t.role}`);
  $('sheetNext').textContent = i < TALKS.length - 1 ? 'Sljedeće' : 'Prvo';
  $('sheet').classList.add('open');
  $('sheet').setAttribute('aria-hidden', 'false');
  $('scrim').classList.add('on');
}
function closeSheet() {
  $('sheet').classList.remove('open');
  $('sheet').setAttribute('aria-hidden', 'true');
  $('scrim').classList.remove('on');
}
$('sheetClose').addEventListener('click', closeSheet);
$('scrim').addEventListener('click', closeSheet);
$('sheetNext').addEventListener('click', () => openSheet((sheetIndex + 1) % TALKS.length));
addEventListener('keydown', (e) => e.key === 'Escape' && closeSheet());

/* ---------------- AR ---------------- */

let ar = null; // { mindar, stop }

$('start').addEventListener('click', async () => {
  $('err').hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Ovaj preglednik ne daje pristup kameri. Otvori stranicu u Safariju ili Chromeu na mobitelu.');
    return;
  }
  const btn = $('start');
  btn.disabled = true;
  btn.lastChild.textContent = ' Učitavam…';
  try {
    ar = await startAR();
  } catch (e) {
    console.error(e);
    teardownUI();
    const denied = e && (e.name === 'NotAllowedError' || /denied|permission/i.test(String(e.message)));
    showError(denied
      ? 'Pristup kameri je odbijen. Dopusti kameru u postavkama preglednika i pokušaj ponovno.'
      : 'AR se nije uspio pokrenuti. Provjeri vezu i pokušaj ponovno.');
  } finally {
    btn.disabled = false;
    btn.lastChild.textContent = ' Pokreni AR kameru';
  }
});

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
  container.hidden = false;
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
    const paint = () => {
      ctx.setTransform(res, 0, 0, res, 0, 0);
      ctx.clearRect(0, 0, wPx, hPx);
      draw(ctx, wPx, hPx);
      tex.needsUpdate = true;
    };
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(U(wPx), U(hPx)), mat);
    paint();
    mesh.userData.repaint = paint;
    return mesh;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

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
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 108) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 108) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }, { res: 0.5, additive: true });
  grid.position.z = 0.001;
  root.add(grid);

  /* ---------- 2. "man" lifts off the title ---------- */
  // the printed word is covered by a cut-out slot, so it reads as having left the paper
  const slot = canvasPlane(360, 190, (ctx, w, h) => {
    roundRect(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.fillStyle = '#05060f';
    ctx.fill();
    const rim = ctx.createLinearGradient(0, 0, w, 0);
    rim.addColorStop(0, '#7b5cf5');
    rim.addColorStop(1, '#e05ad0');
    ctx.lineWidth = 5;
    ctx.strokeStyle = rim;
    ctx.setLineDash([16, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
    const sh = ctx.createLinearGradient(0, 6, 0, 70);
    sh.addColorStop(0, 'rgba(0,0,0,0.9)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    roundRect(ctx, 8, 8, w - 16, 64, 22);
    ctx.fill();
  }, { res: 1.5 });
  slot.position.copy(P(962, 618, 0.0015));
  root.add(slot);

  const glow = canvasPlane(620, 360, (ctx, w, h) => {
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
    g.addColorStop(0, '#7b5cf5');
    g.addColorStop(1, '#e05ad0');
    ctx.fillStyle = g;
    ctx.fillText('man', w / 2, 190);
  }, { res: 2 });
  const manGroup = new THREE.Group();
  manGroup.position.copy(P(961, 613));

  manGroup.add(glow, man);
  root.add(manGroup);

  /* ---------- 3. agent swarm from the logo ---------- */
  const AGENT_COLORS = [0x22c6f0, 0xf7c62f, 0xf0447a, 0x4a5cff];
  const agentGeo = new RoundedBoxGeometry(U(30), U(30), U(30), 2, U(6));
  const agents = [];
  const logo = P(214, 211, 0);
  const titleCenter = P(980, 625, 0);
  for (let i = 0; i < 28; i++) {
    const col = AGENT_COLORS[i % 4];
    const m = new THREE.Mesh(agentGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.1 }));
    m.userData = {
      delay: 0.5 + i * 0.06,
      a: U(820 + Math.random() * 220),
      b: U(150 + Math.random() * 90),
      tilt: 0.05 + Math.random() * 0.05,
      speed: (0.32 + Math.random() * 0.22) * (i % 2 ? 1 : -1),
      phase: (i / 28) * Math.PI * 2,
      spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2),
      scale: 0.7 + Math.random() * 0.6,
    };
    m.scale.setScalar(0.001);
    root.add(m);
    agents.push(m);
  }

  /* ---------- 4. talk badges + hit areas ---------- */
  const ROWS = [
    { badge: [240, 1062], pill: 1131, top: 930, bottom: 1222 },
    { badge: [240, 1358], pill: 1504, top: 1226, bottom: 1597 },
    { badge: [240, 1732], pill: 1800, top: 1600, bottom: 1894 },
  ];
  const badges = [];
  ROWS.forEach((r, i) => {
    const t = TALKS[i];
    const depth = U(46);
    const g = new THREE.Group();
    const box = new THREE.Mesh(
      new RoundedBoxGeometry(U(128), U(128), depth, 4, U(24)),
      new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.35, metalness: 0.05, emissive: t.color, emissiveIntensity: 0.25 }),
    );
    const face = canvasPlane(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 54px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.n, w / 2, h / 2 + 3);
    }, { res: 3 });
    face.position.z = depth / 2 + 0.0008;
    g.add(box, face);
    g.position.copy(P(r.badge[0], r.badge[1], -depth));
    g.userData = { base: P(r.badge[0], r.badge[1], 0), depth, delay: 0.35 + i * 0.18, i };
    root.add(g);
    badges.push(g);

    const pill = canvasPlane(250, 80, (ctx, w, h) => {
      roundRect(ctx, 1, 1, w - 2, h - 2, h / 2);
      ctx.fillStyle = 'rgba(13,17,36,0.92)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = t.color;
      ctx.stroke();
      ctx.fillStyle = '#f3f1ec';
      ctx.font = `600 34px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText('Detalji', 36, h / 2 + 2);
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(w - 40, h / 2, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w - 40, h / 2 - 10); ctx.lineTo(w - 40, h / 2 + 10);
      ctx.moveTo(w - 50, h / 2); ctx.lineTo(w - 30, h / 2);
      ctx.stroke();
    }, { res: 2 });
    pill.position.copy(P(1985 - 125, r.pill, 0.012));
    pill.userData.delay = 0.9 + i * 0.15;
    pill.material.opacity = 0;
    root.add(pill);
    badges[i].userData.pill = pill;

    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(U(1810), U(r.bottom - r.top)),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.position.copy(P(176 + 905, (r.top + r.bottom) / 2, 0.005));
    hit.userData.onTap = () => openSheet(i);
    root.add(hit);
    taps.push(hit);
  });

  /* ---------- 5. QR halo ---------- */
  const halo = canvasPlane(380, 380, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#4a5cff');
    g.addColorStop(0.5, '#9a5cf0');
    g.addColorStop(1, '#d04fc4');
    ctx.strokeStyle = g;
    ctx.lineWidth = 10;
    roundRect(ctx, 20, 20, w - 40, h - 40, 40);
    ctx.stroke();
  }, { res: 1, additive: true });
  halo.position.copy(P(1835, 2098, 0.004));
  root.add(halo);

  /* ---------- 6. footer cards ---------- */
  const CARDS = [
    { x: 160, w: 735, color: '#4a5cff', label: 'KADA', value: 'Utorak, 10. studenoga', sub: () => `18:00 · ${countdownText()}`, cta: 'Dodaj u kalendar', onTap: () => { location.href = CONFIG.ics; } },
    { x: 945, w: 485, color: '#9a5cf0', label: 'GDJE', value: 'HUB385', sub: () => 'Zagreb', cta: 'Otvori kartu', onTap: () => openLink(CONFIG.maps) },
    { x: 1477, w: 528, color: '#d04fc4', label: 'ULAZ', value: 'Besplatan', sub: () => 'Uz prijavu', cta: 'Prijavi se', primary: true, onTap: () => openLink(CONFIG.meetup) },
  ];
  const cardTop = 2282, cardH = 300;
  const cards = CARDS.map((c, i) => {
    const m = canvasPlane(c.w, cardH, (ctx, w, h) => {
      roundRect(ctx, 2, 2, w - 4, h - 4, 30);
      ctx.fillStyle = 'rgba(20,24,50,0.96)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.color + '99';
      ctx.stroke();
      ctx.fillStyle = c.color;
      roundRect(ctx, 30, 2, 90, 7, 4);
      ctx.fill();
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#8e93ab';
      ctx.font = `600 30px ${FONT}`;
      ctx.letterSpacing = '5px';
      ctx.fillText(c.label, 30, 62);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = '#f3f1ec';
      ctx.font = `600 ${c.w > 600 ? 56 : 54}px ${FONT}`;
      ctx.fillText(c.value, 30, 132);
      ctx.fillStyle = '#c4c7d6';
      ctx.font = `400 40px ${FONT}`;
      ctx.fillText(c.sub(), 30, 186);
      // CTA
      ctx.font = `600 34px ${FONT}`;
      const tw = ctx.measureText(c.cta).width;
      const bw = tw + 84, bh = 64, bx = 30, by = h - bh - 26;
      roundRect(ctx, bx, by, bw, bh, bh / 2);
      if (c.primary) {
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, '#9a5cf0');
        g.addColorStop(1, '#d04fc4');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = c.color + '33';
      }
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.cta, bx + 28, by + bh / 2 + 2);
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.moveTo(bx + bw - 44, by + bh / 2 - 9);
      ctx.lineTo(bx + bw - 35, by + bh / 2);
      ctx.lineTo(bx + bw - 44, by + bh / 2 + 9);
      ctx.stroke();
    }, { res: 1.4 });
    m.userData.base = P(c.x + c.w / 2, cardTop + cardH / 2, 0);
    m.userData.delay = 1.1 + i * 0.14;
    m.userData.onTap = c.onTap;
    m.material.opacity = 0;
    root.add(m);
    taps.push(m);
    return m;
  });

  /* ---------- animation ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const back = (t) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const clock = new THREE.Clock();
  let foundAt = -1;
  const tmp = new THREE.Vector3();

  function animate() {
    const now = clock.getElapsedTime();
    if (foundAt < 0 || !root.visible) return;
    const t = reduceMotion ? now - foundAt + 10 : now - foundAt;

    // sweep + grid
    const sp = clamp(t / 1.1);
    sweep.visible = sp < 1;
    sweep.position.y = 0.625 + U(120) - sp * (1.25 + U(240));
    grid.material.opacity = sp < 1 ? 0.35 * Math.sin(sp * Math.PI) : 0;
    grid.visible = grid.material.opacity > 0.001;

    // "man" lift
    const mp = easeOut(clamp((t - 0.6) / 1.2));
    slot.material.opacity = clamp((t - 0.5) / 0.3);
    man.position.z = 0.003 + mp * 0.11 + Math.sin(t * 1.6) * 0.005 * mp;
    man.position.y = mp * U(150);
    man.scale.setScalar(1 + mp * 0.12);
    man.material.opacity = clamp((t - 0.5) / 0.3);
    glow.position.y = man.position.y;
    glow.position.z = man.position.z - 0.01;
    glow.material.opacity = mp * (0.45 + 0.15 * Math.sin(t * 2.2));
    manGroup.rotation.y = Math.sin(t * 0.9) * 0.12 * mp;

    // agents: leave the logo, settle into a tilted orbit that passes through the paper
    for (const a of agents) {
      const d = a.userData;
      const k = easeOut(clamp((t - d.delay) / 1.4));
      const ang = d.phase + t * d.speed;
      tmp.set(
        titleCenter.x + Math.cos(ang) * d.a,
        titleCenter.y + Math.sin(ang) * d.b,
        0.035 + Math.sin(ang) * d.tilt,
      );
      a.position.lerpVectors(logo, tmp, k);
      a.position.z += Math.sin(k * Math.PI) * 0.12;
      a.scale.setScalar(Math.max(0.001, d.scale * clamp((t - d.delay) / 0.3)));
      a.rotation.set(t * d.spin.x, t * d.spin.y, t * d.spin.z);
    }

    // badges rise out of the paper
    for (const b of badges) {
      const d = b.userData;
      const k = clamp((t - d.delay) / 0.7);
      const lift = back(k);
      b.position.z = -d.depth + lift * (d.depth / 2 + U(34)) + Math.sin(t * 2 + d.i) * 0.003 * k;
      b.rotation.x = Math.sin(t * 1.3 + d.i) * 0.12 * k;
      b.rotation.y = Math.cos(t * 1.1 + d.i) * 0.18 * k;
      const pill = d.pill;
      const pk = easeOut(clamp((t - pill.userData.delay) / 0.5));
      pill.material.opacity = pk;
      pill.position.z = 0.004 + pk * 0.014;
    }

    // footer cards
    for (const c of cards) {
      const k = clamp((t - c.userData.delay) / 0.6);
      c.material.opacity = easeOut(k);
      c.position.copy(c.userData.base);
      c.position.z = 0.003 + back(k) * 0.03 + Math.sin(t * 1.5 + c.userData.delay * 5) * 0.002;
      c.position.y -= (1 - easeOut(k)) * U(60);
    }

    halo.material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3));
  }

  /* ---------- tracking state ---------- */
  root.visible = false;
  let everFound = false;
  anchor.onTargetFound = () => {
    root.visible = true;
    if (foundAt < 0 || clock.getElapsedTime() - lostAt > 6) foundAt = clock.getElapsedTime();
    $('reticle').classList.add('found');
    $('dot').classList.add('live');
    $('status').textContent = 'Poster pronađen';
    if (!everFound) {
      everFound = true;
      navigator.vibrate?.(12);
      setTimeout(() => toast('Dodirni predavanje ili karticu na posteru'), 1600);
    }
  };
  let lostAt = 0;
  anchor.onTargetLost = () => {
    lostAt = clock.getElapsedTime();
    $('reticle').classList.remove('found');
    $('dot').classList.remove('live');
    $('status').textContent = 'Tražim poster…';
  };

  /* ---------- taps ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onTap = (e) => {
    if (!root.visible || $('sheet').classList.contains('open')) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(taps, false);
    if (hits.length) {
      // cards sit in front of row hit areas; pick the nearest
      hits[0].object.userData.onTap?.();
    }
  };
  container.addEventListener('click', onTap);

  /* ---------- go ---------- */
  $('intro').hidden = true;
  $('hudTop').hidden = false;
  $('hudBottom').hidden = false;
  $('reticle').hidden = false;
  $('reticle').classList.remove('found');
  $('status').textContent = 'Pokrećem kameru…';

  await mindar.start();
  $('status').textContent = 'Tražim poster…';
  renderer.setAnimationLoop(() => {
    animate();
    renderer.render(scene, camera);
  });

  // refresh countdown on cards once a minute
  const tick = setInterval(() => cards[0].userData.repaint(), 60000);

  return {
    mindar,
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
