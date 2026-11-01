import { DIAG_VERSION, auditGoogle, auditSite, pitchFor, segmentOf, type Check, type SiteClass } from '../audit/diagnostic.js';
import { one, q, tx } from '../db/pool.js';
import { sectorById } from '../domain/sectors.js';
import { extractPage, type PageFacts } from '../enrich/extract.js';
import { politeWait, robotsAllows, safeFetch, type FetchResult } from '../enrich/fetcher.js';
import { emit } from '../lib/live.js';
import { normalizePhone, phoneFromWhatsappUrl } from '../normalize/phone.js';
import { addWhatsapp, emailType } from '../pipeline/ingest.js';
import { SCORE_VERSION, scoreLead } from '../scoring/score.js';
import { config } from '../config.js';

const OFFER = 'Pack Présence complète : site, fiche Google, référencement, visibilité IA';

/**
 * Analyse complète d'une entreprise :
 *  1. lecture prudente du site officiel (robots.txt, délai entre requêtes, pages publiques uniquement) ;
 *  2. coordonnées publiées (mailto, tel, wa.me, réseaux) avec la page source ;
 *  3. diagnostic des piliers + case + score explicable.
 */
export async function analyzeCompany(companyId: string) {
  const c = await one<any>('SELECT * FROM companies WHERE id=$1 AND merged_into IS NULL', [companyId]);
  if (!c) return;
  const sites = await q<any>(`SELECT * FROM websites WHERE company_id=$1 AND official_status <> 'rejected' ORDER BY (official_status='confirmed') DESC, detected_at`, [companyId]);
  const real = sites.filter((w) => !/(^|\.)business\.site$|^sites\.google\.com$|^g\.page$/.test(w.domain));
  const generated = sites.length > 0 && real.length === 0;

  let siteClass: SiteClass, siteScore: number | null = null, checks: Check[] = [], cms: string | null = null;
  let fetchRes: FetchResult | null = null, facts: PageFacts | null = null;
  const site = real[0];

  if (site) {
    let allowed = true;
    try { allowed = await robotsAllows(site.url); } catch { allowed = true; }
    if (!allowed) {
      siteClass = 'correct'; checks = [{ id: 'robots', label: 'Lecture autorisée par robots.txt', ok: false, detail: 'le site refuse les robots : non analysé' }];
    } else {
      await politeWait(new URL(site.url).hostname);
      fetchRes = await safeFetch(site.url);
      facts = fetchRes.ok && fetchRes.html ? extractPage(fetchRes.html, fetchRes.finalUrl) : null;
      const audit = auditSite(fetchRes, facts);
      siteClass = audit.siteClass; siteScore = audit.score; checks = audit.checks; cms = facts?.cms ?? null;
      const failures = fetchRes.ok ? 0 : (site.consecutive_failures ?? 0) + 1;
      await q(`UPDATE websites SET http_status=$2, final_url=$3, uses_https=$4, last_checked_at=now(), consecutive_failures=$5, languages=$6 WHERE id=$1`,
        [site.id, fetchRes.status, fetchRes.finalUrl, fetchRes.https, failures, facts?.lang ? [facts.lang] : []]);
      site.consecutive_failures = failures;
      await q(`INSERT INTO website_audits (website_id, company_id, tool, tool_version, classification, metrics, checks, limits, error)
        VALUES ($1,$2,'radar-audit',$3,$4,$5,$6,$7,$8)`,
        [site.id, companyId, DIAG_VERSION, siteClass, JSON.stringify(audit.metrics), JSON.stringify(checks),
          'Audit léger depuis le serveur Radar : page d’accueil + 2 pages de contact maximum. Pas un audit SEO complet.', fetchRes.error ?? null]);

      // Coordonnées publiées sur le site officiel (accueil + pages contact)
      if (facts) {
        const pages: { url: string; facts: PageFacts }[] = [{ url: fetchRes.finalUrl, facts }];
        for (const link of facts.contactLinks.slice(0, Math.max(0, config.crawlMaxPages - 1))) {
          if (!(await robotsAllows(link).catch(() => true))) continue;
          await politeWait(new URL(link).hostname);
          const r = await safeFetch(link);
          if (r.ok && r.html) pages.push({ url: r.finalUrl, facts: extractPage(r.html, r.finalUrl) });
        }
        await tx(async (db) => {
          for (const p of pages) {
            for (const e of p.facts.emails) await q(`INSERT INTO contacts (company_id, kind, value_raw, value_normalized, email_type, verification, source, source_url)
              VALUES ($1,'email',$2,$3,$4,'published_link','site_officiel',$5) ON CONFLICT (company_id, kind, value_normalized) DO NOTHING`, [companyId, e, e, emailType(e), p.url], db);
            for (const t of p.facts.phones) {
              const info = normalizePhone(t); if (!info) continue;
              await q(`INSERT INTO contacts (company_id, kind, value_raw, value_normalized, phone_type, verification, source, source_url)
                VALUES ($1,'phone',$2,$3,$4,'published_link','site_officiel',$5) ON CONFLICT (company_id, kind, value_normalized) DO NOTHING`, [companyId, t, info.e164, info.type, p.url], db);
            }
            for (const w of p.facts.whatsapp) { const e164 = phoneFromWhatsappUrl(w); if (e164) await addWhatsapp(companyId, e164, w, 'site_officiel', p.url, db); }
            for (const s of p.facts.socials) await q(`INSERT INTO social_profiles (company_id, platform, url, official_status, source, source_url)
              VALUES ($1,$2,$3,'linked_from_official_site','site_officiel',$4) ON CONFLICT (company_id, url) DO UPDATE SET official_status='linked_from_official_site'`, [companyId, s.platform, s.url, p.url], db);
          }
        });
      }
    }
  } else {
    const social = await one(`SELECT 1 FROM social_profiles WHERE company_id=$1 AND official_status <> 'rejected'`, [companyId]);
    siteClass = generated ? 'google_generated' : social ? 'social_only' : 'not_found';
  }

  // Piliers + case + score
  const sources = await q<{ source: string }>('SELECT DISTINCT source FROM source_records WHERE company_id=$1', [companyId]);
  const contacts = await q<{ kind: string }>('SELECT kind FROM contacts WHERE company_id=$1', [companyId]);
  const hasSocial = !!(await one(`SELECT 1 FROM social_profiles WHERE company_id=$1 AND official_status <> 'rejected'`, [companyId]));
  const hasAddress = !!(await one(`SELECT 1 FROM locations WHERE company_id=$1 AND address IS NOT NULL`, [companyId]));
  const google = auditGoogle(c.google_profile);
  const segment = segmentOf(siteClass!, siteScore);
  const pillars = {
    site: { score: siteClass! === 'not_found' ? 0 : siteClass! === 'social_only' ? 5 : siteClass! === 'google_generated' ? 15 : siteScore, class: siteClass!, checks, cms, url: site?.url ?? sites[0]?.url ?? null },
    google: { score: google.score, checks: google.checks },
    seo: { score: null, status: 'non_mesure', note: 'Mesure du positionnement Google : prévue en V2 (API de résultats de recherche).' },
    ai: { score: null, status: 'non_mesure', note: 'Visibilité dans les assistants IA : prévue en V2.' },
  };
  const parts = [[pillars.site.score, 0.6], [pillars.google.score, 0.4]].filter(([s]) => s != null) as [number, number][];
  const presence = parts.length ? Math.round(parts.reduce((a, [s, w]) => a + s * w, 0) / parts.reduce((a, [, w]) => a + w, 0)) : null;
  const sector = c.sector ? sectorById(c.sector) : undefined;
  const sc = scoreLead({
    siteClass: siteClass!, segment, siteScore, consecutiveFailures: site?.consecutive_failures ?? 0, sourcesCount: sources.length,
    prioritySector: !!sector?.priority, hasPhone: contacts.some((k) => k.kind === 'phone'), hasEmail: contacts.some((k) => k.kind === 'email'),
    hasWhatsapp: contacts.some((k) => k.kind === 'whatsapp'), hasSocial, hasAddress, google: c.google_profile?.exists ? c.google_profile : null,
    activity: c.activity_status, doNotContact: c.do_not_contact, crmStatus: c.crm_status,
  });
  const webPresence = siteClass! === 'basic_template' ? (facts && !facts.viewport ? 'not_mobile' : 'outdated') : siteClass! === 'good' || siteClass! === 'correct' ? 'ok' : siteClass!;
  const basis = { sources: sources.map((s) => s.source), at: new Date().toISOString(), rules: DIAG_VERSION, note: siteClass! === 'not_found' ? 'Aucun site trouvé dans les sources consultées : cela ne prouve pas que l’entreprise n’en a pas.' : undefined };

  await q(`UPDATE companies SET site_class=$2, site_cms=$3, pillars=$4, presence_score=$5, segment=$6, pitch_angle=$7, score=$8, score_band=$9, confidence=$10,
      suggested_service=$11, web_presence=$12, web_presence_basis=$13, enriched_at=now(), last_verified_at=now(), updated_at=now(),
      whatsapp_status = CASE WHEN whatsapp_status IN ('confirmed','official_link_found') THEN whatsapp_status ELSE 'unconfirmed' END
    WHERE id=$1`,
    [companyId, siteClass!, cms, JSON.stringify(pillars), presence, segment, pitchFor(segment, sector?.label ?? null, c.city), sc.score, sc.band, sc.confidence, OFFER, webPresence, JSON.stringify(basis)]);
  await q(`INSERT INTO lead_scores (company_id, score, band, confidence, rule_version, signals, suggested_service) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [companyId, sc.score, sc.band, sc.confidence, SCORE_VERSION, JSON.stringify(sc.signals), OFFER]);
  await emit({ type: 'analysis', id: companyId, name: c.name, city: c.city, segment, score: sc.score });
  return { siteClass: siteClass!, segment, score: sc.score };
}
