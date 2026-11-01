import { q, type Db, pool } from '../db/pool.js';

/** Journal de toutes les actions sensibles (qui, quoi, quand, avant/après). */
export async function logAction(userId: string | null, entity: string, entityId: string | null, action: string, diff?: unknown, db: Db = pool) {
  await q('INSERT INTO audit_log(user_id, entity, entity_id, action, diff) VALUES ($1,$2,$3,$4,$5)', [userId, entity, entityId, action, diff == null ? null : JSON.stringify(diff)], db);
}
