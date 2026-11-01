/** Client d'API : cookies de session, JSON, erreurs lisibles. Aucune clé n'est jamais côté navigateur. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const method = opts.method ?? (opts.body || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { 'X-Requested-With': 'radar' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (method !== 'GET') { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body ?? {}); }
  const r = await fetch(path, { method, headers, body, credentials: 'same-origin', signal: opts.signal });
  if (r.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new CustomEvent('radar:unauthorized'));
  const ct = r.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await r.json() : await r.text();
  if (!r.ok) {
    const d = data as any;
    throw new ApiError(r.status, d?.error ?? `Erreur ${r.status}`, d?.details);
  }
  return data as T;
}

export function qs(params: Record<string, unknown>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}
