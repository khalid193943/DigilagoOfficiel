// Points lumineux du globe (illustration) : la terre la nuit, chaque lumière = une entreprise visible en ligne.
import fs from 'fs';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
const world = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-110m.json', 'utf8'));
const countries = feature(world, world.objects.countries).features;
// Intensité illustrative par pays (0 à 1). Le Maroc (avec le Sahara) est faible ; le texte du jeu ne cite que des chiffres sourcés.
const HIGH = ['United States of America', 'Canada', 'United Kingdom', 'Ireland', 'France', 'Germany', 'Netherlands', 'Belgium', 'Luxembourg', 'Switzerland', 'Austria',
  'Denmark', 'Norway', 'Sweden', 'Finland', 'Iceland', 'Japan', 'South Korea', 'Australia', 'New Zealand', 'United Arab Emirates', 'Qatar', 'Israel', 'Spain', 'Italy', 'Portugal'];
const MID = ['China', 'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia', 'Croatia', 'Estonia', 'Latvia', 'Lithuania', 'Greece', 'Saudi Arabia', 'Kuwait', 'Oman',
  'Bahrain', 'Turkey', 'Malaysia', 'Singapore', 'Taiwan', 'Chile', 'Uruguay', 'Russia', 'Romania', 'Bulgaria', 'Serbia', 'South Africa', 'Brazil', 'Argentina', 'Mexico'];
const LOW = ['India', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines', 'Colombia', 'Peru', 'Kazakhstan', 'Ukraine', 'Egypt', 'Tunisia', 'Jordan', 'Iran', 'Ecuador',
  'Belarus', 'Bosnia and Herz.', 'Albania', 'Macedonia', 'Moldova', 'Lebanon', 'Venezuela', 'Panama', 'Costa Rica', 'Dominican Rep.', 'Cuba', 'Algeria', 'Georgia', 'Armenia', 'Azerbaijan'];
const lvl = n => n === 'Morocco' || n === 'W. Sahara' ? 0.31 : HIGH.includes(n) ? 0.92 : MID.includes(n) ? 0.62 : LOW.includes(n) ? 0.4 : 0.16;
const pts = [];
const step = 1.25;
for (let lat = -58; lat <= 78; lat += step) {
  const dlon = step / Math.max(0.25, Math.cos(lat * Math.PI / 180));
  for (let lon = -180; lon < 180; lon += dlon) {
    const jl = lon + (Math.random() - .5) * dlon * .5, jt = lat + (Math.random() - .5) * step * .5;
    const c = countries.find(f => geoContains(f, [jl, jt]));
    if (!c) continue;
    const n = c.properties.name, b = lvl(n), ma = (n === 'Morocco' || n === 'W. Sahara') ? 1 : 0;
    pts.push(Math.round(jl * 10), Math.round(jt * 10), Math.round(b * 100), ma);
  }
}
fs.writeFileSync('../src/globe.js', 'window.GLOBE=' + JSON.stringify(pts) + ';\n');
console.log(pts.length / 4, 'points', Math.round(fs.statSync('../src/globe.js').size / 1024), 'KB');
