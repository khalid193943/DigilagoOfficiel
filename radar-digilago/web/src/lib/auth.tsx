import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

export type User = { id: string; email: string; name: string; role: 'admin' | 'operator' | 'sales' | 'readonly' };
type Ctx = { user: User | null; ready: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ user: null, ready: false, login: async () => {}, logout: async () => {} });

const PERMS: Record<string, User['role'][]> = { search: ['admin', 'operator'], edit: ['admin', 'operator'], crm: ['admin', 'operator', 'sales'], export: ['admin', 'operator', 'sales'], admin: ['admin'] };
export const can = (u: User | null, p: keyof typeof PERMS) => !!u && PERMS[p].includes(u.role);
export const ROLE_LABEL: Record<User['role'], string> = { admin: 'Administrateur', operator: 'Opérateur', sales: 'Commercial', readonly: 'Lecture seule' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { api<{ user: User }>('/api/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setReady(true)); }, []);
  useEffect(() => { const h = () => setUser(null); window.addEventListener('radar:unauthorized', h); return () => window.removeEventListener('radar:unauthorized', h); }, []);
  const login = useCallback(async (email: string, password: string) => { const r = await api<{ user: User }>('/api/auth/login', { body: { email, password } }); setUser(r.user); }, []);
  const logout = useCallback(async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); }, []);
  return <AuthCtx.Provider value={{ user, ready, login, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
