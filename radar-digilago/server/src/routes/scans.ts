import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { guard } from '../auth/auth.js';
import { one, q } from '../db/pool.js';
import { cityById } from '../domain/cities.js';
import { sectorById } from '../domain/sectors.js';
import { estimateScan, type ScanParams } from '../jobs/scan.js';
import { enqueue } from '../jobs/queue.js';
import { logAction } from '../lib/audit.js';
import { badRequest, notFound } from '../lib/errors.js';
import { sourceById } from '../sources/registry.js';

const Params = z.object({
  cityId: z.string(),
  sectors: z.array(z.string()).default([]),
  keywords: z.array(z.string().max(60)).max(30).default([]),
  sources: z.array(z.string()).min(1, 'Choisissez au moins une source'),
  mode: z.enum(['quick', 'full']).default('full'),
  maxRequests: z.number().int().min(1).max(5000).default(400),
  analyze: z.boolean().default(true),
});

function validate(p: z.infer<typeof Params>) {
  if (!cityById(p.cityId)) throw badRequest('Ville inconnue');
  if (!p.sectors.length && !p.keywords.length) throw badRequest('Choisissez au moins un secteur ou un mot-clé');
  for (const s of p.sectors) if (!sectorById(s)) throw badRequest(`Secteur inconnu : ${s}`);
  for (const s of p.sources) { const a = sourceById(s); if (!a) throw badRequest(`Source inconnue : ${s}`); if (!a.isEnabled()) throw badRequest(`${a.label} n’est pas activée (voir Paramètres)`); }
}

export async function scanRoutes(app: FastifyInstance) {
  app.post('/api/scans/estimate', { preHandler: guard('read') }, async (req) => {
    const p = Params.omit({ sources: true }).extend({ sources: z.array(z.string()).default([]) }).parse(req.body);
    if (!cityById(p.cityId)) throw badRequest('Ville inconnue');
    return estimateScan({ cityId: p.cityId, sectors: p.sectors ?? [], keywords: p.keywords ?? [], sources: p.sources ?? [], mode: p.mode ?? 'full' });
  });

  app.post('/api/scans', { preHandler: guard('search') }, async (req) => {
    const p = Params.parse(req.body);
    validate(p);
    const city = cityById(p.cityId)!;
    const label = `${city.name} · ${p.sectors.map((s) => sectorById(s)!.label).join(', ') || p.keywords.join(', ')}`;
    const job = await one<{ id: string }>(`INSERT INTO discovery_jobs (created_by, label, params, sources, city_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user!.id, label, JSON.stringify(p satisfies ScanParams), p.sources, p.cityId]);
    await enqueue('scan', { jobId: job!.id }, { jobId: job!.id });
    await logAction(req.user!.id, 'scan', job!.id, 'create', p);
    return { id: job!.id };
  });

  app.get('/api/scans', { preHandler: guard('read') }, async () =>
    q(`SELECT j.id, j.label, j.status, j.params, j.sources, j.counters, j.progress, j.est_cost, j.created_at, j.started_at, j.finished_at, j.coverage_note, u.name created_by_name
      FROM discovery_jobs j LEFT JOIN users u ON u.id=j.created_by ORDER BY j.created_at DESC LIMIT 50`));

  app.get('/api/scans/:id', { preHandler: guard('read') }, async (req) => {
    const { id } = req.params as { id: string };
    const job = await one('SELECT * FROM discovery_jobs WHERE id=$1', [id]);
    if (!job) throw notFound('Balayage');
    const tiles = await q(`SELECT id, source, label, south, west, north, east, depth, status, results FROM scan_tiles WHERE job_id=$1 ORDER BY source, depth, label`, [id]);
    const analysis = await one(`SELECT count(*) FILTER (WHERE status IN ('queued','running'))::int pending, count(*) FILTER (WHERE status='done')::int done FROM task_queue WHERE job_id=$1 AND type='analyze'`, [id]);
    return { job, tiles, analysis };
  });

  app.post('/api/scans/:id/cancel', { preHandler: guard('search') }, async (req) => {
    const { id } = req.params as { id: string };
    await q(`UPDATE discovery_jobs SET status='cancelled', finished_at=now() WHERE id=$1 AND status IN ('pending','running')`, [id]);
    await q(`UPDATE task_queue SET status='done', finished_at=now() WHERE job_id=$1 AND status='queued'`, [id]);
    await logAction(req.user!.id, 'scan', id, 'cancel');
    return { ok: true };
  });

  app.post('/api/scans/:id/rerun', { preHandler: guard('search') }, async (req) => {
    const { id } = req.params as { id: string };
    const old = await one<any>('SELECT * FROM discovery_jobs WHERE id=$1', [id]);
    if (!old) throw notFound('Balayage');
    const job = await one<{ id: string }>(`INSERT INTO discovery_jobs (created_by, label, params, sources, city_id, parent_job_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.user!.id, old.label, JSON.stringify(old.params), old.sources, old.city_id, id]);
    await enqueue('scan', { jobId: job!.id }, { jobId: job!.id });
    return { id: job!.id };
  });
}
