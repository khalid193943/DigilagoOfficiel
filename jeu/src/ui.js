// LAGO, allume le Maroc : écrans, prologue (la Terre la nuit), dialogues, notes métier, fin de niveau.
(() => {
'use strict';
const A = window.ASSETS, SND = window.SND, E = window.ENGINE, LV = window.LEVELS, MT = window.METIERS;
const CONF = Object.assign({ img: '', cta: 'https://www.digilago.ma/demarrer.html?source=jeu-lago', site: 'https://www.digilago.ma/', lab: 'https://www.digilago.ma/lab-lago.html' }, window.LAGO_CONF || {});
const track = (n, p) => { try { window.track && window.track(n, p || {}); } catch (e) {} };
const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && e.append(k.nodeType ? k : document.createTextNode(k)));
  return e;
}
const ICON = {
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#F5B83D"/><g stroke="#F5B83D" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 2c.7 4.8 3.2 7.3 8 8-4.8.7-7.3 3.2-8 8-.7-4.8-3.2-7.3-8-8 4.8-.7 7.3-3.2 8-8z" fill="#FFE08A"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="#9FC8FF" stroke-width="2" stroke-linejoin="round"><path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3z"/><path d="M10 20v-5h4v5"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>',
  snd: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>',
  lantern: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#FFF4C2"/><g stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2 2M17.4 17.4l2 2M4.6 19.4l2-2M17.4 6.6l2-2"/></g></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill="#F5B83D" stroke="#B9831C" stroke-width="1"/></svg>',
  starOff: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill="rgba(159,200,255,.15)" stroke="rgba(159,200,255,.4)" stroke-width="1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="#3DDC97" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-opacity=".35"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>',
  dot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#9FC8FF"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 3h3M14 21h3"/></svg>',
  mark: '<svg viewBox="14 8 38 48"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="#5F9FF9"/><path d="M28 10 A22 22 0 0 1 28 54 Z" fill="#5F9FF9"/></svg>',
};
const svgOf = (inner, vb = '0 0 760 780') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;

// ─── sauvegarde ─────────────────────────────────────────────────────────────────────────────
const KEY = 'lago-allume-le-maroc-v2';
const fresh = () => ({ v: 2, intro: false, lvl: 0, part: 0, cur: null, abil: [], maxHearts: 3, stars: {}, done: {}, name: '' });
let SV; try { SV = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { SV = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) {} };

// ─── globe (prologue, titre, fin) ───────────────────────────────────────────────────────────
const cv = $('#cv'), ctx = cv.getContext('2d');
const D2R = Math.PI / 180, GL = window.GLOBE || [];
const GP = [];
for (let i = 0; i < GL.length; i += 4) {
  const lon = GL[i] / 10 * D2R, lat = GL[i + 1] / 10 * D2R, hsh = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  GP.push({ lon, lat, sl: Math.sin(lat), cl: Math.cos(lat), b: GL[i + 2] / 100, ma: GL[i + 3], h: hsh,
    casa: Math.hypot(GL[i] / 10 + 7.6, GL[i + 1] / 10 - 33.5) < 2.3 });
}
const SPACE = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + .3, a: Math.random() * .7 + .2 }));
function drawGlobe(o) {
  const DPR = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
  if (cv.width !== Math.round(W * DPR)) { cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bg = ctx.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .45, Math.max(W, H) * .8);
  bg.addColorStop(0, '#0B1C49'); bg.addColorStop(1, '#030918');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  SPACE.forEach(s => { ctx.globalAlpha = s.a; ctx.fillStyle = '#fff'; ctx.fillRect(s.x * W, s.y * H, s.r, s.r); }); ctx.globalAlpha = 1;
  const R = Math.min(W, H) * .38 * o.z, cx = W * (o.cx || .5), cy = H * (o.cy || .46);
  const l0 = o.lon * D2R, p0 = o.lat * D2R, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
  // atmosphère et disque
  const at = ctx.createRadialGradient(cx, cy, R * .9, cx, cy, R * 1.18); at.addColorStop(0, 'rgba(47,132,236,.45)'); at.addColorStop(1, 'rgba(47,132,236,0)');
  ctx.fillStyle = at; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, 7); ctx.fill();
  const dg = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R); dg.addColorStop(0, '#13306B'); dg.addColorStop(1, '#06112F');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  const ds = Math.max(1.1, Math.min(5.5, R * .0075));
  const pulse = .5 + .5 * Math.sin(o.t * 4);
  for (const p of GP) {
    const dl = p.lon - l0, cdl = Math.cos(dl);
    const cosc = sp0 * p.sl + cp0 * p.cl * cdl; if (cosc < 0.02) continue;
    const x = cx + R * p.cl * Math.sin(dl), y = cy - R * (cp0 * p.sl - sp0 * p.cl * cdl);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    const edge = Math.min(1, cosc * 3);
    let lit = p.h < p.b, col = '#FFE3A3';
    if (p.ma) {
      lit = p.h < p.b * (o.maBoost || 1) || (o.casa && p.casa && p.h < o.casa);
      col = '#F5B83D';
      if (!lit && o.maPulse) { ctx.globalAlpha = edge * (.25 + .35 * pulse) * o.maPulse; ctx.fillStyle = '#5F9FF9'; ctx.fillRect(x - ds / 2, y - ds / 2, ds, ds); continue; }
    }
    if (lit) {
      ctx.globalAlpha = edge * .1; ctx.fillStyle = col; ctx.fillRect(x - ds * 1.8, y - ds * 1.8, ds * 3.6, ds * 3.6);
      ctx.globalAlpha = edge * (.55 + .45 * p.b); ctx.fillRect(x - ds / 2, y - ds / 2, ds, ds);
    } else { ctx.globalAlpha = edge * .22; ctx.fillStyle = '#5F9FF9'; ctx.fillRect(x - ds / 2, y - ds / 2, ds * .9, ds * .9); }
  }
  ctx.globalAlpha = 1;
  if (o.casaFlare) { // Casablanca
    const dl = (-7.6 * D2R) - l0, lat = 33.57 * D2R, cosc = sp0 * Math.sin(lat) + cp0 * Math.cos(lat) * Math.cos(dl);
    if (cosc > 0) { const x = cx + R * Math.cos(lat) * Math.sin(dl), y = cy - R * (cp0 * Math.sin(lat) - sp0 * Math.cos(lat) * Math.cos(dl)); const r = 12 + o.casaFlare * 40 + pulse * 6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5); g.addColorStop(0, `rgba(255,214,120,${.8 * o.casaFlare})`); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
      ctx.fillStyle = '#FFF4C2'; ctx.beginPath(); ctx.arc(x, y, 4 + o.casaFlare * 3, 0, 7); ctx.fill(); }
  }
}
let globeRaf = 0, globeState = null;
function globeLoop(fn) {
  cancelAnimationFrame(globeRaf);
  const t0 = performance.now();
  const loop = now => { globeRaf = requestAnimationFrame(loop); const t = (now - t0) / 1000; globeState = fn(t); drawGlobe(globeState); };
  globeRaf = requestAnimationFrame(loop);
}
function globeStop() { cancelAnimationFrame(globeRaf); globeRaf = 0; }
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
function keyframes(KF, t) {
  if (t <= KF[0].t) return Object.assign({}, KF[0]);
  for (let i = 0; i < KF.length - 1; i++) {
    const a = KF[i], b = KF[i + 1];
    if (t <= b.t) { const k = ease((t - a.t) / (b.t - a.t)); const o = {}; for (const key in b) o[key] = typeof b[key] === 'number' && typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * k : b[key]; return o; }
  }
  return Object.assign({}, KF[KF.length - 1]);
}

// ─── éléments d'interface ───────────────────────────────────────────────────────────────────
const ui = $('#ui');
function screen(cls) { const s = h('div', { class: 'screen ' + (cls || '') }); ui.append(s); requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('on'))); return s; }
function closeScreen(s) { return new Promise(r => { if (!s) return r(); s.classList.remove('on'); setTimeout(() => { s.remove(); r(); }, 460); }); }
let toastEl = null, toastT = 0;
function toast(t, ms = 2600) {
  if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status' }); ui.append(toastEl); }
  toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms);
}

// HUD
const hudEl = h('div', { id: 'hud', class: 'hide' });
const hearts = h('span', { class: 'chip', 'aria-label': 'Lumière de la Lanterne' }, h('span', { class: 'suns' }));
const sparksC = h('span', { class: 'chip', html: ICON.spark + '<span>0</span>' });
const shopsC = h('span', { class: 'chip', html: ICON.shop + '<span>0 / 5</span>' });
const lvlName = h('span', { class: 'lvl-name' });
const sndBtn = h('button', { class: 'ibtn', 'aria-label': 'Son', html: SND.on ? ICON.snd : ICON.mute, onclick: () => { const on = SND.toggle(); sndBtn.innerHTML = on ? ICON.snd : ICON.mute; } });
const pauseBtn = h('button', { class: 'ibtn', 'aria-label': 'Pause', html: ICON.pause, onclick: () => pause() });
hudEl.append(h('div', { class: 'grp' }, hearts, sparksC, shopsC, lvlName), h('div', { class: 'grp' }, sndBtn, pauseBtn));
ui.append(hudEl);
let lastShops = -1, lastSparks = -1;
function hud(st) {
  hearts.firstChild.innerHTML = Array.from({ length: st.max }, (_, i) => `<i class="${i < st.hearts ? '' : 'off'}"></i>`).join('');
  if (st.sparks !== lastSparks) { sparksC.lastChild.textContent = st.sparks; if (lastSparks >= 0) { sparksC.classList.remove('pop'); void sparksC.offsetWidth; sparksC.classList.add('pop'); } lastSparks = st.sparks; }
  shopsC.lastChild.textContent = `${st.lit} / ${st.main}`;
  if (st.lit !== lastShops && lastShops >= 0) { shopsC.classList.remove('pop'); void shopsC.offsetWidth; shopsC.classList.add('pop'); }
  lastShops = st.lit;
  actBtn.classList.toggle('ready', !!st.near);
}

// commandes tactiles
const pad = h('div', { id: 'pad' },
  h('div', { class: 'side' }, h('button', { class: 'pb', 'data-k': 'l', 'aria-label': 'Gauche', html: ICON.left }), h('button', { class: 'pb', 'data-k': 'r', 'aria-label': 'Droite', html: ICON.right })),
  h('div', { class: 'side' }, h('button', { class: 'pb act', 'data-k': 'a', 'aria-label': 'Lanterne', html: ICON.lantern }), h('button', { class: 'pb jump', 'data-k': 'j', 'aria-label': 'Sauter', html: ICON.up })));
const actBtn = pad.querySelector('.act');
ui.append(pad); E.bindPad(pad);
const setTouch = () => document.body.classList.add('touch');
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) setTouch();
window.addEventListener('touchstart', setTouch, { once: true, passive: true });

// dialogues
const dlg = h('div', { class: 'dlg', role: 'dialog', 'aria-live': 'polite' });
ui.append(dlg);
function say(who, name, role, text, choices) {
  return new Promise(res => {
    const vb = who === 'cumulus' ? '0 0 120 100' : '0 0 760 780';
    const art = who === 'cumulus' ? A.cumulus : A[who];
    dlg.innerHTML = '';
    const box = h('div', { class: 'box' }, h('div', { class: 'nm' }, name), h('div', { class: 'rl' }, role), h('p', { class: 'tx' }, text));
    let done = false;
    const finish = i => { if (done) return; done = true; window.removeEventListener('keydown', kd); SND.play('tap'); res(i); };
    if (choices) {
      const ch = h('div', { class: 'ch' }); choices.forEach((c, i) => ch.append(h('button', { onclick: () => finish(i) }, c))); box.append(ch);
    } else box.append(h('div', { class: 'nx' }, h('button', { onclick: () => finish(0), html: 'Suivant ' + ICON.arrow })));
    const kd = e => { if (!choices && ['Space', 'Enter', 'KeyX', 'KeyE'].includes(e.code)) { e.preventDefault(); finish(0); } };
    setTimeout(() => window.addEventListener('keydown', kd), 250);
    dlg.append(h('div', { class: 'who', html: svgOf(art, vb) }), box);
    dlg.classList.add('on');
    SND.play('msg');
  });
}
const closeDlg = () => dlg.classList.remove('on');

// note : « le site de ce métier »
const note = h('div', { class: 'note', 'aria-live': 'polite' });
ui.append(note);
let noteT = 0;
function showNote(shop) {
  const m = MT[shop.metier]; if (!m) return;
  const photo = CONF.img ? `background-image:url(${CONF.img}${m.photo}-600.webp)` : 'background-image:linear-gradient(135deg,#5F9FF9,#1F57C7)';
  note.innerHTML = '';
  // la capture d'un vrai site du métier, quand elle existe (levels.js : land), sinon une maquette
  const shot = h('div', { class: 'shot' });
  if (m.land && CONF.img) { const im = new Image(); im.onload = () => { shot.style.backgroundImage = `url(${im.src})`; shot.classList.add('on'); }; im.src = CONF.img + m.land; }
  note.append(
    h('div', { class: 'ph' }, h('div', { class: 'scr' }, h('div', { class: 'url' }, h('i'), shop.dom || 'votre-site.ma'),
      h('div', { class: 'hero', style: photo }, h('b', {}, shop.name)), h('div', { class: 'rows' }, ...m.rows.map(r => h('i', {}, r)), h('i', { class: 'cta' }, m.cta)), shot)),
    h('div', { class: 'tx' }, h('span', { class: 'k' }, m.k), h('h4', {}, m.t), h('ul', {}, ...m.b.map(b => h('li', {}, b))),
      h('a', { href: CONF.site + m.page, target: '_blank', rel: 'noopener', onclick: () => track('jeu_lago_metier', { metier: shop.metier }) }, 'Voir ce que nous faisons pour ce métier')));
  note.classList.add('on'); clearTimeout(noteT); noteT = setTimeout(() => note.classList.remove('on'), 7000);
}

// ─── écran titre ────────────────────────────────────────────────────────────────────────────
let loaded = false;
async function title() {
  E.stop(); hudEl.classList.add('hide'); pad.style.visibility = 'hidden';
  globeLoop(t => ({ lon: -20 + t * 4, lat: 22, z: 1.05, cy: .62, t, maPulse: .6 }));
  const s = screen('');
  const hasSave = SV.intro;
  const go = h('button', { class: 'btn', onclick: () => play() }, hasSave ? 'Continuer' : 'Jouer');
  const lvBtn = h('button', { class: 'btn ghost', onclick: () => levels() }, 'Les villes');
  const inner = h('div', { style: 'margin-top:-18vh' },
    h('div', { class: 'title-k', style: 'justify-content:center', html: ICON.mark + '<span>Digilago Lab</span>' }),
    h('h1', { class: 'title-h' }, 'LAGO'),
    h('div', { class: 'title-s' }, 'Allume le Maroc'),
    h('p', { class: 'title-p' }, 'Vu de l’espace, le Maroc est encore peu éclairé. Aidez Lago à allumer ses entreprises, ville par ville.'),
    h('div', { class: 'title-b' }, go, lvBtn),
    h('div', { class: 'rotate-hint', html: ICON.rotate + '<span>Tournez votre téléphone pour plus de confort</span>' }));
  if (!loaded) { go.disabled = true; go.textContent = 'Chargement…'; }
  s.append(inner, h('div', { class: 'title-f', html: `Un jeu gratuit du <a href="${CONF.lab}" target="_top">Digilago Lab</a> · entreprises fictives · aucune donnée collectée` }));
  if (hasSave) s.querySelector('.title-b').append(h('button', { class: 'btn ghost small', onclick: async () => { const r = await confirmReset(); if (r) { SV = fresh(); save(); closeScreen(s).then(title); } } }, 'Recommencer'));
  title.s = s; title.go = go;
}
function confirmReset() {
  return new Promise(res => {
    const s = screen('dim');
    s.append(h('div', { class: 'card' }, h('div', { class: 'k' }, 'Recommencer'), h('h2', {}, 'Tout reprendre depuis le début ?'), h('p', {}, 'Les commerces allumés et les étoiles seront effacés de cet appareil.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { closeScreen(s); res(true); } }, 'Recommencer'), h('button', { class: 'btn ghost', onclick: () => { closeScreen(s); res(false); } }, 'Annuler'))));
  });
}
function levels() {
  const s = screen('dim');
  const list = h('div', { class: 'levels' });
  LV.forEach(l => list.append(h('button', { class: 'lv ' + (l.open ? 'play' : 'lock'), onclick: () => { if (l.open) { closeScreen(s); play(); } else toast(`${l.city} arrive dans une prochaine mise à jour.`); } },
    h('span', {}, `Niveau ${l.n}`), h('b', {}, l.city), h('span', {}, l.open ? (SV.done[l.id] ? 'Allumée' : 'Jouable') : 'Bientôt'))));
  s.append(h('div', { class: 'card' }, h('div', { class: 'k' }, 'Les villes'), h('h2', {}, 'Une ville, ', h('em', {}, 'un niveau.')),
    h('p', {}, 'Chaque ville a son identité, ses métiers et ses entreprises à allumer. Casablanca ouvre la route.'), list,
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => closeScreen(s) }, 'Retour'))));
}

// ─── prologue : la Terre la nuit ─────────────────────────────────────────────────────────────
async function prologue() {
  const caps = h('div', { class: 'cap' }); ui.append(caps);
  let skip = false;
  const sk = h('button', { class: 'btn ghost small skip', onclick: () => { skip = true; } }, 'Passer');
  ui.append(sk);
  const KF = [
    { t: 0, lon: -100, lat: 20, z: .95, maPulse: 0, cy: .44 },
    { t: 5.5, lon: -45, lat: 28, z: 1.0, maPulse: 0, cy: .44 },
    { t: 11, lon: 8, lat: 40, z: 1.25, maPulse: 0, cy: .44 },
    { t: 17, lon: -6.5, lat: 31, z: 3.6, maPulse: 1, cy: .42 },
    { t: 23, lon: -7.3, lat: 32.6, z: 5.6, maPulse: 1, casaFlare: 1, cy: .42 },
  ];
  globeLoop(t => Object.assign(keyframes(KF, t), { t }));
  const lines = [
    [600, 'La Terre, la nuit. Chaque lumière est une entreprise que l’on trouve en ligne.', 'Illustration'],
    [6000, 'En Allemagne, <b>89 %</b> des entreprises ont un site web. En France, <b>70 %</b>.', ''],
    [12000, 'Au Maroc, seulement <b>31 %</b>. Sept entreprises sur dix restent invisibles.', 'Source : HCP, enquête 2019 publiée en 2022 ; comparaison citée par Hespress.'],
    [18500, 'Digilago s’est donné une mission : <b>allumer le Maroc</b>.', ''],
  ];
  const t0 = performance.now();
  for (let i = 0; i < lines.length && !skip; i++) {
    while (!skip && performance.now() - t0 < lines[i][0]) await wait(80);
    if (skip) break;
    caps.innerHTML = ''; const p = h('p', { html: lines[i][1] + (lines[i][2] ? `<small>${lines[i][2]}</small>` : '') }); caps.append(p);
    requestAnimationFrame(() => p.classList.add('on')); SND.play('chime');
  }
  while (!skip && performance.now() - t0 < 23500) await wait(80);
  caps.remove(); sk.remove();
  globeStop();
  await studio();
}
// au Studio, sur le toit : la mission
async function studio() {
  const bgk = 'bg_medina';
  let alive = true;
  const draw = () => {
    if (!alive) return; requestAnimationFrame(draw);
    const DPR = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bg = E.SPR[bgk];
    ctx.fillStyle = '#071433'; ctx.fillRect(0, 0, W, H);
    if (bg) { const s = Math.max(W / bg.c.width, H / bg.c.height) * 1.05; ctx.drawImage(bg.c, (W - bg.c.width * s) / 2, H - bg.c.height * s, bg.c.width * s, bg.c.height * s); }
    const g = ctx.createLinearGradient(0, H * .45, 0, H); g.addColorStop(0, 'rgba(7,20,51,0)'); g.addColorStop(1, 'rgba(7,20,51,.92)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#E8E1D3'; ctx.fillRect(0, H * .62, W, H * .4); ctx.fillStyle = '#B9AE98'; ctx.fillRect(0, H * .62, W, 6);
    const sc = Math.min(W, H * 1.6) / 1000, base = H * .62;
    const put = (k, x, f = 1) => { const sp = E.SPR[k]; if (!sp) return; const s = sc * 1.45 * f; ctx.drawImage(sp.c, x - sp.ax * s, base - sp.ay * s, sp.w * s, sp.h * s); };
    put('radar', W * .32); put('p_salut', W * .5, 1.05); put('gestion', W * .68, 1.15);
  };
  draw();
  const lines = [
    ['gestion_salut', 'Gestion', 'Devis et accords', 'Sept entreprises sur dix ne sont pas visibles en ligne. On commence par Casablanca ?'],
    ['radar_salut', 'Radar', 'Le repérage', 'J’ai repéré cinq commerces éteints dans la médina. Je te guiderai avec ma flèche.'],
    ['p_salut', 'Lago', 'Le D de Digilago', 'Alors on y va. Avec la Lanterne, on les allume un par un.'],
    ['gestion_salut', 'Gestion', 'Devis et accords', 'Passe par mes kiosques en chemin : chaque devis signé garde ta progression.'],
  ];
  for (const l of lines) await say(...l);
  closeDlg(); alive = false;
  SV.intro = true; save();
}

// ─── partie ─────────────────────────────────────────────────────────────────────────────────
let curLevel = null;
async function play() {
  SND.unlock(); SND.music(true); SND.setIntensity(.35);
  track('jeu_lago_debut', { reprise: !!SV.intro });
  if (document.body.classList.contains('touch')) { try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); await window.screen.orientation.lock('landscape'); } catch (e) {} }
  if (title.s) { closeScreen(title.s); title.s = null; }
  if (!SV.intro) await prologue();
  curLevel = LV[SV.lvl] || LV[0];
  if (SV.part >= curLevel.parts.length) { SV.part = 0; SV.cur = null; }
  await startPart(SV.part, SV.cur);
}
async function startPart(idx, cur) {
  globeStop();
  const P = curLevel.parts[idx];
  E.G.abil = new Set(SV.abil); E.G.maxHearts = SV.maxHearts;
  E.load(curLevel, idx, cur);
  lvlName.textContent = `${curLevel.city} · ${P.name}`;
  E.start(); E.G.hold = true;
  hudEl.classList.remove('hide'); pad.style.visibility = 'hidden';
  if (!cur) await partIntro(P, idx);
  pad.style.visibility = ''; E.G.hold = false;
  SND.setIntensity(.35 + idx * .15);
}
function partIntro(P, idx) {
  return new Promise(res => {
    const s = screen('dim');
    const touch = document.body.classList.contains('touch');
    const goals = [`Allume les ${P.shops.filter(x => !x.bonus).length} commerces du quartier`, 'Ramasse les étincelles', P.shops.some(x => x.bonus) ? 'Trouve le commerce caché' : 'Évite les Ombres de l’Oubli, ou saute dessus'];
    const ctrl = touch ? 'Flèches pour avancer, bouton bleu pour sauter, bouton doré pour la Lanterne.' : 'Flèches ou Q/D pour avancer, Espace pour sauter, X pour la Lanterne.';
    s.append(h('div', { class: 'card' },
      h('div', { class: 'k' }, `Niveau ${curLevel.n} · ${curLevel.city} · quartier ${idx + 1} sur ${curLevel.parts.length}`),
      h('h2', {}, P.name.replace(/^(La|Le) /, m => m), ' ', h('em', {}, 'de nuit.')),
      h('ul', { class: 'goals' }, ...goals.map(g => h('li', { html: ICON.dot + `<span>${g}</span>` }))),
      h('p', {}, ctrl),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { SND.play('success'); closeScreen(s).then(res); } }, 'C’est parti'))));
    setTimeout(() => s.querySelector('.btn').focus(), 500);
  });
}
function pause() {
  if (!E.G.running || E.G.paused) return;
  E.G.paused = true;
  const s = screen('dim');
  const resume = () => { E.G.paused = false; closeScreen(s); };
  s.append(h('div', { class: 'card' }, h('div', { class: 'k' }, `${curLevel.city} · ${E.G.P.name}`), h('h2', {}, 'Pause'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: resume }, 'Reprendre'),
      h('button', { class: 'btn ghost', onclick: () => { closeScreen(s); E.G.paused = false; SV.cur = null; save(); startPart(E.G.partIdx, null); } }, 'Recommencer le quartier'),
      h('button', { class: 'btn ghost', onclick: () => { E.G.paused = false; closeScreen(s); title(); } }, 'Accueil'))));
}
document.addEventListener('visibilitychange', () => { if (document.hidden && E.G.running && !E.G.end) pause(); });
window.addEventListener('keydown', e => { if ((e.code === 'Escape' || e.code === 'KeyP') && E.G.running && !E.G.paused) pause(); });

// ─── rappels du moteur ──────────────────────────────────────────────────────────────────────
E.cb = {
  hud,
  toast: t => toast(t),
  shop: (s, lit, main) => { showNote(s); if (s.bonus) toast('Commerce caché allumé : bravo !'); else if (lit === main) toast('Tous les commerces brillent : direction la sortie.'); },
  check: cur => { SV.cur = cur; SV.abil = [...E.G.abil]; SV.maxHearts = E.G.maxHearts; save(); toast('Devis signé : progression enregistrée'); },
  npc: async n => {
    pad.style.visibility = 'hidden';
    for (const l of n.lines) await say(n.sprite, n.name, n.role, l);
    if (n.deal) {
      let r;
      do {
        r = await say(n.sprite, n.name, n.role, 'Et pour ma commission, on fait comment ?', ['On la fixe par écrit, avant le premier contact.', 'On verra à la fin du projet.']);
        if (r === 1) await say('gestion_salut', 'Gestion', 'Devis et accords', 'Chez Digilago, tout est écrit avant de commencer. Même avec nos partenaires.');
      } while (r === 1);
      SND.play('stamp');
      await say(n.sprite, n.name, n.role, 'Parfait, accord signé. Le tram t’attend : le quartier d’affaires et ses grands comptes.');
      n.ok = true;
    }
    if (n.gives === 'radar') toast('Radar rejoint l’équipe : suis la flèche dorée.', 3200);
    if (n.gives === 'double') toast('Cumulus te porte : saute deux fois.', 3200);
    if (n.gives === 'pin') toast('L’épingle Google : sous une épingle, bouton doré pour t’accrocher.', 3600);
    if (n.gives === 'heart') toast('Ta Lanterne gagne une lumière.', 3000);
    closeDlg(); pad.style.visibility = '';
  },
  partDone: st => partDone(st),
};

// ─── fin de quartier, fin de niveau ──────────────────────────────────────────────────────────
function starsOf(st) {
  return [
    { on: true, t: 'Tous les commerces' },
    { on: st.total ? st.sparks / st.total >= .8 : true, t: 'Étincelles' },
    st.bonusTotal ? { on: st.bonus > 0, t: 'Commerce caché' } : { on: st.hits === 0, t: 'Sans perdre de lumière' },
  ];
}
async function partDone(st) {
  const idx = E.G.partIdx, last = idx === curLevel.parts.length - 1;
  const stars = starsOf(st);
  SV.stars[st.id] = Math.max(SV.stars[st.id] || 0, stars.filter(s => s.on).length);
  SV.abil = [...E.G.abil]; SV.maxHearts = E.G.maxHearts;
  track('jeu_lago_quartier', { quartier: st.id, etoiles: SV.stars[st.id] });
  if (!last) { SV.part = idx + 1; SV.cur = null; save(); return partCard(st, stars); }
  SV.done[curLevel.id] = true; SV.part = 0; SV.cur = null; SV.lvl = 0; save();
  track('jeu_lago_niveau', { niveau: curLevel.id });
  E.stop(); hudEl.classList.add('hide'); pad.style.visibility = 'hidden';
  // la Terre : Casablanca s'allume
  const caps = h('div', { class: 'cap' }); ui.append(caps);
  globeLoop(t => Object.assign(keyframes([{ t: 0, lon: -7.3, lat: 32.6, z: 5.2, casa: .2, casaFlare: 1, maPulse: .4 }, { t: 3, lon: -7, lat: 31.5, z: 3.4, casa: .95, casaFlare: 1, maPulse: .3 }, { t: 7, lon: -12, lat: 30, z: 1.6, casa: .95, casaFlare: .6, maPulse: .2 }], t), { t }));
  await wait(400);
  const p = h('p', { html: '<b>Casablanca brille.</b> Rabat, Marrakech, Fès et Tanger attendent leur lumière.' }); caps.append(p); requestAnimationFrame(() => p.classList.add('on'));
  SND.play('online');
  await wait(5200);
  caps.remove();
  levelCard(st, stars);
}
function statsRow(st) {
  return h('div', { class: 'stats' }, h('div', {}, h('b', {}, `${st.lit}`), 'commerces allumés'), h('div', {}, h('b', {}, `${st.sparks} / ${st.total}`), 'étincelles'),
    h('div', {}, h('b', {}, `${Math.floor(st.time / 60)}:${String(st.time % 60).padStart(2, '0')}`), 'temps'));
}
function starsRow(stars) {
  const row = h('div', { class: 'stars' }, ...stars.map(s => h('div', { class: 'st', html: (s.on ? ICON.star : ICON.starOff) + `<span>${s.t}</span>` })));
  setTimeout(() => [...row.children].forEach((c, i) => setTimeout(() => { c.classList.add('on'); if (stars[i].on) SND.play('star'); }, i * 260)), 350);
  return row;
}
function partCard(st, stars) {
  const s = screen('dim');
  const next = curLevel.parts[E.G.partIdx + 1];
  s.append(h('div', { class: 'card' }, h('div', { class: 'k' }, `${curLevel.city} · quartier ${E.G.partIdx + 1} sur ${curLevel.parts.length}`),
    h('h2', {}, `${st.name} `, h('em', {}, 'brille.')), starsRow(stars), statsRow(st),
    h('div', { class: 'pitch', style: 'grid-template-columns:1fr' }, h('div', {}, h('h3', {}, 'Et votre commerce, ', h('em', {}, 'il brille ?')),
      h('p', {}, 'Comme dans le jeu, mais pour de vrai : un site, une fiche Google et des réponses rapides. Prix écrit avant de commencer.')),
      h('div', { class: 'full' }, h('a', { class: 'btn small', href: CONF.cta + '&quartier=' + st.id, target: '_blank', rel: 'noopener', onclick: () => track('jeu_lago_demarrer', { depuis: st.id }) }, 'Démarrer mon projet'))),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { await closeScreen(s); SND.play('whoosh'); startPart(E.G.partIdx + 1, null); } }, `Prendre le tram · ${next.name}`))));
}
const CODE = 'LAGO-CASA';
// « Café Atlas » devient « cafe-atlas.ma » : l'adresse que pourrait avoir le site
function dom(name) {
  const s = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26).replace(/-+$/, '');
  return (s || 'votre-entreprise') + '.ma';
}
function levelCard(st, stars) {
  globeLoop(t => ({ lon: -10 + Math.sin(t * .1) * 6, lat: 31, z: 2.2, casa: .95, casaFlare: .5, t, cy: .5 }));
  const s = screen('dim');
  const total = Object.values(SV.stars).reduce((a, b) => a + b, 0);
  const input = h('input', { type: 'text', maxlength: '40', placeholder: 'Le nom de votre entreprise', value: SV.name || '', 'aria-label': 'Le nom de votre entreprise' });
  const nameB = h('b', {}, SV.name || 'Votre entreprise');
  const domB = h('span', { class: 'url' }, h('i'), dom(SV.name));
  input.addEventListener('input', () => { nameB.textContent = input.value.trim() || 'Votre entreprise'; domB.lastChild.textContent = dom(input.value); });
  const cta = h('a', { class: 'btn', href: CONF.cta + '&niveau=' + curLevel.id + '&code=' + CODE, target: '_blank', rel: 'noopener', onclick: () => { SV.name = input.value.trim(); save(); track('jeu_lago_demarrer', { depuis: 'niveau-' + curLevel.id, code: CODE }); } }, 'Utiliser mon code ', h('span', { html: ICON.arrow }));
  // le cadeau du niveau : un code qui offre la fiche Google (conditions sur la page Offres du site)
  const copy = h('button', { class: 'btn ghost small', onclick: async () => { try { await navigator.clipboard.writeText(CODE); copy.textContent = 'Copié'; } catch (e) { copy.textContent = CODE; } track('jeu_lago_code', { code: CODE }); } }, 'Copier');
  const gift = h('div', { class: 'gift' }, h('div', {}, h('span', { class: 'gk' }, 'Votre cadeau'), h('b', {}, CODE), h('small', {}, 'Votre fiche Google offerte pour la création de votre site. ', h('a', { href: CONF.site + 'offres.html#conditions', target: '_blank', rel: 'noopener' }, 'Conditions'))), copy);
  const light = h('button', { class: 'btn light small', onclick: () => { const v = input.value.trim(); if (!v) { input.focus(); return; } SV.name = v; save(); SND.play('online'); phone.animate([{ transform: 'scale(.9)', filter: 'brightness(.4)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' }); light.textContent = 'Allumée !'; } }, 'Allumer mon entreprise');
  const phone = h('div', { class: 'ph' }, h('div', { class: 'scr' }, domB, h('span', { class: 'lg', html: ICON.mark }), nameB, h('i'), h('i'), h('i'), h('i', { class: 'c' })));
  const share = h('button', { class: 'btn ghost small', onclick: async () => {
    const text = 'J’ai allumé Casablanca dans LAGO, le jeu de Digilago. À votre tour !';
    try { await navigator.share({ title: 'LAGO, allume le Maroc', text, url: CONF.lab }); }
    catch (e) { try { await navigator.clipboard.writeText(text + ' ' + CONF.lab); toast('Lien copié'); } catch (e2) { toast(CONF.lab); } }
  } }, 'Partager le jeu');
  s.append(h('div', { class: 'card' }, h('div', { class: 'k' }, `Niveau ${curLevel.n} terminé · ${total} étoiles`),
    h('h2', {}, `${curLevel.city} `, h('em', {}, 'est allumée.')),
    h('p', {}, 'La médina, la Corniche et le quartier d’affaires brillent. Prochaine ville : Rabat, dans une prochaine mise à jour.'),
    h('div', { class: 'pitch' },
      h('div', {}, h('h3', {}, 'La prochaine lumière, ', h('em', {}, 'c’est la vôtre.')),
        h('p', {}, 'Un site web élégant, pensé par des experts du référencement et des IA, pour que vos clients vous trouvent enfin.'),
        h('ul', {}, h('li', {}, 'Prix écrit avant de commencer'), h('li', {}, 'Première version en 72 heures'), h('li', {}, 'Réponse le jour même'), h('li', {}, 'Un seul interlocuteur'))),
      phone,
      h('div', { class: 'full' }, input, light),
      h('div', { class: 'full' }, gift),
      h('div', { class: 'full' }, cta)),
    h('div', { class: 'row' }, share, h('button', { class: 'btn ghost small', onclick: () => { closeScreen(s); title(); } }, 'Accueil'), h('button', { class: 'btn ghost small', onclick: () => levels() }, 'Les villes'))));
}

// ─── démarrage ──────────────────────────────────────────────────────────────────────────────
title();
E.rasterAll(p => { if (title.go && !loaded) title.go.textContent = `Chargement ${Math.round(p * 100)} %`; }).then(() => {
  loaded = true; if (title.go) { title.go.disabled = false; title.go.textContent = SV.intro ? 'Continuer' : 'Jouer'; }
});
window.LAGO_UI = { SV: () => SV, title, play, startPart, toast };
})();
