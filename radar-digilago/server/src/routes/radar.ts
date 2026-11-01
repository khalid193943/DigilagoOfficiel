import type { FastifyInstance } from 'fastify';
import { guard } from '../auth/auth.js';
import { SEGMENT_LABEL } from '../audit/diagnostic.js';
import { config } from '../config.js';
import { q } from '../db/pool.js';
import { CITIES } from '../domain/cities.js';
import { SECTORS } from '../domain/sectors.js';
import { live } from '../lib/live.js';
import { PLANNED_SOURCES, allSources } from '../sources/registry.js';

export const CRM_STATUSES = [
  ['new', 'Nouveau'], ['qualified', 'Qualifié'], ['to_contact', 'À contacter'], ['contacted', 'Contacté'], ['replied', 'Réponse reçue'],
  ['meeting', 'Rendez-vous'], ['proposal', 'Proposition envoyée'], ['negotiation', 'Négociation'], ['won', 'Gagné'], ['lost', 'Perdu'],
  ['later', 'À recontacter'], ['do_not_contact', 'Ne pas contacter'],
] as const;
const REGIONS = ['Casablanca-Settat', 'Rabat-Salé-Kénitra', 'Marrakech-Safi', 'Tanger-Tétouan-Al Hoceïma', 'Fès-Meknès', 'Souss-Massa', "L'Oriental",
  'Béni Mellal-Khénifra', 'Drâa-Tafilalet', 'Guelmim-Oued Noun', 'Laâyoune-Sakia El Hamra', 'Dakhla-Oued Ed-Dahab'];

export async function radarRoutes(app: FastifyInstance) {
  app.get('/api/meta', { preHandler: guard('read') }, async () => {
    const usage = await q<{ source: string; requests: number; est_cost: string }>(`SELECT source, requests, est_cost FROM source_usage WHERE day=current_date`);
    const sources = await Promise.all(allSources().map(async (a) => {
      const u = usage.find((x) => x.source === a.id);
      const h = a.id === 'osm' ? { ok: a.isEnabled(), message: a.isEnabled() ? 'Activée (joignabilité vérifiée au balayage).' : 'Désactivée.' } : await a.healthCheck();
      return { id: a.id, label: a.label, mono: a.mono, enabled: a.isEnabled(), requiresKey: a.requiresKey, tiled: a.tiled, coverageNote: a.coverageNote,
        attribution: a.attribution, costPerRequest: a.costPerRequest(), dailyLimit: a.dailyLimit(), usedToday: u?.requests ?? 0, costToday: Number(u?.est_cost ?? 0), health: h };
    }));
    return {
      sectors: SECTORS.map((s) => ({ id: s.id, label: s.label, priority: s.priority, keywords: s.google.length })),
      cities: CITIES, regions: REGIONS, sources, plannedSources: PLANNED_SOURCES,
      segments: Object.entries(SEGMENT_LABEL).map(([id, label]) => ({ id, label })),
      crmStatuses: CRM_STATUSES.map(([id, label]) => ({ id, label })),
      demoEnabled: config.sources.demo.enabled,
    };
  });

  app.get('/api/dashboard', { preHandler: guard('read') }, async () => {
    const [k] = await q<any>(`
      WITH base AS (SELECT * FROM companies WHERE merged_into IS NULL),
      ch AS (SELECT DISTINCT company_id FROM contacts WHERE verification <> 'invalid')
      SELECT count(*)::int total,
        count(*) FILTER (WHERE id IN (SELECT company_id FROM ch) OR id IN (SELECT company_id FROM social_profiles WHERE official_status<>'rejected'))::int contactable,
        count(*) FILTER (WHERE segment='no_site')::int no_site,
        count(*) FILTER (WHERE segment <> 'unknown')::int analyzed,
        count(*) FILTER (WHERE created_at > now() - interval '7 days')::int new7,
        count(*) FILTER (WHERE created_at > now() - interval '1 day')::int new1,
        count(*) FILTER (WHERE whatsapp_status IN ('official_link_found','confirmed'))::int whatsapp,
        count(*) FILTER (WHERE is_demo)::int demo,
        count(*) FILTER (WHERE needs_review)::int review
      FROM base`);
    const daily = await q<{ d: string; n: number }>(`SELECT to_char(day, 'YYYY-MM-DD') d, coalesce(n,0)::int n FROM generate_series(current_date - 6, current_date, '1 day') day
      LEFT JOIN (SELECT created_at::date dd, count(*) n FROM companies WHERE merged_into IS NULL GROUP BY 1) c ON c.dd = day ORDER BY day`);
    const segments = await q(`SELECT segment, count(*)::int n FROM companies WHERE merged_into IS NULL GROUP BY 1`);
    const cityRows = await q<any>(`SELECT city_id, count(*)::int n,
        count(*) FILTER (WHERE id IN (SELECT company_id FROM contacts) OR id IN (SELECT company_id FROM social_profiles))::int contactable,
        count(*) FILTER (WHERE segment='no_site')::int no_site, count(*) FILTER (WHERE segment<>'unknown')::int analyzed,
        count(*) FILTER (WHERE created_at > now() - interval '7 days')::int new7,
        count(*) FILTER (WHERE segment='social_or_generated')::int s2, count(*) FILTER (WHERE segment='weak_site')::int s3, count(*) FILTER (WHERE segment='good_site')::int s4
      FROM companies WHERE merged_into IS NULL AND city_id IS NOT NULL GROUP BY city_id`);
    const sectorRows = await q<any>(`SELECT city_id, sector, count(*)::int n FROM companies WHERE merged_into IS NULL AND city_id IS NOT NULL AND sector IS NOT NULL GROUP BY 1,2`);
    const scans = await q<any>(`SELECT city_id, max(finished_at) last FROM discovery_jobs WHERE status IN ('done','partial') GROUP BY 1`);
    const tiles = await q<any>(`SELECT city_id, count(*) FILTER (WHERE status='done')::int done, count(*)::int total FROM scan_tiles GROUP BY 1`);
    const cities = CITIES.map((c) => {
      const r = cityRows.find((x) => x.city_id === c.id);
      const sec = sectorRows.filter((x) => x.city_id === c.id).sort((a, b) => b.n - a.n).slice(0, 5)
        .map((x) => ({ id: x.sector, label: SECTORS.find((s) => s.id === x.sector)?.label ?? x.sector, n: x.n }));
      const t = tiles.find((x) => x.city_id === c.id);
      return { ...c, n: r?.n ?? 0, contactable: r?.contactable ?? 0, noSite: r?.no_site ?? 0, analyzed: r?.analyzed ?? 0, new7: r?.new7 ?? 0,
        cases: [r?.no_site ?? 0, r?.s2 ?? 0, r?.s3 ?? 0, r?.s4 ?? 0], sectors: sec, lastScan: scans.find((x) => x.city_id === c.id)?.last ?? null,
        tilesDone: t?.done ?? 0, tilesTotal: t?.total ?? 0 };
    });
    const src = await q<any>(`WITH s AS (SELECT company_id, array_agg(DISTINCT source) srcs FROM source_records GROUP BY 1)
      SELECT x.source, count(*)::int n, count(*) FILTER (WHERE cardinality(s.srcs)=1)::int uniq FROM s, unnest(s.srcs) x(source) GROUP BY 1 ORDER BY 2 DESC`);
    const usage = await q<any>(`SELECT source, sum(requests)::int requests, sum(est_cost)::float cost FROM source_usage WHERE day >= date_trunc('month', current_date) GROUP BY 1`);
    const running = await q<any>(`SELECT id, params, progress, status FROM discovery_jobs WHERE status IN ('pending','running') ORDER BY created_at DESC LIMIT 5`);
    return { kpis: k, daily, segments, cities, sources: src, usage, running };
  });

  app.get('/api/map/points', { preHandler: guard('read') }, async () => {
    const rows = await q<any>(`SELECT lat, lon, segment FROM companies WHERE merged_into IS NULL AND lat IS NOT NULL LIMIT 200000`);
    const SEG: Record<string, number> = { unknown: 0, no_site: 1, social_or_generated: 2, weak_site: 3, good_site: 4 };
    const tiles = await q<any>(`SELECT south, west, north, east, status FROM scan_tiles WHERE status IN ('done','partial')`);
    return { points: rows.map((r) => [Math.round(r.lat * 1e5) / 1e5, Math.round(r.lon * 1e5) / 1e5, SEG[r.segment] ?? 0]), tiles: tiles.map((t) => [t.south, t.west, t.north, t.east, t.status === 'done' ? 1 : 0]) };
  });

  app.get('/api/feed', { preHandler: guard('read') }, async (req) => {
    const limit = Math.min(30, Number((req.query as any).limit ?? 12));
    return q(`SELECT c.id, c.name, c.city, c.sector, c.segment, c.is_demo, c.created_at, c.lat, c.lon,
        (SELECT source FROM source_records s WHERE s.company_id=c.id ORDER BY collected_at LIMIT 1) source
      FROM companies c WHERE merged_into IS NULL ORDER BY created_at DESC LIMIT $1`, [limit]);
  });

  // Flux temps réel (Server-Sent Events)
  app.get('/api/live', { preHandler: guard('read') }, async (req, rep) => {
    rep.hijack();
    const res = rep.raw;
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: hello\ndata: {}\n\n`);
    const onEv = (ev: unknown) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
    live.on('event', onEv);
    const ping = setInterval(() => res.write(`: ping\n\n`), 25000);
    req.raw.on('close', () => { clearInterval(ping); live.off('event', onEv); });
  });

  app.get('/api/coverage', { preHandler: guard('read') }, async () => {
    const tiles = await q<any>(`SELECT city_id, count(*) FILTER (WHERE status='done')::int done, count(*) FILTER (WHERE status IN ('partial','error','todo'))::int open, max(updated_at) last FROM scan_tiles GROUP BY 1`);
    const counts = await q<any>(`SELECT city_id, count(*)::int n FROM companies WHERE merged_into IS NULL GROUP BY 1`);
    const zones = CITIES.map((c) => {
      const t = tiles.find((x) => x.city_id === c.id);
      const status = !t ? 'never' : t.open === 0 && t.done > 0 ? 'done' : 'partial';
      return { id: c.id, name: c.name, region: c.region, lat: c.lat, lon: c.lon, status, last: t?.last ?? null, n: counts.find((x) => x.city_id === c.id)?.n ?? 0 };
    });
    const regions = REGIONS.map((r) => {
      const z = zones.filter((x) => x.region.replace('’', "'") === r || x.region === r);
      const done = z.filter((x) => x.status === 'done').length, part = z.filter((x) => x.status === 'partial').length;
      return { name: r, zones: z.length, done, partial: part, pct: z.length ? Math.round(((done + part * 0.5) / z.length) * 100) : 0,
        n: z.reduce((s, x) => s + x.n, 0), last: z.map((x) => x.last).filter(Boolean).sort().pop() ?? null, lat: z[0]?.lat ?? null, lon: z[0]?.lon ?? null };
    });
    const matrixRows = await q<any>(`WITH s AS (SELECT c.sector, sr.company_id, array_agg(DISTINCT sr.source) srcs FROM source_records sr JOIN companies c ON c.id=sr.company_id
        WHERE c.merged_into IS NULL AND c.sector IS NOT NULL GROUP BY 1,2)
      SELECT sector, count(*)::int total, count(*) FILTER (WHERE cardinality(srcs)=1)::int single,
        (SELECT jsonb_object_agg(x, n) FROM (SELECT x, count(*) n FROM s s2, unnest(s2.srcs) x WHERE s2.sector = s.sector GROUP BY x) z) by_source
      FROM s GROUP BY sector ORDER BY total DESC`);
    const sources = allSources().map((a) => ({ id: a.id, label: a.label }));
    const matrix = matrixRows.map((r: any) => ({
      sector: r.sector, label: SECTORS.find((s) => s.id === r.sector)?.label ?? r.sector, total: r.total,
      single: r.total ? Math.round(((r.single ?? 0) / r.total) * 100) : 0,
      cells: sources.map((s) => ({ source: s.id, pct: r.total && r.by_source?.[s.id] ? Math.round((r.by_source[s.id] / r.total) * 100) : 0 })),
    }));
    return { zones, regions, matrix, sources, totals: { zones: zones.length, done: zones.filter((z) => z.status === 'done').length, partial: zones.filter((z) => z.status === 'partial').length, regionsWithData: regions.filter((r) => r.n > 0).length } };
  });
}
