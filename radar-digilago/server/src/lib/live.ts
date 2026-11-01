import { EventEmitter } from 'node:events';
import pg from 'pg';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

/**
 * Événements en direct (nouvelles entreprises, progression des balayages).
 * Passent par PostgreSQL LISTEN/NOTIFY : marche même si le worker tourne dans un autre processus.
 */
export const live = new EventEmitter();
live.setMaxListeners(200);
export type LiveEvent = { type: 'company' | 'scan' | 'analysis'; [k: string]: unknown };

export async function emit(ev: LiveEvent) {
  const payload = JSON.stringify(ev).slice(0, 7900);
  await pool.query('SELECT pg_notify($1, $2)', ['radar', payload]).catch(() => {});
}

let client: pg.Client | null = null;
export async function startLiveListener() {
  if (client) return;
  client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  client.on('notification', (n) => { try { live.emit('event', JSON.parse(n.payload ?? '{}')); } catch { /* ignore */ } });
  client.on('error', () => { client = null; setTimeout(() => startLiveListener().catch(() => {}), 2000); });
  await client.query('LISTEN radar');
}
export async function stopLiveListener() { await client?.end().catch(() => {}); client = null; }
