import { config } from '../config.js';
import { analyzeCompany } from './analyze.js';
import { claim, complete, fail, recoverStale } from './queue.js';
import { runScan } from './scan.js';

const handlers: Record<string, (payload: any) => Promise<unknown>> = {
  scan: (p) => runScan(p.jobId),
  analyze: (p) => analyzeCompany(p.companyId),
};

let running = false;
const slots: Promise<void>[] = [];

/** Boucle de travail : N tâches en parallèle, reprise automatique en cas d'erreur. */
export function startWorker(log: (m: string, e?: unknown) => void = () => {}) {
  if (running) return;
  running = true;
  recoverStale().catch(() => {});
  for (let i = 0; i < config.workerConcurrency; i++) {
    slots.push((async () => {
      while (running) {
        let t;
        try { t = await claim(); } catch (e) { log('file indisponible', e); await sleep(2000); continue; }
        if (!t) { await sleep(700); continue; }
        try { await handlers[t.type]?.(t.payload); await complete(t.id); }
        catch (e) { log(`tâche ${t.type} #${t.id} en échec`, e); await fail(t, e).catch(() => {}); }
      }
    })());
  }
}
export async function stopWorker() { running = false; await Promise.allSettled(slots); slots.length = 0; }

/** Exécute toutes les tâches en attente puis rend la main (utile pour les tests et les scripts). */
export async function drainQueue(max = 10_000) {
  for (let i = 0; i < max; i++) {
    const t = await claim();
    if (!t) return i;
    try { await handlers[t.type]?.(t.payload); await complete(t.id); } catch (e) { await fail(t, e); }
  }
  return max;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
