/** Normalisation des noms d'entreprise pour la comparaison (jamais pour l'affichage). */
const LEGAL = /\b(s\.?\s?a\.?\s?r\.?\s?l\.?(\s?a\.?\s?u\.?)?|sarlau|s\.?\s?a\.?|snc|sas|ste|societe|société|ets|etablissements?|établissements?|cie|compagnie|ltd|llc|inc)\b/giu;
const STOP = new Set(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd', 'et', 'the', 'and', 'el', 'al']);

export function stripAccents(s: string) { return s.normalize('NFD').replace(/\p{M}/gu, ''); }

export function normalizeName(name: string): string {
  const s = stripAccents(name.toLowerCase()).replace(LEGAL, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ');
  return s.split(' ').filter((w) => w && !STOP.has(w)).join(' ').trim();
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false), bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (!bm[j] && a[i] === b[j]) { am[i] = bm[j] = true; m++; break; }
    }
  }
  if (!m) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) if (am[i]) { while (!bm[k]) k++; if (a[i] !== b[k]) t++; k++; }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let p = 0; while (p < 4 && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

export function tokenDice(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean)), B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** Trigrammes à la manière de pg_trgm (chaque mot entouré d'espaces). */
export function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.split(' ').filter(Boolean)) {
    const p = `  ${w} `;
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  }
  return out;
}
export function trigramSimilarity(a: string, b: string): number {
  const A = trigrams(a), B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Similarité 0..1 entre deux noms déjà normalisés.
 * Volontairement stricte : deux noms sans mot commun restent loin l'un de l'autre.
 * (Jaro-Winkler n'est utilisé que pour les fautes de frappe sur des noms courts et quasi identiques.)
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const tri = trigramSimilarity(a, b), dice = tokenDice(a, b);
  const jw = Math.abs(a.length - b.length) <= 2 && Math.min(a.length, b.length) >= 6 ? jaroWinkler(a, b) : 0;
  return Math.max(tri, dice, jw >= 0.95 ? jw : 0);
}
