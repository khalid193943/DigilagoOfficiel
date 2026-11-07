// LAGO, allume le Maroc : le moteur de plateforme (canevas, physique, lumière).
(() => {
'use strict';
const A = window.ASSETS, SND = window.SND;
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const dk = document.createElement('canvas'), dkx = dk.getContext('2d');
let DPR = 1, SW = 1, SH = 1, SC = 1, VW = 1, VH = 1;

// ─── réglages ───────────────────────────────────────────────────────────────────────────────
const GRAV = 2800, RUN = 390, ACC_G = 3400, ACC_A = 2100, FRIC = 3000, JUMP = 1000, DJUMP = 900, MAXFALL = 1250;
const COYOTE = .11, BUFFER = .14, PW = 54, PH = 112, PIT = 560, LIGHT_R = 240, GRAB_R = 480, BURST_R = 200;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + Math.random() * (b - a);

// ─── images : chaque dessin SVG est converti une fois en image, à la taille de l'écran ──────────
const SPEC = {}, SPR = {};
const LAGO_VB = [100, 40, 560, 740];
function spec(key, svg, vb, s, ax, ay, tint) { SPEC[key] = { svg, vb, s, ax, ay, tint }; }
Object.keys(A).filter(k => k.startsWith('p_')).forEach(k => spec(k, A[k], LAGO_VB, .2, 380, 746));
spec('radar', A.radar_salut, LAGO_VB, .2, 380, 746);
spec('gestion', A.gestion_tablette, LAGO_VB, .17, 380, 746);
['h_salma', 'h_youssef', 'h_mehdi'].forEach(k => spec(k, A[k], [60, 20, 640, 760], .24, 380, 746));
spec('cumulus', A.cumulus, [0, 0, 120, 100], 1.3, 60, 92);
const winFill = (s, c) => s.replace(/<rect class="win"([^>]*?)fill="#[0-9A-Fa-f]{6}"/g, `<rect class="win"$1fill="${c}"`);
const doorFill = (s, c) => s.replace(/<rect class="door"([^>]*?)fill="#[0-9A-Fa-f]{6}"/g, `<rect class="door"$1fill="${c}"`);
Object.entries(A.facade).forEach(([k, f]) => {
  spec('f_' + k, doorFill(winFill(f, '#1A2B5C'), '#2B3557'), [0, 0, 300, 380], .68, 150, 370);
  spec('f_' + k + '_on', winFill(f, '#FFE3A3'), [0, 0, 300, 380], .68, 150, 370);
});
A.tower.forEach((t, i) => {
  spec('tower' + i, t.replace(/fill="#FFE3A3"/g, 'fill="#24407E"'), [0, 0, 240, 600], 1.1, 120, 600);
  spec('tower' + i + '_on', t, [0, 0, 240, 600], 1.1, 120, 600);
});
spec('bg_medina', A.bg_medina, [0, 0, 1600, 830], .95, 0, 0);
spec('bg_affaires', A.bg_affaires, [0, 0, 1600, 830], .95, 0, 0, 'night');

let rasterSC = 0;
function svgImage(key, pxW, pxH) {
  const S = SPEC[key];
  const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${S.vb.join(' ')}" width="${pxW}" height="${pxH}"><defs>${A.defs}</defs>${S.svg}</svg>`;
  return new Promise(res => {
    const im = new Image();
    const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); res(null); };
    im.src = url;
  });
}
async function raster(key) {
  const S = SPEC[key], big = key.startsWith('bg_');
  const ww = S.vb[2] * S.s, wh = S.vb[3] * S.s;
  let k = SC * DPR * (big ? .55 : 1);
  const pxW = Math.max(8, Math.min(big ? 2200 : 1100, Math.ceil(ww * k))), pxH = Math.max(8, Math.ceil(pxW * S.vb[3] / S.vb[2]));
  const im = await svgImage(key, pxW, pxH);
  if (!im) return;
  const c = document.createElement('canvas'); c.width = pxW; c.height = pxH;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, pxW, pxH);
  if (S.tint === 'night') { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(8,18,52,.62)'; x.fillRect(0, 0, pxW, pxH); }
  SPR[key] = { c, w: ww, h: wh, ax: (S.ax - S.vb[0]) * S.s, ay: (S.ay - S.vb[1]) * S.s };
}
async function rasterAll(onProgress) {
  const keys = Object.keys(SPEC); let n = 0;
  rasterSC = SC;
  for (let i = 0; i < keys.length; i += 6) {
    await Promise.all(keys.slice(i, i + 6).map(raster));
    n = Math.min(keys.length, i + 6); onProgress && onProgress(n / keys.length);
  }
}

// ─── écran ──────────────────────────────────────────────────────────────────────────────────
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1); SW = window.innerWidth; SH = window.innerHeight;
  cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR);
  SC = Math.min(SH / 560, SW / 480); VW = SW / SC; VH = SH / SC;
  dk.width = Math.ceil(SW / 2); dk.height = Math.ceil(SH / 2);
  if (rasterSC && Math.abs(SC / rasterSC - 1) > .22) { rasterSC = SC; Object.keys(SPEC).forEach(k => raster(k)); }
}
window.addEventListener('resize', resize); resize();

// ─── commandes ──────────────────────────────────────────────────────────────────────────────
const IN = { l: 0, r: 0, j: 0, a: 0, jp: 0, ap: 0 };
const KEYS = { ArrowLeft: 'l', KeyA: 'l', KeyQ: 'l', ArrowRight: 'r', KeyD: 'r', Space: 'j', ArrowUp: 'j', KeyW: 'j', KeyZ: 'j',
  KeyX: 'a', KeyE: 'a', KeyJ: 'a', KeyK: 'a', Enter: 'a', ShiftLeft: 'a', ShiftRight: 'a' };
window.addEventListener('keydown', e => {
  const k = KEYS[e.code]; if (!k || !G.running) return;
  e.preventDefault();
  if (!IN[k]) { if (k === 'j') IN.jp = 1; if (k === 'a') IN.ap = 1; }
  IN[k] = 1;
});
window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) IN[k] = 0; });
window.addEventListener('blur', () => { IN.l = IN.r = IN.j = IN.a = 0; });
function bindPad(root) {
  root.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k, ids = new Set();
    const on = e => { e.preventDefault(); ids.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch (_) {} if (!IN[k]) { if (k === 'j') IN.jp = 1; if (k === 'a') IN.ap = 1; } IN[k] = 1; b.classList.add('on'); };
    const off = e => { ids.delete(e.pointerId); if (!ids.size) { IN[k] = 0; b.classList.remove('on'); } };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
}

// ─── état ───────────────────────────────────────────────────────────────────────────────────
const G = { running: false, paused: false, hold: false, t: 0, P: null, lvl: null, partIdx: 0, pl: null, cam: { x: 0, y: -300 }, parts: [], abil: new Set(),
  maxHearts: 3, hearts: 3, fx: [], stars: [], dawn: 0, end: 0, cb: {}, burstCd: 0, msgT: 0, shake: 0, lastHud: '' };
const S = () => G.P;
function mainShops() { return G.P.shops.filter(s => !s.bonus); }
function litRatio() { const m = G.P.shops; return m.length ? m.filter(s => s.lit).length / m.length : 0; }

function newPlayer(x, y) {
  return { x, y, vx: 0, vy: 0, face: 1, onG: false, gRef: null, coyote: 0, buf: 0, dbl: true, inv: 0, hurt: 0, act: 0, actShop: null, grap: null,
    safe: { x, y }, safeT: 0, runD: 0, sq: 1, air: 0, cut: false, orb: { x: x - 40, y: y - 150 } };
}

function load(level, partIdx, save) {
  G.lvl = level; G.partIdx = partIdx;
  const P = JSON.parse(JSON.stringify(level.parts[partIdx]));
  G.P = P;
  if (save) {
    (save.lit || []).forEach(id => { const s = P.shops.find(z => z.id === id); if (s) { s.lit = true; s.glow = 1; } });
    (save.got || []).forEach(i => { if (P.sparks[i]) P.sparks[i].got = true; });
    (save.npcs || []).forEach(id => { const n = P.npcs.find(z => z.id === id); if (n) n.done = true; });
    (save.dead || []).forEach(i => { if (P.shadows[i]) P.shadows[i].alive = false; });
    P.hidden.forEach(h => { if (P.shops.find(s => s.id === h.by && s.lit)) h.a = 1; });
    P.lamps.forEach(l => { if (P.shops.find(s => s.id === l.by && s.lit)) l.on = true; });
  }
  const st = save && save.check ? save.check : P.start;
  P.checks.forEach(c => { if (save && save.check && Math.abs(c.x - st.x) < 2) c.on = true; });
  if (!save || !save.check) P.checks[0] && (P.checks[0].on = true);
  G.check = { x: st.x, y: st.y };
  G.pl = newPlayer(st.x, st.y);
  G.cam.x = st.x - VW * .35; G.cam.y = st.y - VH * .62;
  G.fx = []; G.dawn = 0; G.end = 0; G.t = 0; G.hold = false; G.msgT = 0;
  G.hearts = G.maxHearts; G.hits = 0;
  G.stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * .75, r: rnd(.4, 1.4), a: rnd(.25, .9), tw: rnd(0, 6) }));
  buildMid();
  G.startT = performance.now();
  hud(true);
}
function partSave() {
  const P = G.P;
  return { check: G.check, lit: P.shops.filter(s => s.lit).map(s => s.id), got: P.sparks.map((s, i) => s.got ? i : -1).filter(i => i >= 0),
    npcs: P.npcs.filter(n => n.done).map(n => n.id), dead: P.shadows.map((s, i) => s.alive ? -1 : i).filter(i => i >= 0) };
}

// ─── décor du plan intermédiaire (silhouettes) ───────────────────────────────────────────────
function buildMid() {
  const P = G.P, items = []; let x = -600; let seed = 7;
  const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const end = P.len * .6 + 2400;
  while (x < end) {
    if (P.theme === 'medina') { const w = 150 + r() * 160, h = 200 + r() * 260; items.push({ x, w, h, k: 'house', win: Math.floor(r() * 4), seed: r() }); x += w - 10; }
    else if (P.theme === 'corniche') { const w = 220 + r() * 300; items.push({ x, w, h: 0, k: 'palm', seed: r() }); x += w; }
    else { const w = 120 + r() * 140, h = 380 + r() * 520; items.push({ x, w, h, k: 'tower', seed: r() }); x += w + 20 + r() * 60; }
  }
  G.mid = items;
}

// ─── boucle ─────────────────────────────────────────────────────────────────────────────────
let last = 0, acc = 0, raf = 0;
function frame(ts) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (G.running && !G.paused && !G.hold) { acc += dt; while (acc >= 1 / 120) { step(1 / 120); acc -= 1 / 120; } }
  else acc = 0;
  if (G.running) render(dt);
}
function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } G.running = true; }
function stop() { G.running = false; }

// ─── physique ───────────────────────────────────────────────────────────────────────────────
const over = (ax, ay, aw, ah, b) => ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
function step(dt) {
  const P = G.P, pl = G.pl;
  G.t += dt;
  // plateformes mobiles
  P.movers.forEach(m => {
    const ph = (G.t / m.period) % 1, d = m.dwell || 0;
    // un ascenseur marque une pause en bas et en haut, le temps de monter ou de descendre
    const k = !d ? .5 - .5 * Math.cos(2 * Math.PI * ph)
      : ph < d ? 0 : ph < .5 ? .5 - .5 * Math.cos(Math.PI * (ph - d) / (.5 - d)) : ph < .5 + d ? 1 : .5 + .5 * Math.cos(Math.PI * (ph - .5 - d) / (.5 - d));
    const nx = m.x0 + m.dx * k, ny = m.y0 + m.dy * k;
    m.ddx = nx - m.x; m.ddy = ny - m.y; m.x = nx; m.y = ny;
  });
  P.hidden.forEach(h => { const on = P.shops.find(s => s.id === h.by && s.lit); h.a = clamp(h.a + (on ? dt * 1.6 : -dt * 2), 0, 1); });
  P.shops.forEach(s => { if (s.lit) s.glow = Math.min(1, s.glow + dt * 1.2); });
  P.bubbles.forEach(b => { b.sq = Math.max(0, b.sq - dt * 3); });
  G.burstCd = Math.max(0, G.burstCd - dt);
  G.msgT = Math.max(0, G.msgT - dt);
  if (G.end) { G.dawn = Math.min(1, G.dawn + dt * .35); updateFx(dt); camera(dt); return; }
  // le joueur porté par une plateforme mobile
  if (pl.onG && pl.gRef) { pl.x += pl.gRef.ddx; pl.y += pl.gRef.ddy; }
  const lock = pl.act > 0;
  const dir = lock ? 0 : (IN.r ? 1 : 0) - (IN.l ? 1 : 0);
  if (IN.jp) { pl.buf = BUFFER; IN.jp = 0; }
  if (IN.ap) { IN.ap = 0; action(); }
  if (pl.grap) grappleStep(dt, dir);
  else {
    const acc = pl.onG ? ACC_G : ACC_A;
    if (dir) {
      pl.face = dir;
      if (Math.abs(pl.vx) > RUN && Math.sign(pl.vx) === dir) pl.vx = dir * Math.max(RUN, Math.abs(pl.vx) - FRIC * dt * .5); // élan d'un rebond : il retombe doucement
      else pl.vx = clamp(pl.vx + dir * acc * dt, -RUN, RUN);
    }
    else if (pl.onG) { const f = FRIC * dt; pl.vx = Math.abs(pl.vx) <= f ? 0 : pl.vx - Math.sign(pl.vx) * f; }
    else pl.vx *= Math.pow(.6, dt);
  }
  // saut, double saut (Cumulus)
  pl.buf = Math.max(0, pl.buf - dt);
  if (pl.buf > 0 && !lock) {
    if (pl.grap) { releaseGrap(true); pl.buf = 0; }
    else if (pl.onG || pl.coyote > 0) { pl.vy = -JUMP; pl.onG = false; pl.gRef = null; pl.coyote = 0; pl.buf = 0; pl.cut = false; pl.sq = 1.18; SND.play('jump'); dust(pl.x, pl.y, 5); }
    else if (G.abil.has('double') && pl.dbl) { pl.vy = -DJUMP; pl.dbl = false; pl.buf = 0; pl.cut = false; pl.sq = 1.15; SND.play('dbl'); puff(pl.x, pl.y); }
  }
  if (!IN.j && pl.vy < -380 && !pl.bounced) pl.cut = true;
  if (!pl.grap) {
    const g = GRAV * (pl.vy > 0 ? 1.12 : 1) * (pl.cut ? 1.9 : 1);
    pl.vy = Math.min(MAXFALL, pl.vy + g * dt);
  }
  if (pl.vy >= 0) pl.bounced = false;
  const wasG = pl.onG, vyBefore = pl.vy;
  move(dt);
  if (pl.grap && pl.onG) releaseGrap(false);
  if (pl.onG) {
    pl.coyote = COYOTE; pl.dbl = true;
    if (!wasG) { pl.sq = .82 + Math.max(0, .1 - vyBefore / 12000); if (vyBefore > 650) { SND.play('land'); dust(pl.x, pl.y, 7); } }
    if (!pl.gRef) { pl.safeT += dt; if (pl.safeT > .25) { pl.safe = { x: pl.x, y: pl.y }; pl.safeT = 0; } }
  } else { pl.coyote = Math.max(0, pl.coyote - dt); pl.safeT = 0; }
  pl.sq = lerp(pl.sq, 1, 1 - Math.exp(-12 * dt));
  if (pl.onG && Math.abs(pl.vx) > 30) pl.runD += Math.abs(pl.vx) * dt;
  pl.inv = Math.max(0, pl.inv - dt); pl.hurt = Math.max(0, pl.hurt - dt);
  if (pl.act > 0) { const before = pl.act; pl.act -= dt; if (before > .32 && pl.act <= .32 && pl.actShop) lightShop(pl.actShop); }
  // la lanterne suit Lago
  const ox = pl.x - pl.face * 50, oy = pl.y - PH - 34 + Math.sin(G.t * 2.6) * 6;
  const tx = pl.act > 0 && pl.actShop ? lerp(ox, pl.actShop.x, clamp((.7 - pl.act) / .38, 0, 1)) : ox;
  const ty = pl.act > 0 && pl.actShop ? lerp(oy, pl.actShop.by - 190, clamp((.7 - pl.act) / .38, 0, 1)) : oy;
  pl.orb.x = lerp(pl.orb.x, tx, 1 - Math.exp(-10 * dt)); pl.orb.y = lerp(pl.orb.y, ty, 1 - Math.exp(-10 * dt));
  interact(dt);
  enemies(dt);
  updateFx(dt);
  if (pl.y > PIT) fall();
  camera(dt);
  hud();
}

function solidsAll() { return G.P.solids; }
function move(dt) {
  const P = G.P, pl = G.pl;
  // horizontal
  pl.x += pl.vx * dt;
  for (const s of P.solids) {
    if (over(pl.x - PW / 2, pl.y - PH, PW, PH - 2, s)) {
      if (pl.x < s.x + s.w / 2) pl.x = s.x - PW / 2; else pl.x = s.x + s.w + PW / 2;
      pl.vx = 0;
    }
  }
  if (pl.x < -320) { pl.x = -320; pl.vx = 0; }
  // vertical
  const prev = pl.y;
  pl.y += pl.vy * dt;
  pl.onG = false; const oldRef = pl.gRef; pl.gRef = null;
  for (const s of P.solids) {
    if (over(pl.x - PW / 2, pl.y - PH, PW, PH, s)) {
      if (pl.vy >= 0 && prev <= s.y + 6) { pl.y = s.y; pl.vy = 0; pl.onG = true; }
      else if (pl.vy < 0) { pl.y = s.y + s.h + PH; pl.vy = 0; }
    }
  }
  if (pl.vy >= 0) {
    const tops = P.oneway.concat(P.hidden.filter(h => h.a > .6), P.movers);
    for (const s of tops) {
      const top = s.y, prevTop = s.ddy !== undefined ? s.y - s.ddy : s.y;
      if (pl.x + PW / 2 > s.x + 4 && pl.x - PW / 2 < s.x + s.w - 4 && prev <= prevTop + 6 && pl.y >= top) {
        pl.y = top; pl.vy = 0; pl.onG = true; if (s.ddy !== undefined) pl.gRef = s;
      }
    }
  }
}

function grappleStep(dt, dir) {
  const pl = G.pl, g = pl.grap;
  pl.vy = Math.min(MAXFALL, pl.vy + GRAV * dt);
  let hx = pl.x, hy = pl.y - PH * .7;
  let dx = hx - g.x, dy = hy - g.y, d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  let tx = -ny, ty = nx; if (tx < 0) { tx = -tx; ty = -ty; }
  if (dir) { pl.vx += tx * dir * 1250 * dt; pl.vy += ty * dir * 1250 * dt; pl.face = dir; }
  if (g.L > 300) g.L = Math.max(300, g.L - 220 * dt);
  // la corde ne s'allonge pas : on retire la vitesse qui éloigne de l'épingle
  const vr = pl.vx * nx + pl.vy * ny;
  if (d >= g.L - 1 && vr > 0) { pl.vx -= vr * nx; pl.vy -= vr * ny; }
  const sp = Math.hypot(pl.vx, pl.vy); if (sp > 1500) { pl.vx *= 1500 / sp; pl.vy *= 1500 / sp; }
  // après le déplacement, la position est ramenée sur le cercle (fait dans move via correction)
  const px = pl.x + pl.vx * dt, py = pl.y - PH * .7 + pl.vy * dt;
  const ddx = px - g.x, ddy = py - g.y, dd = Math.hypot(ddx, ddy);
  if (dd > g.L) { const k = g.L / dd; pl.vx = (g.x + ddx * k - pl.x) / dt; pl.vy = (g.y + ddy * k - (pl.y - PH * .7)) / dt; }
}
function releaseGrap(jump) {
  const pl = G.pl; if (!pl.grap) return;
  pl.grap = null; pl.dbl = true;
  if (jump) { pl.vy = Math.min(pl.vy, 0) - 520; pl.vx *= 1.1; pl.bounced = true; SND.play('jump'); }
}

// ─── actions ────────────────────────────────────────────────────────────────────────────────
function nearShop() {
  const pl = G.pl;
  return G.P.shops.find(s => !s.lit && Math.abs(pl.x - s.x) < 92 && Math.abs(pl.y - s.by) < 30);
}
function nearAnchor() {
  if (!G.abil.has('pin')) return null;
  const pl = G.pl; let best = null, bd = GRAB_R;
  G.P.anchors.forEach(a => { const d = Math.hypot(a.x - pl.x, a.y - (pl.y - PH * .7)); if (a.y < pl.y - PH * .5 && d < bd) { bd = d; best = a; } });
  return best;
}
function action() {
  const pl = G.pl;
  if (pl.act > 0) return;
  if (pl.grap) { releaseGrap(false); return; }
  const s = pl.onG && nearShop();
  if (s) { pl.act = .7; pl.actShop = s; pl.vx = 0; SND.play('chime'); return; }
  const a = nearAnchor();
  if (a) { const d = Math.hypot(a.x - pl.x, a.y - (pl.y - PH * .7)); pl.grap = { x: a.x, y: a.y, L: Math.max(160, d) }; pl.onG = false; SND.play('grapple'); return; }
  if (G.burstCd > 0) return;
  G.burstCd = .65; SND.play('burst');
  G.fx.push({ k: 'ring', x: pl.orb.x, y: pl.orb.y, r: 20, life: .45, max: .45 });
  G.P.shadows.forEach(sh => { if (sh.alive && Math.hypot(sh.x - pl.orb.x, sh.y - 30 - pl.orb.y) < BURST_R + 40) killShadow(sh); });
}
function lightShop(s) {
  if (s.lit) return;
  s.lit = true; s.glow = 0; s.pin = 0;
  const P = G.P;
  P.lamps.forEach(l => { if (l.by === s.id) l.on = true; });
  SND.play('online'); G.shake = .25;
  for (let i = 0; i < 46; i++) G.fx.push({ k: 'spark', x: s.x + rnd(-110, 110), y: s.by - rnd(40, 300), vx: rnd(-200, 200), vy: rnd(-420, -60), life: rnd(.6, 1.3), max: 1.3, c: Math.random() < .7 ? '#FFD36B' : '#9FC8FF' });
  G.cb.shop && G.cb.shop(s, P.shops.filter(z => !z.bonus && z.lit).length, mainShops().length);
  hud(true);
}

// ─── rencontres, objets, sortie ──────────────────────────────────────────────────────────────
function interact(dt) {
  const P = G.P, pl = G.pl;
  for (let i = 0; i < P.sparks.length; i++) {
    const s = P.sparks[i]; if (s.got) continue;
    const d = Math.hypot(s.x - pl.x, s.y - (pl.y - PH / 2));
    if (d < 120) { s.x = lerp(s.x, pl.x, Math.min(1, dt * (d < 70 ? 14 : 4))); s.y = lerp(s.y, pl.y - PH / 2, Math.min(1, dt * (d < 70 ? 14 : 4))); }
    if (d < 40) { s.got = true; SND.play('spark'); G.fx.push({ k: 'spark', x: s.x, y: s.y, vx: 0, vy: -60, life: .35, max: .35, c: '#FFE08A' }); hud(true); }
  }
  // bulle WhatsApp, ballon : il suffit de les toucher pour rebondir, par le dessus, le côté ou le dessous
  P.bubbles.forEach(b => {
    b.cd = Math.max(0, (b.cd || 0) - dt);
    const by = b.y + Math.sin(G.t * 2.4 + b.x) * 5;
    if (!b.cd && pl.vy > -700 && Math.abs(pl.x - b.x) < 34 + PW / 2 && pl.y > by - 36 && pl.y - PH < by + 34) {
      if (pl.grap) releaseGrap(false);
      // la même hauteur de rebond, quel que soit l'endroit touché
      pl.vy = -Math.sqrt(2 * GRAV * Math.max(240, pl.y - (by - (b.kind === 'ball' ? 360 : 400)))); pl.onG = false; pl.gRef = null; pl.coyote = 0;
      pl.bounced = true; pl.dbl = true; pl.cut = false; b.sq = 1; b.cd = .3; SND.play('bounce');
      G.fx.push({ k: 'ring', x: b.x, y: by, r: 30, life: .3, max: .3 });
    }
  });
  P.checks.forEach(c => {
    if (!c.on && Math.abs(pl.x - c.x) < 60 && Math.abs(pl.y - c.y) < 70) {
      P.checks.forEach(z => z.cur = false); c.on = true; c.cur = true; G.check = { x: c.x, y: c.y };
      G.hearts = G.maxHearts; SND.play('stamp'); G.cb.check && G.cb.check(partSave()); hud(true);
    }
  });
  P.npcs.forEach(n => {
    if (!n.done && Math.abs(pl.x - n.x) < 110 && Math.abs(pl.y - n.y) < 90 && pl.onG && !G.hold) {
      n.done = true; G.hold = true; IN.l = IN.r = 0; pl.vx = 0;
      Promise.resolve(G.cb.npc ? G.cb.npc(n) : null).then(() => {
        if (n.gives === 'heart') { G.maxHearts = 4; G.hearts = 4; }
        if (n.gives) G.abil.add(n.gives);
        G.hold = false; hud(true); G.cb.check && G.cb.check(partSave());
      });
    }
  });
  const ex = P.exit;
  if (Math.abs(pl.x - ex.x) < 80 && Math.abs(pl.y - ex.y) < 60 && pl.onG) {
    const left = mainShops().filter(s => !s.lit).length;
    const deal = P.npcs.find(n => n.deal && !n.ok);
    if (left) { if (!G.msgT) { G.cb.toast && G.cb.toast(left === 1 ? 'Encore 1 commerce éteint : suis la flèche du Radar.' : `Encore ${left} commerces éteints : suis la flèche du Radar.`); G.msgT = 3.5; } }
    else if (deal) { if (!G.msgT) { G.cb.toast && G.cb.toast('Parle d’abord à Youssef.'); G.msgT = 3; } }
    else finishPart();
  }
}
function finishPart() {
  const P = G.P;
  G.end = 1; G.pl.vx = 0; IN.l = IN.r = 0;
  const st = { sparks: P.sparks.filter(s => s.got && !s.bonus).length, total: P.sparks.filter(s => !s.bonus).length, lit: mainShops().length, bonus: P.shops.filter(s => s.bonus && s.lit).length,
    bonusTotal: P.shops.filter(s => s.bonus).length, hits: G.hits, time: Math.round((performance.now() - G.startT) / 1000), id: P.id, name: P.name };
  P.shops.forEach(s => { if (!s.lit) { s.lit = true; s.glow = 0; } });
  SND.play('success');
  for (let i = 0; i < 90; i++) G.fx.push({ k: 'spark', x: G.pl.x + rnd(-400, 400), y: G.pl.y - rnd(100, 600), vx: rnd(-160, 160), vy: rnd(-300, 40), life: rnd(1, 2.4), max: 2.4, c: ['#FFD36B', '#9FC8FF', '#3DDC97', '#fff'][i % 4] });
  setTimeout(() => G.cb.partDone && G.cb.partDone(st), P.exit.kind === 'beacon' ? 3600 : 1700);
}

// ─── ombres de l'Oubli ───────────────────────────────────────────────────────────────────────
function enemies(dt) {
  const P = G.P, pl = G.pl;
  P.shadows.forEach(sh => {
    if (!sh.alive) return;
    sh.t += dt;
    if (sh.kind === 'walk') { sh.x += sh.dir * sh.speed * dt; if (sh.x > sh.x2) { sh.x = sh.x2; sh.dir = -1; } if (sh.x < sh.x1) { sh.x = sh.x1; sh.dir = 1; } }
    else { sh.x = sh.cx + Math.sin(sh.t * .9 * sh.speed) * sh.ax; sh.y = sh.cy + Math.sin(sh.t * 1.7 * sh.speed) * sh.ay; }
    const w = sh.kind === 'walk' ? 64 : 58, h = sh.kind === 'walk' ? 58 : 46;
    const top = sh.kind === 'walk' ? sh.y - h : sh.y - h / 2;
    if (pl.x + PW / 2 > sh.x - w / 2 && pl.x - PW / 2 < sh.x + w / 2 && pl.y > top && pl.y - PH < top + h) {
      if (pl.vy > 100 && pl.y - top < 30) { killShadow(sh); pl.vy = -760; pl.bounced = true; pl.dbl = true; pl.cut = false; pl.y = top; }
      else if (pl.inv <= 0) hurt(Math.sign(pl.x - sh.x) || -pl.face);
    }
  });
}
function killShadow(sh) {
  sh.alive = false; SND.play('poof');
  for (let i = 0; i < 16; i++) G.fx.push({ k: 'fly', x: sh.x + rnd(-24, 24), y: sh.y - rnd(10, 50), vx: rnd(-50, 50), vy: rnd(-120, -30), life: rnd(1.2, 2.2), max: 2.2, ph: rnd(0, 6) });
  // l'ombre libère trois étincelles
  for (let i = 0; i < 3; i++) G.P.sparks.push({ x: sh.x + (i - 1) * 34, y: (sh.kind === 'walk' ? sh.y - 70 : sh.y) - 20, got: false, bonus: true });
}
function hurt(dir) {
  const pl = G.pl;
  if (pl.grap) releaseGrap(false);
  G.hearts--; G.hits++; pl.inv = 1.4; pl.hurt = .45; pl.vx = dir * 420; pl.vy = -520; pl.onG = false; G.shake = .3;
  SND.play('hurt'); hud(true);
  if (G.hearts <= 0) respawn(true);
}
function fall() {
  const pl = G.pl;
  SND.play('fall');
  G.hearts--; G.hits++;
  if (G.hearts <= 0) return respawn(true);
  pl.grap = null; pl.x = pl.safe.x; pl.y = pl.safe.y; pl.vx = pl.vy = 0; pl.inv = 1.6; pl.act = 0;
  G.cam.y = pl.y - VH * .62; hud(true);
}
function respawn(hard) {
  const pl = G.pl;
  pl.grap = null; pl.x = G.check.x; pl.y = G.check.y; pl.vx = pl.vy = 0; pl.inv = 2; pl.act = 0; pl.safe = { x: pl.x, y: pl.y };
  G.hearts = G.maxHearts; G.cam.x = pl.x - VW * .35; G.cam.y = pl.y - VH * .62;
  if (hard) G.cb.toast && G.cb.toast('La Lanterne faiblit : retour au dernier devis signé.');
  hud(true);
}

// ─── effets ─────────────────────────────────────────────────────────────────────────────────
function dust(x, y, n) { for (let i = 0; i < n; i++) G.fx.push({ k: 'dust', x: x + rnd(-20, 20), y: y - 4, vx: rnd(-90, 90), vy: rnd(-70, -10), life: rnd(.3, .5), max: .5 }); }
function puff(x, y) { for (let i = 0; i < 9; i++) G.fx.push({ k: 'puff', x: x + rnd(-30, 30), y: y + rnd(-8, 10), vx: rnd(-60, 60), vy: rnd(10, 60), life: rnd(.4, .7), max: .7, r: rnd(10, 20) }); }
function updateFx(dt) {
  G.fx = G.fx.filter(f => {
    f.life -= dt; if (f.life <= 0) return false;
    if (f.k === 'ring') { f.r += dt * 520; return true; }
    f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
    if (f.k === 'spark') f.vy += 500 * dt;
    if (f.k === 'fly') { f.vx += Math.sin(G.t * 3 + f.ph) * 40 * dt; }
    return true;
  });
  G.shake = Math.max(0, G.shake - dt);
}

// ─── caméra ─────────────────────────────────────────────────────────────────────────────────
function camera(dt) {
  const pl = G.pl, P = G.P;
  const tx = pl.x - VW * .5 + pl.face * Math.min(VW * .14, 120) + pl.vx * .12;
  let ty = pl.y - VH * (VH > VW ? .58 : .6);
  if (pl.vy > 600) ty += 60;
  G.cam.x = lerp(G.cam.x, tx, 1 - Math.exp(-5 * dt));
  G.cam.y = lerp(G.cam.y, ty, 1 - Math.exp(-4 * dt));
  G.cam.x = clamp(G.cam.x, -300, P.len + 300 - VW);
  G.cam.y = Math.min(G.cam.y, 250 - VH);
}

// ─── HUD ────────────────────────────────────────────────────────────────────────────────────
function hud(force) {
  if (!G.cb.hud) return;
  const P = G.P;
  const st = { hearts: G.hearts, max: G.maxHearts, sparks: P.sparks.filter(s => s.got).length, total: P.sparks.filter(s => !s.bonus).length,
    lit: mainShops().filter(s => s.lit).length, main: mainShops().length, near: !!(G.pl && (nearShop() || nearAnchor())) };
  const key = JSON.stringify(st);
  if (force || key !== G.lastHud) { G.lastHud = key; G.cb.hud(st); }
}

// ─── rendu ──────────────────────────────────────────────────────────────────────────────────
const THEME = {
  medina: { sky: ['#040B26', '#0E2358', '#1D3C7E'], dawn: ['#3A6FD0', '#F6B27A', '#FFE3A3'], mid: '#13264F', midTop: '#1E3768' },
  corniche: { sky: ['#030A22', '#0C2153', '#1B3B7B'], dawn: ['#3E7FDC', '#F4A97A', '#FFE0A8'], mid: '#0F2049', midTop: '#1A3366' },
  affaires: { sky: ['#030920', '#0A1C4B', '#183470'], dawn: ['#4688E3', '#F3A779', '#FFE3A3'], mid: '#0E1E46', midTop: '#1B3570' },
};
function mixHex(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = (pa >> 16) + (((pb >> 16) - (pa >> 16)) * k), g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * k), bl = (pa & 255) + (((pb & 255) - (pa & 255)) * k); return `rgb(${r | 0},${g | 0},${bl | 0})`; }

function render() {
  const P = G.P, pl = G.pl, T = THEME[P.theme];
  const lr = litRatio(), dawn = Math.max(G.dawn, lr * .28);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // ciel
  const sg = ctx.createLinearGradient(0, 0, 0, SH);
  sg.addColorStop(0, mixHex(T.sky[0], T.dawn[0], dawn)); sg.addColorStop(.62, mixHex(T.sky[1], T.dawn[1], dawn * .9)); sg.addColorStop(1, mixHex(T.sky[2], T.dawn[2], dawn * .85));
  ctx.fillStyle = sg; ctx.fillRect(0, 0, SW, SH);
  // étoiles et lune
  const sa = 1 - dawn * 1.1;
  if (sa > 0) {
    G.stars.forEach(s => { ctx.globalAlpha = Math.max(0, sa * s.a * (.6 + .4 * Math.sin(G.t * 1.3 + s.tw))); ctx.fillStyle = '#fff'; const x = ((s.x * SW * 1.4 - G.cam.x * SC * .02) % (SW * 1.4) + SW * 1.4) % (SW * 1.4) - SW * .2; ctx.fillRect(x, s.y * SH, s.r, s.r); });
    ctx.globalAlpha = sa; const mx = SW * .82, my = SH * .16, mr = Math.min(SW, SH) * .045;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4); mg.addColorStop(0, 'rgba(221,235,255,.35)'); mg.addColorStop(1, 'rgba(221,235,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.fillStyle = '#EAF2FF'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    ctx.fillStyle = mixHex(T.sky[0], T.sky[1], .25); ctx.beginPath(); ctx.arc(mx - mr * .45, my - mr * .2, mr * .88, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (G.dawn > 0) { // le soleil se lève
    const sy = SH * (.95 - G.dawn * .45), r = Math.min(SW, SH) * .09;
    const sgl = ctx.createRadialGradient(SW * .7, sy, 0, SW * .7, sy, r * 5); sgl.addColorStop(0, `rgba(255,214,120,${.55 * G.dawn})`); sgl.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = sgl; ctx.fillRect(0, 0, SW, SH);
    ctx.globalAlpha = G.dawn; ctx.fillStyle = '#F5B83D'; ctx.beginPath(); ctx.arc(SW * .7, sy, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  const gy = (0 - G.cam.y) * SC; // position du sol à l'écran
  // fond lointain (dessin de la ville)
  const bg = SPR[P.bg];
  if (bg) {
    const h = 640 * SC, w = h * bg.c.width / bg.c.height, x0 = -((G.cam.x * SC * .18) % w) - w;
    const y = gy * .7 + SH * .3 - h * .86;
    ctx.globalAlpha = .9;
    for (let x = x0; x < SW; x += w) ctx.drawImage(bg.c, x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = mixHex(T.sky[2], T.dawn[2], dawn * .5); ctx.globalAlpha = .35; ctx.fillRect(0, y + h - 4, SW, SH); ctx.globalAlpha = 1;
  }
  // plan intermédiaire
  drawMid(T, gy, lr);
  // le monde
  const shk = G.shake > 0 ? G.shake * 14 : 0;
  ctx.setTransform(DPR * SC, 0, 0, DPR * SC, (-G.cam.x * SC + rnd(-shk, shk)) * DPR, (-G.cam.y * SC + rnd(-shk, shk)) * DPR);
  const vx0 = G.cam.x - 200, vx1 = G.cam.x + VW + 200;
  if (P.sea) drawSea(vx0, vx1);
  P.deco.forEach(d => { if (d.x > vx0 - 300 && d.x < vx1 + 300) drawDeco(d); });
  P.lamps.forEach(l => { if (l.x > vx0 && l.x < vx1) drawLamp(l); });
  P.shops.forEach(s => { if (s.x > vx0 - 300 && s.x < vx1 + 300) drawShop(s); });
  P.solids.forEach(s => { if (s.x < vx1 && s.x + s.w > vx0) drawSolid(s, lr); });
  P.oneway.forEach(s => { if (s.x < vx1 && s.x + s.w > vx0) drawLedge(s); });
  P.hidden.forEach(s => { if (s.x < vx1 && s.x + s.w > vx0) drawHidden(s); });
  P.movers.forEach(s => drawMover(s));
  drawExit(P.exit);
  P.checks.forEach(c => { if (c.x > vx0 && c.x < vx1) drawCheck(c); });
  P.npcs.forEach(n => { if (n.x > vx0 && n.x < vx1) drawNpc(n); });
  P.anchors.forEach(a => drawAnchor(a));
  P.bubbles.forEach(b => drawBubble(b));
  P.sparks.forEach(s => { if (!s.got && s.x > vx0 && s.x < vx1) drawSpark(s); });
  P.shadows.forEach(sh => { if (sh.alive && sh.x > vx0 && sh.x < vx1) drawShadow(sh); });
  drawPlayer();
  drawFx();
  // l'obscurité, percée par les lumières
  darkness(lr);
  // lueurs chaudes
  ctx.setTransform(DPR * SC, 0, 0, DPR * SC, -G.cam.x * SC * DPR, -G.cam.y * SC * DPR);
  ctx.globalCompositeOperation = 'lighter';
  P.shops.forEach(s => { if (s.lit && s.x > vx0 - 300 && s.x < vx1 + 300) glow(s.x, s.by - 160, 300, `rgba(255,190,90,${.13 * s.glow})`); });
  glow(pl.orb.x, pl.orb.y, 120, 'rgba(255,200,100,.22)');
  ctx.globalCompositeOperation = 'source-over';
  drawOrb();
  // aides à l'écran : invite d'action, flèche du Radar
  overlays();
}

function glow(x, y, r, c) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

function drawMid(T, gy, lr) {
  const P = G.P, k = .55, baseY = gy * .86 + SH * .14;
  ctx.save();
  ctx.translate(-G.cam.x * SC * k, 0);
  const s = SC * .9;
  G.mid.forEach(it => {
    const x = it.x * s, w = it.w * s;
    if (x + w < G.cam.x * SC * k - 50 || x > G.cam.x * SC * k + SW + 50) return;
    if (it.k === 'house') {
      const h = it.h * s;
      ctx.fillStyle = T.mid; ctx.fillRect(x, baseY - h, w, h + SH);
      ctx.fillStyle = T.midTop; ctx.fillRect(x, baseY - h, w, 5 * s);
      for (let i = 0; i < 3; i++) { const wx = x + w * (.2 + i * .28), wy = baseY - h * .7; const lit = (it.seed * 10 + i) % 3 < lr * 3.2; ctx.fillStyle = lit ? 'rgba(255,214,140,.85)' : 'rgba(40,64,120,.9)'; rr(wx, wy, 14 * s, 20 * s, 7 * s); ctx.fill(); }
      ctx.fillStyle = 'rgba(8,18,46,.9)'; rr(x + w * .42, baseY - 70 * s, 34 * s, 70 * s, [17 * s, 17 * s, 0, 0]); ctx.fill();
    } else if (it.k === 'tower') {
      const h = it.h * s; ctx.fillStyle = T.mid; ctx.fillRect(x, baseY - h, w, h + SH);
      const cols = Math.max(2, Math.floor(w / (18 * s))), rows = Math.floor(h / (26 * s));
      for (let c = 0; c < cols; c++) for (let r = 1; r < rows; r++) { const lit = ((c * 7 + r * 13 + it.seed * 100) % 10) / 10 < .12 + lr * .55; if (!lit) continue; ctx.fillStyle = 'rgba(255,214,140,.75)'; ctx.fillRect(x + 6 * s + c * 18 * s, baseY - h + r * 26 * s, 8 * s, 10 * s); }
    } else if (it.k === 'palm') {
      const px = x + w * .5, h = (180 + it.seed * 90) * s; ctx.strokeStyle = T.mid; ctx.lineWidth = 9 * s; ctx.beginPath(); ctx.moveTo(px, baseY); ctx.quadraticCurveTo(px + 18 * s, baseY - h * .5, px + 6 * s, baseY - h); ctx.stroke();
      ctx.fillStyle = T.mid; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .5; ctx.beginPath(); ctx.ellipse(px + 6 * s + Math.cos(a) * 40 * s, baseY - h + Math.sin(a) * 18 * s + 10 * s, 48 * s, 9 * s, a, 0, 7); ctx.fill(); }
    }
  });
  ctx.restore();
  if (P.theme === 'corniche') { // l'horizon de l'océan
    ctx.fillStyle = 'rgba(12,32,80,.55)'; ctx.fillRect(0, baseY - 10 * SC, SW, SH);
  }
}

function drawSea(x0, x1) {
  const g = ctx.createLinearGradient(0, 30, 0, 600); g.addColorStop(0, '#0D2C68'); g.addColorStop(1, '#061638');
  ctx.fillStyle = g; ctx.fillRect(x0, 40, x1 - x0, 900);
  ctx.strokeStyle = 'rgba(159,200,255,.25)'; ctx.lineWidth = 3;
  for (let y = 70; y < 400; y += 60) { ctx.beginPath(); for (let x = x0 - (x0 % 80); x < x1; x += 80) { const o = Math.sin(G.t * 1.6 + x * .02 + y) * 6; ctx.moveTo(x, y + o); ctx.lineTo(x + 34, y + o); } ctx.stroke(); }
}

const STY = {
  ground: ['#2C2541', '#5A4E6E', '#3B3352'], promenade: ['#2E3550', '#C9BC9F', '#4A5372'], pitch: ['#123F2C', '#3E9A50', '#1A5A3B'],
  plaza: ['#1E2B4D', '#6F7F9F', '#2A3A61'], roof: ['#163066', '#5F9FF9', '#1C3B7A'], top: ['#163066', '#F5B83D', '#1C3B7A'], block: ['#2C2541', '#5A4E6E', '#3B3352'],
};
function drawSolid(s, lr) {
  const c = STY[s.style] || STY.ground;
  const x0 = Math.max(s.x, G.cam.x - 50), x1 = Math.min(s.x + s.w, G.cam.x + VW + 50), bottom = Math.min(s.y + s.h, G.cam.y + VH + 50);
  if (x1 <= x0) return;
  if (s.style === 'roof' || s.style === 'top') {
    const gr = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0); gr.addColorStop(0, '#13285A'); gr.addColorStop(.5, '#1C3A7A'); gr.addColorStop(1, '#122656');
    ctx.fillStyle = gr; ctx.fillRect(s.x, s.y, s.w, bottom - s.y);
    for (let x = s.x + 16; x < s.x + s.w - 20; x += 34) for (let y = s.y + 40; y < bottom; y += 46) {
      const lit = ((x * 7 + y * 3) % 17) / 17 < .2 + lr * .6; ctx.fillStyle = lit ? 'rgba(255,214,140,.8)' : 'rgba(95,159,249,.16)'; ctx.fillRect(x, y, 18, 24);
    }
    ctx.fillStyle = c[1]; ctx.fillRect(s.x - 6, s.y, s.w + 12, 10);
    ctx.fillStyle = '#0B1A40'; ctx.fillRect(s.x - 6, s.y + 10, s.w + 12, 6);
    return;
  }
  ctx.fillStyle = c[0]; ctx.fillRect(x0, s.y, x1 - x0, bottom - s.y);
  ctx.fillStyle = c[2]; ctx.fillRect(x0, s.y + 14, x1 - x0, 22);
  ctx.fillStyle = c[1]; ctx.fillRect(x0, s.y, x1 - x0, 14);
  if (s.style === 'ground') { ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let x = x0 - (x0 % 46); x < x1; x += 46) { rr(x + 4, s.y + 18, 38, 16, 6); ctx.fill(); } }
  if (s.style === 'pitch') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x0, s.y + 3, x1 - x0, 4); }
  if (s.style === 'promenade') { ctx.strokeStyle = 'rgba(14,33,78,.5)'; ctx.lineWidth = 3; for (let x = x0 - (x0 % 60); x < x1; x += 60) { ctx.beginPath(); ctx.moveTo(x, s.y - 2); ctx.lineTo(x, s.y - 34); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x0, s.y - 34); ctx.lineTo(x1, s.y - 34); ctx.stroke(); }
  // bords des trous
  if (s.x >= x0 - 1) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(s.x, s.y, 6, bottom - s.y); }
}
function drawLedge(s) {
  const st = s.style;
  if (st === 'awning') {
    const n = Math.max(3, Math.round(s.w / 34)), w = s.w / n;
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#F4ECDD' : '#E5484D'; ctx.beginPath(); ctx.moveTo(s.x + i * w, s.y); ctx.lineTo(s.x + (i + 1) * w, s.y); ctx.lineTo(s.x + (i + 1) * w, s.y + 22); ctx.quadraticCurveTo(s.x + (i + .5) * w, s.y + 34, s.x + i * w, s.y + 22); ctx.fill(); }
    ctx.fillStyle = '#0E214E'; ctx.fillRect(s.x - 4, s.y - 4, s.w + 8, 6);
  } else if (st === 'terrace') {
    ctx.fillStyle = '#E8E1D3'; ctx.fillRect(s.x, s.y, s.w, 26); ctx.fillStyle = '#B9AE98'; ctx.fillRect(s.x, s.y + 26, s.w, 8);
    ctx.fillStyle = '#E8E1D3'; for (let x = s.x; x < s.x + s.w - 10; x += 36) ctx.fillRect(x, s.y - 14, 20, 14);
  } else if (st === 'balcony') {
    ctx.fillStyle = '#8A5A33'; ctx.fillRect(s.x, s.y, s.w, 14); ctx.strokeStyle = '#0E214E'; ctx.lineWidth = 3;
    for (let x = s.x + 8; x < s.x + s.w; x += 18) { ctx.beginPath(); ctx.moveTo(x, s.y); ctx.lineTo(x, s.y - 26); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(s.x, s.y - 26); ctx.lineTo(s.x + s.w, s.y - 26); ctx.stroke();
  } else if (st === 'mast') {
    ctx.fillStyle = '#9FB4D6'; ctx.fillRect(s.x, s.y, s.w, 14); ctx.fillStyle = '#5B6B86'; ctx.fillRect(s.x + s.w / 2 - 6, s.y + 14, 12, -s.y);
    ctx.fillStyle = '#FFF4C2'; for (let i = 0; i < 3; i++) { rr(s.x + 14 + i * 36, s.y - 22, 26, 16, 4); ctx.fill(); }
  } else if (st === 'steel') {
    ctx.fillStyle = '#E5484D'; ctx.fillRect(s.x, s.y, s.w, 16); ctx.strokeStyle = '#9C2A31'; ctx.lineWidth = 3;
    for (let x = s.x; x < s.x + s.w; x += 24) { ctx.beginPath(); ctx.moveTo(x, s.y + 16); ctx.lineTo(x + 12, s.y); ctx.lineTo(x + 24, s.y + 16); ctx.stroke(); }
  } else { ctx.fillStyle = '#6F7F9F'; ctx.fillRect(s.x, s.y, s.w, 16); }
}
function drawHidden(s) {
  if (s.a <= 0) { if (G.abil.has('radar')) { ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(159,200,255,.35)'; ctx.lineWidth = 3; ctx.strokeRect(s.x, s.y, s.w, 16); ctx.setLineDash([]); } return; }
  ctx.globalAlpha = s.a; const g = ctx.createLinearGradient(0, s.y, 0, s.y + 18); g.addColorStop(0, '#DDEBFF'); g.addColorStop(1, '#5F9FF9');
  ctx.fillStyle = g; rr(s.x, s.y, s.w, 16, 8); ctx.fill(); glow(s.x + s.w / 2, s.y + 8, s.w * .8, 'rgba(95,159,249,.25)'); ctx.globalAlpha = 1;
}
function drawMover(s) {
  if (s.style === 'boat') {
    ctx.fillStyle = '#E8E1D3'; ctx.beginPath(); ctx.moveTo(s.x - 10, s.y); ctx.lineTo(s.x + s.w + 10, s.y); ctx.lineTo(s.x + s.w - 14, s.y + 30); ctx.lineTo(s.x + 14, s.y + 30); ctx.fill();
    ctx.fillStyle = '#2F84EC'; ctx.fillRect(s.x, s.y + 8, s.w, 6); return;
  }
  ctx.strokeStyle = 'rgba(159,200,255,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x + 12, s.y); ctx.lineTo(s.x + 12, s.y - 900); ctx.moveTo(s.x + s.w - 12, s.y); ctx.lineTo(s.x + s.w - 12, s.y - 900); ctx.stroke();
  ctx.fillStyle = '#9FB4D6'; rr(s.x, s.y, s.w, 18, 5); ctx.fill(); ctx.fillStyle = '#3DDC97'; ctx.fillRect(s.x + s.w / 2 - 14, s.y + 6, 28, 5);
}
function drawShop(s) {
  const key = s.sprite.startsWith('tower') ? s.sprite.replace('tower', 'tower') : 'f_' + s.sprite;
  const off = SPR[key], on = SPR[key + '_on'];
  if (!off) return;
  ctx.drawImage(off.c, s.x - off.ax, s.by - off.ay, off.w, off.h);
  if (s.lit && on) { ctx.globalAlpha = s.glow; ctx.drawImage(on.c, s.x - on.ax, s.by - on.ay, on.w, on.h); ctx.globalAlpha = 1; }
  // enseigne : le nom, puis « En ligne » et l'épingle Google quand le commerce s'allume
  const top = s.by - off.ay - 18;
  ctx.font = '600 15px Sora, sans-serif'; const tw = ctx.measureText(s.name).width;
  const w = tw + (s.lit ? 98 : 26);
  ctx.globalAlpha = s.lit ? 1 : .55;
  ctx.fillStyle = s.lit ? '#fff' : 'rgba(14,33,78,.85)'; rr(s.x - w / 2, top - 34, w, 32, 16); ctx.fill();
  ctx.fillStyle = s.lit ? '#0E214E' : '#9FB4D6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s.name, s.x - w / 2 + 13, top - 17);
  if (s.lit) { ctx.fillStyle = '#1FA463'; ctx.beginPath(); ctx.arc(s.x + w / 2 - 78, top - 17, 5, 0, 7); ctx.fill(); ctx.font = '600 13px Sora, sans-serif'; ctx.fillText('En ligne', s.x + w / 2 - 68, top - 17); }
  // l'adresse du site, en petit, sous l'enseigne
  if (s.lit && s.dom) {
    ctx.globalAlpha = s.glow; ctx.font = '500 11.5px Sora, sans-serif';
    const dw = ctx.measureText(s.dom).width + 34;
    ctx.fillStyle = 'rgba(7,20,51,.82)'; rr(s.x - dw / 2, top + 3, dw, 21, 10.5); ctx.fill();
    ctx.strokeStyle = '#7FE0A8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(s.x - dw / 2 + 13, top + 11.5, 3, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#7FE0A8'; ctx.fillRect(s.x - dw / 2 + 8.5, top + 11.5, 9, 7);
    ctx.fillStyle = '#E8F0FB'; ctx.textAlign = 'left'; ctx.fillText(s.dom, s.x - dw / 2 + 23, top + 14);
  }
  ctx.globalAlpha = 1;
  if (s.lit) { // l'épingle Google tombe et rebondit
    s.pin = Math.min(1, (s.pin || 0) + 1 / 60);
    const k = s.pin, by = top - 60 - (1 - k) * 160 + Math.abs(Math.sin(k * 9)) * (1 - k) * 30;
    ctx.save(); ctx.translate(s.x, by); ctx.scale(1.2, 1.2);
    ctx.fillStyle = '#EA4335'; ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-14, 6, -16, -2, -16, -8); ctx.arc(0, -8, 16, Math.PI, 0); ctx.bezierCurveTo(16, -2, 14, 6, 0, 22); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -8, 6, 0, 7); ctx.fill(); ctx.restore();
  }
  if (s.bonus && !s.lit) { ctx.fillStyle = '#F5B83D'; ctx.font = '600 13px Sora, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Commerce caché', s.x, top - 52); }
}
function drawLamp(l) {
  ctx.strokeStyle = '#0B1736'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l.x, l.y - 30); ctx.lineTo(l.x, l.y - 70); ctx.stroke();
  ctx.fillStyle = l.on ? '#FFD36B' : '#2B3A63'; ctx.strokeStyle = '#B07A3B'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(l.x, l.y - 30); ctx.lineTo(l.x + 14, l.y - 6); ctx.lineTo(l.x + 10, l.y + 18); ctx.lineTo(l.x - 10, l.y + 18); ctx.lineTo(l.x - 14, l.y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawDeco(d) {
  if (d.kind === 'palm') {
    const x = d.x, y = 0; ctx.strokeStyle = '#5A3D24'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 20, y - 150, x + 8, y - 290); ctx.stroke();
    ctx.fillStyle = '#1E6B4A'; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .48; ctx.beginPath(); ctx.ellipse(x + 8 + Math.cos(a) * 62, y - 290 + Math.sin(a) * 26 + 14, 70, 12, a, 0, 7); ctx.fill(); }
  }
}
function drawExit(e) {
  if (e.kind === 'tram') {
    ctx.fillStyle = '#0E214E'; ctx.fillRect(e.x - 120, e.y - 200, 12, 200); ctx.fillRect(e.x + 108, e.y - 200, 12, 200);
    ctx.fillStyle = '#E8EEF8'; rr(e.x - 130, e.y - 214, 260, 30, 10); ctx.fill();
    ctx.fillStyle = '#E5484D'; rr(e.x - 112, e.y - 260, 224, 40, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 16px Sora, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.label, e.x, e.y - 240);
  } else {
    const on = G.end > 0;
    ctx.fillStyle = '#0E214E'; ctx.fillRect(e.x - 10, e.y - 180, 20, 180);
    ctx.fillStyle = on ? '#FFF4C2' : '#5F9FF9'; ctx.beginPath(); ctx.arc(e.x, e.y - 200, 34, 0, 7); ctx.fill();
    ctx.fillStyle = '#F5B83D'; ctx.beginPath(); ctx.moveTo(e.x - 40, e.y - 170); ctx.lineTo(e.x + 40, e.y - 170); ctx.lineTo(e.x + 30, e.y - 150); ctx.lineTo(e.x - 30, e.y - 150); ctx.fill();
    if (on) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { const a = G.t * .6 + i * Math.PI / 4; ctx.strokeStyle = 'rgba(255,214,120,.25)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(e.x, e.y - 200); ctx.lineTo(e.x + Math.cos(a) * 2400, e.y - 200 + Math.sin(a) * 2400); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; }
  }
}
function drawCheck(c) {
  ctx.fillStyle = '#0E214E'; rr(c.x - 34, c.y - 86, 68, 86, 10); ctx.fill();
  ctx.fillStyle = c.on ? '#3DDC97' : '#2B3A63'; rr(c.x - 26, c.y - 78, 52, 34, 6); ctx.fill();
  if (c.on) { ctx.strokeStyle = '#0E214E'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(c.x - 10, c.y - 62); ctx.lineTo(c.x - 2, c.y - 54); ctx.lineTo(c.x + 12, c.y - 70); ctx.stroke(); }
  const g = SPR.gestion; if (g) ctx.drawImage(g.c, c.x + 26 - g.ax, c.y - g.ay, g.w, g.h);
}
function drawNpc(n) {
  const sp = SPR[n.sprite === 'radar_salut' ? 'radar' : n.sprite]; if (!sp) return;
  const bob = n.fly ? Math.sin(G.t * 2) * 10 - 120 : 0;
  ctx.drawImage(sp.c, n.x - sp.ax, n.y - sp.ay + bob, sp.w, sp.h);
  if (!n.done) { ctx.fillStyle = '#F5B83D'; ctx.beginPath(); ctx.arc(n.x, n.y - sp.ay + bob - 8 + Math.sin(G.t * 4) * 4, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#0E214E'; ctx.font = '700 18px Sora, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', n.x, n.y - sp.ay + bob - 7 + Math.sin(G.t * 4) * 4); }
}
function drawAnchor(a) {
  const on = G.abil.has('pin'), near = G.pl.grap && G.pl.grap.x === a.x;
  ctx.globalAlpha = on ? 1 : .4;
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, 30 + Math.sin(G.t * 3) * 4, 0, 7); ctx.stroke();
  ctx.save(); ctx.translate(a.x, a.y - 6); ctx.fillStyle = near ? '#F5B83D' : '#EA4335'; ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-14, 6, -16, -2, -16, -8); ctx.arc(0, -8, 16, Math.PI, 0); ctx.bezierCurveTo(16, -2, 14, 6, 0, 22); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -8, 6, 0, 7); ctx.fill(); ctx.restore();
  ctx.globalAlpha = 1;
}
function drawBubble(b) {
  const sq = 1 + Math.sin(b.sq * 9) * b.sq * .25, y = b.y + Math.sin(G.t * 2.4 + b.x) * 5;
  ctx.save(); ctx.translate(b.x, y); ctx.scale(1 / sq, sq);
  if (b.kind === 'ball') {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill(); ctx.strokeStyle = '#0E214E'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#0E214E'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); } ctx.fill();
  } else {
    ctx.fillStyle = '#25D366'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-22, 22); ctx.lineTo(-30, 34); ctx.lineTo(-10, 28); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2, 1, 6, 9, -.5, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function drawSpark(s) {
  const y = s.y + Math.sin(G.t * 3 + s.x * .05) * 4, r = 9 + Math.sin(G.t * 5 + s.x) * 1.5;
  glow(s.x, y, 30, 'rgba(255,214,120,.35)');
  ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.moveTo(s.x, y - r); ctx.quadraticCurveTo(s.x, y, s.x + r, y); ctx.quadraticCurveTo(s.x, y, s.x, y + r); ctx.quadraticCurveTo(s.x, y, s.x - r, y); ctx.quadraticCurveTo(s.x, y, s.x, y - r); ctx.fill();
}
function drawShadow(sh) {
  const walk = sh.kind === 'walk', w = walk ? 64 : 58, h = walk ? 58 : 46;
  const cx = sh.x, cy = walk ? sh.y - h / 2 : sh.y, wob = Math.sin(sh.t * 6) * 3;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * .7); g.addColorStop(0, '#120A2E'); g.addColorStop(.7, 'rgba(26,14,60,.95)'); g.addColorStop(1, 'rgba(26,14,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy + wob * .5, w * .62 + wob, h * .62 - wob * .5, 0, 0, 7); ctx.fill();
  if (!walk) { ctx.fillStyle = 'rgba(26,14,60,.85)'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(cx + s * 30, cy - 6 + Math.sin(sh.t * 14) * 6, 20, 8, s * .5, 0, 7); ctx.fill(); }); }
  const lx = clamp((G.pl.x - cx) / 300, -1, 1) * 4;
  ctx.fillStyle = '#fff'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(cx + s * 11 + lx, cy - 4, 7, 9, 0, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#120A2E'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(cx + s * 11 + lx * 1.6, cy - 3, 3.5, 0, 7); ctx.fill(); });
}
function frameName() {
  const pl = G.pl;
  if (pl.act > 0) return 'lanterne';
  if (pl.hurt > 0) return 'chute';
  if (!pl.onG) return pl.vy < 0 || pl.grap ? 'saut' : 'chute';
  if (Math.abs(pl.vx) > 40) return Math.floor(pl.runD / 46) % 2 ? 'run2' : 'run1';
  return 'repos';
}
function costume() { const pl = G.pl, c = G.P.costumes.find(c => pl.x >= c.x1 && pl.x <= c.x2); return c ? c.kind : ''; }
function drawPlayer() {
  const pl = G.pl;
  if (G.end && G.P.exit.kind !== 'beacon') return drawLago('p_pouce');
  if (pl.grap) { ctx.strokeStyle = '#FFE3A3'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(pl.x + pl.face * 18, pl.y - PH * .78); ctx.lineTo(pl.grap.x, pl.grap.y); ctx.stroke(); }
  if (pl.inv > 0 && Math.floor(pl.inv * 12) % 2) ctx.globalAlpha = .45;
  const c = costume(), fr = frameName();
  drawLago('p_' + fr + (c ? '_' + c : ''));
  ctx.globalAlpha = 1;
}
function drawLago(key) {
  const pl = G.pl, sp = SPR[key] || SPR['p_repos']; if (!sp) return;
  const idle = pl.onG && Math.abs(pl.vx) < 40 ? 1 + Math.sin(G.t * 3) * .015 : 1;
  const sy = pl.sq * idle, sx = 1 / Math.sqrt(sy);
  const tilt = pl.grap ? clamp(pl.vx / 1400, -.5, .5) : 0;
  ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(tilt); ctx.scale(pl.face * sx, sy);
  ctx.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h); ctx.restore();
}
function drawOrb() {
  const o = G.pl.orb, r = 13 + Math.sin(G.t * 4) * 1.2;
  ctx.save(); ctx.translate(o.x, o.y);
  ctx.rotate(G.t * .8); ctx.strokeStyle = 'rgba(255,214,120,.8)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5)); ctx.lineTo(Math.cos(a) * (r + 11), Math.sin(a) * (r + 11)); ctx.stroke(); }
  ctx.rotate(-G.t * .8);
  const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, r); g.addColorStop(0, '#FFF9E0'); g.addColorStop(.55, '#FFD36B'); g.addColorStop(1, '#F0A92A');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#1F57C7'; ctx.fillRect(-5, -6, 2.6, 12); ctx.beginPath(); ctx.moveTo(-1, -6); ctx.arc(-1, 0, 6, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.restore();
}
function drawFx() {
  G.fx.forEach(f => {
    const a = clamp(f.life / f.max, 0, 1);
    if (f.k === 'ring') { ctx.strokeStyle = `rgba(255,224,138,${a})`; ctx.lineWidth = 8 * a + 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.stroke(); }
    else if (f.k === 'spark') { ctx.globalAlpha = a; ctx.fillStyle = f.c; ctx.fillRect(f.x - 3, f.y - 3, 6, 6); ctx.globalAlpha = 1; }
    else if (f.k === 'dust') { ctx.globalAlpha = a * .6; ctx.fillStyle = '#C9D7EC'; ctx.beginPath(); ctx.arc(f.x, f.y, 6 * (1.5 - a), 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.k === 'puff') { ctx.globalAlpha = a * .9; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.4 - a * .4), 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (f.k === 'fly') { ctx.globalAlpha = a; glow(f.x, f.y, 16, 'rgba(190,255,150,.6)'); ctx.fillStyle = '#D9FF9E'; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); ctx.globalAlpha = 1; }
  });
}
function darkness(lr) {
  const P = G.P, a = P.dark * (1 - .55 * lr) * (1 - G.dawn);
  if (a <= .01) return;
  const k = .5, z = SC * k;
  dkx.setTransform(1, 0, 0, 1, 0, 0); dkx.globalCompositeOperation = 'source-over'; dkx.clearRect(0, 0, dk.width, dk.height);
  dkx.fillStyle = `rgba(3,9,30,${a})`; dkx.fillRect(0, 0, dk.width, dk.height);
  dkx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, s = 1) => { const sx = (x - G.cam.x) * z, sy = (y - G.cam.y) * z, rr = r * z; if (sx < -rr || sy < -rr || sx > dk.width + rr || sy > dk.height + rr) return; const g = dkx.createRadialGradient(sx, sy, 0, sx, sy, rr); g.addColorStop(0, `rgba(0,0,0,${s})`); g.addColorStop(.5, `rgba(0,0,0,${s * .75})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dkx.fillStyle = g; dkx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); };
  const pl = G.pl;
  hole(pl.orb.x, pl.orb.y, LIGHT_R + Math.sin(G.t * 3) * 6);
  hole(pl.x, pl.y - 60, 150, .7);
  P.shops.forEach(s => { if (s.lit) hole(s.x, s.by - 160, 360 * (.4 + .6 * s.glow)); });
  P.lamps.forEach(l => { if (l.on) hole(l.x, l.y, 170); });
  P.sparks.forEach(s => { if (!s.got) hole(s.x, s.y, 46, .8); });
  P.checks.forEach(c => hole(c.x, c.y - 60, 120, c.on ? .9 : .5));
  P.bubbles.forEach(b => hole(b.x, b.y, 90, .7));
  P.npcs.forEach(n => hole(n.x, n.y - 80, 140, .8));
  if (G.abil.has('pin')) P.anchors.forEach(an => hole(an.x, an.y, 100, .8));
  hole(P.exit.x, P.exit.y - 160, 200, .7);
  G.fx.forEach(f => { if (f.k === 'ring') hole(f.x, f.y, f.r + 40, .8); });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(dk, 0, 0, cv.width, cv.height);
}
function overlays() {
  const pl = G.pl;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const ws = (x, y) => [(x - G.cam.x) * SC, (y - G.cam.y) * SC];
  // invite : « Allumer » devant une vitrine, « Accrocher » sous une épingle
  if (!G.end && !G.hold) {
    const s = pl.onG && nearShop(), a = !s && !pl.grap && !pl.onG && nearAnchor();
    if (s || a) {
      const [x, y] = ws(pl.x, pl.y - PH - 70);
      const label = s ? 'Allumer' : 'S’accrocher', key = document.body.classList.contains('touch') ? '' : ' · X';
      ctx.font = '600 14px Sora, sans-serif'; const w = ctx.measureText(label + key).width + 44;
      ctx.fillStyle = 'rgba(245,184,61,.96)'; rr(x - w / 2, y - 18 + Math.sin(G.t * 5) * 3, w, 36, 18); ctx.fill();
      ctx.fillStyle = '#0E214E'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label + key, x + 8, y + Math.sin(G.t * 5) * 3);
      ctx.beginPath(); ctx.arc(x - w / 2 + 18, y + Math.sin(G.t * 5) * 3, 6, 0, 7); ctx.fill();
    }
  }
  // flèche du Radar vers le commerce éteint le plus proche, s'il est hors de l'écran
  if (G.abil.has('radar') && !G.end) {
    const left = G.P.shops.filter(s => !s.lit && !s.bonus);
    let t = null, bd = 1e9; left.forEach(s => { const d = Math.abs(s.x - pl.x) + Math.abs(s.by - pl.y) * .5; if (d < bd) { bd = d; t = s; } });
    if (!t && G.P.npcs.some(n => n.deal && !n.done)) t = G.P.npcs.find(n => n.deal && !n.done);
    if (!t) t = G.P.exit;
    const [sx, sy] = ws(t.x, (t.by !== undefined ? t.by : t.y) - 120);
    if (sx < 40 || sx > SW - 40 || sy < 80 || sy > SH - 60) {
      const cx = SW / 2, cy = SH / 2, ang = Math.atan2(sy - cy, sx - cx);
      const ex = clamp(cx + Math.cos(ang) * SW, 46, SW - 46), ey = clamp(cy + Math.sin(ang) * SH, 96, SH - (document.body.classList.contains('touch') ? 150 : 50));
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(7,20,51,.75)'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
      ctx.fillStyle = '#F5B83D'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -11); ctx.lineTo(-2, 0); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

// ─── fin de quartier : l'aube (appelée par l'interface pour la cinématique) ──────────────────
function dawnAll() { G.end = 1; G.dawn = Math.max(G.dawn, .01); }

window.ENGINE = { G, IN, SPR, load, start, stop, rasterAll, bindPad, partSave, resize: () => resize(), lightShop, dawnAll,
  set cb(v) { G.cb = v; }, get view() { return { SW, SH, SC, DPR }; },
  debug: { tp(x, y) { G.pl.x = x; G.pl.y = y; G.pl.vx = G.pl.vy = 0; G.cam.x = x - VW / 2; G.cam.y = y - VH * .6; }, litAll() { G.P.shops.forEach(s => lightShop(s)); } } };
})();
