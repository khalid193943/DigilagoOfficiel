import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10, ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined });
/* Une connexion inactive coupée par la base (mise en veille Neon, redémarrage, réseau) ne doit pas arrêter le serveur :
   le pool la retire et en ouvre une neuve à la requête suivante. */
pool.on('error', (e) => console.warn('Base : connexion inactive fermée (' + e.message + '), elle sera rouverte.'));
export type Db = pg.Pool | pg.PoolClient;

export async function q<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
  const r = await db.query<T>(text, params as any[]);
  return r.rows;
}
export async function one<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Db = pool): Promise<T | undefined> {
  return (await q<T>(text, params, db))[0];
}
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  let broken: Error | undefined;
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    /* si la connexion elle-même est coupée, on garde l'erreur d'origine et on jette cette connexion */
    await c.query('ROLLBACK').catch((re: Error) => { broken = re; });
    throw e;
  } finally {
    c.release(broken);
  }
}
