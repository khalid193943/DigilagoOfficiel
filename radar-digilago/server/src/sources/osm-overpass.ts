import { config } from '../config.js';
import { sectorFromOsmTags } from '../domain/sectors.js';
import type { Rect } from '../normalize/geo.js';
import type { Sector } from '../domain/sectors.js';
import type { FetchFn, RawPlace, SearchContext, SourceAdapter, TileQuery, TileResult } from './types.js';

/**
 * OpenStreetMap via Overpass. Gratuit, licence ODbL (attribution obligatoire).
 * Politique d'usage : requêtes espacées, User-Agent identifiable ; pour un usage soutenu, héberger son propre Overpass.
 */
export function osmFilterToQl(f: string): string {
  return f.split('][').map((part) => {
    const m = part.match(/^([a-z_:]+)(?:(=|~)(.+))?$/);
    if (!m) throw new Error(`Filtre OSM invalide : ${f}`);
    const [, k, op, v] = m;
    return op ? `["${k}"${op}"${v.replace(/"/g, '\\"')}"]` : `["${k}"]`;
  }).join('');
}

export function buildOverpassQuery(p: { rect: Rect; sectors: Sector[]; keywords: string[] }, limit: number) {
  const bbox = `${p.rect.south},${p.rect.west},${p.rect.north},${p.rect.east}`;
  const parts: string[] = [];
  for (const s of p.sectors) for (const f of s.osm) parts.push(`nwr["name"]${osmFilterToQl(f)}(${bbox});`);
  for (const k of p.keywords) if (k.trim()) parts.push(`nwr["name"~"${k.trim().replace(/["\\]/g, '')}",i](${bbox});`);
  return `[out:json][timeout:90];(\n${parts.join('\n')}\n);out center tags ${limit};`;
}

export class OsmOverpassAdapter implements SourceAdapter {
  id = 'osm';
  label = 'OpenStreetMap';
  mono = 'O';
  attribution = '© OpenStreetMap contributors (ODbL)';
  requiresKey = false;
  tiled = false;
  coverageNote = 'Gratuit ; couverture variable selon les contributeurs, souvent faible hors grandes villes.';
  private lastCall = 0;
  constructor(private fetchFn: FetchFn = fetch, private cfg = config.sources.osm) {}

  isEnabled() { return this.cfg.enabled; }
  dailyLimit() { return this.cfg.dailyLimit; }
  costPerRequest() { return 0; }
  requestsPerTile() { return 1; }

  async healthCheck() {
    try {
      const r = await this.fetchFn(this.cfg.overpassUrl.replace(/interpreter$/, 'status'), { headers: { 'User-Agent': config.userAgent }, signal: AbortSignal.timeout(8000) });
      return { ok: r.ok, message: r.ok ? 'Overpass joignable.' : `Overpass : HTTP ${r.status}` };
    } catch (e) { return { ok: false, message: `Overpass injoignable : ${(e as Error).message}` }; }
  }

  async searchTile(q: TileQuery, ctx: SearchContext): Promise<TileResult> {
    const res: TileResult = { places: [], requests: 0, saturated: false, estCost: 0, notes: [] };
    if (!q.sectors.length && !q.keywords.length) return res;
    const wait = this.cfg.minIntervalMs - (Date.now() - this.lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const limit = 2000;
    try {
      await ctx.useQuota(1);
      res.requests = 1;
      this.lastCall = Date.now();
      const r = await this.fetchFn(this.cfg.overpassUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': config.userAgent },
        body: 'data=' + encodeURIComponent(buildOverpassQuery(q, limit)),
        signal: AbortSignal.timeout(120000),
      });
      if (r.status === 429) throw new Error('Overpass : trop de requêtes (429), réessayer plus tard.');
      if (!r.ok) throw new Error(`Overpass : HTTP ${r.status}`);
      const json: any = await r.json();
      res.places = (json.elements ?? []).map((e: any) => this.normalize(e, q.cityName)).filter(Boolean) as RawPlace[];
      if (res.places.length >= limit) { res.saturated = true; res.notes.push('Limite de résultats atteinte.'); }
      if (json.remark) res.notes.push(String(json.remark));
    } catch (e) {
      if ((e as Error).name === 'QuotaError') throw e;
      res.error = (e as Error).message;
    }
    return res;
  }

  normalize(e: any, fallbackCity?: string): RawPlace | null {
    const t = e?.tags ?? {};
    if (!t.name) return null;
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
    const { sector, subsector } = sectorFromOsmTags(t);
    const links = [t.website, t['contact:website'], t.url, t['contact:facebook'], t.facebook, t['contact:instagram'], t['contact:whatsapp'] && /^https?:/.test(t['contact:whatsapp']) ? t['contact:whatsapp'] : undefined].filter(Boolean);
    const phones = [t.phone, t['contact:phone'], t['contact:mobile'], t.mobile].filter(Boolean).flatMap((s: string) => s.split(/[;,]/));
    return {
      source: this.id,
      externalId: `${e.type}/${e.id}`,
      sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      attribution: this.attribution,
      name: t.name,
      sector, subsector,
      categories: Object.entries(t).filter(([k]) => ['amenity', 'shop', 'office', 'craft', 'tourism', 'healthcare', 'leisure'].includes(k)).map(([k, v]) => `${k}=${v}`),
      address: [street, t['addr:city']].filter(Boolean).join(', ') || undefined,
      neighborhood: t['addr:suburb'] ?? t['addr:quarter'],
      city: t['addr:city'] ?? fallbackCity,
      postcode: t['addr:postcode'],
      country: 'MA',
      lat, lon,
      phones,
      emails: [t.email, t['contact:email']].filter(Boolean),
      links,
      payload: { osm_type: e.type, tags: Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith('name:'))) },
    };
  }
}
