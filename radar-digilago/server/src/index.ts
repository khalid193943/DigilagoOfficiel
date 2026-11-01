import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { one, pool, q } from './db/pool.js';
import { hashPassword } from './auth/auth.js';
import { startWorker, stopWorker } from './jobs/worker.js';
import { startLiveListener, stopLiveListener } from './lib/live.js';

await migrate((m) => console.log(m));
await ensureFirstAdmin();
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

/**
 * Premier démarrage : si aucun utilisateur n'existe et que ADMIN_EMAIL / ADMIN_PASSWORD sont définis,
 * crée l'administrateur (pratique sur un hébergeur sans terminal). Sans effet ensuite.
 */
async function ensureFirstAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(), password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (await one('SELECT 1 FROM users LIMIT 1')) return;
  if (password.length < 10) { console.warn('ADMIN_PASSWORD trop court (10 caractères minimum) : administrateur non créé.'); return; }
  await q(`INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,'admin',$3)`, [email, process.env.ADMIN_NAME?.trim() || 'Administrateur', await hashPassword(password)]);
  console.log(`Premier administrateur créé : ${email} (vous pouvez retirer ADMIN_PASSWORD des variables).`);
}
