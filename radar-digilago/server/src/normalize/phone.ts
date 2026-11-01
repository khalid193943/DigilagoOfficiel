import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export type PhoneInfo = { e164: string; type: 'fixed' | 'mobile' | 'unknown'; country?: string; display: string };

/**
 * Normalise un numéro (E.164) et estime son type d'après le plan de numérotation.
 * « mobile » ne veut JAMAIS dire « WhatsApp » : ce statut exige une preuve séparée.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry: string = 'MA'): PhoneInfo | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (cleaned.replace(/\D/g, '').length < 8) return null;
  const p = parsePhoneNumberFromString(cleaned, defaultCountry as any);
  if (!p || !p.isValid()) return null;
  const t = p.getType();
  const type = t === 'MOBILE' ? 'mobile' : t === 'FIXED_LINE' ? 'fixed' : 'unknown';
  return { e164: p.number, type, country: p.country, display: p.formatInternational() };
}

/** Extrait un numéro d'un lien WhatsApp public (wa.me/212..., api.whatsapp.com/send?phone=...). */
export function phoneFromWhatsappUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    let digits = '';
    if (host === 'wa.me') digits = u.pathname.replace(/\D/g, '');
    else if (host.endsWith('whatsapp.com')) digits = (u.searchParams.get('phone') ?? '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    return normalizePhone('+' + digits)?.e164 ?? null;
  } catch { return null; }
}
