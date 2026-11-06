// LAGO, allume le Maroc : moteur, scènes, sauvegarde.
(() => {
const A = window.ASSETS, C = window.CONTENT, SND = window.SND;
const stage = document.getElementById('stage');
const $ = (s, r = document) => r.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && e.append(k.nodeType ? k : document.createTextNode(k)));
  return e;
}
const svgOf = (inner, vb = '0 0 760 780') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;
function char(key, css, cls = 'idle') { return h('div', { class: 'char ' + cls, style: css, html: svgOf(A[key]) }); }
const LOGO = '<svg viewBox="14 8 38 48"><rect x="16" y="10" width="8" height="44" rx="1.5"/><path d="M28 10 A22 22 0 0 1 28 54 Z"/></svg>';
const ICONS = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  cal: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>', chat: '<path d="M4 18l1.5-4A7 7 0 1 1 9 18z"/>',
  mega: '<path d="M4 10v4h4l7 4V6L8 10z"/><path d="M18 9a4 4 0 0 1 0 6"/>', spark: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/>',
  sun: '<path d="M4 16a8 8 0 0 1 16 0z"/><path d="M2 19h20"/>', heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  sound: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', mute: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>', home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  msg: '<rect x="3" y="5" width="18" height="13" rx="3"/><path d="M8 18l-2 3 5-3"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M15.5 14a5 5 0 0 1 6 5"/>',
};
const icon = (n, color = 'currentColor', sw = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

// ------------------------------------------------------------------ sauvegarde
const KEY = 'lago-allume-le-maroc-v1';
const fresh = () => ({ v: 1, intro: false, done: {}, confiance: 50, inbox: [], youssef: false, anas: false, flicker: null, missions: 0, player: '', finished: false, tutoDevis: false });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { S = fresh(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const bizById = id => C.businesses.find(b => b.id === id);
function lumiere() { return Math.min(100, C.businesses.reduce((t, b) => t + (S.done[b.id] ? (b.big ? 20 : 12) : 0), 0)); }
const doneCount = d => C.businesses.filter(b => (!d || b.district === d) && S.done[b.id]).length;

// ------------------------------------------------------------------ mise à l'échelle
function resize() { stage.style.setProperty('--u', (stage.clientWidth / 100) + 'px'); }
window.addEventListener('resize', resize); resize();

// ------------------------------------------------------------------ outils d'interface
let current = null;
async function show(fn, ...args) {
  const old = current;
  const sc = h('div', { class: 'scene' });
  stage.append(sc);
  current = sc;
  await fn(sc, ...args);
  requestAnimationFrame(() => sc.classList.add('on'));
  if (old) { old.classList.remove('on'); setTimeout(() => old.remove(), 400); }
}
function toast(text, ms = 2200) {
  const t = h('div', { class: 'toast' }, text); stage.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}
function dialog({ who, name, role, text, choices, avatarBox }) {
  return new Promise(res => {
    const box = h('div', { class: 'dialog panel' });
    const av = h('div', { class: 'av', html: svgOf(A[who]) });
    if (avatarBox) av.firstChild.style.cssText = avatarBox;
    box.append(h('div', { class: 'who' }, av, h('div', {}, h('div', { class: 'name' }, name), h('div', { class: 'role' }, role || ''))), h('p', { html: text }));
    const ch = h('div', { class: 'choices' });
    (choices || ['Continuer']).forEach((c, i) => ch.append(h('button', { class: 'choice', onclick: async e => { SND.play('tap'); res(i); box.classList.remove('show'); setTimeout(() => box.remove(), 450); } }, c)));
    box.append(ch); stage.append(box); requestAnimationFrame(() => box.classList.add('show'));
  });
}
function confetti(n = 40) {
  const cols = ['#F5B83D', '#2F84EC', '#3DDC97', '#E5484D', '#5F9FF9', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = h('div', { class: 'confetti', style: `left:${Math.random() * 100}%;top:-20px;background:${cols[i % cols.length]};transform:rotate(${Math.random() * 360}deg)` });
    stage.append(c);
    const dx = (Math.random() - .5) * 120, dur = 1400 + Math.random() * 1200;
    c.animate([{ transform: `translate(0,0) rotate(0)` }, { transform: `translate(${dx}px, ${stage.clientHeight + 40}px) rotate(${720 * Math.random()}deg)` }], { duration: dur, easing: 'cubic-bezier(.3,.6,.5,1)' }).onfinish = () => c.remove();
  }
}
const pill = (text, cls = '', style = '') => h('span', { class: 'pill ' + cls, style }, text);

// ------------------------------------------------------------------ HUD
function hud(root, opts = {}) {
  const bar = h('div', { class: 'hud' });
  const lum = h('div', { class: 'gauge', title: 'Lumière' }, h('span', { class: 'ic', style: 'background:#F5B83D', html: icon('sun', '#0E214E') }), h('span', { class: 'bar' }, h('i', { style: `width:${lumiere()}%` })), h('span', {}, lumiere() + ' %'));
  const conf = h('div', { class: 'gauge', title: 'Confiance' }, h('span', { class: 'ic', style: 'background:#3DDC97', html: icon('heart', '#0E214E') }), h('span', {}, String(S.confiance)));
  bar.append(lum, conf, h('span', { class: 'sp' }));
  if (opts.inbox) {
    const b = h('button', { class: 'iconbtn', 'aria-label': 'Messages', html: icon('msg'), onclick: () => openInbox(root) });
    const n = S.inbox.length; if (n) b.append(h('span', { class: 'badge' }, String(n)));
    bar.append(b);
  }
  if (opts.map) bar.append(h('button', { class: 'iconbtn', 'aria-label': 'Carte', html: icon('map'), onclick: () => { SND.play('whoosh'); show(mapScene); } }));
  const snd = h('button', { class: 'iconbtn', 'aria-label': 'Son', html: icon(SND.on ? 'sound' : 'mute'), onclick: () => { const on = SND.toggle(); snd.innerHTML = icon(on ? 'sound' : 'mute'); } });
  bar.append(snd);
  root.append(bar);
  return bar;
}

// ------------------------------------------------------------------ TITRE
async function titleScene(sc) {
  const bg = h('div', { class: 'title-bg', html: svgOf(A.bg_medina, '0 0 1600 830') });
  bg.firstChild.setAttribute('preserveAspectRatio', 'xMidYMax slice');
  bg.firstChild.style.cssText = 'width:100%;height:100%;left:0;transform:none';
  sc.append(bg, h('div', { style: 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,20,51,.85) 0%,rgba(7,20,51,.35) 45%,rgba(7,20,51,.75) 100%)' }));
  sc.append(h('div', { style: 'position:absolute;left:0;right:0;top:calc(var(--u)*16);text-align:center;color:#fff' },
    h('div', { class: 'logo', style: 'justify-content:center;font-size:calc(var(--u)*6.6);color:#DDEBFF', html: LOGO + '<span>digilago</span>' }),
    h('h1', { style: 'font-size:calc(var(--u)*15);margin-top:calc(var(--u)*5);color:#fff;letter-spacing:-.05em' }, 'LAGO'),
    h('div', { class: 'sora', style: 'font-size:calc(var(--u)*6);color:#F5B83D;margin-top:calc(var(--u)*1)' }, 'Allume le Maroc'),
    h('p', { style: 'margin:calc(var(--u)*4) auto 0;max-width:78%;font-size:calc(var(--u)*3.9);line-height:1.45;color:#C9D7EC' }, 'Rends visibles les entreprises du Maroc, une par une, avec Radar, Gestion et toute l’équipe.')));
  sc.append(char('lago_salut', 'width:68%;left:16%;bottom:15%'));
  const go = h('button', { class: 'btn gold', style: 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--u)*12);min-width:58%' }, Object.keys(S.done).length ? 'Continuer' : 'Jouer');
  go.onclick = () => { window.track && window.track('jeu_lago_debut', { reprise: Object.keys(S.done).length > 0 }); SND.unlock(); SND.music(true); SND.setIntensity(.3); SND.play('success'); S.intro ? show(mapScene) : show(introScene); };
  sc.append(go, h('a', { href: 'https://www.digilago.ma/lab-lago.html', target: '_top', style: 'position:absolute;bottom:calc(var(--u)*4);left:0;right:0;text-align:center;font-size:calc(var(--u)*2.9);color:#9FB4D6;text-decoration:none' }, 'Un jeu du Digilago Lab · entreprises fictives'));
  if (Object.keys(S.done).length) sc.append(h('button', { class: 'btn ghost small', style: 'position:absolute;right:calc(var(--u)*4);top:calc(var(--u)*4)', onclick: async () => { const r = await dialog({ who: 'lago_surpris', name: 'Recommencer ?', role: 'Votre progression sera effacée', text: 'Toutes les entreprises repasseront hors ligne.', choices: ['Recommencer depuis le début', 'Annuler'] }); if (r === 0) { S = fresh(); save(); show(titleScene); } } }, 'Recommencer'));
}

// ------------------------------------------------------------------ INTRO
async function introScene(sc) {
  const cards = [
    { bg: 'dark', ch: ['lago_surpris', 'width:56%;left:22%;bottom:22%'], t: 'Au Maroc, tant d’entreprises font un travail remarquable.', s: 'Pourtant, en ligne, personne ne les voit.' },
    { bg: 'dark', ch: ['lago_saut', 'width:64%;left:18%;bottom:20%'], t: 'Voici Lago, le D de Digilago.', s: 'Sa mission : les rendre visibles, une par une. Site, fiche Google, présence dans les IA.' },
    { bg: 'light', ch2: true, t: 'Au Studio de Casablanca, toute une équipe.', s: 'Radar trouve les entreprises. Gestion écrit le prix avant de commencer. Lago construit en 72 heures.' },
    { bg: 'light', ch: ['lago_tablette', 'width:60%;left:20%;bottom:20%'], t: 'Allume le Maroc. Et garde-le allumé.', s: 'Tiens les trois promesses de Digilago : le prix juste, le délai, et une réponse le jour même.' },
  ];
  let i = 0;
  const wrap = h('div', { style: 'position:absolute;inset:0' }); sc.append(wrap);
  const render = () => {
    const c = cards[i];
    wrap.innerHTML = '';
    wrap.style.background = c.bg === 'dark' ? 'radial-gradient(120% 70% at 50% 30%,#163C85,#0E214E 60%,#071433)' : 'linear-gradient(180deg,#9FC8FF,#DDEBFF 50%,#FFF4DE)';
    if (c.ch) wrap.append(char(c.ch[0], c.ch[1]));
    if (c.ch2) { wrap.append(char('radar_salut', 'width:52%;left:-2%;bottom:20%'), char('gestion_tablette', 'width:52%;left:50%;bottom:20%')); }
    const col = c.bg === 'dark' ? '#fff' : '#0E214E', sub = c.bg === 'dark' ? '#C9D7EC' : '#4A5876';
    wrap.append(h('div', { class: 'fade-in', style: `position:absolute;left:8%;right:8%;top:calc(var(--u)*16);text-align:center` },
      h('h2', { style: `font-size:calc(var(--u)*7.4);line-height:1.08;color:${col}` }, c.t), h('p', { style: `font-size:calc(var(--u)*4.2);line-height:1.45;color:${sub};margin:calc(var(--u)*4) 0 0` }, c.s)));
    const dots = h('div', { style: 'position:absolute;left:0;right:0;bottom:calc(var(--u)*30);display:flex;justify-content:center;gap:8px' }, cards.map((_, k) => h('i', { style: `width:${k === i ? 22 : 8}px;height:8px;border-radius:4px;background:${k === i ? '#F5B83D' : 'rgba(159,200,255,.5)'};transition:width .3s` })));
    const next = h('button', { class: 'btn ' + (i === cards.length - 1 ? 'gold' : ''), style: 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--u)*12);min-width:58%' }, i === cards.length - 1 ? 'C’est parti' : 'Suivant');
    next.onclick = () => { SND.play('tap'); if (i < cards.length - 1) { i++; render(); } else { S.intro = true; save(); show(mapScene); } };
    wrap.append(dots, next, h('button', { class: 'btn ghost small', style: 'position:absolute;right:calc(var(--u)*4);top:calc(var(--u)*4)', onclick: () => { S.intro = true; save(); show(mapScene); } }, 'Passer'));
  };
  render();
}

// ------------------------------------------------------------------ CARTE
async function mapScene(sc) {
  SND.setIntensity(.35);
  sc.style.background = 'radial-gradient(120% 80% at 50% 20%,#163C85,#0E214E 55%,#071433)';
  const L = lumiere();
  const dots = A.map_dots.map(([x, y], i) => {
    const d = Math.hypot(x - 351, y - 122);
    const lit = d < 30 + L * 1.2;
    return `<circle cx="${x}" cy="${y}" r="${lit ? 1.25 : .8}" fill="${lit ? '#FFE08A' : '#5F9FF9'}" opacity="${lit ? .95 : .35}"/>`;
  }).join('');
  const cities = { Casablanca: 'play', Rabat: 'soon', Marrakech: 'lock', 'Fès': 'lock', Tanger: 'lock' };
  const SIDE = { Casablanca: 'l', Rabat: 't', 'Fès': 'r', Tanger: 'r', Marrakech: 'r' };
  const VB = [262, -6, 236, 262];
  let marks = '';
  for (const [n, [x, y]] of Object.entries(A.map_cities)) {
    const st = cities[n];
    const c = st === 'play' ? '#F5B83D' : st === 'soon' ? '#9FC8FF' : '#5B6B86';
    marks += `<g class="city" data-city="${n}" transform="translate(${x} ${y})" style="cursor:pointer"><circle r="16" fill="transparent"/>${st === 'play' ? `<circle r="12" fill="#F5B83D" opacity=".25"><animate attributeName="r" values="6;15;6" dur="1.8s" repeatCount="indefinite"/></circle>` : ''}<circle r="4.6" fill="${c}" stroke="#0E214E" stroke-width="1.8"/></g>`;
  }
  const map = h('div', { style: 'position:absolute;left:3%;right:3%;top:calc(var(--u)*34);bottom:calc(var(--u)*32)', html: `<svg viewBox="${VB.join(' ')}" style="width:100%;height:100%;overflow:visible"><path d="${A.map_outline}" fill="#12295C" stroke="#5F9FF9" stroke-width="1.4" stroke-linejoin="round"/>${dots}${marks}</svg>` });
  sc.append(map);
  for (const [n, [x, y]] of Object.entries(A.map_cities)) {
    const st = cities[n];
    const lab = h('div', { class: 'pill', style: `position:absolute;white-space:nowrap;background:${st === 'play' ? '#fff' : 'rgba(7,20,51,.78)'};color:${st === 'play' ? '#0E214E' : '#9FB4D6'};font-size:calc(var(--u)*3.1);box-shadow:${st === 'play' ? '0 6px 18px rgba(0,0,0,.35)' : 'inset 0 0 0 1px rgba(159,200,255,.3)'}` },
      n, st === 'play' ? h('b', { style: 'color:#1F57C7;margin-left:4px' }, L + ' %') : st === 'soon' ? ' · bientôt' : '');
    const tr = { l: 'translate(calc(-100% - 12px),-50%)', r: 'translate(12px,-50%)', t: 'translate(-50%,calc(-100% - 10px))' }[SIDE[n]];
    lab.style.transform = tr;
    map.append(lab);
    const place = () => { const r = map.getBoundingClientRect(); const s = Math.min(r.width / VB[2], r.height / VB[3]); const ox = (r.width - VB[2] * s) / 2, oy = (r.height - VB[3] * s) / 2; lab.style.left = (ox + (x - VB[0]) * s) + 'px'; lab.style.top = (oy + (y - VB[1]) * s) + 'px'; };
    requestAnimationFrame(place); setTimeout(place, 60);
  }
  map.addEventListener('click', e => {
    const g = e.target.closest('.city'); if (!g) return;
    const n = g.dataset.city;
    if (cities[n] === 'play') { SND.play('whoosh'); show(cityScene, 'medina'); }
    else toast(cities[n] === 'soon' ? 'Rabat arrive dans la prochaine mise à jour.' : `${n} : allume d’abord Casablanca.`);
  });
  sc.append(h('div', { style: 'position:absolute;left:0;right:0;top:calc(var(--u)*16);text-align:center;color:#fff' },
    h('h2', { style: 'font-size:calc(var(--u)*7)' }, 'La carte du Maroc'),
    h('p', { style: 'margin:calc(var(--u)*2) auto 0;color:#C9D7EC;font-size:calc(var(--u)*3.8);max-width:84%;line-height:1.4' }, L >= 100 ? 'Casablanca brille. Rabat arrive bientôt.' : 'Commence par Casablanca, là où se trouve le Studio.')));
  const go = h('button', { class: 'btn gold', style: 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--u)*12);min-width:62%' }, L >= 100 ? 'Revoir Casablanca' : 'Aller à Casablanca');
  go.onclick = () => { SND.play('whoosh'); show(cityScene, 'medina'); };
  sc.append(go);
  if (S.finished) sc.append(h('button', { class: 'btn ghost small', style: 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--u)*4)', onclick: () => show(endingScene) }, 'Et votre entreprise ?'));
  hud(sc, {});
}

// ------------------------------------------------------------------ VILLE
const STRIP_W = 1600, STRIP_H = 830;
async function cityScene(sc, district = 'medina', focusId = null) {
  if (district === 'affaires' && !S.youssef) district = 'medina';
  SND.setIntensity(.3 + lumiere() / 160);
  sc.style.background = '#071433';
  const H = stage.clientHeight * .7, k = H / STRIP_H, W = STRIP_W * k;
  const street = h('div', { class: 'street', style: `height:${H}px` });
  const strip = h('div', { class: 'strip', style: `width:${W}px;height:${H}px` });
  const bg = h('div', { class: 'bg', html: svgOf(district === 'medina' ? A.bg_medina : A.bg_affaires, '0 0 1600 830'), style: `width:${W}px;height:${H}px` });
  bg.firstChild.style.cssText = 'width:100%;height:100%';
  const night = h('div', { class: 'night', style: `opacity:${.8 - lumiere() / 100 * .8}` });
  strip.append(bg, night);
  // le ciel au-dessus de la rue suit la lumière
  const sky = h('div', { style: `position:absolute;inset:0;bottom:${H - 4}px;background:linear-gradient(180deg,${lumiere() > 60 ? '#5F9FF9' : '#0E2A6B'},${lumiere() > 60 ? '#DDEBFF' : '#1F57C7'})` });
  if (lumiere() <= 60) for (let i = 0; i < 26; i++) sky.append(h('i', { style: `position:absolute;left:${(i * 37) % 100}%;top:${20 + (i * 53) % 75}%;width:2px;height:2px;border-radius:50%;background:#fff;opacity:${.25 + (i % 4) * .15}` }));
  sc.append(sky);
  const bizs = C.businesses.filter(b => b.district === district);
  const nextBiz = C.businesses.find(b => !S.done[b.id] && (b.district === 'medina' || S.youssef));
  for (const b of bizs) {
    const on = !!S.done[b.id];
    const isTower = b.big;
    const w = (isTower ? 220 : 270) * k;
    const el = h('div', { class: 'biz ' + (on ? 'on' : 'off') + (S.flicker === b.id ? ' flicker' : ''), style: `left:${(b.x - (isTower ? 110 : 135)) * k}px;width:${w}px`, 'data-id': b.id,
      html: isTower ? svgOf(A.tower[b.tower], '0 0 240 600') : svgOf(A.facade[b.sector], '0 0 300 380') });
    let tag;
    if (S.flicker === b.id) tag = pill('Mise à jour ?', 'next');
    else if (on) tag = pill('En ligne', 'onl');
    else if (nextBiz && nextBiz.id === b.id) tag = pill(b.trade, 'next');
    else tag = pill('Hors ligne', 'offl');
    tag.classList.add('tag');
    el.append(tag);
    if (on) el.append(h('div', { class: 'pin show', style: 'top:-25%', html: `<svg viewBox="0 0 40 50" width="${30 * k * 3}px"><path d="M20 48 C8 32 2 24 2 16 a18 18 0 0 1 36 0 c0 8 -6 16 -18 32 z" fill="#2F84EC" stroke="#0E214E" stroke-width="3"/><circle cx="20" cy="16" r="6" fill="#fff"/></svg>` }));
    el.onclick = () => onBiz(b);
    strip.append(el);
  }
  street.append(strip); sc.append(street);
  // Lago dans la rue, près de la prochaine entreprise
  const target = focusId ? bizById(focusId) : (nextBiz && nextBiz.district === district ? nextBiz : bizs[0]);
  const lago = char(lumiere() >= 100 ? 'lago_saut' : 'lago_tablette', `width:${230 * k}px;bottom:${4 * k}px;left:${(target.x + (target.big ? 96 : 118)) * k}px;z-index:3`);
  strip.append(lago);
  // défilement : glisser, et centrer sur la cible
  let off = 0; const maxOff = Math.max(0, W - stage.clientWidth);
  const setOff = (v, anim = true) => { off = Math.max(0, Math.min(maxOff, v)); strip.style.transition = anim ? '' : 'none'; strip.style.transform = `translateX(${-off}px)`; };
  setOff(target.x * k - stage.clientWidth / 2, false);
  let sx = null, so = 0, moved = false;
  street.addEventListener('pointerdown', e => { sx = e.clientX; so = off; moved = false; });
  street.addEventListener('pointermove', e => { if (sx === null) return; const dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true; if (moved) setOff(so - dx, false); });
  street.addEventListener('pointerup', () => { sx = null; });
  street.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  // flèches : d'une entreprise à l'autre
  const xs = bizs.map(b => b.x * k - stage.clientWidth / 2);
  const go = dir => { SND.play('tap'); const cur = off + dir * 4; const nx = dir > 0 ? xs.find(v => v > cur + 2) : [...xs].reverse().find(v => v < cur - 2); setOff(nx === undefined ? (dir > 0 ? maxOff : 0) : nx); upd(); };
  const prev = h('button', { class: 'arrow', 'aria-label': 'Entreprise précédente', style: `left:calc(var(--u)*2.4);bottom:${H * .52}px`, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>', onclick: () => go(-1) });
  const next = h('button', { class: 'arrow', 'aria-label': 'Entreprise suivante', style: `right:calc(var(--u)*2.4);bottom:${H * .52}px`, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>', onclick: () => go(1) });
  const upd = () => { prev.disabled = off <= 2; next.disabled = off >= maxOff - 2; };
  sc.append(prev, next); upd();
  street.addEventListener('pointerup', upd);
  if (!S.tutoStreet) { S.tutoStreet = true; save(); setTimeout(() => toast('Glisse la rue ou touche les flèches. Touche l’entreprise en doré.', 3600), 900); }
  // onglets de quartier, Studio
  const tabs = h('div', { class: 'district-tabs' },
    h('button', { class: 'tab' + (district === 'medina' ? ' on' : ''), onclick: () => district !== 'medina' && (SND.play('whoosh'), show(cityScene, 'medina')) }, 'La médina'),
    h('button', { class: 'tab' + (district === 'affaires' ? ' on' : '') + (S.youssef ? '' : ' locked'), html: (S.youssef ? '' : icon('lock')) + 'Quartier d’affaires', style: 'white-space:nowrap', onclick: () => S.youssef ? district !== 'affaires' && (SND.play('whoosh'), show(cityScene, 'affaires')) : toast('Un partenaire doit d’abord vous présenter ces grandes entreprises.') }));
  tabs.querySelectorAll('svg').forEach(s => s.style.cssText = 'width:14px;height:14px');
  sc.append(tabs);
  sc.append(h('button', { class: 'btn light small', style: 'position:absolute;left:calc(var(--u)*4);top:calc(var(--u)*29);display:flex;align-items:center;gap:6px', html: icon('team', '#0E214E') + 'Le Studio', onclick: () => { SND.play('whoosh'); show(studioScene); } }));
  sc.querySelector('.btn.light svg').style.cssText = 'width:18px;height:18px';
  sc.append(h('div', { style: 'position:absolute;right:calc(var(--u)*4);top:calc(var(--u)*29);color:#fff;font:500 calc(var(--u)*3.4)/1.2 Sora;text-align:right' }, 'Casablanca', h('div', { style: 'color:#9FC8FF;font-size:calc(var(--u)*2.9)' }, `${doneCount(district)} / ${bizs.length} en ligne`)));
  hud(sc, { inbox: true, map: true });
  await wait(10);
  events(sc, district);
}

let LOCK = false;
async function onBiz(b) {
  if (LOCK || document.querySelector('.dialog.show,.mg')) return;
  SND.play('tap');
  if (S.flicker === b.id) return maintenance(b);
  if (S.done[b.id]) { toast(`${b.name} : en ligne, ${S.done[b.id].stars} étoile${S.done[b.id].stars > 1 ? 's' : ''} sur 3.`); return; }
  LOCK = true;
  const ok = await dialog({ who: b.big ? 'lago_cravate' : 'lago_tablette', name: b.name, role: b.trade, text: `<b>Le problème :</b> ${b.brief}`, choices: ['On s’en occupe', 'Plus tard'], avatarBox: 'width:200%;left:-50%;top:-4%' });
  LOCK = false;
  if (ok === 0) window.MISSION.run(b);
}

// ------------------------------------------------------------------ évènements de la ville : partenaire, recrutement, messages, maintenance, fin
async function events(sc, district) {
  if (current !== sc) return;
  const still = () => current === sc && !document.querySelector('.mg');
  LOCK = true;
  try {
    if (lumiere() >= 100 && !S.finished) { S.finished = true; save(); await wait(600); return show(endingScene); }
    if (!S.youssef && doneCount('medina') >= 2) { await wait(500); if (still()) await youssefEvent(); return; }
    if (!S.anas && S.missions >= 3) { await wait(500); if (still()) await recruitEvent(); return; }
    if (S.missions >= 3 && !S.flicker && Math.random() < .45) {
      const lit = C.businesses.filter(b => S.done[b.id] && b.district === district);
      if (lit.length) { S.flicker = lit[Math.floor(Math.random() * lit.length)].id; save(); await wait(900); if (!still()) return; const el = sc.querySelector(`.biz[data-id="${S.flicker}"]`); if (el) { el.classList.add('flicker'); const t = el.querySelector('.tag'); t.className = 'pill tag next'; t.textContent = 'Mise à jour ?'; } toast('Cumulus a la pluie : un site a besoin d’une mise à jour.'); }
    }
  } finally { LOCK = false; }
}

async function youssefEvent() {
  await dialog({ who: 'h_youssef', name: 'Youssef', role: 'Apporteur d’affaires', avatarBox: 'width:190%;left:-45%;top:-8%', text: 'Salam ! J’ai vu vos sites dans la médina. Je connais de grandes entreprises du quartier d’affaires qui ont besoin de vous.', choices: ['Parlons-en'] });
  let r;
  do {
    r = await dialog({ who: 'h_youssef', name: 'Youssef', role: 'Apporteur d’affaires', avatarBox: 'width:190%;left:-45%;top:-8%', text: 'Et pour ma commission, on fait comment ?', choices: ['On la fixe par écrit, avant le premier contact.', 'On verra ça à la fin du projet.'] });
    if (r === 1) { SND.play('miss'); await dialog({ who: 'gestion_salut', name: 'Gestion', role: 'Devis et accords', text: 'Chez Digilago, tout est écrit avant de commencer. Même avec nos partenaires.', choices: ['Bien vu, je reprends'] }); }
  } while (r === 1);
  SND.play('stamp'); toast('Accord signé avec Youssef', 2400); confetti(30);
  S.youssef = true; S.confiance = Math.min(100, S.confiance + 5); save();
  await dialog({ who: 'h_youssef', name: 'Youssef', role: 'Apporteur d’affaires', avatarBox: 'width:190%;left:-45%;top:-8%', text: 'Parfait. Le quartier d’affaires vous attend : deux grands comptes, un groupe de logistique et un hôtel.', choices: ['Aller au quartier d’affaires', 'Rester dans la médina'] }).then(i => i === 0 ? show(cityScene, 'affaires') : null);
}

async function recruitEvent() {
  toast('Les demandes s’accumulent au Studio…', 2000); await wait(900);
  await dialog({ who: 'h_rachid', name: 'Rachid', role: 'Directeur d’école, partenaire', avatarBox: 'width:190%;left:-45%;top:-8%', text: 'Bonjour ! Un de mes anciens élèves cherche un stage sur de vrais projets. Il s’appelle Anas.', choices: ['On le rencontre'] });
  let r;
  do {
    r = await dialog({ who: 'h_anas', name: 'Anas', role: 'Candidat au stage', avatarBox: 'width:190%;left:-45%;top:-8%', text: 'Je veux apprendre à répondre aux clients et à construire des sites. Comment ça se passe chez vous ?', choices: ['Tu travailles sur de vrais projets, avec quelqu’un à tes côtés.', 'Tu feras surtout le café.'] });
    if (r === 1) { SND.play('miss'); await dialog({ who: 'lago_pouce', name: 'Lago', role: 'Studio Digilago', text: 'Un stage chez Digilago, c’est sur de vrais projets, avec un suivi. On recommence ?', choices: ['Oui'] }); }
  } while (r === 1);
  SND.play('success'); confetti(30);
  S.anas = true; save();
  toast('Anas rejoint l’équipe : il répondra aux messages le jour même.', 2800);
}

async function maintenance(b) {
  const r = await dialog({ who: 'lago_laptop', name: 'Cumulus a la pluie', role: b.name, text: 'Une mise à jour attend sur ce site. Chez Digilago, on reste après la mise en ligne.', choices: ['Faire la mise à jour', 'Plus tard'] });
  if (r !== 0) return;
  SND.play('type'); await wait(300); SND.play('type'); await wait(300); SND.play('chime');
  S.flicker = null; S.confiance = Math.min(100, S.confiance + 4); save();
  toast('Mise à jour faite : le site reste allumé. Confiance +4');
  show(cityScene, b.district, b.id);
}

function openInbox(root) {
  SND.play('tap');
  if (!S.inbox.length) return toast('Aucun message en attente. Bravo !');
  const m = S.inbox[0], msg = C.messages[m];
  const opts = Math.random() < .5 ? [msg.good, msg.bad] : [msg.bad, msg.good];
  dialog({ who: 'h_kenza', name: msg.from, role: 'Message client', avatarBox: 'width:190%;left:-45%;top:-8%', text: `« ${msg.text} »`, choices: opts }).then(i => {
    const good = opts[i] === msg.good;
    S.inbox.shift(); S.confiance = Math.max(0, Math.min(100, S.confiance + (good ? 3 : -3))); save();
    SND.play(good ? 'chime' : 'miss'); toast(good ? 'Réponse le jour même. Confiance +3' : 'Le client attendait mieux. Confiance -3');
    const b = root.querySelector('.iconbtn .badge'); if (b) { if (S.inbox.length) b.textContent = S.inbox.length; else b.remove(); }
  });
}

// ------------------------------------------------------------------ STUDIO
async function studioScene(sc) {
  SND.setIntensity(.4);
  const bg = h('div', { style: 'position:absolute;inset:0', html: svgOf(A.bg_studio, '0 0 1600 900') });
  bg.firstChild.setAttribute('preserveAspectRatio', 'xMidYMid slice'); bg.firstChild.style.cssText = 'width:100%;height:100%';
  sc.append(bg, h('div', { style: 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(244,248,254,.0) 40%,rgba(7,20,51,.6))' }));
  const team = [['Lago', 'Construit les sites en 72 h', 'lago_repos'], ['Radar', 'Trouve les entreprises hors ligne', 'radar_salut'], ['Gestion', 'Écrit le prix avant de commencer', 'gestion_salut']];
  if (S.youssef) team.push(['Youssef', 'Apporteur d’affaires, accord signé', 'h_youssef']);
  if (S.anas) team.push(['Anas', 'Stagiaire : répond aux messages', 'h_anas']);
  const panel = h('div', { class: 'panel', style: 'position:absolute;left:calc(var(--u)*4);right:calc(var(--u)*4);bottom:calc(var(--u)*6);padding:calc(var(--u)*5)' },
    h('h2', { style: 'font-size:calc(var(--u)*6)' }, 'Le Studio, Casablanca'),
    h('p', { style: 'margin:calc(var(--u)*1.4) 0 calc(var(--u)*3);color:#4A5876;font-size:calc(var(--u)*3.5)' }, `${C.businesses.filter(b => S.done[b.id]).length} entreprises en ligne · Confiance ${S.confiance}`));
  const list = h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*2.4)' });
  team.forEach(([n, r, k]) => list.append(h('div', { style: 'display:flex;align-items:center;gap:calc(var(--u)*2);background:#F4F8FE;border-radius:calc(var(--u)*3);padding:calc(var(--u)*2)' },
    h('div', { style: 'width:calc(var(--u)*11);height:calc(var(--u)*11);border-radius:50%;overflow:hidden;position:relative;flex:none;background:#DDEBFF', html: svgOf(A[k]) }),
    h('div', {}, h('div', { class: 'sora', style: 'font-size:calc(var(--u)*3.6)' }, n), h('div', { style: 'font-size:calc(var(--u)*2.8);color:#4A5876;line-height:1.3' }, r)))));
  list.querySelectorAll('svg').forEach(s => s.style.cssText = 'position:absolute;width:220%;left:-60%;top:-6%');
  panel.append(list, h('button', { class: 'btn', style: 'width:100%;margin-top:calc(var(--u)*4)', onclick: () => { SND.play('whoosh'); show(cityScene, 'medina'); } }, 'Retour en ville'));
  sc.append(panel);
  hud(sc, { map: true });
}

// ------------------------------------------------------------------ FIN : « Et votre entreprise ? »
async function endingScene(sc) {
  SND.setIntensity(1);
  window.track && window.track('jeu_lago_fin', { confiance: S.confiance });
  sc.style.background = 'linear-gradient(180deg,#5F9FF9,#DDEBFF 55%,#FFF4DE)';
  confetti(70); SND.play('online');
  sc.append(char('radar_bravo', 'width:46%;left:-4%;bottom:44%'), char('gestion_salut', 'width:46%;left:58%;bottom:44%'), char('lago_saut', 'width:56%;left:22%;bottom:46%'));
  const box = h('div', { class: 'panel fade-in', style: 'position:absolute;left:calc(var(--u)*4);right:calc(var(--u)*4);bottom:calc(var(--u)*6);padding:calc(var(--u)*5.4)' });
  box.append(h('h2', { style: 'font-size:calc(var(--u)*7)' }, 'Casablanca brille !'),
    h('p', { style: 'margin:calc(var(--u)*2) 0 calc(var(--u)*4);color:#4A5876;font-size:calc(var(--u)*3.8);line-height:1.45' }, 'Il reste une entreprise à allumer : la vôtre. Tapez son nom.'));
  const input = h('input', { class: 'name', placeholder: 'Le nom de votre entreprise', maxlength: '40', value: S.player || '' });
  const res = h('div');
  const go = h('button', { class: 'btn gold', style: 'width:100%;margin-top:calc(var(--u)*3)' }, 'Allumer mon entreprise');
  go.onclick = async () => {
    const name = input.value.trim(); if (!name) { input.focus(); return; }
    S.player = name; save(); SND.play('online'); confetti(50);
    res.innerHTML = '';
    const card = h('div', { class: 'pop', style: 'display:flex;align-items:center;gap:calc(var(--u)*3);margin-top:calc(var(--u)*4);background:#F4F8FE;border-radius:calc(var(--u)*4);padding:calc(var(--u)*3)' },
      h('div', { style: 'width:calc(var(--u)*16);flex:none', html: svgOf(A.facade.commerce, '0 0 300 380') }),
      h('div', {}, h('div', { class: 'sora', style: 'font-size:calc(var(--u)*4.6)' }, name), h('div', { style: 'color:#1FA463;font:500 calc(var(--u)*3.3) Sora;margin-top:4px' }, '● En ligne, demain')));
    const cta = h('a', { class: 'btn', style: 'display:block;text-align:center;text-decoration:none;margin-top:calc(var(--u)*3)', href: 'https://digilago.ma/demarrer.html?source=jeu-lago', target: '_blank', rel: 'noopener', onclick: () => window.track && window.track('jeu_lago_demarrer', {}) }, 'Démarrer mon projet');
    const share = h('button', { class: 'btn light small', style: 'margin-top:calc(var(--u)*2.4);width:100%', onclick: async () => {
      const text = `J’ai allumé Casablanca dans le jeu LAGO de Digilago. À votre tour !`;
      const url = 'https://www.digilago.ma/lab-lago.html';
      try { await navigator.share({ title: 'LAGO, allume le Maroc', text, url }); }
      catch (e) { try { await navigator.clipboard.writeText(text + ' ' + url); toast('Lien copié'); } catch (e2) { toast('digilago.ma/lab-lago.html'); } }
    } }, 'Partager le jeu');
    res.append(card, cta, share);
  };
  box.append(input, go, res, h('button', { class: 'btn ghost small', style: 'width:100%;margin-top:calc(var(--u)*2.4);color:#0E214E;box-shadow:inset 0 0 0 2px #C9D7EC', onclick: () => show(mapScene) }, 'Retour à la carte'));
  sc.append(box);
}

window.GAME = { S: () => S, save, show, toast, dialog, confetti, char, h, svgOf, icon, wait, lumiere, cityScene, mapScene, titleScene, endingScene, pill, setS: v => { S = v; save(); } };
show(titleScene);
})();
