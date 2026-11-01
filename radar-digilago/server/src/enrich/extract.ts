import * as cheerio from 'cheerio';
import { classifyUrl } from '../normalize/url.js';

export type PageFacts = {
  title?: string; description?: string; h1?: string; lang?: string; viewport: boolean; favicon: boolean; jsonLd: boolean;
  generator?: string; cms?: string; copyrightYear?: number; emails: string[]; phones: string[]; whatsapp: string[];
  socials: { platform: string; url: string }[]; contactLinks: string[]; hasForm: boolean; bookingLink: boolean; links: number;
};

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|@(2x|3x)|example\.(com|org)|sentry|wixpress|domain\.com/i;

export function detectCms(html: string, generator?: string): string | undefined {
  const g = (generator ?? '').toLowerCase();
  if (g.includes('wordpress') || /wp-content|wp-includes/.test(html)) return 'wordpress';
  if (g.includes('wix') || /static\.wixstatic\.com|wix-bolt|_wixCssImports/.test(html)) return 'wix';
  if (/squarespace/.test(g + html.slice(0, 20000))) return 'squarespace';
  if (/cdn\.shopify\.com/.test(html)) return 'shopify';
  if (/webflow/.test(g) || /data-wf-page/.test(html)) return 'webflow';
  if (g.includes('joomla')) return 'joomla';
  if (/jimdo/.test(g + html.slice(0, 20000))) return 'jimdo';
  if (/sites\.google\.com|gstatic\.com\/atari/.test(html)) return 'google_sites';
  return g ? g.split(' ')[0] : undefined;
}

export function extractPage(html: string, pageUrl: string): PageFacts {
  const $ = cheerio.load(html);
  const abs = (h: string) => { try { return new URL(h, pageUrl).toString(); } catch { return null; } };
  const emails = new Set<string>(), phones = new Set<string>(), whatsapp = new Set<string>(), contactLinks = new Set<string>();
  const socials = new Map<string, { platform: string; url: string }>();
  let bookingLink = false;
  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').trim();
    const text = $(a).text().trim().toLowerCase();
    if (/^mailto:/i.test(href)) { const e = decodeURIComponent(href.slice(7).split('?')[0]).trim().toLowerCase(); if (e) emails.add(e); return; }
    if (/^tel:/i.test(href)) { phones.add(decodeURIComponent(href.slice(4)).trim()); return; }
    const u = abs(href); if (!u) return;
    const c = classifyUrl(u);
    if (c.kind === 'whatsapp') whatsapp.add(u);
    else if (c.kind === 'social' || c.kind === 'link_page') {
      const clean = u.split('?')[0].replace(/\/$/, '');
      if (!/\/(sharer|share|intent|plugins|dialog)\b/.test(clean)) socials.set(clean, { platform: c.platform ?? 'link_page', url: clean });
    }
    if (/contact|nous-contacter|contactez|joindre|اتصل/.test(href.toLowerCase() + ' ' + text) && new URL(u).origin === new URL(pageUrl).origin) contactLinks.add(u.split('#')[0]);
    if (/rendez-vous|rdv|book|réserv|reserv/.test(href.toLowerCase() + ' ' + text)) bookingLink = true;
  });
  const bodyText = $('body').text();
  for (const m of bodyText.match(EMAIL) ?? []) if (!BAD_EMAIL.test(m)) emails.add(m.toLowerCase());
  const years = [...bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((y) => y > 1995 && y < 2100);
  const generator = $('meta[name="generator"]').attr('content');
  return {
    title: $('title').first().text().trim() || undefined,
    description: $('meta[name="description"]').attr('content')?.trim() || undefined,
    h1: $('h1').first().text().trim() || undefined,
    lang: $('html').attr('lang') || undefined,
    viewport: $('meta[name="viewport"]').length > 0,
    favicon: $('link[rel~="icon"]').length > 0,
    jsonLd: $('script[type="application/ld+json"]').length > 0,
    generator, cms: detectCms(html, generator),
    copyrightYear: years.length ? Math.max(...years) : undefined,
    emails: [...emails].filter((e) => !BAD_EMAIL.test(e)), phones: [...phones], whatsapp: [...whatsapp],
    socials: [...socials.values()], contactLinks: [...contactLinks].slice(0, 3), hasForm: $('form').length > 0, bookingLink, links: $('a[href]').length,
  };
}
