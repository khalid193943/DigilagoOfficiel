import type { Segment, SiteClass } from '../audit/diagnostic.js';

/** Version des règles de score (à recalibrer avec les résultats réels). */
export const SCORE_VERSION = 'score-v1';

export type Signal = { id: string; label: string; points: number; evidence?: string };
export type ScoreInput = {
  siteClass: SiteClass; segment: Segment; siteScore: number | null; consecutiveFailures: number;
  sourcesCount: number; prioritySector: boolean; hasPhone: boolean; hasEmail: boolean; hasWhatsapp: boolean; hasSocial: boolean; hasAddress: boolean;
  google: { rating?: number; reviews?: number } | null; activity: string; doNotContact: boolean; crmStatus: string;
};

/**
 * Score d'opportunité explicable : chaque point correspond à un signal observable.
 * Il aide à prioriser ; il ne prétend pas connaître l'intention d'achat.
 */
export function scoreLead(i: ScoreInput): { score: number; band: string; confidence: 'high' | 'medium' | 'low'; signals: Signal[] } {
  const signals: Signal[] = [{ id: 'base', label: 'Base', points: 40 }];
  const add = (id: string, label: string, points: number, evidence?: string) => signals.push({ id, label, points, evidence });
  switch (i.siteClass) {
    case 'not_found':
      if (i.sourcesCount >= 2) add('no_site', 'Aucun site officiel trouvé (plusieurs sources)', 25);
      else add('no_site_1src', 'Aucun site trouvé (une seule source : à confirmer)', 15);
      break;
    case 'social_only': add('social_only', 'Présence sociale uniquement', 20); break;
    case 'google_generated': add('generated', 'Simple page générée (pas un vrai site)', 20); break;
    case 'unreachable': i.consecutiveFailures >= 2 ? add('broken', 'Site inaccessible (constaté plusieurs fois)', 20) : add('broken_once', 'Site inaccessible (une fois : à reconfirmer)', 10); break;
    case 'basic_template': add('basic', 'Site basique ou daté', 15, i.siteScore != null ? `${i.siteScore}/100 aux contrôles` : undefined); break;
    case 'correct': add('correct', 'Site correct mais perfectible', 5); break;
    case 'good': add('good', 'Site moderne et complet', -15); break;
  }
  if (i.prioritySector) add('sector', 'Secteur prioritaire pour Digilago', 10);
  if (i.hasPhone || i.hasEmail) add('contact', 'Coordonnées professionnelles publiques', 8);
  if (i.hasWhatsapp) add('whatsapp', 'WhatsApp publié par l’entreprise', 4);
  if (i.google && (i.google.reviews ?? 0) >= 20 && (i.google.rating ?? 0) >= 4.2) add('active', 'Entreprise active et appréciée sur Google', 6, `${i.google.rating} ★ · ${i.google.reviews} avis`);
  if (!i.hasPhone && !i.hasEmail && !i.hasWhatsapp && !i.hasSocial) add('weak_data', 'Aucun moyen de contact', -15);
  if (!i.hasAddress && i.sourcesCount <= 1) add('thin', 'Données minces (adresse inconnue, source unique)', -5);

  let score = Math.max(0, Math.min(100, signals.reduce((a, s) => a + s.points, 0)));
  let band = score >= 80 ? 'high' : score >= 60 ? 'review' : score >= 40 ? 'medium' : 'low';
  if (i.activity === 'inactive') { score = 0; band = 'excluded'; signals.push({ id: 'inactive', label: 'Établissement signalé fermé', points: -100 }); }
  if (i.doNotContact) { band = 'excluded'; signals.push({ id: 'dnc', label: 'Liste « ne pas contacter »', points: 0 }); }
  if (i.crmStatus === 'won') band = 'client';

  const confidence = i.sourcesCount >= 2 && (i.hasPhone || i.hasEmail) ? 'high' : (i.hasPhone || i.hasAddress) ? 'medium' : 'low';
  return { score, band, confidence, signals };
}
