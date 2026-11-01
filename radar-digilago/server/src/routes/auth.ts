import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { COOKIE, checkPassword, createSession, destroySession, guard, hashPassword } from '../auth/auth.js';
import { config } from '../config.js';
import { one, q } from '../db/pool.js';
import { logAction } from '../lib/audit.js';
import { HttpError, badRequest } from '../lib/errors.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } }, async (req, rep) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const u = await one<any>('SELECT * FROM users WHERE email=$1 AND active', [body.email.toLowerCase()]);
    if (!u || !(await checkPassword(body.password, u.password_hash))) throw new HttpError(401, 'Email ou mot de passe incorrect');
    const token = await createSession(u.id, req.ip, req.headers['user-agent']);
    await q('UPDATE users SET last_login_at=now() WHERE id=$1', [u.id]);
    await logAction(u.id, 'user', u.id, 'login');
    rep.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: config.sessionDays * 86400 });
    return { user: { id: u.id, email: u.email, name: u.name, role: u.role } };
  });
  app.post('/api/auth/logout', async (req, rep) => {
    const t = req.cookies[COOKIE];
    if (t) await destroySession(t);
    rep.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });
  app.get('/api/auth/me', { preHandler: guard('read') }, async (req) => ({ user: req.user }));

  // ----- utilisateurs (administrateur) -----
  app.get('/api/users', { preHandler: guard('admin') }, async () =>
    q('SELECT id, email, name, role, active, created_at, last_login_at FROM users ORDER BY created_at'));
  app.get('/api/users/assignable', { preHandler: guard('read') }, async () =>
    q(`SELECT id, name, role FROM users WHERE active AND role IN ('admin','operator','sales') ORDER BY name`));
  app.post('/api/users', { preHandler: guard('admin') }, async (req) => {
    const b = z.object({ email: z.string().email(), name: z.string().min(1), role: z.enum(['admin', 'operator', 'sales', 'readonly']), password: z.string().min(10) }).parse(req.body);
    if (await one('SELECT 1 FROM users WHERE email=$1', [b.email.toLowerCase()])) throw badRequest('Cet email existe déjà');
    const u = await one(`INSERT INTO users (email, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role, active`,
      [b.email.toLowerCase(), b.name, b.role, await hashPassword(b.password)]);
    await logAction(req.user!.id, 'user', u.id, 'create', { email: b.email, role: b.role });
    return u;
  });
  app.patch('/api/users/:id', { preHandler: guard('admin') }, async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({ role: z.enum(['admin', 'operator', 'sales', 'readonly']).optional(), active: z.boolean().optional(), password: z.string().min(10).optional() }).parse(req.body);
    if (id === req.user!.id && (b.active === false || (b.role && b.role !== 'admin'))) throw badRequest('Vous ne pouvez pas retirer vos propres droits d’administrateur');
    if (b.role) await q('UPDATE users SET role=$2 WHERE id=$1', [id, b.role]);
    if (b.active != null) { await q('UPDATE users SET active=$2 WHERE id=$1', [id, b.active]); if (!b.active) await q('DELETE FROM sessions WHERE user_id=$1', [id]); }
    if (b.password) await q('UPDATE users SET password_hash=$2 WHERE id=$1', [id, await hashPassword(b.password)]);
    await logAction(req.user!.id, 'user', id, 'update', { role: b.role, active: b.active, password: b.password ? 'changé' : undefined });
    return { ok: true };
  });
}
