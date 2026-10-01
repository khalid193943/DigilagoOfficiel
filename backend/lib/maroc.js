'use strict';
/* Carte du Maroc : les clients allument leur ville et leur région. */
const M = require('./maroc.json');
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const ALIAS = { 'casa': 'Casablanca', 'dar el beida': 'Casablanca', 'tangier': 'Tanger', 'tanja': 'Tanger', 'fez': 'Fès', 'fes': 'Fès', 'marrakesh': 'Marrakech', 'sale': 'Salé', 'temara': 'Témara', 'kenitra': 'Kénitra', 'meknes': 'Meknès', 'tetouan': 'Tétouan', 'laayoune': 'Laâyoune', 'el aaiun': 'Laâyoune', 'eljadida': 'El Jadida', 'jadida': 'El Jadida', 'beni mellal': 'Béni Mellal', 'al hoceima': 'Al Hoceïma', 'hoceima': 'Al Hoceïma', 'agadir ida outanane': 'Agadir', 'tan tan': 'Tan-Tan' };
const INDEX = {}; for (const n of Object.keys(M.cities)) INDEX[norm(n)] = n; for (const [a, n] of Object.entries(ALIAS)) INDEX[a] = n;
function findCity(t) { const k = norm(t); if (!k) return null; if (INDEX[k]) return INDEX[k]; const hit = Object.keys(INDEX).find((x) => k.includes(x) || (x.length > 4 && x.includes(k))); return hit ? INDEX[hit] : null; }
/* clients : [{ city, name }] → carte SVG, villes et régions allumées */
function supervise(clients) {
  const byCity = {}, unknown = [];
  for (const c of clients) { const n = findCity(c.city); if (n) (byCity[n] = byCity[n] || []).push(c); else unknown.push(c); }
  const litRegions = new Set(Object.keys(byCity).map((n) => M.cities[n].r));
  const max = Math.max(1, ...Object.values(byCity).map((l) => l.length));
  /* étiquettes : on évite qu'elles se chevauchent quand des villes sont proches */
  const placed = [];
  const lab = {};
  Object.keys(byCity).sort((a, b) => byCity[b].length - byCity[a].length).forEach((n) => {
    const p = M.cities[n], r = 5 + 9 * Math.sqrt(byCity[n].length / max), w = (n.length + 4) * 6.4;
    const tries = [[r + 6, 4], [-(r + 6 + w), 4], [r + 6, -12], [r + 6, 18], [-(r + 6 + w), -12], [-(r + 6 + w), 18]];
    let pick = tries[0];
    for (const t of tries) { const x = p.x + t[0], y = p.y + t[1]; if (!placed.some((q) => Math.abs(q.y - y) < 13 && x < q.x + q.w && x + w > q.x)) { pick = t; break; } }
    placed.push({ x: p.x + pick[0], y: p.y + pick[1], w }); lab[n] = pick;
  });
  const dots = Object.entries(M.cities).map(([n, p]) => {
    const l = byCity[n];
    if (!l) return `<circle cx="${p.x}" cy="${p.y}" r="2.2" class="mp-off"><title>${n}</title></circle>`;
    const r = 5 + 9 * Math.sqrt(l.length / max), t = lab[n];
    return `<g class="mp-on"><circle cx="${p.x}" cy="${p.y}" r="${(r * 2.6).toFixed(1)}" class="mp-halo"/><circle cx="${p.x}" cy="${p.y}" r="${r.toFixed(1)}" class="mp-dot"><title>${n} : ${l.length} client${l.length > 1 ? 's' : ''}</title></circle></g>`;
  }).join('') + '<g class="mp-on mp-labels">' + Object.keys(byCity).map((n) => { const p = M.cities[n], t = lab[n]; return `<text x="${(p.x + t[0]).toFixed(1)}" y="${(p.y + t[1]).toFixed(1)}">${n} · ${byCity[n].length}</text>`; }).join('') + '</g>';
  const svg = `<svg viewBox="0 0 ${M.W} ${M.H}" class="mp" role="img" aria-label="Carte des clients au Maroc"><defs><radialGradient id="mpg"><stop offset="0" stop-color="#FFD66B" stop-opacity=".75"/><stop offset="1" stop-color="#FFD66B" stop-opacity="0"/></radialGradient><linearGradient id="mpl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A4C9C"/><stop offset="1" stop-color="#1A3474"/></linearGradient></defs><path d="${M.around}" class="mp-around"/><path d="${M.outline}" class="mp-land"/>${dots}</svg>`;
  const regions = Object.entries(M.regions).map(([k, n]) => ({ k, n, lit: litRegions.has(k), count: Object.entries(byCity).filter(([c]) => M.cities[c].r === k).reduce((a, [, l]) => a + l.length, 0) }));
  return { svg, byCity, unknown, regions, litRegions: litRegions.size, totalRegions: regions.length, litCities: Object.keys(byCity).length, totalCities: Object.keys(M.cities).length };
}
module.exports = { supervise, findCity };
