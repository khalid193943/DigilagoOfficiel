import type pg from 'pg';
import { config } from '../config.js';
import { one, q } from '../db/pool.js';
import { decideMatch } from '../dedup/matcher.js';
import { cityById } from '../domain/cities.js';
import { distanceM } from '../normalize/geo.js';
import { normalizePhone, phoneFromWhatsappUrl } from '../normalize/phone.js';
import { nameSimilarity, normalizeName } from '../normalize/text.js';
import { classifyUrl } from '../normalize/url.js';
import type { RawPlace } from '../sources/types.js';

export type IngestResult = { companyId: string; created: boolean; matched: 'external' | 'certain' | null; review: boolean };
type Ctx = { jobId?: string | null; cityId?: string | null; userId?: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** Ajoute ou met à jour une entreprise à partir d'une fiche source. À appeler dans une transaction. */
export async function ingestPlace(raw: RawPlace, ctx: Ctx, db: pg.PoolClient): Promise<IngestResult> {
  const now = new Date().toISOString();
  const nameN = normalizeName(raw.name);
  const phones = (raw.phones ?? []).map((p) => ({ raw: p, info: normalizePhone(p) })).filter((p) => p.info);
  const links = (raw.links ?? []).map((l) => ({ raw: l, c: classifyUrl(l) })).filter((l) => l.c.kind !== 'invalid');
  const domains = links.filter((l) => l.c.kind === 'website').map((l) => l.c.domain!);
  const isDemo = !!raw.isDemo;

  // 1. Même identifiant source → même entreprise
  let companyId: string | undefined = (await one<{ company_id: string }>(
    'SELECT company_id FROM source_records WHERE source=$1 AND external_id=$2', [raw.source, raw.externalId], db))?.company_id;
  let matched: IngestResult['matched'] = companyId ? 'external' : null;
  let created = false, review = false;
  let probable: { id: string; reasons: string[] } | null = null;

  // 2. Recherche de correspondances (téléphone, domaine, nom + distance)
  if (!companyId) {
    const cands = new Map<string, { id: string; name_normalized: string; lat: number | null; lon: number | null; samePhone: boolean; sameDomain: boolean; names?: string[] }>();
    const add = (r: any, k: 'samePhone' | 'sameDomain' | null) => {
      const c = cands.get(r.id) ?? { id: r.id, name_normalized: r.name_normalized, lat: r.lat, lon: r.lon, samePhone: false, sameDomain: false };
      if (k) c[k] = true;
      cands.set(r.id, c);
    };
    if (phones.length) {
      for (const r of await q(`SELECT c.id, c.name_normalized, c.lat, c.lon FROM contacts k JOIN companies c ON c.id=k.company_id
        WHERE k.kind='phone' AND k.value_normalized = ANY($1) AND c.merged_into IS NULL AND c.is_demo=$2`, [phones.map((p) => p.info!.e164), isDemo], db)) add(r, 'samePhone');
    }
    if (domains.length) {
      for (const r of await q(`SELECT c.id, c.name_normalized, c.lat, c.lon FROM websites w JOIN companies c ON c.id=w.company_id
        WHERE w.domain = ANY($1) AND c.merged_into IS NULL AND c.is_demo=$2`, [domains, isDemo], db)) add(r, 'sameDomain');
    }
    if (raw.lat != null && raw.lon != null && nameN) {
      const d = 0.006; // ≈ 600 m
      for (const r of await q(`SELECT c.id, c.name_normalized, c.lat, c.lon FROM companies c
        WHERE c.merged_into IS NULL AND c.is_demo=$5 AND c.lat BETWEEN $1 AND $2 AND c.lon BETWEEN $3 AND $4
          AND (similarity(c.name_normalized, $6) > 0.35 OR EXISTS (SELECT 1 FROM source_records s WHERE s.company_id=c.id AND similarity(s.source_name_normalized, $6) > 0.35))
        LIMIT 12`, [raw.lat - d, raw.lat + d, raw.lon - d, raw.lon + d, isDemo, nameN], db)) add(r, null);
    }
    // tous les noms connus de chaque candidat (nom actuel + noms publiés par les sources)
    if (cands.size) for (const r of await q<{ company_id: string; names: string[] }>(`SELECT company_id, array_agg(DISTINCT source_name_normalized) names FROM source_records
        WHERE company_id = ANY($1) AND source_name_normalized IS NOT NULL GROUP BY 1`, [[...cands.keys()]], db)) cands.get(r.company_id)!.names = r.names;
    let best: { id: string; level: string; reasons: string[]; score: number } | null = null;
    for (const c of cands.values()) {
      const dist = raw.lat != null && raw.lon != null && c.lat != null && c.lon != null ? distanceM({ lat: raw.lat, lon: raw.lon }, { lat: c.lat, lon: c.lon }) : null;
      const sim = Math.max(nameSimilarity(nameN, c.name_normalized), ...(c.names ?? []).map((n) => nameSimilarity(nameN, n)));
      const dec = decideMatch({ nameSim: sim, distM: dist, samePhone: c.samePhone, sameDomain: c.sameDomain });
      const score = (dec.level === 'certain' ? 2 : dec.level === 'probable' ? 1 : 0) + sim;
      if (dec.level !== 'weak' && (!best || score > best.score)) best = { id: c.id, level: dec.level, reasons: dec.reasons, score };
    }
    if (best?.level === 'certain') { companyId = best.id; matched = 'certain'; }
    else if (best?.level === 'probable') probable = { id: best.id, reasons: best.reasons };
  }

  // 3. Création si nécessaire
  const city = ctx.cityId ? cityById(ctx.cityId) : undefined;
  if (!companyId) {
    const prov = { name: { source: raw.source, at: now } };
    const r = await one<{ id: string }>(`INSERT INTO companies (name, name_normalized, sector, subsector, city, city_id, region, lat, lon, activity_status, is_demo, field_provenance, origin)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'existing') RETURNING id`,
      [raw.name, nameN || raw.name.toLowerCase(), raw.sector ?? null, raw.subsector ?? null, raw.city ?? city?.name ?? null, ctx.cityId ?? null,
        raw.region ?? city?.region ?? null, raw.lat ?? null, raw.lon ?? null, raw.activityStatus ?? 'unknown', isDemo, JSON.stringify(prov)], db);
    companyId = r!.id;
    created = true;
    if (probable) {
      review = true;
      await q(`INSERT INTO merge_candidates (company_a, company_b, level, signals) VALUES ($1,$2,'probable',$3) ON CONFLICT DO NOTHING`,
        [probable.id, companyId, JSON.stringify({ reasons: probable.reasons })], db);
      await q(`UPDATE companies SET needs_review=true, review_reasons=array_append(review_reasons, $2) WHERE id=$1`, [companyId, 'doublon possible'], db);
    }
  } else {
    // Mise à jour prudente : on ne remplit que les champs vides et non verrouillés.
    const c = await one<any>('SELECT * FROM companies WHERE id=$1', [companyId], db);
    const locked = new Set<string>(c.locked_fields ?? []);
    const prov = c.field_provenance ?? {};
    const set: Record<string, unknown> = {};
    const fill = (field: string, value: unknown) => {
      if (value == null || value === '' || locked.has(field) || (c[field] != null && c[field] !== '')) return;
      set[field] = value; prov[field] = { source: raw.source, at: now };
    };
    fill('sector', raw.sector); fill('subsector', raw.subsector); fill('city', raw.city ?? city?.name);
    fill('city_id', ctx.cityId); fill('region', raw.region ?? city?.region); fill('lat', raw.lat); fill('lon', raw.lon);
    if (raw.activityStatus && raw.activityStatus !== 'unknown' && !locked.has('activity_status')) set.activity_status = raw.activityStatus;
    if (Object.keys(set).length) {
      const keys = Object.keys(set);
      await q(`UPDATE companies SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(', ')}, field_provenance=$${keys.length + 2}, updated_at=now() WHERE id=$1`,
        [companyId, ...keys.map((k) => set[k]), JSON.stringify(prov)], db);
    }
  }

  // 4. Fiche Google (pilier 2)
  if (raw.google) {
    await q(`UPDATE companies SET google_profile = google_profile || $2::jsonb WHERE id=$1`,
      [companyId, JSON.stringify({ exists: true, ...raw.google, source: raw.source, at: now })], db);
  }

  // 5. Référence source + établissement
  const existingRec = await one<{ id: string; location_id: string | null }>('SELECT id, location_id FROM source_records WHERE source=$1 AND external_id=$2', [raw.source, raw.externalId], db);
  let locationId = existingRec?.location_id ?? null;
  if (!locationId && (raw.address || raw.lat != null)) {
    const hasPrimary = await one('SELECT 1 FROM locations WHERE company_id=$1 AND is_primary', [companyId], db);
    const l = await one<{ id: string }>(`INSERT INTO locations (company_id, address, neighborhood, city, region, postcode, country, lat, lon, is_primary, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [companyId, raw.address ?? null, raw.neighborhood ?? null, raw.city ?? city?.name ?? null, raw.region ?? city?.region ?? null, raw.postcode ?? null,
        raw.country ?? 'MA', raw.lat ?? null, raw.lon ?? null, !hasPrimary, raw.source], db);
    locationId = l!.id;
  }
  await q(`INSERT INTO source_records (company_id, location_id, source, external_id, source_name, source_name_normalized, source_url, payload, attribution, job_id, expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (source, external_id) DO UPDATE SET collected_at=now(), payload=EXCLUDED.payload, job_id=EXCLUDED.job_id, expires_at=EXCLUDED.expires_at,
      source_url=EXCLUDED.source_url, source_name=EXCLUDED.source_name, source_name_normalized=EXCLUDED.source_name_normalized`,
    [companyId, locationId, raw.source, raw.externalId, raw.name, nameN, raw.sourceUrl ?? null, JSON.stringify(raw.payload ?? {}), raw.attribution ?? null, ctx.jobId ?? null, raw.expiresAt ?? null], db);

  // 6. Contacts : téléphone, email, WhatsApp (jamais déduit d'un numéro mobile)
  for (const p of phones) {
    await q(`INSERT INTO contacts (company_id, kind, value_raw, value_normalized, phone_type, source, source_url)
      VALUES ($1,'phone',$2,$3,$4,$5,$6) ON CONFLICT (company_id, kind, value_normalized) DO NOTHING`,
      [companyId, p.raw, p.info!.e164, p.info!.type, raw.source, raw.sourceUrl ?? null], db);
  }
  for (const e of raw.emails ?? []) {
    const v = e.trim().toLowerCase();
    if (!EMAIL_RE.test(v)) continue;
    await q(`INSERT INTO contacts (company_id, kind, value_raw, value_normalized, email_type, source, source_url) VALUES ($1,'email',$2,$3,$4,$5,$6)
      ON CONFLICT (company_id, kind, value_normalized) DO NOTHING`, [companyId, e, v, emailType(v), raw.source, raw.sourceUrl ?? null], db);
  }
  for (const l of links) {
    if (l.c.kind === 'website' || l.c.kind === 'google_generated') {
      await q(`INSERT INTO websites (company_id, url, domain, source, source_url) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (company_id, domain) DO NOTHING`,
        [companyId, l.c.url, l.c.domain, raw.source, raw.sourceUrl ?? null], db);
    } else if (l.c.kind === 'social' || l.c.kind === 'link_page') {
      await q(`INSERT INTO social_profiles (company_id, platform, url, official_status, source, source_url) VALUES ($1,$2,$3,'probable',$4,$5) ON CONFLICT (company_id, url) DO NOTHING`,
        [companyId, l.c.platform ?? 'link_page', l.c.url, raw.source, raw.sourceUrl ?? null], db);
    } else if (l.c.kind === 'whatsapp') {
      const e164 = phoneFromWhatsappUrl(l.raw);
      if (e164) await addWhatsapp(companyId, e164, l.raw, raw.source, raw.sourceUrl, db);
    }
  }
  await applyDoNotContact(companyId, db);
  return { companyId, created, matched, review };
}

/** Une opposition (entreprise, téléphone, email ou domaine) s'applique à toute fiche qui la porte, y compris les nouvelles. */
export async function applyDoNotContact(companyId: string, db: pg.PoolClient | pg.Pool) {
  await q(`UPDATE companies c SET do_not_contact=true, crm_status='do_not_contact', score_band='excluded'
    WHERE c.id=$1 AND NOT c.do_not_contact AND (
      EXISTS (SELECT 1 FROM do_not_contact d WHERE d.scope='company' AND d.value=c.id::text)
      OR EXISTS (SELECT 1 FROM contacts k JOIN do_not_contact d ON d.value=k.value_normalized AND d.scope = CASE WHEN k.kind='email' THEN 'email' ELSE 'phone' END WHERE k.company_id=c.id)
      OR EXISTS (SELECT 1 FROM websites w JOIN do_not_contact d ON d.scope='domain' AND d.value=w.domain WHERE w.company_id=c.id))`, [companyId], db);
}

/** Un numéro WhatsApp n'est enregistré que s'il est PUBLIÉ par l'entreprise (lien wa.me / api.whatsapp.com). */
export async function addWhatsapp(companyId: string, e164: string, raw: string, source: string, sourceUrl: string | null | undefined, db: pg.PoolClient | pg.Pool) {
  await q(`INSERT INTO contacts (company_id, kind, value_raw, value_normalized, verification, source, source_url)
    VALUES ($1,'whatsapp',$2,$3,'published_link',$4,$5) ON CONFLICT (company_id, kind, value_normalized) DO NOTHING`, [companyId, raw, e164, source, sourceUrl ?? null], db);
  await q(`UPDATE companies SET whatsapp_status = CASE WHEN whatsapp_status='confirmed' THEN 'confirmed' ELSE 'official_link_found' END WHERE id=$1`, [companyId], db);
}

export function emailType(v: string) {
  const local = v.split('@')[0];
  if (/^(contact|info|hello|bonjour)$/.test(local)) return 'contact';
  if (/^(commercial|sales|vente|ventes|devis)$/.test(local)) return 'sales';
  if (/^(admin|office|secretariat|direction|accueil)$/.test(local)) return 'general';
  return 'other';
}

void config;
