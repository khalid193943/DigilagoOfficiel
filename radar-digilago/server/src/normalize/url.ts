/** Classement d'une URL : un lien Facebook n'est pas un « site web ». */
export type UrlKind = 'website' | 'social' | 'google_generated' | 'whatsapp' | 'link_page' | 'maps' | 'invalid';

const SOCIAL: Record<string, string> = {
  'facebook.com': 'facebook', 'fb.com': 'facebook', 'm.facebook.com': 'facebook', 'fb.me': 'facebook',
  'instagram.com': 'instagram', 'linkedin.com': 'linkedin', 'tiktok.com': 'tiktok', 'youtube.com': 'youtube', 'youtu.be': 'youtube',
  'twitter.com': 'x', 'x.com': 'x', 'pinterest.com': 'pinterest', 'snapchat.com': 'snapchat',
};
const LINK_PAGES = ['linktr.ee', 'linkin.bio', 'beacons.ai', 'bio.link'];
const GOOGLE_GEN = ['business.site', 'g.page', 'sites.google.com'];
const MAPS = ['maps.google.com', 'goo.gl', 'maps.app.goo.gl', 'google.com'];

export function toUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.')) return null;
    return u;
  } catch { return null; }
}

export const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, '');

/** Domaine « canonique » : sans www, en minuscules. */
export function canonicalDomain(raw: string): string | null {
  const u = toUrl(raw); return u ? hostOf(u) : null;
}

const endsWithAny = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith('.' + d));

export function classifyUrl(raw: string | null | undefined): { kind: UrlKind; platform?: string; url?: string; domain?: string } {
  const u = toUrl(raw);
  if (!u) return { kind: 'invalid' };
  const host = hostOf(u);
  const url = u.toString();
  if (host === 'wa.me' || host.endsWith('whatsapp.com')) return { kind: 'whatsapp', url, domain: host };
  for (const [d, platform] of Object.entries(SOCIAL)) if (host === d || host.endsWith('.' + d)) return { kind: 'social', platform, url, domain: host };
  if (endsWithAny(host, LINK_PAGES)) return { kind: 'link_page', url, domain: host };
  if (endsWithAny(host, GOOGLE_GEN)) return { kind: 'google_generated', url, domain: host };
  if (endsWithAny(host, MAPS) && (host !== 'google.com' || u.pathname.startsWith('/maps'))) return { kind: 'maps', url, domain: host };
  return { kind: 'website', url, domain: host };
}
