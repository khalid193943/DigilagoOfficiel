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
let stopped = false;
let retry: NodeJS.Timeout | null = null;

/** Écoute permanente ; si la connexion tombe (veille de la base, redémarrage, réseau), elle se rétablit seule. */
export async function startLiveListener() {
  if (client) return;
  stopped = false;
  const c = new pg.Client({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined });
  client = c;
  let lost = false;
  const onLost = () => {
    if (lost) return;
    lost = true;
    if (client === c) client = null;
    c.end().catch(() => {});
    scheduleReconnect(2000);
  };
  c.on('notification', (n) => { try { live.emit('event', JSON.parse(n.payload ?? '{}')); } catch { /* ignore */ } });
  c.on('error', onLost);
  c.on('end', onLost);
  try {
    await c.connect();
    await c.query('LISTEN radar');
  } catch (e) {
    onLost();
    throw e;
  }
}

function scheduleReconnect(ms: number) {
  if (stopped || retry) return;
  retry = setTimeout(() => {
    retry = null;
    startLiveListener().catch(() => scheduleReconnect(Math.min(ms * 2, 30_000)));
  }, ms);
}

export async function stopLiveListener() {
  stopped = true;
  if (retry) { clearTimeout(retry); retry = null; }
  const c = client;
  client = null;
  await c?.end().catch(() => {});
}
