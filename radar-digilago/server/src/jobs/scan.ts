import { one, q, tx } from '../db/pool.js';
import { cityById } from '../domain/cities.js';
import { sectorById, type Sector } from '../domain/sectors.js';
import { emit } from '../lib/live.js';
import { rectAround, splitRect, type Rect } from '../normalize/geo.js';
import { ingestPlace } from '../pipeline/ingest.js';
import { sourceById } from '../sources/registry.js';
import { QuotaError, type SearchContext, type SourceAdapter } from '../sources/types.js';
import { enqueue } from './queue.js';

export type ScanParams = {
  cityId: string; sectors: string[]; keywords: string[]; sources: string[];
  mode: 'quick' | 'full'; maxRequests: number; analyze: boolean;
};

const MAX_DEPTH = 2;
const ROWS = 'ABCDEFGH';

/** Découpe de la zone : environ une tuile tous les 4 km, de 1×1 à 6×6. */
export function planTiles(cityId: string, mode: 'quick' | 'full'): { rect: Rect; label: string }[] {
  const city = cityById(cityId);
  if (!city) throw new Error(`Ville inconnue : ${cityId}`);
  const rect = rectAround(city.lat, city.lon, city.radiusKm);
  if (mode === 'quick') return [{ rect, label: 'Zone' }];
  const n = Math.max(1, Math.min(6, Math.ceil((city.radiusKm * 2) / 4)));
  return splitRect(rect, n).map((r, i) => ({ rect: r, label: `${ROWS[n - 1 - Math.floor(i / n)]}${(i % n) + 1}` }));
}

export function estimateScan(p: Pick<ScanParams, 'cityId' | 'sectors' | 'keywords' | 'sources' | 'mode'>) {
  const tiles = planTiles(p.cityId, p.mode);
  const sectors = p.sectors.map(sectorById).filter(Boolean) as Sector[];
  const per = p.sources.map((id) => {
    const a = sourceById(id);
    if (!a) return null;
    const requests = a.tiled ? Math.ceil(a.requestsPerTile({ sectors, keywords: p.keywords }) * tiles.length * 1.15) : 1;
    return { source: id, label: a.label, requests, cost: requests * a.costPerRequest(), enabled: a.isEnabled() };
  }).filter(Boolean) as { source: string; label: string; requests: number; cost: number; enabled: boolean }[];
  return { tiles: tiles.length, perSource: per, requests: per.reduce((s, x) => s + x.requests, 0), cost: per.reduce((s, x) => s + x.cost, 0) };
}

async function useQuotaFactory(a: SourceAdapter): Promise<SearchContext['useQuota']> {
  return async (n: number) => {
    const row = await one<{ requests: number }>(`SELECT requests FROM source_usage WHERE source=$1 AND day=current_date`, [a.id]);
    if ((row?.requests ?? 0) + n > a.dailyLimit()) throw new QuotaError(`${a.label} : quota quotidien atteint (${a.dailyLimit()} requêtes)`);
    await q(`INSERT INTO source_usage (source, day, requests, est_cost) VALUES ($1, current_date, $2, $3)
      ON CONFLICT (source, day) DO UPDATE SET requests = source_usage.requests + $2, est_cost = source_usage.est_cost + $3`, [a.id, n, n * a.costPerRequest()]);
  };
}

/** Exécute un balayage : tuiles, redécoupage des tuiles saturées, ingestion, journal et progression en direct. */
export async function runScan(jobId: string) {
  const job = await one<any>('SELECT * FROM discovery_jobs WHERE id=$1', [jobId]);
  if (!job || ['done', 'cancelled'].includes(job.status)) return;
  const p: ScanParams = job.params;
  const city = cityById(p.cityId)!;
  const sectors = p.sectors.map(sectorById).filter(Boolean) as Sector[];
  const log: { at: string; tag: string; msg: string }[] = job.log ?? [];
  const counters = { found: 0, created: 0, matched: 0, review: 0, requests: 0, errors: 0 };
  const reports: any[] = [];
  let partial = false, cost = 0;
  const touched = new Set<string>();

  const push = async (tag: string, msg: string) => {
    log.push({ at: new Date().toISOString(), tag, msg });
    while (log.length > 200) log.shift();
  };
  const tilesDone = async () => (await one<{ d: number; t: number }>(`SELECT count(*) FILTER (WHERE status IN ('done','partial','split','error'))::int d, count(*)::int t FROM scan_tiles WHERE job_id=$1`, [jobId]))!;
  const save = async () => {
    const t = await tilesDone();
    const progress = { tiles_done: t.d, tiles_total: t.t, found: counters.found, fresh: counters.created };
    await q(`UPDATE discovery_jobs SET progress=$2, counters=$3, log=$4, source_reports=$5, est_cost=$6 WHERE id=$1`,
      [jobId, JSON.stringify(progress), JSON.stringify(counters), JSON.stringify(log), JSON.stringify(reports), cost]);
    await emit({ type: 'scan', id: jobId, status: 'running', progress });
  };
  const isCancelled = async () => (await one<{ status: string }>('SELECT status FROM discovery_jobs WHERE id=$1', [jobId]))?.status === 'cancelled';

  await q(`UPDATE discovery_jobs SET status='running', started_at=now() WHERE id=$1`, [jobId]);
  await push('DÉPART', `${city.name} · ${sectors.map((s) => s.label).join(', ') || 'mots-clés'} · ${p.sources.length} source(s)`);

  const plan = planTiles(p.cityId, p.mode);
  for (const sid of p.sources) {
    const a = sourceById(sid);
    if (!a || !a.isEnabled()) { reports.push({ source: sid, ok: false, error: 'source indisponible ou désactivée' }); partial = true; continue; }
    const tiles = a.tiled ? plan : [{ rect: rectAround(city.lat, city.lon, city.radiusKm), label: 'Zone' }];
    for (const t of tiles) await q(`INSERT INTO scan_tiles (job_id, city_id, source, label, south, west, north, east) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [jobId, p.cityId, a.id, t.label, t.rect.south, t.rect.west, t.rect.north, t.rect.east]);
  }
  await save();

  let budget = p.maxRequests;
  for (const sid of p.sources) {
    const a = sourceById(sid);
    if (!a || !a.isEnabled()) continue;
    const rep = { source: a.id, label: a.label, ok: true, requests: 0, results: 0, truncated: false, attribution: a.attribution, notes: [] as string[], error: undefined as string | undefined };
    reports.push(rep);
    const ctx: SearchContext = { useQuota: await useQuotaFactory(a), isCancelled };
    try {
      for (;;) {
        if (await isCancelled()) { partial = true; await push('ARRÊT', 'Balayage annulé par l’utilisateur.'); break; }
        const tile = await one<any>(`SELECT * FROM scan_tiles WHERE job_id=$1 AND source=$2 AND status='todo' ORDER BY depth, label LIMIT 1`, [jobId, a.id]);
        if (!tile) break;
        if (budget <= 0) { rep.truncated = true; partial = true; await push('BUDGET', 'Budget de requêtes atteint : balayage partiel.'); break; }
        await q(`UPDATE scan_tiles SET status='running', updated_at=now() WHERE id=$1`, [tile.id]);
        await save();
        const rect = { south: tile.south, west: tile.west, north: tile.north, east: tile.east };
        const res = await a.searchTile({ rect, sectors, keywords: p.keywords, maxRequests: Math.min(budget, 60), cityName: city.name }, ctx);
        budget -= res.requests; rep.requests += res.requests; counters.requests += res.requests; cost += res.estCost;
        if (res.error) { rep.ok = false; rep.error = res.error; counters.errors++; partial = true; await push(a.mono === 'G' ? 'GOOGLE' : a.id.toUpperCase(), `tuile ${tile.label} : erreur — ${res.error}`); }
        let created = 0;
        await tx(async (db) => {
          for (const place of res.places) {
            const r = await ingestPlace(place, { jobId, cityId: p.cityId }, db);
            touched.add(r.companyId);
            counters.found++;
            if (r.created) { created++; counters.created++; }
            if (r.matched === 'certain') counters.matched++;
            if (r.review) counters.review++;
          }
        });
        rep.results += res.places.length;
        const tag = { google_places: 'GOOGLE', osm: 'OSM', demo: 'DÉMO' }[a.id] ?? a.id.toUpperCase();
        if (res.saturated && tile.depth < MAX_DEPTH && a.tiled) {
          await q(`UPDATE scan_tiles SET status='split', results=$2, updated_at=now() WHERE id=$1`, [tile.id, res.places.length]);
          const kids = splitRect(rect, 2);
          for (let k = 0; k < 4; k++) await q(`INSERT INTO scan_tiles (job_id, city_id, source, label, south, west, north, east, depth) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [jobId, p.cityId, a.id, `${tile.label}.${k + 1}`, kids[k].south, kids[k].west, kids[k].north, kids[k].east, tile.depth + 1]);
          await push(tag, `tuile ${tile.label} · ${res.places.length} résultats → saturée, redécoupée en 4`);
        } else {
          const st = res.error ? 'error' : res.saturated ? 'partial' : 'done';
          if (res.saturated) { rep.truncated = true; partial = true; }
          await q(`UPDATE scan_tiles SET status=$2, results=$3, updated_at=now() WHERE id=$1`, [tile.id, st, res.places.length]);
          await push(tag, `tuile ${tile.label} · ${res.places.length} résultats · ${created} nouvelles${res.saturated ? ' · limite atteinte (partiel)' : ''}`);
        }
        await save();
      }
    } catch (e) {
      rep.ok = false; rep.error = (e as Error).message; partial = true; counters.errors++;
      await push(e instanceof QuotaError ? 'QUOTA' : 'ERREUR', (e as Error).message);
      await q(`UPDATE scan_tiles SET status='todo' WHERE job_id=$1 AND source=$2 AND status='running'`, [jobId, a.id]);
    }
  }

  // Événements « nouvelle entreprise » pour le flux en direct
  const fresh = await q<any>(`SELECT c.id, c.name, c.city, c.sector, s.source FROM companies c JOIN source_records s ON s.company_id=c.id
    WHERE s.job_id=$1 AND c.created_at >= (SELECT started_at FROM discovery_jobs WHERE id=$1) ORDER BY c.created_at LIMIT 200`, [jobId]);
  for (const f of fresh) await emit({ type: 'company', id: f.id, name: f.name, city: f.city, sector: f.sector, source: f.source });

  if (p.analyze) for (const id of touched) await enqueue('analyze', { companyId: id }, { jobId });
  const cancelled = await isCancelled();
  const status = cancelled ? 'cancelled' : partial ? 'partial' : 'done';
  const coverage = `Sources : ${reports.map((r) => `${r.label}${r.ok ? '' : ' (erreur)'}`).join(', ') || 'aucune'}. ` +
    (partial ? 'Couverture PARTIELLE : voir le journal.' : 'Toutes les tuiles ont été balayées pour ces sources.') +
    ' Aucune source ne garantit l’exhaustivité.';
  await push('FIN', `${counters.found} fiches · ${counters.created} nouvelles · ${counters.matched} fusions sûres · ${counters.review} à valider`);
  await save();
  await q(`UPDATE discovery_jobs SET status=$2, finished_at=now(), coverage_note=$3 WHERE id=$1`, [jobId, status, coverage]);
  await emit({ type: 'scan', id: jobId, status, progress: { found: counters.found, fresh: counters.created } });
}
