import { one, pool, q } from '../db/pool.js';

export type Task = { id: number; type: string; payload: any; attempts: number; max_attempts: number; job_id: string | null };

/** Ajoute une tâche ; une analyse déjà en attente pour la même entreprise n'est pas dupliquée. */
export async function enqueue(type: string, payload: Record<string, unknown>, opts: { jobId?: string | null; delayMs?: number } = {}) {
  if (type === 'analyze' && payload.companyId) {
    const dup = await one(`SELECT 1 FROM task_queue WHERE type='analyze' AND status IN ('queued','running') AND payload->>'companyId'=$1`, [payload.companyId]);
    if (dup) return;
  }
  await q(`INSERT INTO task_queue (type, payload, job_id, run_after) VALUES ($1,$2,$3, now() + ($4 || ' milliseconds')::interval)`,
    [type, JSON.stringify(payload), opts.jobId ?? null, String(opts.delayMs ?? 0)]);
}

/** Réserve la prochaine tâche prête. SKIP LOCKED : plusieurs workers peuvent tourner sans se gêner. */
export async function claim(types?: string[]): Promise<Task | undefined> {
  return one<Task>(`UPDATE task_queue SET status='running', locked_at=now(), attempts=attempts+1
    WHERE id = (SELECT id FROM task_queue WHERE status='queued' AND run_after <= now() ${types ? 'AND type = ANY($1)' : ''}
      ORDER BY (type='scan') DESC, id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, type, payload, attempts, max_attempts, job_id`, types ? [types] : []);
}

export async function complete(id: number) { await q(`UPDATE task_queue SET status='done', finished_at=now(), last_error=NULL WHERE id=$1`, [id]); }

export async function fail(t: Task, err: unknown) {
  const msg = (err as Error)?.message ?? String(err);
  if (t.attempts < t.max_attempts) {
    await q(`UPDATE task_queue SET status='queued', last_error=$2, run_after = now() + ($3 || ' seconds')::interval WHERE id=$1`, [t.id, msg, String(30 * 2 ** t.attempts)]);
  } else {
    await q(`UPDATE task_queue SET status='failed', last_error=$2, finished_at=now() WHERE id=$1`, [t.id, msg]);
  }
}

/** Remet en file les tâches abandonnées (processus arrêté en plein travail). */
export async function recoverStale(minutes = 15) {
  await q(`UPDATE task_queue SET status='queued' WHERE status='running' AND locked_at < now() - ($1 || ' minutes')::interval`, [String(minutes)]);
}

export async function queueStats() {
  return q<{ type: string; status: string; n: number }>(`SELECT type, status, count(*)::int n FROM task_queue WHERE created_at > now() - interval '7 days' GROUP BY 1,2`);
}
void pool;
