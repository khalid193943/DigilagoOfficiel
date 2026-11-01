/** Worker séparé (optionnel) : `npm run worker`, avec INLINE_WORKER=false côté API. */
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { startWorker, stopWorker } from './jobs/worker.js';

await migrate();
startWorker((m, e) => console.error(m, e));
console.log('worker Radar démarré');
const stop = async () => { await stopWorker(); await pool.end(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
