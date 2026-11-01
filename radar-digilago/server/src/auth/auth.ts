import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { one, q } from '../db/pool.js';
import { HttpError, forbidden } from '../lib/errors.js';

export type Role = 'admin' | 'operator' | 'sales' | 'readonly';
export type SessionUser = { id: string; email: string; name: string; role: Role };

export const COOKIE = 'radar_session';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(userId: string, ip?: string, ua?: string) {
  const token = randomBytes(32).toString('base64url');
  await q(`INSERT INTO sessions(token_hash, user_id, expires_at, ip, user_agent) VALUES ($1,$2, now() + ($3 || ' days')::interval, $4, $5)`,
    [sha(token), userId, String(config.sessionDays), ip ?? null, ua ?? null]);
  return token;
}
export async function destroySession(token: string) { await q('DELETE FROM sessions WHERE token_hash=$1', [sha(token)]); }

export async function userFromToken(token?: string): Promise<SessionUser | undefined> {
  if (!token) return undefined;
  return one<SessionUser>(`SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at > now() AND u.active`, [sha(token)]);
}

declare module 'fastify' { interface FastifyRequest { user?: SessionUser } }

/** Droits par action. Un seul endroit à modifier pour ajuster les permissions. */
export const PERMS = {
  read: ['admin', 'operator', 'sales', 'readonly'],
  search: ['admin', 'operator'],
  edit: ['admin', 'operator'],
  crm: ['admin', 'operator', 'sales'],
  export: ['admin', 'operator', 'sales'],
  admin: ['admin'],
} satisfies Record<string, Role[]>;
export type Perm = keyof typeof PERMS;

export const can = (u: SessionUser | undefined, p: Perm) => !!u && (PERMS[p] as Role[]).includes(u.role);

export function guard(p: Perm) {
  return async (req: FastifyRequest, _rep: FastifyReply) => {
    if (!req.user) throw new HttpError(401, 'Connexion requise');
    if (!can(req.user, p)) throw forbidden();
  };
}
