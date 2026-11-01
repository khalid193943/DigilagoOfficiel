import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { startWorker, stopWorker } from './jobs/worker.js';
import { startLiveListener, stopLiveListener } from './lib/live.js';

await migrate((m) => console.log(m));
const app = await buildApp({ logger: true });
await startLiveListener();
if (config.inlineWorker) startWorker((m, e) => app.log.warn({ err: e }, m));
await app.listen({ port: config.port, host: config.host });

const shutdown = async () => {
  app.log.info('arrêt en cours…');
  await app.close(); await stopWorker(); await stopLiveListener(); await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
