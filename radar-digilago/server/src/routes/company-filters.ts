import { z } from 'zod';

export const ListQuery = z.object({
  q: z.string().max(120).optional(),
  city: z.string().optional(),
  sector: z.string().optional(),
  segment: z.enum(['unknown', 'no_site', 'social_or_generated', 'weak_site', 'good_site']).optional(),
  channel: z.enum(['any', 'email', 'whatsapp', 'facebook', 'instagram', 'mobile', 'fixed_only', 'none']).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  status: z.string().optional(),
  view: z.enum(['today', 'all', 'new', 'nosite', 'wa', 'follow', 'review', 'demo']).optional(),
  owner: z.string().optional(),
  sort: z.enum(['score', 'recent', 'name', 'verified']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type ListQueryT = z.infer<typeof ListQuery>;

/** Construit la clause WHERE commune à la liste et à l'export (l'export reflète toujours les filtres actifs). */
export function buildWhere(f: Partial<ListQueryT>, opts: { skipView?: boolean; skipSegment?: boolean } = {}) {
  const w: string[] = ['c.merged_into IS NULL'];
  const p: unknown[] = [];
  const add = (sql: string, ...vals: unknown[]) => { let s = sql; for (const v of vals) { p.push(v); s = s.replace('?', `$${p.length}`); } w.push(s); };
  if (f.q) {
    const term = f.q.trim();
    add(`(c.name ILIKE ? OR c.ref ILIKE ? OR EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id AND k.value_normalized LIKE ?) OR EXISTS (SELECT 1 FROM websites x WHERE x.company_id=c.id AND x.domain ILIKE ?) OR c.city ILIKE ?)`,
      `%${term}%`, `%${term}%`, `%${term.replace(/[^\d+]/g, '') || '§'}%`, `%${term}%`, `%${term}%`);
  }
  if (f.city) add('c.city_id = ?', f.city);
  if (f.sector) add('c.sector = ?', f.sector);
  if (f.segment && !opts.skipSegment) add('c.segment = ?', f.segment);
  if (f.minScore != null) add('coalesce(c.score,0) >= ?', f.minScore);
  if (f.status) add('c.crm_status = ?', f.status);
  if (f.owner) add('c.owner_id = ?', f.owner);
  switch (f.channel) {
    case 'any': w.push(`(EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id AND k.verification<>'invalid') OR EXISTS (SELECT 1 FROM social_profiles s WHERE s.company_id=c.id AND s.official_status<>'rejected'))`); break;
    case 'email': w.push(`EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id AND k.kind='email' AND k.verification<>'invalid')`); break;
    case 'whatsapp': w.push(`c.whatsapp_status IN ('official_link_found','confirmed')`); break;
    case 'facebook': w.push(`EXISTS (SELECT 1 FROM social_profiles s WHERE s.company_id=c.id AND s.platform='facebook' AND s.official_status<>'rejected')`); break;
    case 'instagram': w.push(`EXISTS (SELECT 1 FROM social_profiles s WHERE s.company_id=c.id AND s.platform='instagram' AND s.official_status<>'rejected')`); break;
    case 'mobile': w.push(`EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id AND k.kind='phone' AND k.phone_type='mobile')`); break;
    case 'fixed_only': w.push(`EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id AND k.kind='phone' AND k.phone_type='fixed') AND NOT EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id AND k.kind IN ('whatsapp','email') OR (k.company_id=c.id AND k.kind='phone' AND k.phone_type='mobile'))`); break;
    case 'none': w.push(`NOT EXISTS (SELECT 1 FROM contacts k WHERE k.company_id=c.id) AND NOT EXISTS (SELECT 1 FROM social_profiles s WHERE s.company_id=c.id)`); break;
  }
  if (!opts.skipView) applyView(f.view, w);
  return { where: w.join(' AND '), params: p };
}

export function applyView(view: string | undefined, w: string[]) {
  switch (view) {
    case 'today': w.push(`c.score >= 60 AND c.crm_status IN ('new','qualified','to_contact') AND NOT c.do_not_contact`); break;
    case 'new': w.push(`c.created_at > now() - interval '7 days'`); break;
    case 'nosite': w.push(`c.segment = 'no_site'`); break;
    case 'wa': w.push(`c.whatsapp_status IN ('official_link_found','confirmed')`); break;
    case 'follow': w.push(`(c.crm_status IN ('contacted','later','replied') OR (c.next_action_at IS NOT NULL AND c.next_action_at <= now() + interval '2 days'))`); break;
    case 'review': w.push(`c.needs_review`); break;
    case 'demo': w.push(`c.is_demo`); break;
  }
}

export const ORDER: Record<string, string> = {
  score: 'c.score DESC NULLS LAST, c.created_at DESC',
  recent: 'c.created_at DESC',
  name: 'c.name ASC',
  verified: 'c.last_verified_at DESC NULLS LAST',
};

/** Colonnes de la liste : canaux disponibles, sources, sans charger toute la fiche. */
export const LIST_SELECT = `
  c.id, c.ref, c.name, c.sector, c.subsector, c.city, c.city_id, c.segment, c.site_class, c.score, c.score_band, c.confidence, c.crm_status,
  c.is_demo, c.needs_review, c.lat, c.lon, c.created_at, c.last_verified_at, c.whatsapp_status, c.owner_id, c.next_action_at,
  coalesce(k.email,false) has_email, coalesce(k.mobile,false) has_mobile, coalesce(k.fixed,false) has_fixed,
  c.whatsapp_status IN ('official_link_found','confirmed') has_whatsapp, coalesce(sp.fb,false) has_facebook, coalesce(sp.ig,false) has_instagram,
  coalesce(sr.srcs, '{}') sources`;
export const LIST_JOINS = `
  LEFT JOIN LATERAL (SELECT bool_or(kind='email') email, bool_or(kind='phone' AND phone_type='mobile') mobile, bool_or(kind='phone' AND phone_type='fixed') fixed
    FROM contacts WHERE company_id=c.id AND verification<>'invalid') k ON true
  LEFT JOIN LATERAL (SELECT bool_or(platform='facebook') fb, bool_or(platform='instagram') ig FROM social_profiles WHERE company_id=c.id AND official_status<>'rejected') sp ON true
  LEFT JOIN LATERAL (SELECT array_agg(DISTINCT source) srcs FROM source_records WHERE company_id=c.id) sr ON true`;
