/** Configuration lue uniquement côté serveur. Aucune clé n'est jamais envoyée au navigateur. */
const env = process.env;
const bool = (v: string | undefined, d = false) => (v == null || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));
const num = (v: string | undefined, d: number) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/**
 * Neon (y compris via Vercel) fournit une adresse « pooled » (hôte en -pooler) qui ne permet pas LISTEN,
 * utilisé pour le direct. Le Radar est un serveur permanent : on se connecte directement à la base.
 */
export function directDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (/\.neon\.tech$/i.test(u.hostname) && u.hostname.includes('-pooler.')) {
      u.hostname = u.hostname.replace('-pooler.', '.');
      return u.toString();
    }
  } catch { /* adresse non standard : laissée telle quelle */ }
  return raw;
}

export const config = {
  env: env.NODE_ENV ?? 'development',
  isProd: env.NODE_ENV === 'production',
  port: num(env.PORT, 8080),
  /** Adresse publique du serveur (sert aux sites de démonstration). */
  publicBaseUrl: (env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${num(env.PORT, 8080)}`).replace(/\/$/, ''),
  host: env.HOST ?? '0.0.0.0',
  databaseUrl: directDatabaseUrl(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || 'postgres://postgres@localhost:5432/leadfinder'),
  /** SSL vers la base (bases gérées externes : Neon, Supabase…). Inutile sur le réseau privé Railway. */
  databaseSsl: bool(env.DATABASE_SSL, false),
  sessionDays: num(env.SESSION_DAYS, 7),
  /** Cookie de session « Secure » (HTTPS obligatoire). Par défaut actif en production. */
  cookieSecure: bool(env.COOKIE_SECURE, env.NODE_ENV === 'production'),
  /** Le worker tourne dans le même processus que l'API (simple) ou à part (`npm run worker`). */
  inlineWorker: bool(env.INLINE_WORKER, true),
  workerConcurrency: num(env.WORKER_CONCURRENCY, 3),

  /** Identification honnête de notre robot auprès des sites et des APIs. */
  userAgent: env.CRAWLER_USER_AGENT ?? 'DigilagoLeadFinder/0.1 (+https://digilago.ma; contact@digilago.ma)',
  crawlDelayMs: num(env.CRAWL_DELAY_MS, 1500),
  crawlMaxPages: num(env.CRAWL_MAX_PAGES, 4),
  fetchTimeoutMs: num(env.FETCH_TIMEOUT_MS, 12000),
  /** Bloque l'accès aux IP privées (protection SSRF). Ne mettre à true qu'en test/démo locale. */
  allowPrivateFetch: bool(env.ALLOW_PRIVATE_FETCH, false),

  sources: {
    osm: {
      enabled: bool(env.OSM_ENABLED, true),
      overpassUrl: env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
      dailyLimit: num(env.OSM_DAILY_LIMIT, 300),
      minIntervalMs: num(env.OSM_MIN_INTERVAL_MS, 5000),
    },
    google: {
      enabled: bool(env.GOOGLE_PLACES_ENABLED, false),
      apiKey: env.GOOGLE_PLACES_API_KEY ?? '',
      dailyLimit: num(env.GOOGLE_PLACES_DAILY_LIMIT, 200),
      /** Coût estimé par requête, à renseigner d'après la grille tarifaire en vigueur (0 = non estimé). */
      costPerRequest: num(env.GOOGLE_PLACES_COST_PER_REQUEST, 0),
      /** Rétention appliquée aux contenus Google (hors place_id), à aligner sur les conditions en vigueur. */
      retentionDays: num(env.GOOGLE_PLACES_RETENTION_DAYS, 30),
    },
    demo: {
      enabled: bool(env.DEMO_SOURCE_ENABLED, false),
    },
  },
  exportMaxRows: num(env.EXPORT_MAX_ROWS, 5000),
};
export type Config = typeof config;
