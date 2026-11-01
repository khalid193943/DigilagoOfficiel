/** Crée (ou réinitialise) le compte administrateur à partir de ADMIN_EMAIL / ADMIN_PASSWORD. */
import { hashPassword } from '../auth/auth.js';
import { migrate } from '../db/migrate.js';
import { pool, q } from '../db/pool.js';

const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD, name = process.env.ADMIN_NAME ?? 'Administrateur';
if (!email || !password || password.length < 10) {
  console.error('Définissez ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères minimum).');
  process.exit(1);
}
await migrate();
await q(`INSERT INTO users(email, name, password_hash, role) VALUES ($1,$2,$3,'admin')
  ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin', active=true`, [email.toLowerCase(), name, await hashPassword(password)]);
console.log(`Administrateur prêt : ${email}`);
await pool.end();
