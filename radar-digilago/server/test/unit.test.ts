import { describe, expect, it } from 'vitest';
import { auditSite, segmentOf } from '../src/audit/diagnostic.js';
import { decideMatch } from '../src/dedup/matcher.js';
import { extractPage } from '../src/enrich/extract.js';
import { parseRobots } from '../src/enrich/fetcher.js';
import { normalizePhone, phoneFromWhatsappUrl } from '../src/normalize/phone.js';
import { nameSimilarity, normalizeName } from '../src/normalize/text.js';
import { classifyUrl } from '../src/normalize/url.js';
import { scoreLead } from '../src/scoring/score.js';
import { osmFilterToQl, OsmOverpassAdapter } from '../src/sources/osm-overpass.js';
import { GooglePlacesAdapter } from '../src/sources/google-places.js';
import { sectorById } from '../src/domain/sectors.js';

describe('téléphones', () => {
  it('normalise et distingue fixe / mobile sans jamais conclure à WhatsApp', () => {
    expect(normalizePhone('0661-23 45 67')).toMatchObject({ e164: '+212661234567', type: 'mobile' });
    expect(normalizePhone('05 23 34 12 00')).toMatchObject({ e164: '+212523341200', type: 'fixed' });
    expect(normalizePhone('00212 6 61 23 45 67')?.e164).toBe('+212661234567');
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('pas un numéro')).toBeNull();
  });
  it('lit un numéro dans un lien WhatsApp publié', () => {
    expect(phoneFromWhatsappUrl('https://wa.me/212661234567?text=Bonjour')).toBe('+212661234567');
    expect(phoneFromWhatsappUrl('https://api.whatsapp.com/send?phone=212661234567')).toBe('+212661234567');
    expect(phoneFromWhatsappUrl('https://example.com/wa')).toBeNull();
  });
});

describe('noms et liens', () => {
  it('retire les formes juridiques et les accents', () => {
    expect(normalizeName('Société Atlas Ingénierie S.A.R.L AU')).toBe('atlas ingenierie');
    expect(normalizeName('Clinique Al Waha')).toBe('clinique waha');
  });
  it('mesure la proximité des noms', () => {
    expect(nameSimilarity(normalizeName('Clinique Al Waha Santé'), normalizeName('Clinique Al-Waha Sante'))).toBeGreaterThan(0.95);
    expect(nameSimilarity(normalizeName('Café Atlas'), normalizeName('Pharmacie Océan'))).toBeLessThan(0.6);
  });
  it('ne prend pas une page Facebook pour un site web', () => {
    expect(classifyUrl('https://www.facebook.com/monresto')).toMatchObject({ kind: 'social', platform: 'facebook' });
    expect(classifyUrl('instagram.com/x')).toMatchObject({ kind: 'social', platform: 'instagram' });
    expect(classifyUrl('https://monresto.business.site')).toMatchObject({ kind: 'google_generated' });
    expect(classifyUrl('https://wa.me/212600000000')).toMatchObject({ kind: 'whatsapp' });
    expect(classifyUrl('www.clinique-atlas.ma')).toMatchObject({ kind: 'website', domain: 'clinique-atlas.ma' });
    expect(classifyUrl('pas une url')).toMatchObject({ kind: 'invalid' });
  });
});

describe('dédoublonnage prudent', () => {
  it('fusionne seulement sur une règle robuste', () => {
    expect(decideMatch({ nameSim: 0.8, distM: 2000, samePhone: true, sameDomain: false }).level).toBe('certain');
    expect(decideMatch({ nameSim: 0.95, distM: 40, samePhone: false, sameDomain: false }).level).toBe('certain');
  });
  it('soumet les cas ambigus à un humain', () => {
    expect(decideMatch({ nameSim: 0.2, distM: 10, samePhone: true, sameDomain: false }).level).toBe('probable');
    expect(decideMatch({ nameSim: 0.85, distM: 200, samePhone: false, sameDomain: false }).level).toBe('probable');
  });
  it('un même numéro avec des noms qui ne partagent qu’un mot générique reste à valider', () => {
    expect(decideMatch({ nameSim: nameSimilarity(normalizeName('Dentiste Atlas'), normalizeName('Dentiste Océan')), distM: 50, samePhone: true, sameDomain: false }).level).toBe('probable');
  });
  it('ignore les ressemblances faibles', () => {
    expect(decideMatch({ nameSim: 0.95, distM: 5000, samePhone: false, sameDomain: false }).level).toBe('weak');
    expect(decideMatch({ nameSim: 0.5, distM: 20, samePhone: false, sameDomain: false }).level).toBe('weak');
  });
});

describe('lecture de site', () => {
  const html = `<html lang="fr"><head><title>Clinique Test</title><meta name="viewport" content="width=device-width"><meta name="description" content="x">
    <meta name="generator" content="WordPress 6.4"></head><body><h1>Bienvenue</h1>
    <a href="mailto:contact@clinique-test.ma">mail</a> <a href="tel:+212523000000">tel</a>
    <a href="https://wa.me/212661234567">WhatsApp</a> <a href="https://www.facebook.com/cliniquetest/">FB</a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">partager</a> <a href="/contact">Contactez-nous</a>
    <img src="logo@2x.png"> info@clinique-test.ma © 2019 Clinique</body></html>`;
  it('extrait les coordonnées publiées et les liens officiels', () => {
    const f = extractPage(html, 'https://clinique-test.ma/');
    expect(f.emails.sort()).toEqual(['contact@clinique-test.ma', 'info@clinique-test.ma']);
    expect(f.phones).toEqual(['+212523000000']);
    expect(f.whatsapp).toHaveLength(1);
    expect(f.socials).toEqual([{ platform: 'facebook', url: 'https://www.facebook.com/cliniquetest' }]);
    expect(f.contactLinks).toEqual(['https://clinique-test.ma/contact']);
    expect(f.cms).toBe('wordpress');
    expect(f.copyrightYear).toBe(2019);
  });
  it('classe un site daté comme « basique » avec des contrôles explicites', () => {
    const f = extractPage(html, 'https://clinique-test.ma/');
    const a = auditSite({ ok: true, status: 200, url: '', finalUrl: 'https://clinique-test.ma/', https: true, ms: 400, html, bytes: 1000, redirects: 0, contentType: 'text/html' }, f, new Date('2026-10-31'));
    expect(a.siteClass).toBe('basic_template');
    expect(a.checks.find((c) => c.id === 'fresh')).toMatchObject({ ok: false, detail: '© 2019' });
    expect(segmentOf(a.siteClass, a.score)).toBe('weak_site');
  });
  it('respecte robots.txt', () => {
    expect(parseRobots('User-agent: *\nDisallow: /prive\n')).toEqual(['/prive']);
    expect(parseRobots('User-agent: DigilagoLeadFinder\nDisallow: /\n\nUser-agent: *\nDisallow: /x')).toEqual(['/']);
  });
});

describe('score explicable', () => {
  const base = { siteScore: null, consecutiveFailures: 0, sourcesCount: 2, prioritySector: true, hasPhone: true, hasEmail: false, hasWhatsapp: true, hasSocial: true, hasAddress: true, google: { rating: 4.6, reviews: 23 }, activity: 'active', doNotContact: false, crmStatus: 'new' };
  it('priorise une entreprise sans site, avec des raisons lisibles', () => {
    const s = scoreLead({ ...base, siteClass: 'not_found', segment: 'no_site' });
    expect(s.score).toBe(93);
    expect(s.band).toBe('high');
    expect(s.confidence).toBe('high');
    expect(s.signals.map((x) => x.id)).toEqual(['base', 'no_site', 'sector', 'contact', 'whatsapp', 'active']);
  });
  it('baisse la priorité d’un bon site et exclut un « ne pas contacter »', () => {
    expect(scoreLead({ ...base, siteClass: 'good', segment: 'good_site' }).score).toBeLessThan(60);
    expect(scoreLead({ ...base, siteClass: 'not_found', segment: 'no_site', doNotContact: true }).band).toBe('excluded');
  });
  it('reste prudent avec une seule source', () => {
    const s = scoreLead({ ...base, sourcesCount: 1, siteClass: 'not_found', segment: 'no_site' });
    expect(s.signals.find((x) => x.id === 'no_site_1src')?.points).toBe(15);
  });
});

describe('sources (réponses enregistrées, aucun appel réseau)', () => {
  it('traduit les secteurs en requête Overpass', () => {
    expect(osmFilterToQl('amenity~^(clinic|dentist)$')).toBe('["amenity"~"^(clinic|dentist)$"]');
    expect(osmFilterToQl('tourism=information][information=office')).toBe('["tourism"="information"]["information"="office"]');
  });
  it('normalise un élément OpenStreetMap', () => {
    const p = new OsmOverpassAdapter().normalize({ type: 'node', id: 42, lat: 33.23, lon: -8.5, tags: { name: 'Exemple OSM', amenity: 'dentist', phone: '+212 523 00 00 00', 'contact:facebook': 'https://facebook.com/exemple' } }, 'El Jadida');
    expect(p).toMatchObject({ externalId: 'node/42', sector: 'sante', city: 'El Jadida', phones: ['+212 523 00 00 00'], links: ['https://facebook.com/exemple'] });
  });
  it('interroge Google par tuile, signale la saturation et ne divulgue jamais la clé ailleurs', async () => {
    const calls: any[] = [];
    const page = (n: number, token?: string) => ({ places: Array.from({ length: 20 }, (_, i) => ({ id: `p${n}-${i}`, displayName: { text: `Lieu ${n}-${i}` }, location: { latitude: 33.2, longitude: -8.5 } })), nextPageToken: token });
    const fake: any = async (url: string, init: any) => { calls.push({ url, init }); const body = JSON.parse(init.body); const n = body.pageToken ? Number(body.pageToken) : 1; return new Response(JSON.stringify(page(n, n < 3 ? String(n + 1) : undefined)), { status: 200 }); };
    const g = new GooglePlacesAdapter(fake, { enabled: true, apiKey: 'k', dailyLimit: 100, costPerRequest: 0.035, retentionDays: 30 });
    const res = await g.searchTile({ rect: { south: 33, west: -9, north: 33.1, east: -8.9 }, sectors: [], keywords: ['dentiste'], maxRequests: 10, cityName: 'X' }, { useQuota: async () => {}, isCancelled: async () => false });
    expect(res.requests).toBe(3);
    expect(res.places).toHaveLength(60);
    expect(res.saturated).toBe(true);
    expect(calls[0].init.headers['X-Goog-Api-Key']).toBe('k');
    expect(JSON.parse(calls[0].init.body).locationRestriction.rectangle.low).toEqual({ latitude: 33, longitude: -9 });
    expect(res.estCost).toBeCloseTo(0.105);
  });
  it('les secteurs prioritaires sont définis', () => { expect(sectorById('sante')?.priority).toBe(true); });
});
