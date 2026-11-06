// LAGO, allume le Maroc : une mission = Radar → métier → devis → 72 h → en ligne.
(() => {
const A = window.ASSETS, C = window.CONTENT, SND = window.SND;
const G = window.GAME;
const { h, svgOf, icon, wait, toast, confetti, char } = G;
const stage = document.getElementById('stage');
const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const STEPS = ['Radar', 'Le métier', 'Le devis', '72 heures', 'En ligne'];

// Indices du client pour le devis : chaque phrase pointe vers un besoin.
const CLUES = {
  ecole: ['« Les parents ne trouvent ni les horaires ni les inscriptions. »', '« Sur Google, on ne nous voit pas. »', '« Les parents préfèrent nous écrire sur WhatsApp. »'],
  cafe: ['« Les touristes veulent voir la carte avant d’entrer. »', '« Sur Google Maps, on n’apparaît même pas. »', '« Le soir, on aimerait que les gens réservent une table. »'],
  sante: ['« Les parents veulent savoir où on est et nos horaires. »', '« On nous cherche sur Google. »', '« Le téléphone sonne pour des rendez-vous toute la journée. »'],
  commerce: ['« Nos clients aimeraient commander nos produits en ligne. »', '« Sur Google, l’épicerie n’existe pas. »', '« Beaucoup préfèrent commander sur WhatsApp. »'],
  sport: ['« Il nous faut une vraie page pour le club. »', '« Les créneaux doivent se réserver en ligne. »', '« Le matin, il faut faire venir du monde. »'],
  logistique: ['« Nos clients doivent pouvoir suivre leurs colis sur leur téléphone. »', '« Il nous faut un site qui présente le groupe. »', '« Nos agences doivent être visibles sur Google. »', '« Nos commerciaux veulent plus de demandes. »'],
  hotel: ['« Il nous faut un site en trois langues. »', '« Les clients doivent réserver en direct. »', '« L’hôtel doit sortir sur Google Maps. »', '« Les voyageurs demandent maintenant à ChatGPT où dormir. »'],
};
const BUILD_MSG = [
  { text: 'Peut-on mettre notre logo en plus grand ?', good: 'Bien sûr, c’est fait aujourd’hui.', bad: 'On verra après la mise en ligne.' },
  { text: 'On a de nouvelles photos, je vous les envoie ?', good: 'Oui, envoyez : je les ajoute tout de suite.', bad: 'Trop tard, le site est presque fini.' },
  { text: 'Est-ce qu’on peut ajouter l’arabe ?', good: 'Oui, on prévoit l’arabe dès maintenant.', bad: 'Ce n’est pas prévu.' },
  { text: 'Vous avez reçu notre numéro WhatsApp ?', good: 'Oui, il est déjà sur le bouton.', bad: 'Je regarderai demain.' },
];
const COSTUME_LINE = {
  chef: 'Tablier de chef : Lago passe en cuisine.', sante: 'Blouse blanche : Lago entre au cabinet.', ecole: 'Toque de diplômé : Lago rejoint l’école.',
  commerce: 'Casquette de l’épicerie : Lago tient la boutique.', sport: 'Maillot du club : Lago descend sur le terrain.', cravate: 'Costume et cravate : Lago part en réunion.',
};
const CLIENT_AV = { logistique: ['h_omar', 'Omar, directeur général'], hotel: ['h_nadia', 'Nadia, directrice de l’hôtel'] };

function shell({ step, title, text, dark = false }) {
  const mg = h('div', { class: 'mg' + (dark ? ' dark' : '') });
  const dots = h('div', { style: 'display:flex;justify-content:center;gap:6px;margin-bottom:calc(var(--u)*2.4)' },
    STEPS.map((s, i) => h('i', { style: `width:${i === step ? 20 : 7}px;height:7px;border-radius:4px;background:${i < step ? '#3DDC97' : i === step ? '#F5B83D' : (dark ? 'rgba(159,200,255,.35)' : '#C9D7EC')};transition:width .3s` })));
  const head = h('div', { class: 'mg-head' }, dots, h('div', { class: 'step' }, `Étape ${step + 1} sur 5 · ${STEPS[step]}`), h('h2', {}, title), text ? h('p', { html: text }) : '');
  const body = h('div', { class: 'mg-body' }), foot = h('div', { class: 'mg-foot' });
  mg.append(head, body, foot);
  stage.append(mg);
  mg.animate([{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' });
  return { mg, head, body, foot, close: () => new Promise(r => { mg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).onfinish = () => { mg.remove(); r(); }; }) };
}
const btn = (label, cls = '', onclick) => h('button', { class: 'btn ' + cls, onclick }, label);
function say(parent, text, css = '') {
  const b = h('div', { class: 'pop', style: `position:absolute;z-index:6;background:#fff;color:#0E214E;border-radius:calc(var(--u)*4);padding:calc(var(--u)*2.6) calc(var(--u)*3.4);font:500 calc(var(--u)*3.5)/1.3 Sora;letter-spacing:-.02em;box-shadow:0 10px 26px rgba(7,20,51,.3);${css}` }, text);
  parent.append(b); return b;
}

// ================================================================== 1. RADAR : tape quand le faisceau passe sur l'entreprise
async function radarStep(m) {
  const { body, foot, close } = shell({ step: 0, dark: true, title: 'Radar repère les entreprises', text: 'Touche <b>Scanner</b> quand le faisceau passe sur le point doré : une entreprise invisible en ligne.' });
  const size = 'min(calc(var(--u)*76), 92%)';
  const scr = h('div', { style: `position:absolute;left:50%;top:2%;transform:translateX(-50%);width:${size};aspect-ratio:1` });
  const tgtA = rnd(30, 330), tgtR = rnd(.42, .78);
  const others = Array.from({ length: 7 }, () => [rnd(0, 360), rnd(.25, .9)]);
  const pt = (a, r) => [50 + Math.sin(a * Math.PI / 180) * r * 46, 50 - Math.cos(a * Math.PI / 180) * r * 46];
  const [tx, ty] = pt(tgtA, tgtR);
  scr.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%;height:100%;overflow:visible">
    <defs><radialGradient id="rdBg"><stop offset="0" stop-color="#163C85"/><stop offset="1" stop-color="#0A1A45"/></radialGradient>
    <linearGradient id="rdBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3DDC97" stop-opacity="0"/><stop offset="1" stop-color="#3DDC97" stop-opacity=".55"/></linearGradient></defs>
    <circle cx="50" cy="50" r="48" fill="url(#rdBg)" stroke="#5F9FF9" stroke-width="1.2"/>
    ${[12, 24, 36].map(r => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#5F9FF9" stroke-opacity=".3" stroke-width=".5"/>`).join('')}
    <path d="M50 2V98M2 50H98" stroke="#5F9FF9" stroke-opacity=".25" stroke-width=".5"/>
    ${others.map(([a, r]) => { const [x, y] = pt(a, r); return `<circle cx="${x}" cy="${y}" r="1.4" fill="#9FC8FF" opacity=".5"/>`; }).join('')}
    <g id="rdSweep"><path d="M50 50 L50 2 A48 48 0 0 1 ${50 + Math.sin(.5) * 48} ${50 - Math.cos(.5) * 48} Z" fill="url(#rdBeam)" transform="rotate(-28.6 50 50)"/><path d="M50 50 L50 2" stroke="#3DDC97" stroke-width=".8"/></g>
    <circle id="rdTgt" cx="${tx}" cy="${ty}" r="2.6" fill="#F5B83D"><animate attributeName="r" values="2.2;3.4;2.2" dur="1.2s" repeatCount="indefinite"/></circle>
    <circle id="rdRing" cx="${tx}" cy="${ty}" r="3" fill="none" stroke="#F5B83D" stroke-width=".8" opacity="0"/>
    <circle cx="50" cy="50" r="2" fill="#3DDC97"/></svg>`;
  body.append(scr);
  const rad = char('radar_tablette', 'width:44%;left:-4%;bottom:-6%');
  body.append(rad);
  const info = h('div', { style: 'position:absolute;right:calc(var(--u)*5);bottom:calc(var(--u)*6);width:52%;color:#C9D7EC;font-size:calc(var(--u)*3.4);line-height:1.4;text-align:right' }, 'Essais : ', h('b', { style: 'color:#fff' }, '3'));
  body.append(info);
  const sweep = scr.querySelector('#rdSweep');
  let ang = rnd(0, 360), last = performance.now(), run = true, tries = 3, found = false;
  const speed = 150 + G.S().missions * 12;   // degrés par seconde, un peu plus vite à chaque mission
  const loop = t => { if (!run) return; ang = (ang + (t - last) / 1000 * speed) % 360; last = t; sweep.setAttribute('transform', `rotate(${ang} 50 50)`); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  let lastPing = 0;
  const pingTimer = setInterval(() => { if (Math.abs(((ang - tgtA + 540) % 360) - 180) < 12 && performance.now() - lastPing > 600) { lastPing = performance.now(); SND.play('sonar'); } }, 40);
  await new Promise(res => {
    const b = btn('Scanner', 'gold', () => {
      if (found) return;
      const d = Math.abs(((ang - tgtA + 540) % 360) - 180);
      if (d < 22 || tries <= 1) {
        found = true; run = false; clearInterval(pingTimer); SND.play('ping');
        m.radarPerfect = d < 22 && tries === 3;
        const ring = scr.querySelector('#rdRing'); ring.style.opacity = 1;
        ring.animate([{ r: 3, opacity: 1 }, { r: 14, opacity: 0 }], { duration: 900, iterations: 2 });
        b.disabled = true; res();
      } else { tries--; SND.play('miss'); info.lastChild.textContent = String(tries); b.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 250 }); }
    });
    b.style.minWidth = '60%'; foot.append(b);
  });
  await wait(500);
  info.remove();
  const card = h('div', { class: 'panel pop', style: 'position:absolute;right:calc(var(--u)*4);left:38%;bottom:calc(var(--u)*4);padding:calc(var(--u)*4)' },
    h('div', { class: 'sora', style: 'font-size:calc(var(--u)*4.2)' }, m.b.name),
    h('div', { style: 'color:#E5484D;font:500 calc(var(--u)*3.1) Sora;margin:6px 0 8px' }, '● Hors ligne'),
    h('p', { style: 'margin:0;font-size:calc(var(--u)*3.3);line-height:1.4;color:#4A5876' }, m.b.brief));
  body.append(card);
  foot.innerHTML = '';
  await new Promise(r => foot.append(btn('On y va', 'gold', r)));
  SND.play('tap');
  await close();
}

// ================================================================== 2. LE MÉTIER : Lago enfile la tenue, puis un jeu propre au métier
async function costumeReveal(m) {
  const k = m.b.costume;
  const { body, foot, close } = shell({ step: 1, title: 'Lago change de tenue', text: COSTUME_LINE[k] });
  const before = char('lago_repos', 'width:72%;left:14%;top:0');
  body.append(before);
  await wait(700);
  SND.play('whoosh');
  const puff = h('div', { style: 'position:absolute;left:50%;top:38%;width:70%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff 0 40%,rgba(255,255,255,0) 70%)' });
  body.append(puff);
  puff.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1, offset: .5 }, { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0 }], { duration: 700 });
  await wait(330);
  before.remove();
  const after = char('lago_' + k, 'width:72%;left:14%;top:0', 'idle pop');
  body.append(after);
  SND.play('pop');
  await new Promise(r => foot.append(btn('Au travail', 'gold', r)));
  SND.play('tap');
  await close();
}

// --- école : les questions des parents deviennent des réponses sur le site
async function gameQuestions(m) {
  const { body, foot, close } = shell({ step: 1, title: 'Les questions des parents', text: 'Touche chaque question : Lago la transforme en réponse sur le site. Il en faut <b>6</b> avant la sonnerie.' });
  const page = h('div', { class: 'panel', style: 'position:absolute;left:calc(var(--u)*5);right:calc(var(--u)*5);bottom:calc(var(--u)*2);height:30%;padding:calc(var(--u)*3);overflow:hidden' },
    h('div', { class: 'sora', style: 'font-size:calc(var(--u)*3.4);color:#1F57C7;margin-bottom:6px' }, 'Le site de l’école · Questions fréquentes'));
  const list = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }); page.append(list);
  const timer = h('div', { class: 'timer' }, h('i', { style: 'width:100%' }));
  const count = h('div', { class: 'big-count', style: 'position:absolute;left:0;right:0;top:calc(var(--u)*3)' }, '0 / 6');
  body.append(timer, count, page, char('lago_ecole', 'width:30%;right:-2%;bottom:30%'));
  let got = 0, live = true; const T = 20000, t0 = performance.now(), answered = new Set();
  const spawn = () => {
    if (!live) return;
    const floating = [...body.querySelectorAll('button.q')].map(e => e.textContent);
    const pool = C.ecoleQuestions.filter(x => !answered.has(x) && !floating.includes(x));
    const q = (pool.length ? pool : C.ecoleQuestions)[Math.floor(Math.random() * (pool.length || C.ecoleQuestions.length))];
    const x = rnd(4, 58), travel = body.clientHeight * .5;
    const bub = h('button', { class: 'choice q', style: `position:absolute;left:${x}%;top:60%;width:auto;padding:calc(var(--u)*2.6) calc(var(--u)*3.6);background:#fff;font-family:Sora;font-size:calc(var(--u)*3.6);border-radius:999px 999px 999px 6px` }, q);
    const anim = bub.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: .1 }, { transform: `translateY(${-travel * .9}px)`, opacity: 1, offset: .9 }, { transform: `translateY(${-travel}px)`, opacity: 0 }], { duration: 3800, easing: 'linear' });
    anim.onfinish = () => bub.remove();
    bub.onclick = () => {
      if (!live) return; anim.cancel(); bub.remove(); got++; SND.play('pop'); count.textContent = `${got} / 6`;
      if (answered.has(q)) return; answered.add(q);
      list.append(h('span', { class: 'pill pop', style: 'background:#E3FAF0;color:#0E214E;font-size:calc(var(--u)*2.9)', html: icon('check', '#1FA463', 3) + q.replace(' ?', '') }));
      list.lastChild.querySelector('svg').style.cssText = 'width:12px;height:12px';
      if (got >= 6) end();
    };
    body.append(bub);
    setTimeout(spawn, rnd(520, 900));
  };
  let endRes; const done = new Promise(r => endRes = r);
  const tick = () => { if (!live) return; const p = 1 - (performance.now() - t0) / T; timer.firstChild.style.width = Math.max(0, p * 100) + '%'; if (p <= 0) end(); else requestAnimationFrame(tick); };
  function end() { if (!live) return; live = false; body.querySelectorAll('button.choice').forEach(b => b.remove()); endRes(); }
  spawn(); tick();
  await done;
  m.metierOk = got >= 6;
  await resultLine(body, foot, m.metierOk ? 'Toutes les questions ont leur réponse en ligne.' : `${got} réponses en ligne : les autres arriveront avec le site.`, m.metierOk);
  await close();
}

// --- café : remplir les verres de thé, ni trop ni trop peu
async function gameThe(m) {
  const { body, foot, close } = shell({ step: 1, title: 'Le thé de l’Horloge', text: 'Garde le doigt appuyé pour verser. Relâche quand le thé atteint la <b>bande dorée</b>. Trois verres.' });
  const glassW = 34;
  const wrap = h('div', { style: `position:absolute;left:50%;top:6%;transform:translateX(-50%);width:calc(var(--u)*${glassW * 2});height:62%` });
  wrap.innerHTML = `<svg viewBox="0 0 120 200" style="width:100%;height:100%;overflow:visible">
    <g transform="translate(18 -6) rotate(28 50 30)"><path d="M18 22 Q50 -2 82 22 L76 52 Q50 62 24 52 Z" fill="#C9D7EC" stroke="#0E214E" stroke-width="4"/><path d="M80 30 Q104 24 110 6" fill="none" stroke="#0E214E" stroke-width="6" stroke-linecap="round"/><path d="M80 30 Q104 24 110 6" fill="none" stroke="#C9D7EC" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="8" r="6" fill="#C9D7EC" stroke="#0E214E" stroke-width="3.5"/></g>
    <path id="stream" d="M108 34 Q100 70 60 96" stroke="#C9822F" stroke-width="5" fill="none" stroke-linecap="round" opacity="0"/>
    <clipPath id="glassClip"><path d="M24 92 L96 92 L88 192 L32 192 Z"/></clipPath>
    <g clip-path="url(#glassClip)"><rect id="tea" x="0" y="192" width="120" height="0" fill="#C9822F"/><rect id="foam" x="0" y="192" width="120" height="5" fill="#F3D9A4"/>
    <rect id="zone" x="0" y="0" width="120" height="0" fill="#F5B83D" opacity=".35"/></g>
    <path d="M24 92 L96 92 L88 192 L32 192 Z" fill="rgba(221,235,255,.25)" stroke="#0E214E" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 100 L36 180" stroke="#fff" stroke-width="4" opacity=".7" stroke-linecap="round"/></svg>`;
  body.append(wrap, char('lago_chef', 'width:40%;left:-4%;bottom:0'));
  const score = h('div', { class: 'big-count', style: 'position:absolute;right:calc(var(--u)*6);bottom:calc(var(--u)*6);color:#0E214E' }, '');
  body.append(score);
  const tea = wrap.querySelector('#tea'), foam = wrap.querySelector('#foam'), zone = wrap.querySelector('#zone'), stream = wrap.querySelector('#stream');
  let good = 0;
  for (let g = 0; g < 3; g++) {
    const zLo = rnd(.55, .78), zH = .12 - g * .02;     // fraction de remplissage (0 = vide, 1 = plein)
    const yOf = f => 192 - f * 100;
    zone.setAttribute('y', yOf(zLo + zH)); zone.setAttribute('height', zH * 100);
    let level = 0; tea.setAttribute('y', 192); tea.setAttribute('height', 0); foam.setAttribute('y', 192);
    score.textContent = `Verre ${g + 1} / 3`;
    const ok = await new Promise(res => {
      let pouring = false, raf, last, sndT = 0;
      const b = btn('Verser', 'gold'); b.style.minWidth = '60%'; b.style.touchAction = 'none';
      const step = t => { if (!pouring) return; const dt = (t - last) / 1000; last = t; level = Math.min(1.05, level + dt * (.42 + g * .08)); tea.setAttribute('y', yOf(level)); tea.setAttribute('height', level * 100); foam.setAttribute('y', yOf(level)); if (t - sndT > 220) { sndT = t; SND.play('pour'); } if (level >= 1.05) stop(); else raf = requestAnimationFrame(step); };
      const start = e => { e.preventDefault(); if (pouring) return; pouring = true; stream.style.opacity = 1; last = performance.now(); raf = requestAnimationFrame(step); };
      const stop = () => { if (!pouring) return; pouring = false; cancelAnimationFrame(raf); stream.style.opacity = 0; b.remove(); res(level >= zLo && level <= zLo + zH); };
      b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
      foot.append(b);
    });
    if (ok) { good++; SND.play('chime'); say(body, 'Parfait !', 'left:50%;top:30%;transform:translateX(-50%)'); } else { SND.play('miss'); say(body, level < zLo ? 'Pas assez…' : 'Ça déborde !', 'left:50%;top:30%;transform:translateX(-50%)'); }
    await wait(900); body.querySelectorAll('.pop').forEach(e => e.remove());
  }
  m.metierOk = good >= 2;
  await resultLine(body, foot, m.metierOk ? `${good} verres parfaits : Lago connaît la maison.` : 'Lago a goûté le thé : il sait ce qu’il faut montrer.', m.metierOk);
  await close();
}

// --- santé : ranger les rendez-vous dans l'ordre
async function gameRdv(m) {
  const { body, foot, close } = shell({ step: 1, title: 'L’agenda du cabinet', text: 'Le téléphone n’arrête pas. Touche les rendez-vous <b>dans l’ordre des heures</b> pour remplir l’agenda.' });
  const times = shuffle(['08:30', '09:15', '10:00', '11:30', '14:00', '15:45', '16:30']).slice(0, 5).sort();
  const names = shuffle(['Yasmine, 4 ans', 'Adam, 7 ans', 'Lina, 2 ans', 'Rayan, 9 ans', 'Inès, 5 ans', 'Ilyas, 3 ans']);
  const agenda = h('div', { class: 'panel', style: 'position:absolute;left:calc(var(--u)*5);right:calc(var(--u)*5);top:0;padding:calc(var(--u)*3.4)' },
    h('div', { class: 'sora', style: 'font-size:calc(var(--u)*3.6);color:#1FA463;margin-bottom:8px' }, 'Agenda en ligne · Lundi'));
  const rows = times.map(t => { const r = h('div', { style: 'display:flex;gap:10px;align-items:center;padding:calc(var(--u)*1.5) 0;border-top:1px solid #E3ECF8;font-size:calc(var(--u)*3.4)' }, h('b', { class: 'sora', style: 'width:calc(var(--u)*13);color:#4A5876' }, t), h('span', { style: 'color:#9FB4D6' }, 'libre')); agenda.append(r); return r; });
  const cards = h('div', { style: 'position:absolute;left:calc(var(--u)*5);right:calc(var(--u)*5);bottom:calc(var(--u)*2);display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*2.4)' });
  body.append(agenda, cards, char('lago_sante', 'width:28%;right:-1%;top:30%'));
  let idx = 0, errors = 0;
  await new Promise(res => {
    shuffle(times.map((t, i) => [t, names[i]])).forEach(([t, n]) => {
      const c = h('button', { class: 'block', style: 'text-align:left;display:flex;flex-direction:column;gap:4px' }, h('span', { style: 'font-size:calc(var(--u)*4.6);color:#1F57C7' }, t), h('span', { style: 'font-family:Instrument Sans;font-size:calc(var(--u)*3.1);color:#4A5876' }, n));
      c.onclick = () => {
        if (t === times[idx]) { SND.play('pop'); c.style.visibility = 'hidden'; const r = rows[idx]; r.lastChild.textContent = n; r.lastChild.style.color = '#0E214E'; r.style.background = '#E3FAF0'; r.animate([{ background: '#3DDC97' }, { background: '#E3FAF0' }], { duration: 500 }); idx++; if (idx === times.length) res(); }
        else { errors++; SND.play('miss'); c.classList.remove('wrong'); void c.offsetWidth; c.classList.add('wrong'); }
      };
      cards.append(c);
    });
  });
  m.metierOk = errors <= 1;
  await resultLine(body, foot, errors === 0 ? 'Agenda parfait : plus besoin de décrocher.' : 'L’agenda est plein : les parents réservent seuls.', m.metierOk);
  await close();
}

// --- épicerie : photographier les produits pour la boutique en ligne
const PRODUCTS = {
  olives: '<ellipse cx="0" cy="8" rx="22" ry="12" fill="#7E8A3A" stroke="#0E214E" stroke-width="3.5"/><circle cx="-8" cy="2" r="7" fill="#556B2F" stroke="#0E214E" stroke-width="3"/><circle cx="6" cy="0" r="7" fill="#3E4F1F" stroke="#0E214E" stroke-width="3"/><circle cx="-1" cy="-8" r="7" fill="#6B7F2A" stroke="#0E214E" stroke-width="3"/>',
  miel: '<rect x="-16" y="-14" width="32" height="34" rx="8" fill="#F5B83D" stroke="#0E214E" stroke-width="3.5"/><rect x="-18" y="-22" width="36" height="10" rx="3" fill="#E5484D" stroke="#0E214E" stroke-width="3.5"/><rect x="-10" y="-2" width="20" height="10" rx="2" fill="#fff"/>',
  epices: '<path d="M-24 18 Q0 -26 24 18 Z" fill="#E5484D" stroke="#0E214E" stroke-width="3.5"/><path d="M-12 18 Q2 -6 14 18" fill="#F5B83D" opacity=".8"/>',
  the: '<rect x="-18" y="-18" width="36" height="38" rx="5" fill="#1FA463" stroke="#0E214E" stroke-width="3.5"/><path d="M-8 4 q8 -16 16 0 q-8 10 -16 0z" fill="#fff"/>',
  huile: '<path d="M-10 -24 h20 v8 q12 6 12 18 v20 h-44 v-20 q0 -12 12 -18z" fill="#E9C46A" stroke="#0E214E" stroke-width="3.5"/><rect x="-6" y="-30" width="12" height="8" fill="#0E214E"/>',
  dattes: '<ellipse cx="-9" cy="6" rx="9" ry="14" fill="#7A3E1D" stroke="#0E214E" stroke-width="3" transform="rotate(-20 -9 6)"/><ellipse cx="9" cy="6" rx="9" ry="14" fill="#8E4A22" stroke="#0E214E" stroke-width="3" transform="rotate(20 9 6)"/>',
};
async function gameRayons(m) {
  const { body, foot, close } = shell({ step: 1, title: 'La boutique se remplit', text: 'Les produits apparaissent sur les étagères : touche-les pour les <b>photographier</b> avant qu’ils disparaissent. Objectif : 10.' });
  const timer = h('div', { class: 'timer' }, h('i', { style: 'width:100%' }));
  const count = h('div', { class: 'big-count', style: 'position:absolute;left:0;right:0;top:calc(var(--u)*3)' }, '0 / 10');
  const shelf = h('div', { style: 'position:absolute;left:calc(var(--u)*5);right:calc(var(--u)*5);top:calc(var(--u)*13);bottom:calc(var(--u)*24);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:0;background:#F4E9D8;border-radius:calc(var(--u)*4);box-shadow:inset 0 0 0 3px #0E214E;padding:calc(var(--u)*2)' });
  const cells = Array.from({ length: 9 }, () => { const c = h('div', { style: 'position:relative;border-bottom:5px solid #B07A3B' }); shelf.append(c); return c; });
  body.append(timer, count, shelf, char('lago_commerce', 'width:34%;left:-3%;bottom:-6%'));
  const flash = h('div', { style: 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:9' }); body.append(flash);
  let got = 0, live = true; const T = 20000, t0 = performance.now();
  const keys = Object.keys(PRODUCTS);
  const spawn = () => {
    if (!live) return;
    const free = cells.filter(c => !c.firstChild); if (free.length) {
      const c = free[Math.floor(Math.random() * free.length)];
      const p = h('button', { style: 'position:absolute;inset:8%;border:0;background:none;padding:0;cursor:pointer', html: `<svg viewBox="-30 -32 60 60" style="width:100%;height:100%">${PRODUCTS[keys[Math.floor(Math.random() * keys.length)]]}</svg>` });
      p.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.2,1.6,.4,1)' });
      const life = Math.max(700, 1350 - got * 40);
      const to = setTimeout(() => { p.animate([{ transform: 'scale(1)' }, { transform: 'scale(0)' }], { duration: 160 }).onfinish = () => p.remove(); }, life);
      p.onclick = () => { if (!live) return; clearTimeout(to); got++; count.textContent = `${got} / 10`; SND.play('pop'); flash.animate([{ opacity: .7 }, { opacity: 0 }], { duration: 220 }); p.innerHTML += `<div class="pop" style="position:absolute;inset:0;display:grid;place-items:center">${icon('check', '#1FA463', 4)}</div>`; p.lastChild.firstChild.style.cssText = 'width:50%;height:50%'; p.onclick = null; setTimeout(() => p.remove(), 380); if (got >= 10) end(); };
      c.append(p);
    }
    setTimeout(spawn, rnd(380, 650));
  };
  let endRes; const done = new Promise(r => endRes = r);
  const tick = () => { if (!live) return; const p = 1 - (performance.now() - t0) / T; timer.firstChild.style.width = Math.max(0, p * 100) + '%'; if (p <= 0) end(); else requestAnimationFrame(tick); };
  function end() { if (!live) return; live = false; endRes(); }
  spawn(); tick(); await done;
  m.metierOk = got >= 10;
  await resultLine(body, foot, m.metierOk ? '10 produits photographiés : la boutique est prête.' : `${got} produits en boutique : on complètera ensemble.`, m.metierOk);
  await close();
}

// --- club de foot : tirs au but au bon moment
async function gameFoot(m) {
  const { body, foot, close } = shell({ step: 1, title: 'Tirs au but', text: 'Le gardien bouge. Tire quand la cible dorée est <b>loin de lui</b>. Marque 2 buts sur 3.' });
  const field = h('div', { style: 'position:absolute;left:0;right:0;top:0;bottom:0;background:linear-gradient(180deg,#5FB86B,#3E9A50);overflow:hidden' });
  field.innerHTML = `<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMin meet" style="position:absolute;inset:0;width:100%;height:100%">
    ${Array.from({ length: 6 }, (_, i) => `<rect x="0" y="${i * 20}" width="100" height="10" fill="#fff" opacity=".06"/>`).join('')}
    <rect x="12" y="10" width="76" height="32" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-width="2"/>
    ${Array.from({ length: 9 }, (_, i) => `<path d="M${12 + i * 9.5} 10 V42" stroke="#fff" stroke-opacity=".35" stroke-width=".5"/>`).join('')}${Array.from({ length: 4 }, (_, i) => `<path d="M12 ${10 + i * 8} H88" stroke="#fff" stroke-opacity=".35" stroke-width=".5"/>`).join('')}
    <path d="M4 42 H96 M24 42 V58 H76 V42" stroke="#fff" stroke-width="1.2" fill="none"/>
    <g id="keeper"><circle cx="0" cy="24" r="5" fill="#E5484D" stroke="#0E214E" stroke-width="1.2"/><rect x="-7" y="28" width="14" height="12" rx="3" fill="#E5484D" stroke="#0E214E" stroke-width="1.2"/><path d="M-7 31 L-14 22 M7 31 L14 22" stroke="#0E214E" stroke-width="2.4" stroke-linecap="round"/><circle cx="-2" cy="23" r=".9" fill="#0E214E"/><circle cx="2" cy="23" r=".9" fill="#0E214E"/></g>
    <g id="aim"><circle r="4.5" fill="none" stroke="#F5B83D" stroke-width="1.6"/><circle r="1.2" fill="#F5B83D"/></g>
    <g id="ball" transform="translate(50 92)"><circle r="4.4" fill="#fff" stroke="#0E214E" stroke-width="1"/><path d="M0 -1.8 L1.7 -.5 L1 1.5 H-1 L-1.7 -.5 Z" fill="#0E214E"/></g></svg>`;
  body.append(field, char('lago_sport', 'width:38%;left:2%;bottom:-2%'));
  const score = h('div', { class: 'pill', style: 'position:absolute;right:calc(var(--u)*4);bottom:calc(var(--u)*4);background:#fff;font-size:calc(var(--u)*3.6)' }, 'Buts : 0 / 3');
  body.append(score);
  const keeper = field.querySelector('#keeper'), aim = field.querySelector('#aim'), ball = field.querySelector('#ball');
  let goals = 0;
  for (let s = 0; s < 3; s++) {
    let kx = 50, ax = 30, ay = 24, t0 = performance.now(), run = true;
    const kSp = 1.1 + s * .25, aSp = 1.7 + s * .2;
    ball.setAttribute('transform', 'translate(50 92)');
    const loop = t => { if (!run) return; const tt = (t - t0) / 1000; kx = 50 + Math.sin(tt * kSp * 2) * 28; ax = 50 + Math.sin(tt * aSp * 2 + 1.7) * 32; ay = 22 + Math.cos(tt * aSp * 1.3) * 8; keeper.setAttribute('transform', `translate(${kx} 0)`); aim.setAttribute('transform', `translate(${ax} ${ay})`); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    await new Promise(res => { const b = btn('Tirer', 'gold', () => { b.remove(); res(); }); b.style.minWidth = '60%'; foot.append(b); });
    run = false; SND.play('kickball');
    const tx = ax, ty = ay;
    await new Promise(r => { const st = performance.now(); const fly = t => { const p = Math.min(1, (t - st) / 380); const x = 50 + (tx - 50) * p, y = 92 + (ty - 92) * p; ball.setAttribute('transform', `translate(${x} ${y}) scale(${1 - p * .35})`); if (p < 1) requestAnimationFrame(fly); else r(); }; requestAnimationFrame(fly); });
    const saved = Math.abs(tx - kx) < 12;
    if (!saved) { goals++; SND.play('goal'); say(body, 'Buuut !', 'left:50%;top:44%;transform:translateX(-50%);font-size:calc(var(--u)*6)'); }
    else { SND.play('miss'); say(body, 'Arrêté !', 'left:50%;top:44%;transform:translateX(-50%);font-size:calc(var(--u)*6)'); }
    score.textContent = `Buts : ${goals} / 3`;
    await wait(1000); body.querySelectorAll('.pop').forEach(e => e.remove());
  }
  m.metierOk = goals >= 2;
  await resultLine(body, foot, m.metierOk ? `${goals} buts : Lago a compris ce que vivent les joueurs.` : 'Le gardien était en forme. Lago a quand même compris le club.', m.metierOk);
  await close();
}

// --- grand compte : la réunion, les trois promesses
async function gameReunion(m) {
  const [av, role] = CLIENT_AV[m.b.id] || ['h_omar', 'Direction'];
  const { body, foot, close } = shell({ step: 1, title: 'La réunion', text: `${m.b.name} pose trois questions. Réponds comme Digilago.` });
  body.append(char(av, 'width:56%;right:-6%;top:-4%'), char('lago_cravate', 'width:50%;left:-4%;top:6%'));
  let good = 0;
  for (const q of C.quizReunion) {
    const box = h('div', { class: 'panel fade-in', style: 'position:absolute;left:calc(var(--u)*4);right:calc(var(--u)*4);bottom:calc(var(--u)*2);padding:calc(var(--u)*4.4)' },
      h('div', { style: 'font-size:calc(var(--u)*3.1);color:#4A5876' }, role), h('div', { class: 'sora', style: 'font-size:calc(var(--u)*5);margin:6px 0 calc(var(--u)*3)' }, q.q));
    const ch = h('div', { class: 'choices' }); box.append(ch); body.append(box);
    const opts = shuffle([q.a, q.b]);
    const ok = await new Promise(res => opts.forEach(o => ch.append(h('button', { class: 'choice', onclick: e => { const r = o === q.a; e.currentTarget.classList.add(r ? 'ok' : 'ko'); SND.play(r ? 'chime' : 'miss'); setTimeout(() => res(r), 650); } }, o))));
    if (ok) good++;
    else { box.querySelectorAll('.choice').forEach(b => { if (b.textContent === q.a) b.classList.add('ok'); }); await wait(900); }
    box.remove();
  }
  m.metierOk = good === 3;
  await resultLine(body, foot, m.metierOk ? 'Trois réponses, trois promesses : la direction signe.' : 'La direction a compris nos promesses. Elle signe.', m.metierOk);
  await close();
}

async function resultLine(body, foot, text, ok) {
  SND.play(ok ? 'success' : 'chime');
  if (ok) confetti(24);
  const b = say(body, text, 'left:calc(var(--u)*5);right:calc(var(--u)*5);top:34%;text-align:center;font-size:calc(var(--u)*4.4);padding:calc(var(--u)*4)');
  b.prepend(h('div', { style: `font-size:calc(var(--u)*3.2);color:${ok ? '#1FA463' : '#1F57C7'};margin-bottom:6px` }, ok ? 'Réussi · Confiance +2' : 'C’est noté'));
  foot.innerHTML = '';
  await new Promise(r => { const x = btn('Préparer le devis', 'gold', r); x.style.minWidth = '60%'; foot.append(x); });
  SND.play('tap');
}

// ================================================================== 3. DEVIS : Gestion écrit le prix avant de commencer
async function devisStep(m) {
  const S = G.S(), b = m.b, n = b.needs.length;
  const { body, foot, close } = shell({ step: 2, title: 'Gestion prépare le devis', text: `Écoute le client et choisis <b>exactement ${n} services</b>. Le prix est écrit avant de commencer.` });
  const clues = h('div', { class: 'panel', style: 'position:absolute;left:calc(var(--u)*4);right:calc(var(--u)*4);top:0;padding:calc(var(--u)*3.4) calc(var(--u)*4);display:flex;flex-direction:column;gap:6px' },
    h('div', { class: 'sora', style: 'font-size:calc(var(--u)*3.2);color:#1F57C7' }, b.name), ...(CLUES[b.id] || []).map(c => h('div', { style: 'font-size:calc(var(--u)*3.35);line-height:1.35;color:#0E214E' }, c)));
  const grid = h('div', { style: 'position:absolute;left:calc(var(--u)*4);right:calc(var(--u)*4);bottom:0;display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*2.2)' });
  body.append(clues, grid);
  const sel = new Set();
  const counter = h('div', { class: 'pill', style: 'background:#fff;box-shadow:inset 0 0 0 2px #C9D7EC' }, `0 / ${n}`);
  const ok = btn('Écrire le devis', 'gold'); ok.disabled = true;
  Object.entries(C.offers).forEach(([k, o]) => {
    const e = h('button', { class: 'offer', html: `<span class="oi">${icon(o.icon, '#1F57C7')}</span><span>${o.label}</span>` });
    e.onclick = () => { SND.play('tap'); if (sel.has(k)) { sel.delete(k); e.classList.remove('sel'); } else { sel.add(k); e.classList.add('sel'); } counter.textContent = `${sel.size} / ${n}`; ok.disabled = sel.size !== n; };
    grid.append(e);
  });
  foot.append(counter, ok);
  let attempts = 0;
  await new Promise(res => {
    ok.onclick = async () => {
      attempts++;
      const wrong = [...sel].filter(k => !b.needs.includes(k)), missing = b.needs.filter(k => !sel.has(k));
      if (!wrong.length) return res();
      SND.play('miss');
      const hint = `${C.offers[wrong[0]].label} : ce client n’en a pas besoin. Relis ce qu’il dit${missing.length ? ` : il lui manque ${C.offers[missing[0]].label.toLowerCase()}` : ''}.`;
      const tip = say(body, hint, 'left:calc(var(--u)*4);right:calc(var(--u)*4);top:38%;font-size:calc(var(--u)*3.6)');
      tip.prepend(h('div', { style: 'font-size:calc(var(--u)*3);color:#1FA463;margin-bottom:4px' }, 'Gestion'));
      setTimeout(() => tip.remove(), 3200);
    };
  });
  m.stars.prix = attempts === 1;
  // le devis signé
  SND.play('type');
  body.innerHTML = '';
  const doc = h('div', { class: 'panel pop', style: 'position:absolute;left:calc(var(--u)*6);right:calc(var(--u)*6);top:0;padding:calc(var(--u)*5)' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, h('div', { class: 'logo', style: 'color:#0E214E;font-size:calc(var(--u)*4.4)', html: '<svg viewBox="14 8 38 48"><rect x="16" y="10" width="8" height="44" rx="1.5"/><path d="M28 10 A22 22 0 0 1 28 54 Z"/></svg><span>digilago</span>' }), h('span', { style: 'font:500 calc(var(--u)*3) Sora;color:#4A5876' }, 'Devis')),
    h('div', { class: 'sora', style: 'font-size:calc(var(--u)*4.6);margin:calc(var(--u)*4) 0 calc(var(--u)*2)' }, b.name),
    ...b.needs.map(k => h('div', { style: 'display:flex;align-items:center;gap:10px;padding:calc(var(--u)*1.8) 0;border-top:1px solid #E3ECF8;font-size:calc(var(--u)*3.6)', html: `<span style="width:calc(var(--u)*6);display:grid">${icon(C.offers[k].icon, '#1F57C7')}</span>${C.offers[k].label}` })),
    h('div', { style: 'margin-top:calc(var(--u)*3);padding:calc(var(--u)*3);border-radius:calc(var(--u)*3);background:#F4F8FE;font-size:calc(var(--u)*3.4);line-height:1.4' }, 'Prix fixe, écrit avant de commencer. Première version en 72 heures.'));
  body.append(doc, char('gestion_signe', 'width:44%;right:-6%;bottom:-14%'));
  doc.querySelectorAll('svg').forEach(s => { if (!s.closest('.logo')) s.style.cssText = 'width:100%;height:auto'; });
  await wait(700);
  const stamp = h('div', { style: 'position:absolute;left:12%;bottom:6%;z-index:8;padding:calc(var(--u)*2) calc(var(--u)*4);border:4px solid #1FA463;color:#1FA463;border-radius:10px;font:600 calc(var(--u)*5)/1 Sora;transform:rotate(-12deg);background:rgba(255,255,255,.85)' }, 'Accepté');
  body.append(stamp); stamp.animate([{ transform: 'rotate(-12deg) scale(2.4)', opacity: 0 }, { transform: 'rotate(-12deg) scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.5,0,.8,.4)' });
  SND.play('stamp');
  foot.innerHTML = '';
  const note = h('div', { class: 'pill', style: `background:${m.stars.prix ? '#E3FAF0' : '#F4F8FE'};color:#0E214E;font-size:calc(var(--u)*3.2)`, html: (m.stars.prix ? icon('star', '#F5B83D', 2.4) + 'Devis juste du premier coup' : 'Devis corrigé : pas d’étoile Prix cette fois') });
  const ns = note.querySelector('svg'); if (ns) ns.style.cssText = 'width:16px;height:16px';
  foot.style.flexDirection = 'column'; foot.style.alignItems = 'center';
  await new Promise(r => { const x = btn('Lancer les 72 heures', 'gold', r); x.style.minWidth = '64%'; foot.append(note, x); });
  SND.play('tap');
  await close();
}

// ================================================================== 4. 72 HEURES : assembler le site dans l'ordre, chasser les bugs, répondre au client
const BUG = '<svg viewBox="-20 -20 40 40"><ellipse rx="10" ry="12" fill="#E5484D" stroke="#0E214E" stroke-width="3"/><path d="M0 -12 V12" stroke="#0E214E" stroke-width="2"/><circle cy="-14" r="6" fill="#0E214E"/><path d="M-10 -4 L-17 -9 M10 -4 L17 -9 M-10 4 L-18 4 M10 4 L18 4 M-9 10 L-15 16 M9 10 L15 16 M-3 -19 L-7 -24 M3 -19 L7 -24" stroke="#0E214E" stroke-width="2.5" stroke-linecap="round"/></svg>';
async function buildStep(m) {
  const S = G.S(), b = m.b;
  const { mg, body, foot, close } = shell({ step: 3, title: '72 heures pour le site', text: 'Touche les blocs <b>dans l’ordre</b> de la maquette, de haut en bas. Écrase les bugs. Et réponds au client.' });
  SND.setIntensity(.75);
  const clock = h('div', { class: 'pill', style: 'position:absolute;right:calc(var(--u)*5);top:calc(var(--u)*-1);background:#0E214E;color:#fff;font-size:calc(var(--u)*4)' }, '72 h');
  const bugsPill = h('div', { class: 'pill', style: 'position:absolute;left:calc(var(--u)*5);top:calc(var(--u)*-1);background:#fff;color:#0E214E;font-size:calc(var(--u)*3.4);box-shadow:inset 0 0 0 2px #C9D7EC' }, 'Bugs écrasés : 0');
  const phone = h('div', { style: 'position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--u)*9);width:52%;height:58%;background:#0E214E;border-radius:calc(var(--u)*6);padding:calc(var(--u)*2.4)' });
  const screen = h('div', { style: 'width:100%;height:100%;background:#fff;border-radius:calc(var(--u)*4);display:flex;flex-direction:column;gap:calc(var(--u)*1.6);padding:calc(var(--u)*2);overflow:hidden;position:relative' });
  phone.append(screen);
  const slots = b.slots.map((s, i) => { const e = h('div', { class: 'slot' + (i === 0 ? ' cur' : ''), style: `flex:${i === 0 ? .55 : 1}` }, s); screen.append(e); return e; });
  const tray = h('div', { style: 'position:absolute;left:calc(var(--u)*4);right:calc(var(--u)*4);bottom:0;display:flex;flex-wrap:wrap;justify-content:center;gap:calc(var(--u)*2)' });
  body.append(clock, bugsPill, phone, tray);
  let idx = 0, squashed = 0, live = true, msgShown = false, msgDone = Promise.resolve();
  const TOTAL = 26000 + b.slots.length * 2000, t0 = performance.now();
  let endRes; const finished = new Promise(r => endRes = r);
  // les bugs
  const bugs = new Set();
  const spawnBug = () => {
    if (!live) return;
    if (bugs.size < 3) {
      const bg = h('div', { class: 'bug', html: BUG, style: `left:${rnd(10, 80)}%;top:${rnd(18, 66)}%` });
      bg.onpointerdown = e => { e.stopPropagation(); if (!bugs.has(bg)) return; bugs.delete(bg); squashed++; bugsPill.textContent = `Bugs écrasés : ${squashed}`; SND.play('squash'); bg.style.transition = 'none'; bg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5,.2)', opacity: 0 }], { duration: 220 }).onfinish = () => bg.remove(); };
      body.append(bg); bugs.add(bg);
      const wander = () => { if (!bugs.has(bg)) return; bg.style.left = rnd(6, 84) + '%'; bg.style.top = rnd(14, 70) + '%'; setTimeout(wander, 2600); };
      setTimeout(wander, 60);
    }
    setTimeout(spawnBug, rnd(2600, 4200));
  };
  setTimeout(spawnBug, 1800);
  // les blocs, mélangés
  const renderTray = () => {
    tray.innerHTML = '';
    shuffle(b.slots.map((s, i) => [s, i]).filter(([, i]) => i >= idx)).forEach(([s, i]) => {
      const k = h('button', { class: 'block' }, s);
      k.onclick = () => {
        if (!live) return;
        if (bugs.size >= 3) { SND.play('miss'); toast('Trop de bugs : écrase-les d’abord.'); return; }
        if (i === idx) {
          SND.play('type'); setTimeout(() => SND.play('pop'), 60);
          slots[idx].classList.remove('cur'); slots[idx].classList.add('done'); slots[idx].animate([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'cubic-bezier(.2,1.6,.4,1)' });
          idx++;
          if (idx < slots.length) slots[idx].classList.add('cur');
          if (!msgShown && idx >= Math.ceil(slots.length / 2)) { msgShown = true; msgDone = clientMessage(); }
          if (idx >= slots.length) endRes(); else renderTray();
        } else { SND.play('miss'); k.classList.remove('wrong'); void k.offsetWidth; k.classList.add('wrong'); }
      };
      tray.append(k);
    });
  };
  renderTray();
  // le message du client pendant le chantier
  async function clientMessage() {
    const msg = BUILD_MSG[Math.floor(Math.random() * BUILD_MSG.length)];
    SND.play('msg');
    const bub = h('div', { class: 'msgbubble' });
    bub.append(h('div', { class: 'from', html: `<i>${icon('chat', '#fff', 2.4)}</i>${b.name}` }), h('p', {}, msg.text));
    bub.querySelector('.from svg').style.cssText = 'width:60%;height:60%';
    const bar = h('div', { class: 'mbar' }, h('i', { style: 'width:100%' })); bub.append(bar);
    mg.append(bub); requestAnimationFrame(() => bub.classList.add('show'));
    let answered;
    if (S.anas) {
      await wait(1200);
      bub.append(h('div', { class: 'choice ok', style: 'font-size:calc(var(--u)*3.2)' }, 'Anas : « ' + msg.good + ' »'));
      SND.play('chime'); answered = true; await wait(1600);
    } else {
      const ch = h('div', { class: 'choices' }); bub.append(ch);
      answered = await new Promise(res => {
        const T = 9000, s0 = performance.now(); let over = false;
        const tk = () => { if (over) return; const p = 1 - (performance.now() - s0) / T; bar.firstChild.style.width = Math.max(0, p * 100) + '%'; if (p <= 0) { over = true; res(false); } else requestAnimationFrame(tk); };
        tk();
        shuffle([msg.good, msg.bad]).forEach(o => ch.append(h('button', { class: 'choice', style: 'font-size:calc(var(--u)*3.2);padding:calc(var(--u)*2.4) calc(var(--u)*3)', onclick: e => { if (over) return; over = true; const g = o === msg.good; e.currentTarget.classList.add(g ? 'ok' : 'ko'); SND.play(g ? 'chime' : 'miss'); setTimeout(() => res(g), 700); } }, o)));
      });
    }
    m.stars.reponse = !!answered;
    bub.classList.remove('show'); setTimeout(() => bub.remove(), 450);
  }
  // l'horloge des 72 heures
  const tick = () => { if (!live) return; const p = (performance.now() - t0) / TOTAL; const hLeft = Math.max(0, Math.ceil(72 * (1 - p))); clock.textContent = hLeft + ' h'; clock.style.background = hLeft < 12 ? '#E5484D' : '#0E214E'; if (p >= 1) endRes(); else requestAnimationFrame(tick); };
  tick();
  await finished;
  const inTime = idx >= slots.length;
  if (!inTime) { // le temps est écoulé : l'équipe termine, mais pas d'étoile Délai
    while (idx < slots.length) { slots[idx].classList.remove('cur'); slots[idx].classList.add('done'); idx++; await wait(120); }
    if (!msgShown) { msgShown = true; msgDone = clientMessage(); }
  }
  await msgDone;
  live = false;
  bugs.forEach(bg => bg.remove());
  m.stars.delai = inTime;
  m.squashed = squashed;
  tray.innerHTML = '';
  SND.play('success');
  say(body, inTime ? `Site prêt en ${72 - parseInt(clock.textContent)} heures.` : 'Le site est prêt, avec un peu de retard.', 'left:50%;transform:translateX(-50%);bottom:calc(var(--u)*4);white-space:nowrap');
  await new Promise(r => { const x = btn('Mettre en ligne', 'gold', r); x.style.minWidth = '64%'; foot.append(x); });
  SND.play('tap');
  await close();
}

// ================================================================== 5. EN LIGNE
async function onlineStep(m) {
  const S = G.S(), b = m.b;
  const { mg, body, foot, close } = shell({ step: 4, dark: true, title: `${b.name} est en ligne`, text: b.gain + '.' });
  SND.setIntensity(1);
  body.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding-bottom:calc(var(--u)*2)';
  const build = h('div', { style: 'height:46%;flex:none;filter:grayscale(1) brightness(.6)', html: b.big ? svgOf(A.tower[b.tower], '0 0 240 600') : svgOf(A.facade[b.sector], '0 0 300 380') });
  build.className = 'biz off'; build.style.position = 'relative'; build.style.bottom = 'auto';
  build.firstChild.style.cssText = 'height:100%;width:auto;display:block';
  body.append(build);
  await wait(400);
  SND.play('online');
  build.style.transition = 'filter 1s'; build.style.filter = 'none';
  const wins = [...build.querySelectorAll('.win')];
  build.classList.remove('off'); build.classList.add('on');
  for (const w of wins) { w.style.transition = 'fill .3s'; w.style.fill = '#FFE3A3'; await wait(70); }
  const L0 = G.lumiere();
  // résultat
  const gotStars = ['prix', 'delai', 'reponse'].filter(k => m.stars[k]).length;
  const prev = S.done[b.id];
  S.done[b.id] = { stars: Math.max(gotStars, prev ? prev.stars : 0) };
  S.missions++;
  const dc = (m.metierOk ? 2 : 0) + gotStars * 2 + Math.min(3, m.squashed || 0);
  S.confiance = Math.min(100, S.confiance + dc);
  // un ancien client écrira bientôt
  const olds = C.messages.map((x, i) => [x, i]).filter(([x]) => { const ob = C.businesses.find(z => z.name === x.from); return ob && ob.id !== b.id && S.done[ob.id]; }).map(([, i]) => i).filter(i => !S.inbox.includes(i));
  if (olds.length) S.inbox.push(olds[Math.floor(Math.random() * olds.length)]);
  G.save();
  window.track && window.track('jeu_lago_mission', { entreprise: b.id, etoiles: gotStars, mission: S.missions });
  const L1 = G.lumiere();
  const tags = h('div', { style: 'display:flex;flex-wrap:wrap;justify-content:center;gap:8px;padding:0 calc(var(--u)*5)' });
  body.append(tags);
  for (const k of b.needs) { const t = h('span', { class: 'pill pop', style: 'background:#fff;color:#0E214E', html: icon(C.offers[k].icon, '#1F57C7') + C.offers[k].label }); t.querySelector('svg').style.cssText = 'width:16px;height:16px'; tags.append(t); SND.play('pop'); await wait(180); }
  const stars = h('div', { class: 'stars' });
  const LABEL = { prix: 'Prix juste', delai: 'Dans les 72 h', reponse: 'Réponse le jour même' };
  for (const k of ['prix', 'delai', 'reponse']) { const s = h('div', { class: 'star' + (m.stars[k] ? '' : ' miss'), html: icon('star', m.stars[k] ? '#F5B83D' : '#9FB4D6', 2) }); s.querySelector('svg').setAttribute('fill', m.stars[k] ? '#F5B83D' : 'none'); s.append(h('span', { style: 'color:#C9D7EC' }, LABEL[k])); stars.append(s); }
  body.append(stars);
  for (const s of stars.children) { await wait(260); s.classList.add('got'); if (!s.classList.contains('miss')) SND.play('star'); }
  confetti(gotStars === 3 ? 70 : 35);
  const sum = h('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap' },
    h('span', { class: 'pill', style: 'background:#F5B83D;color:#0E214E' }, `Lumière ${L0} → ${L1} %`), h('span', { class: 'pill', style: 'background:#3DDC97;color:#0E214E' }, `Confiance +${dc}`));
  foot.style.flexDirection = 'column'; foot.style.alignItems = 'center';
  foot.append(sum);
  await new Promise(r => { const x = btn('Retour en ville', 'gold', r); x.style.minWidth = '64%'; foot.append(x); });
  SND.play('whoosh');
  SND.setIntensity(.3 + L1 / 160);
  await close();
}

// ================================================================== enchaînement
const GAMES = { questions: gameQuestions, the: gameThe, rdv: gameRdv, rayons: gameRayons, foot: gameFoot, reunion: gameReunion };
let busy = false;
window.MISSION = {
  async run(b) {
    if (busy) return; busy = true;
    const m = { b, stars: { prix: false, delai: false, reponse: false }, metierOk: false };
    try {
      await radarStep(m);
      await costumeReveal(m);
      await GAMES[b.game](m);
      await devisStep(m);
      await buildStep(m);
      await onlineStep(m);
    } finally { busy = false; }
    G.show(G.cityScene, b.district, b.id);
  },
  _games: GAMES, _steps: { radarStep, costumeReveal, devisStep, buildStep, onlineStep },
};
})();
