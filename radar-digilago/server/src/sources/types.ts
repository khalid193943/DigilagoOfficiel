import type { Sector } from '../domain/sectors.js';
import type { Rect } from '../normalize/geo.js';

/** Fiche brute normalisée, telle que livrée par une source. Rien n'est inventé : champ absent = inconnu. */
export type RawPlace = {
  source: string;
  externalId: string;
  sourceUrl?: string;
  attribution?: string;
  name: string;
  sector?: string;
  subsector?: string;
  categories?: string[];
  address?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
  lat?: number;
  lon?: number;
  phones?: string[];
  emails?: string[];
  /** Liens tels que publiés par la source ; ils seront classés (site, réseau social, WhatsApp...). */
  links?: string[];
  google?: { rating?: number; reviews?: number; hasHours?: boolean; photos?: number; mapsUrl?: string; status?: string; hasWebsite?: boolean };
  activityStatus?: 'active' | 'inactive' | 'unknown';
  isDemo?: boolean;
  payload?: Record<string, unknown>;
  expiresAt?: Date;
};

export type TileQuery = {
  rect: Rect;
  sectors: Sector[];
  keywords: string[];
  /** Budget de requêtes restant pour cette tuile. */
  maxRequests: number;
  cityName: string;
};

export type TileResult = {
  places: RawPlace[];
  requests: number;
  /** La source a renvoyé son maximum : la tuile doit être redécoupée. */
  saturated: boolean;
  estCost: number;
  notes: string[];
  error?: string;
};

export type SearchContext = {
  /** Réserve n requêtes dans le quota du jour ; lève QuotaError si dépassé. */
  useQuota(n: number): Promise<void>;
  isCancelled(): Promise<boolean>;
};

export interface SourceAdapter {
  id: string;
  label: string;
  mono: string;
  attribution: string;
  requiresKey: boolean;
  coverageNote: string;
  /** true : la source est interrogée tuile par tuile ; false : une seule requête pour toute la zone. */
  tiled: boolean;
  isEnabled(): boolean;
  dailyLimit(): number;
  costPerRequest(): number;
  /** Nombre de requêtes estimé pour une tuile. */
  requestsPerTile(q: { sectors: Sector[]; keywords: string[] }): number;
  searchTile(q: TileQuery, ctx: SearchContext): Promise<TileResult>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

export class QuotaError extends Error {}
export type FetchFn = typeof fetch;

export function keywordsFor(q: { sectors: Sector[]; keywords: string[] }, pick: (s: Sector) => string[]) {
  const set = new Set<string>();
  for (const s of q.sectors) pick(s).forEach((k) => set.add(k));
  q.keywords.forEach((k) => k.trim() && set.add(k.trim()));
  return [...set];
}
