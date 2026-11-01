import { createHash } from 'node:crypto';
import { config } from '../config.js';
import type { RawPlace, SearchContext, SourceAdapter, TileQuery, TileResult } from './types.js';

/**
 * Source de DÉMONSTRATION — données 100 % FICTIVES.
 * Sert à essayer le Radar sans clé API. Chaque fiche est marquée is_demo et son nom se termine par « (démo) ».
 * Les sites « web » pointent vers le domaine réservé *.demo-radar.invalid, servi localement par le serveur.
 * À désactiver en production (DEMO_SOURCE_ENABLED=false) ; les fiches démo se purgent en un clic.
 */
export const DEMO_DOMAIN = 'demo-radar.invalid';

const PREFIX: Record<string, string[]> = {
  education: ['École', 'Groupe Scolaire', 'Crèche', 'Centre de Langues', 'Auto-École'],
  sante: ['Clinique', 'Centre Dentaire', 'Cabinet Médical', 'Cabinet Kiné', 'Laboratoire', 'Centre d’Optique'],
  beaute: ['Institut', 'Salon', 'Spa', 'Hammam', 'Fitness Club', 'Onglerie'],
  construction: ['Menuiserie Alu', 'Bureau d’Études', 'Entreprise BTP', 'Plomberie', 'Climatisation', 'Cabinet d’Architecture'],
  services_pro: ['Fiduciaire', 'Cabinet Comptable', 'Conseil', 'Assurances', 'Cabinet d’Avocats'],
  restauration: ['Restaurant', 'Café', 'Pâtisserie', 'Snack', 'Traiteur'],
  hotellerie: ['Riad', 'Hôtel', 'Maison d’Hôtes', 'Résidence'],
  immobilier: ['Agence Immobilière', 'Promotion Immobilière', 'Syndic'],
  tourisme: ['Agence de Voyages', 'Excursions', 'Location de Quads'],
  transport: ['Location de Voitures', 'Garage', 'Transport & Logistique'],
  industrie: ['Atelier Industriel', 'Maintenance Industrielle', 'Fabrication'],
  commerce: ['Boutique', 'Showroom', 'Grossiste'],
  artisanat: ['Coopérative', 'Atelier Artisanal', 'Maison du Tapis'],
  associations: ['Association', 'Coopérative'],
};
const NAMES = ['Les Horizons', 'Al Amal', 'Les Mimosas', 'Atlas', 'Océan', 'Al Massira', 'Les Orangers', 'Mazagan', 'Doukkala', 'Al Bahr',
  'Ibn Khaldoun', 'Les Pins', 'Azur', 'Andalous', 'Nakhla', 'Al Waha', 'Saphir', 'Rose des Sables', 'Bouregreg', 'Argana', 'Zitoune', 'Cèdre',
  'Al Andalus', 'Lumière', 'Palmeraie', 'Corniche', 'Amane', 'Yasmine', 'Badr', 'Noujoum'];

/** Variante de présence en ligne attribuée à une fiche démo (répartition proche de ce qu'on observe). */
export type DemoVariant = 'none' | 'social' | 'generated' | 'basic' | 'good' | 'broken';
function variantFor(h: number): DemoVariant {
  const r = h % 100;
  return r < 46 ? 'none' : r < 64 ? 'social' : r < 69 ? 'generated' : r < 84 ? 'basic' : r < 95 ? 'good' : 'broken';
}

const hash = (s: string) => createHash('sha1').update(s).digest().readUInt32BE(0);
const slugify = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export class DemoAdapter implements SourceAdapter {
  id = 'demo';
  label = 'Démonstration (fictif)';
  mono = 'D';
  attribution = 'Données fictives de démonstration';
  requiresKey = false;
  tiled = true;
  coverageNote = 'Données inventées pour essayer le Radar. Ne jamais utiliser pour prospecter.';
  constructor(private enabled = config.sources.demo.enabled) {}
  isEnabled() { return this.enabled; }
  dailyLimit() { return 100000; }
  costPerRequest() { return 0; }
  requestsPerTile(q: { sectors: any[] }) { return Math.max(1, q.sectors.length); }
  async healthCheck() { return { ok: this.enabled, message: this.enabled ? 'Active : données fictives uniquement.' : 'Désactivée.' }; }

  async searchTile(q: TileQuery, ctx: SearchContext): Promise<TileResult> {
    const res: TileResult = { places: [], requests: 0, saturated: false, estCost: 0, notes: [] };
    const cLat = (q.rect.south + q.rect.north) / 2, cLon = (q.rect.west + q.rect.east) / 2;
    const area = (q.rect.north - q.rect.south) * (q.rect.east - q.rect.west);
    for (const s of q.sectors) {
      await ctx.useQuota(1);
      res.requests++;
      const key = `${s.id}|${q.rect.south.toFixed(4)}|${q.rect.west.toFixed(4)}|${q.rect.north.toFixed(4)}`;
      // densité fictive : plus forte au centre de la ville, plafonnée à 20 comme une page d'API
      const n = Math.min(20, 2 + (hash(key) % 7) + Math.round(Math.min(14, area * 9000)));
      if (n >= 20) res.saturated = true;
      for (let i = 0; i < n; i++) {
        const h = hash(key + '#' + i);
        const prefix = (PREFIX[s.id] ?? ['Entreprise'])[h % (PREFIX[s.id]?.length ?? 1)];
        const base = NAMES[(h >>> 8) % NAMES.length];
        const name = `${prefix} ${base} (démo)`;
        const lat = q.rect.south + ((h >>> 4) % 1000) / 1000 * (q.rect.north - q.rect.south);
        const lon = q.rect.west + ((h >>> 14) % 1000) / 1000 * (q.rect.east - q.rect.west);
        const v = variantFor(h >>> 3);
        const slug = `${v}-${slugify(prefix + ' ' + base)}-${(h % 9000) + 1000}`;
        const links: string[] = [];
        if (v === 'social') links.push(`https://www.facebook.com/radar-demo-${slug}`);
        if (v === 'generated') links.push(`https://${slug}.business.site`);
        if (v === 'basic') links.push(`http://${slug}.${DEMO_DOMAIN}/`);
        if (v === 'good' || v === 'broken') links.push(`https://${slug}.${DEMO_DOMAIN}/`);
        const mobile = (h >>> 5) % 3 !== 0;
        res.places.push({
          source: this.id,
          externalId: `demo:${slug}`,
          attribution: this.attribution,
          name,
          sector: s.id,
          subsector: prefix,
          address: `[Adresse fictive] ${q.cityName}`,
          city: q.cityName,
          lat, lon,
          phones: [mobile ? `+2126000${String(h % 100000).padStart(5, '0')}` : `+2125230${String(h % 100000).padStart(5, '0')}`],
          links,
          google: { rating: Math.round((3.6 + ((h >>> 9) % 14) / 10) * 10) / 10, reviews: (h >>> 11) % 140, hasHours: (h & 1) === 1, photos: (h >>> 2) % 12, hasWebsite: v === 'basic' || v === 'good' || v === 'broken' || v === 'generated' },
          activityStatus: 'active',
          isDemo: true,
          payload: { demo: true, variant: v },
        });
      }
    }
    void cLat; void cLon;
    return res;
  }
}
