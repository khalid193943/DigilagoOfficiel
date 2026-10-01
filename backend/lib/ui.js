'use strict';
const { esc } = require('./fmt');
const { LOGO } = require('./doc');

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
  project: I('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>'),
  expense: I('<path d="M4 7h16v12H4z"/><path d="M4 7l2-3h12l2 3M12 11v5M9.5 13.5h5"/>'),
  report: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  out: I('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
};
const NAV = [['/', 'Tableau de bord', 'home'], ['/demandes', 'Demandes du site', 'lead'], ['/devis', 'Devis', 'quote'], ['/projets', 'Projets', 'project'], ['/factures', 'Factures', 'invoice'], ['/depenses', 'Dépenses', 'expense'], ['/rapports', 'Rapports', 'report'], ['/clients', 'Clients', 'client'], ['/prestations', 'Prestations', 'catalog'], ['/parametres', 'Paramètres', 'settings']];

const Q_STATUS = { brouillon: ['Brouillon', 'grey'], envoye: ['Envoyé', 'blue'], vu: ['Consulté', 'violet'], accepte: ['Accepté', 'green'], refuse: ['Refusé', 'red'], facture: ['Facturé', 'navy'], expire: ['Expiré', 'amber'] };
const P_STATUS = { a_demarrer: ['À démarrer', 'grey'], en_cours: ['En cours', 'blue'], validation: ['En validation', 'violet'], livre: ['Livré', 'green'] };
const I_STATUS = { impayee: ['À payer', 'amber'], partielle: ['Partiellement payée', 'blue'], payee: ['Payée', 'green'], retard: ['En retard', 'red'], annulee: ['Annulée', 'grey'] };
const badge = (map, k) => { const [t, c] = map[k] || [k, 'grey']; return `<span class="bdg bdg-${c}">${esc(t)}</span>`; };

function layout({ title, active = '', body, flash = '', actions = '' }) {
  const nav = NAV.map(([h, t, i]) => `<a href="${h}" class="${active === h ? 'on' : ''}">${ICONS[i]}<span>${t}</span></a>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | Digilago Gestion</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 8 38 48"><rect x="16" y="10" width="8" height="44" rx="1.5" fill="#1F57C7"/><path d="M28 10 A22 22 0 0 1 28 54 Z" fill="#1F57C7"/></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/app.css"></head><body class="admin">
<aside class="side"><a class="brand" href="/"><span>${LOGO}</span><b>digilago</b><em>Gestion</em></a>
<a class="new" href="/devis/nouveau">${ICONS.plus}Nouveau devis</a><nav>${nav}</nav>
<form method="post" action="/deconnexion" class="out"><button type="submit">${ICONS.out}Déconnexion</button></form></aside>
<main class="main"><header class="top"><h1>${esc(title)}</h1><div class="top-a">${actions}</div></header>${flash ? `<div class="flash">${esc(flash)}</div>` : ''}${body}</main>
<script src="/static/app.js" defer></script></body></html>`;
}

module.exports = { layout, badge, Q_STATUS, I_STATUS, P_STATUS, ICONS };
