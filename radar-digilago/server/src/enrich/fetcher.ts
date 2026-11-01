import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { config } from '../config.js';
import { DEMO_DOMAIN } from '../sources/demo.js';

export type FetchResult = {
  ok: boolean; status: number | null; url: string; finalUrl: string; https: boolean; ms: number;
  html: string; bytes: number; redirects: number; contentType: string; error?: string;
};

function isPrivateIp(ip: string) {
  if (net.isIPv6(ip)) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip.startsWith('::ffff:127.') || ip === '::';
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Protection SSRF : une URL venue d'une source externe ne doit jamais atteindre le réseau interne. */
export async function assertPublicHost(host: string) {
  if (config.allowPrivateFetch) return;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('hôte interne refusé');
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('adresse privée refusée');
}

/** Les sites de démonstration (*.demo-radar.invalid) sont servis par notre propre serveur. */
function resolveTarget(u: URL): { fetchUrl: string; internal: boolean } {
  if (u.hostname.endsWith('.' + DEMO_DOMAIN)) {
    const slug = u.hostname.slice(0, -(DEMO_DOMAIN.length + 1));
    return { fetchUrl: `${config.publicBaseUrl}/demo-sites/${slug}${u.pathname}${u.search}`, internal: true };
  }
  return { fetchUrl: u.toString(), internal: false };
}

export async function safeFetch(url: string, opts: { maxBytes?: number; timeoutMs?: number; method?: string } = {}): Promise<FetchResult> {
  const maxBytes = opts.maxBytes ?? 1_500_000;
  const started = Date.now();
  let current = url, redirects = 0;
  const base: FetchResult = { ok: false, status: null, url, finalUrl: url, https: url.startsWith('https:'), ms: 0, html: '', bytes: 0, redirects: 0, contentType: '' };
  try {
    for (;;) {
      const u = new URL(current);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocole refusé');
      const { fetchUrl, internal } = resolveTarget(u);
      if (!internal) await assertPublicHost(u.hostname);
      const r = await fetch(fetchUrl, {
        method: opts.method ?? 'GET', redirect: 'manual',
        headers: { 'User-Agent': config.userAgent, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'fr,ar;q=0.8,en;q=0.6' },
        signal: AbortSignal.timeout(opts.timeoutMs ?? config.fetchTimeoutMs),
      });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        if (++redirects > 5) throw new Error('trop de redirections');
        current = new URL(r.headers.get('location')!, current).toString();
        continue;
      }
      const ct = r.headers.get('content-type') ?? '';
      let html = '', bytes = 0;
      if (r.body && /html|xml|text/.test(ct || 'text/html')) {
        const reader = r.body.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length; chunks.push(value);
          if (bytes > maxBytes) { await reader.cancel(); break; }
        }
        html = Buffer.concat(chunks).toString('utf8');
      }
      return { ...base, ok: r.status < 400, status: r.status, finalUrl: current, https: current.startsWith('https:'), ms: Date.now() - started, html, bytes, redirects, contentType: ct };
    }
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    const code = err.cause?.code;
    const msg = err.name === 'TimeoutError' ? 'délai dépassé' : code === 'ENOTFOUND' ? 'domaine introuvable (DNS)' : /certificate|SSL|TLS/i.test(err.message + (code ?? '')) ? 'certificat TLS invalide' : err.message;
    return { ...base, ms: Date.now() - started, finalUrl: current, redirects, error: msg };
  }
}

// ---------- robots.txt ----------
const robotsCache = new Map<string, { rules: string[]; at: number }>();
export function parseRobots(txt: string, agentToken = 'digilagoleadfinder'): string[] {
  const groups: { agents: string[]; dis: string[] }[] = [];
  let cur: { agents: string[]; dis: string[] } | null = null, lastWasAgent = false;
  for (const line of txt.split(/\r?\n/)) {
    const m = line.replace(/#.*/, '').trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, k, v] = m; const key = k.toLowerCase();
    if (key === 'user-agent') { if (!cur || !lastWasAgent) { cur = { agents: [], dis: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; }
    else { lastWasAgent = false; if (cur && key === 'disallow' && v) cur.dis.push(v); }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && agentToken.includes(a)));
  return (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.dis);
}
export async function robotsAllows(url: string): Promise<boolean> {
  const u = new URL(url);
  const key = u.origin;
  let entry = robotsCache.get(key);
  if (!entry || Date.now() - entry.at > 6 * 3600_000) {
    const r = await safeFetch(`${u.origin}/robots.txt`, { maxBytes: 200_000, timeoutMs: 8000 });
    entry = { rules: r.ok && r.status === 200 ? parseRobots(r.html) : [], at: Date.now() };
    robotsCache.set(key, entry);
  }
  return !entry.rules.some((p) => u.pathname.startsWith(p));
}

// ---------- politesse : un domaine n'est jamais sollicité trop vite ----------
const lastHit = new Map<string, number>();
export async function politeWait(host: string) {
  const wait = config.crawlDelayMs - (Date.now() - (lastHit.get(host) ?? 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}
