'use strict';
const { esc } = require('./fmt');
const { LOGO } = require('./doc');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
/* Empreinte des fichiers statiques : chaque mise à jour est vue tout de suite malgré le cache de 7 jours. */
const V = {};
const ver = (f) => V[f] || (V[f] = (() => { try { return crypto.createHash('md5').update(fs.readFileSync(path.join(__dirname, '..', 'public', f))).digest('hex').slice(0, 8); } catch (e) { return '1'; } })());

const I = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  home: I('<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8z"/>'),
  quote: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  invoice: I('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  client: I('<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 7M21 20c0-2.5-1.5-4.6-3.6-5.5"/>'),
  lead: I('<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>'),
  catalog: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 009 4.6 1.7 1.7 0 0010 3.1V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0019.4 9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  chat: I('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/>'),
  ledger: I('<path d="M5 3h11l3 3v15H5z"/><path d="M9 8h6M9 12h6M9 16h3M16 3v3h3"/>'),
  spark: I('<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
  project: I('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>'),
  expense: I('<path d="M4 7h16v12H4z"/><path d="M4 7l2-3h12l2 3M12 11v5M9.5 13.5h5"/>'),
  report: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  out: I('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  phone: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>'),
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 000-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.3 2.2 2.2 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
  check: I('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  bell: I('<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 004 0"/>'),
};
/* Barre d'onglets du téléphone : l'essentiel au pouce, le reste dans « Menu ». */
const TABS = [['/', 'Accueil', 'home'], ['/demandes', 'Demandes', 'lead'], ['/assistant', 'Nouveau', 'plus'], ['/factures', 'Factures', 'invoice']];
/* Navigation par groupes : plus courte à parcourir (« Nouveau projet » reste le grand bouton du haut) */
const NAV_GROUPS = [
  ['Au quotidien', [['/', 'Tableau de bord', 'home'], ['/demandes', 'Demandes', 'lead'], ['/messagerie', 'Messagerie', 'chat']]],
  ['Ventes', [['/devis', 'Devis', 'quote'], ['/projets', 'Projets', 'project'], ['/factures', 'Factures', 'invoice'], ['/clients', 'Clients', 'client']]],
  ['Gestion', [['/depenses', 'Dépenses', 'expense'], ['/comptabilite', 'Comptabilité', 'ledger'], ['/rapports', 'Rapports', 'report']]],
  ['Réglages', [['/prestations', 'Prestations', 'catalog'], ['/parametres', 'Paramètres', 'settings']]],
];
const NAV = NAV_GROUPS.flatMap((g) => g[1]);
/* Navigation instantanée : la page survolée est préparée à l'avance (Chrome, Edge). Jamais pour les pages qui
   changent quelque chose à l'ouverture (messagerie marquée lue, liens clients « consulté »). */
const NOSPEC = ['/messagerie', '/d/', '/f/', '/bc/', '/recu/', '/brief/', '/comptable/', '/deconnexion'].map((p) => `[href^="${p}"]`).join(',');
const SPEC = '<script type="speculationrules">' + JSON.stringify({ prerender: [{ where: { and: [{ href_matches: '/*' },
  { not: { selector_matches: '[target],[download],[data-mark],' + NOSPEC } }] }, eagerness: 'moderate' }] }) + '</script>';

const Q_STATUS = { brouillon: ['Brouillon', 'grey'], envoye: ['Envoyé', 'blue'], vu: ['Consulté', 'violet'], accepte: ['Accepté', 'green'], refuse: ['Refusé', 'red'], facture: ['Facturé', 'navy'], expire: ['Expiré', 'amber'] };
const P_STATUS = { proposition: ['Proposition', 'amber'], a_demarrer: ['À démarrer', 'grey'], en_cours: ['En cours', 'blue'], validation: ['En validation', 'violet'], livre: ['Livré', 'green'] };
const I_STATUS = { impayee: ['À payer', 'amber'], partielle: ['Partiellement payée', 'blue'], payee: ['Payée', 'green'], retard: ['En retard', 'red'], annulee: ['Annulée par avoir', 'grey'], avoir: ['Avoir', 'violet'] };
const badge = (map, k) => { const [t, c] = map[k] || [k, 'grey']; return `<span class="bdg bdg-${c}">${esc(t)}</span>`; };

function layout({ title, active = '', body, flash = '', actions = '' }) {
  const nav = NAV_GROUPS.map(([g, items]) => `<span class="ng">${g}</span>` + items.map(([h, t, i]) => `<a href="${h}" class="${active === h ? 'on' : ''}"${active === h ? ' aria-current="page"' : ''}>${ICONS[i]}<span>${t}</span></a>`).join('')).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${esc(title)} | Digilago Gestion</title>
<meta name="theme-color" content="#0E214E"><link rel="manifest" href="/static/manifest.webmanifest"><link rel="apple-touch-icon" href="/static/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Digilago">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 8 38 48"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="#1F57C7"/><path d="M28 10 A22 22 0 0 1 28 54 Z" fill="#1F57C7"/></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/app.css?v=${ver('app.css')}">
${SPEC}</head><body class="admin">
<aside class="side"><a class="brand" href="/"><span>${LOGO}</span><b>digilago</b><em>Gestion</em></a>
<a class="new${active === '/assistant' ? ' on' : ''}" href="/assistant">${ICONS.spark}<span>Nouveau projet</span></a><button type="button" class="kbar" data-cmdk>${ICONS.search || ""}<span>Rechercher</span><kbd>⌘K</kbd></button><nav>${nav}</nav>
<button type="button" class="alerts" data-alerts hidden>${ICONS.bell}<span>Activer les alertes</span></button>
<form method="post" action="/deconnexion" class="out"><button type="submit">${ICONS.out}Déconnexion</button></form></aside>
<main class="main"><header class="top"><h1>${esc(title)}</h1><div class="top-a">${actions}</div></header>${flash ? `<div class="flash">${esc(flash)}</div>` : ''}${body}</main>
<nav class="tabbar" aria-label="Navigation rapide">${TABS.map(([h, t, i]) => `<a href="${h}" class="${active === h ? 'on' : ''}${h === '/assistant' ? ' tb-new' : ''}">${ICONS[i]}<span>${t}</span></a>`).join('')}<button type="button" data-menu aria-expanded="false">${ICONS.menu}<span>Menu</span></button></nav>
<script src="/static/app.js?v=${ver('app.js')}" defer></script></body></html>`;
}

/* Graphique SVG (sans bibliothèque) : échelle graduée, barres groupées, courbe, valeur au survol.
   series : [{ name, values, color, kind: 'bar' | 'line', fmt }] ; labels : noms des colonnes. */
function chart({ labels, series, height = 220, unit = 'DH' }) {
  const W = 640, H = height, L = 46, R = 10, T = 14, B = 26, iw = W - L - R, ih = H - T - B;
  const all = series.flatMap((s) => s.values.map((v) => Math.abs(Number(v) || 0)));
  const raw = Math.max(1, ...all), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const top = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  const y = (v) => T + ih - (Math.max(0, Number(v) || 0) / top) * ih;
  const short = (v) => (v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + ' M' : v >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0).replace('.0', '') + ' k' : String(v)).replace('.', ',');
  const fmtV = (v) => Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' ' + unit;
  const n = labels.length, cw = iw / n, bars = series.filter((s) => s.kind !== 'line'), bw = Math.min(26, (cw * 0.62) / Math.max(1, bars.length));
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = (top * k) / 4, yy = y(v).toFixed(1); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" class="ch-g${k ? '' : ' ch-0'}"/><text x="${L - 8}" y="${(+yy + 3.5).toFixed(1)}" class="ch-y">${short(v)}</text>`; }
  let b = '';
  labels.forEach((lab, i) => {
    const cx = L + cw * i + cw / 2;
    bars.forEach((s, j) => {
      const v = Number(s.values[i]) || 0; if (v <= 0) return;
      const x = cx - (bars.length * bw) / 2 + j * bw + 1, yy = y(v), h = T + ih - yy;
      b += `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6, bw / 3).toFixed(1)}" fill="${s.color}" class="ch-b" style="--d:${i * 40}ms"><title>${esc(lab)} · ${esc(s.name)} : ${fmtV(v)}</title></rect>`;
    });
    b += `<text x="${cx.toFixed(1)}" y="${H - 8}" class="ch-x">${esc(lab)}</text>`;
  });
  for (const s of series.filter((x) => x.kind === 'line')) {
    const pts = s.values.map((v, i) => [L + cw * i + cw / 2, y(v)]);
    b += `<polyline points="${pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" class="ch-l"/>`;
    b += pts.map((q, i) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.4" fill="#fff" stroke="${s.color}" stroke-width="2"><title>${esc(labels[i])} · ${esc(s.name)} : ${fmtV(s.values[i])}</title></circle>`).join('');
  }
  const legend = series.length > 1 ? `<div class="ch-lg">${series.map((s) => `<span><i style="background:${s.color === 'url(#chB)' ? 'linear-gradient(#5F9FF9,#1F57C7)' : s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<figure class="ch">${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(', '))}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="chB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5F9FF9"/><stop offset="1" stop-color="#1F57C7"/></linearGradient></defs>${g}${b}</svg></figure>`;
}

module.exports = { layout, badge, Q_STATUS, I_STATUS, P_STATUS, ICONS, ver, chart };
