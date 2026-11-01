import { config } from '../config.js';
import type { FetchFn, RawPlace, SearchContext, SourceAdapter, TileQuery, TileResult } from './types.js';
import { QuotaError, keywordsFor } from './types.js';

/**
 * Google Places API (New) — Text Search.
 * https://developers.google.com/maps/documentation/places/web-service/text-search
 *  - 20 résultats par page, 60 maximum par requête : une tuile qui atteint 60 est « saturée » et sera redécoupée.
 *  - locationRestriction n'accepte qu'un rectangle.
 *  - Le prix dépend des champs demandés (téléphone, site, note = SKU « Enterprise ») : coût par requête configurable.
 *  - Conditions Google : seul le place_id se conserve sans limite ; les autres contenus ont une durée de rétention
 *    (GOOGLE_PLACES_RETENTION_DAYS), à aligner sur les conditions en vigueur.
 */
const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents', 'places.location',
  'places.types', 'places.primaryType', 'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
  'places.websiteUri', 'places.rating', 'places.userRatingCount', 'places.businessStatus', 'places.googleMapsUri',
  'places.regularOpeningHours', 'places.photos', 'nextPageToken',
].join(',');
const PAGES = 3;

export class GooglePlacesAdapter implements SourceAdapter {
  id = 'google_places';
  label = 'Google Places';
  mono = 'G';
  attribution = 'Données © Google';
  requiresKey = true;
  tiled = true;
  coverageNote = 'Couverture large mais non exhaustive ; 60 résultats max par requête, compensé par le redécoupage des tuiles.';
  constructor(private fetchFn: FetchFn = fetch, private cfg = config.sources.google) {}

  isEnabled() { return this.cfg.enabled && !!this.cfg.apiKey; }
  dailyLimit() { return this.cfg.dailyLimit; }
  costPerRequest() { return this.cfg.costPerRequest; }
  requestsPerTile(q: { sectors: any[]; keywords: string[] }) { return keywordsFor(q, (s) => s.google).length * 2; }

  async healthCheck() {
    if (!this.cfg.apiKey) return { ok: false, message: 'Clé GOOGLE_PLACES_API_KEY absente (à mettre côté serveur).' };
    if (!this.cfg.enabled) return { ok: false, message: 'Source désactivée (GOOGLE_PLACES_ENABLED=false).' };
    return { ok: true, message: 'Clé configurée. Le premier appel confirmera les droits et la facturation.' };
  }

  private async call(body: Record<string, unknown>) {
    const r = await this.fetchFn('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.cfg.apiKey, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const json: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = json?.error?.message ?? `HTTP ${r.status}`;
      if (r.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new QuotaError(`Google : quota dépassé (${msg})`);
      throw new Error(`Google Places : ${msg}`);
    }
    return json as { places?: any[]; nextPageToken?: string };
  }

  async searchTile(q: TileQuery, ctx: SearchContext): Promise<TileResult> {
    const res: TileResult = { places: [], requests: 0, saturated: false, estCost: 0, notes: [] };
    const seen = new Map<string, RawPlace>();
    try {
      for (const query of keywordsFor(q, (s) => s.google)) {
        let token: string | undefined, got = 0;
        for (let page = 0; page < PAGES; page++) {
          if (res.requests >= q.maxRequests) { res.notes.push('Budget de requêtes atteint pour cette tuile.'); res.saturated = true; break; }
          if (await ctx.isCancelled()) return res;
          await ctx.useQuota(1);
          res.requests++;
          const out = await this.call({
            textQuery: query, pageSize: 20, languageCode: 'fr', regionCode: 'MA',
            locationRestriction: { rectangle: { low: { latitude: q.rect.south, longitude: q.rect.west }, high: { latitude: q.rect.north, longitude: q.rect.east } } },
            ...(token ? { pageToken: token } : {}),
          });
          for (const raw of out.places ?? []) {
            got++;
            const n = this.normalize(raw, query);
            if (n && !seen.has(n.externalId)) seen.set(n.externalId, n);
          }
          token = out.nextPageToken;
          if (!token) break;
        }
        if (got >= PAGES * 20) res.saturated = true;
      }
    } catch (e) {
      res.error = (e as Error).message;
      if (e instanceof QuotaError) throw e;
    }
    res.places = [...seen.values()];
    res.estCost = res.requests * this.cfg.costPerRequest;
    return res;
  }

  normalize(p: any, query?: string): RawPlace | null {
    const name = p?.displayName?.text;
    if (!p?.id || !name) return null;
    const comp = (type: string) => (p.addressComponents ?? []).find((c: any) => c.types?.includes(type))?.longText;
    return {
      source: this.id,
      externalId: p.id,
      sourceUrl: p.googleMapsUri,
      attribution: this.attribution,
      name,
      categories: [p.primaryType, ...(p.types ?? [])].filter(Boolean),
      address: p.formattedAddress,
      neighborhood: comp('sublocality') ?? comp('neighborhood'),
      city: comp('locality'),
      region: comp('administrative_area_level_1'),
      postcode: comp('postal_code'),
      country: (p.addressComponents ?? []).find((c: any) => c.types?.includes('country'))?.shortText ?? 'MA',
      lat: p.location?.latitude,
      lon: p.location?.longitude,
      phones: [p.internationalPhoneNumber ?? p.nationalPhoneNumber].filter(Boolean),
      links: p.websiteUri ? [p.websiteUri] : [],
      google: {
        rating: p.rating, reviews: p.userRatingCount ?? 0, hasHours: !!p.regularOpeningHours, hasWebsite: !!p.websiteUri,
        photos: Array.isArray(p.photos) ? p.photos.length : 0, mapsUrl: p.googleMapsUri, status: p.businessStatus,
      },
      activityStatus: p.businessStatus === 'OPERATIONAL' ? 'active' : p.businessStatus?.startsWith('CLOSED') ? 'inactive' : 'unknown',
      payload: { primaryType: p.primaryType, query },
      expiresAt: new Date(Date.now() + this.cfg.retentionDays * 86400000),
    };
  }
}
