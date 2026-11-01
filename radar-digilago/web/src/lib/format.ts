export const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('fr-FR'));
export const fmtK = (n: number) => (Math.abs(n) >= 10000 ? `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k` : fmt(n));
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export function ago(d: string | Date | null | undefined) {
  if (!d) return 'jamais';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 10) return 'à l’instant';
  if (s < 60) return `il y a ${Math.round(s)} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  if (s < 86400 * 30) return `il y a ${Math.round(s / 86400)} j`;
  return new Date(d).toLocaleDateString('fr-FR');
}
export const dateFr = (d: string | null | undefined, time = false) => (d ? new Date(d).toLocaleString('fr-FR', time ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }) : '—');
export const phoneFr = (e164: string) => {
  const m = e164.match(/^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+212 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
};
export const initials = (name: string) => name.replace(/\(démo\)/, '').split(/\s+/).filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase();

export const SEGMENTS: Record<string, { short: string; label: string; color: string; bg: string; ink: string; pitch: string }> = {
  no_site: { short: 'Aucun site', label: 'Aucun site trouvé', color: '#F07D1A', bg: '#FFF1E4', ink: '#8A3E00', pitch: 'Vos clients vous cherchent en ligne et ne vous trouvent pas.' },
  social_or_generated: { short: 'Facebook / Google', label: 'Facebook / site Google', color: '#2E9BEA', bg: '#E3F1FC', ink: '#084E8A', pitch: 'Vous existez en ligne, mais vous ne contrôlez pas votre image.' },
  weak_site: { short: 'Site basique', label: 'Site basique', color: '#1E3A8A', bg: '#E8ECFA', ink: '#1E3A8A', pitch: 'Votre site existe, mais il ne vous ramène pas de clients.' },
  good_site: { short: 'Bon site', label: 'Bon site', color: '#A7B4C6', bg: '#EEF2F6', ink: '#33445C', pitch: 'Passons au référencement et à la visibilité sur les IA.' },
  unknown: { short: 'À analyser', label: 'À analyser', color: '#C9D6E4', bg: '#F2F5F9', ink: '#4A5A70', pitch: 'Analyse en cours.' },
};
export const SEG_ORDER = ['no_site', 'social_or_generated', 'weak_site', 'good_site'] as const;

export const SOURCE_STYLE: Record<string, { mono: string; label: string; bg: string; fg: string }> = {
  google_places: { mono: 'G', label: 'Google', bg: '#E3F1FC', fg: '#084E8A' },
  osm: { mono: 'O', label: 'OSM', bg: '#E6F6EE', fg: '#0A6B45' },
  demo: { mono: 'D', label: 'Démo', bg: '#FFF1E4', fg: '#8A3E00' },
  manual: { mono: 'M', label: 'Manuel', bg: '#EFEAFB', fg: '#5B2C9C' },
  import: { mono: 'I', label: 'Import', bg: '#EEF2F6', fg: '#33445C' },
  site_officiel: { mono: 'S', label: 'Site officiel', bg: '#E6F6EE', fg: '#0A6B45' },
};
export const srcStyle = (id: string) => SOURCE_STYLE[id] ?? { mono: id.slice(0, 1).toUpperCase(), label: id, bg: '#EEF2F6', fg: '#33445C' };

export const SECTOR_TINT: Record<string, [string, string]> = {
  sante: ['#E6F6EE', '#0A6B45'], education: ['#E3F1FC', '#084E8A'], beaute: ['#FBEAF3', '#8E2463'], construction: ['#FFF1E4', '#8A3E00'],
  services_pro: ['#EFEAFB', '#5B2C9C'], restauration: ['#FFF6E0', '#7A5200'], hotellerie: ['#E6F4F7', '#0B5F70'], immobilier: ['#EEF2F6', '#33445C'],
  tourisme: ['#E6F4F7', '#0B5F70'], transport: ['#EEF2F6', '#33445C'], industrie: ['#EEF2F6', '#33445C'], commerce: ['#FFF6E0', '#7A5200'],
  artisanat: ['#FBEAF3', '#8E2463'], associations: ['#E6F6EE', '#0A6B45'],
};
export const sectorTint = (s?: string | null) => SECTOR_TINT[s ?? ''] ?? ['#EEF2F6', '#33445C'];
