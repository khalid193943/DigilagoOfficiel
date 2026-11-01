/**
 * Décision de rapprochement entre une fiche entrante et une entreprise existante.
 * Prudence : deux établissements peuvent avoir un nom proche ; un groupe peut partager un numéro.
 *  - certain  : fusion automatique (règle robuste)
 *  - probable : nouvelle fiche + proposition de fusion à valider par un humain
 *  - weak     : rien
 */
export type MatchSignals = { nameSim: number; distM: number | null; samePhone: boolean; sameDomain: boolean; sameExternal?: boolean };
export type MatchLevel = 'certain' | 'probable' | 'weak';

export function decideMatch(s: MatchSignals): { level: MatchLevel; reasons: string[] } {
  const reasons: string[] = [];
  if (s.sameExternal) return { level: 'certain', reasons: ['même identifiant source'] };
  const near = (m: number) => s.distM != null && s.distM <= m;
  if (s.sameDomain && s.nameSim >= 0.6) return { level: 'certain', reasons: ['même domaine web', `noms proches (${pct(s.nameSim)})`] };
  if (s.samePhone && s.nameSim >= 0.6) return { level: 'certain', reasons: ['même téléphone', `noms proches (${pct(s.nameSim)})`] };
  if (s.nameSim >= 0.92 && near(80)) return { level: 'certain', reasons: [`même nom (${pct(s.nameSim)})`, `à ${Math.round(s.distM!)} m`] };
  if (s.samePhone) reasons.push('même téléphone, noms différents');
  if (s.sameDomain) reasons.push('même domaine, noms différents');
  if (s.nameSim >= 0.8 && near(300)) reasons.push(`noms proches (${pct(s.nameSim)}) à ${Math.round(s.distM!)} m`);
  return { level: reasons.length ? 'probable' : 'weak', reasons };
}
const pct = (x: number) => `${Math.round(x * 100)} %`;
