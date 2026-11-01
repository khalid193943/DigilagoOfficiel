import type { PageFacts } from '../enrich/extract.js';
import type { FetchResult } from '../enrich/fetcher.js';

/** Version des règles : stockée avec chaque audit et chaque score, pour pouvoir recalibrer. */
export const DIAG_VERSION = 'diag-v1';

export type Check = { id: string; label: string; ok: boolean | null; detail?: string };
export type SiteClass = 'unknown' | 'not_found' | 'social_only' | 'google_generated' | 'unreachable' | 'basic_template' | 'correct' | 'good';
export type Segment = 'unknown' | 'no_site' | 'social_or_generated' | 'weak_site' | 'good_site';

const FREE_BUILDERS = /(wixsite\.com|wordpress\.com|blogspot\.com|jimdosite\.com|weebly\.com|webnode\.|site123\.me|business\.site|sites\.google\.com)$/;

/** Pilier 1 — le site web. Mesures observables uniquement, datées, avec leurs limites. */
export function auditSite(fetchRes: FetchResult, facts: PageFacts | null, now = new Date()): { siteClass: SiteClass; score: number; checks: Check[]; metrics: Record<string, unknown> } {
  const host = (() => { try { return new URL(fetchRes.finalUrl).hostname; } catch { return ''; } })();
  if (!fetchRes.ok || !facts) {
    return { siteClass: 'unreachable', score: 10, checks: [{ id: 'reachable', label: 'Site accessible', ok: false, detail: fetchRes.error ?? `HTTP ${fetchRes.status}` }], metrics: { status: fetchRes.status, ms: fetchRes.ms, error: fetchRes.error } };
  }
  const year = now.getFullYear();
  const checks: Check[] = [
    { id: 'reachable', label: 'Site accessible', ok: true, detail: `HTTP ${fetchRes.status}` },
    { id: 'https', label: 'Connexion sécurisée (HTTPS)', ok: fetchRes.https },
    { id: 'mobile', label: 'Adapté au mobile (viewport)', ok: facts.viewport },
    { id: 'speed', label: 'Réponse rapide', ok: fetchRes.ms < 2500, detail: `${fetchRes.ms} ms depuis le serveur Radar` },
    { id: 'title', label: 'Titre de page', ok: !!facts.title },
    { id: 'description', label: 'Description pour Google', ok: !!facts.description },
    { id: 'h1', label: 'Titre principal (H1)', ok: !!facts.h1 },
    { id: 'contact', label: 'Moyen de contact visible', ok: facts.contactLinks.length > 0 || facts.phones.length > 0 || facts.emails.length > 0 || facts.whatsapp.length > 0 || facts.hasForm },
    { id: 'fresh', label: 'Site entretenu', ok: facts.copyrightYear == null ? null : facts.copyrightYear >= year - 2, detail: facts.copyrightYear ? `© ${facts.copyrightYear}` : 'aucune date visible' },
    { id: 'structured', label: 'Données structurées', ok: facts.jsonLd },
    { id: 'favicon', label: 'Icône du site', ok: facts.favicon },
  ];
  const graded = checks.filter((c) => c.ok !== null);
  const score = Math.round((graded.filter((c) => c.ok).length / graded.length) * 100);
  const old = facts.copyrightYear != null && facts.copyrightYear <= year - 3;
  const core = ['https', 'mobile', 'speed', 'title', 'description', 'h1', 'contact'].every((id) => checks.find((c) => c.id === id)?.ok);
  let siteClass: SiteClass;
  if (!facts.viewport || old || !fetchRes.https || FREE_BUILDERS.test(host) || score < 55) siteClass = 'basic_template';
  else if (core && score >= 80) siteClass = 'good';
  else siteClass = 'correct';
  return { siteClass, score, checks, metrics: { status: fetchRes.status, ms: fetchRes.ms, bytes: fetchRes.bytes, redirects: fetchRes.redirects, https: fetchRes.https, cms: facts.cms, copyrightYear: facts.copyrightYear, lang: facts.lang } };
}

/** Pilier 2 — la fiche Google (seulement si la source Google a été utilisée). */
export function auditGoogle(g: any): { score: number | null; checks: Check[] } {
  if (!g || !g.exists) return { score: null, checks: [] };
  const checks: Check[] = [
    { id: 'reviews', label: 'Avis clients', ok: (g.reviews ?? 0) >= 10, detail: g.rating ? `${String(g.rating).replace('.', ',')} ★ · ${g.reviews ?? 0} avis` : 'aucune note' },
    { id: 'hours', label: 'Horaires renseignés', ok: !!g.hasHours },
    { id: 'photos', label: 'Photos (5 ou plus)', ok: (g.photos ?? 0) >= 5, detail: `${g.photos ?? 0} photo(s)` },
    { id: 'website', label: 'Site lié à la fiche', ok: !!g.hasWebsite },
  ];
  return { score: 20 + checks.filter((c) => c.ok).length * 20, checks };
}

export function segmentOf(siteClass: SiteClass, siteScore: number | null): Segment {
  switch (siteClass) {
    case 'not_found': return 'no_site';
    case 'social_only': case 'google_generated': return 'social_or_generated';
    case 'unreachable': case 'basic_template': return 'weak_site';
    case 'correct': return (siteScore ?? 0) >= 75 ? 'good_site' : 'weak_site';
    case 'good': return 'good_site';
    default: return 'unknown';
  }
}

export const SEGMENT_LABEL: Record<Segment, string> = {
  unknown: 'À analyser', no_site: 'Aucun site trouvé', social_or_generated: 'Facebook / site Google', weak_site: 'Site basique', good_site: 'Bon site',
};

/** L'argument d'approche, adapté à la case et au secteur. */
export function pitchFor(segment: Segment, sectorLabel: string | null, city: string | null): string {
  const where = city ? ` à ${city}` : '';
  const who = sectorLabel ? sectorLabel.toLowerCase() : 'votre activité';
  switch (segment) {
    case 'no_site': return `Les clients qui cherchent « ${who}${where} » en ligne ne vous trouvent pas : aucun site n’a été trouvé pour votre entreprise.`;
    case 'social_or_generated': return `Vous existez en ligne (page sociale ou page Google), mais vous ne contrôlez ni votre image ni vos demandes de contact.`;
    case 'weak_site': return `Votre site existe, mais il présente des faiblesses observables (mobile, sécurité, contenu) qui freinent les demandes.`;
    case 'good_site': return `Votre site est solide : la prochaine étape est d’être trouvé, sur Google et dans les réponses des assistants IA.`;
    default: return `Analyse en cours.`;
  }
}
