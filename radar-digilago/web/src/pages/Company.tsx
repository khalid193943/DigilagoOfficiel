import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { I } from '../components/Icons';
import { Page } from '../components/Shell';
import { DemoBadge, Empty, Modal, Ring, SegPill, Skeleton, SourceBadge, useToast } from '../components/ui';
import { api } from '../lib/api';
import { can, useAuth } from '../lib/auth';
import { ago, dateFr, fmt, initials, phoneFr, SEGMENTS, sectorTint, srcStyle } from '../lib/format';
import { MAP_H, MAP_W, project } from '../lib/geo';
import { useApi, useCountUp } from '../lib/hooks';
import { useLive } from '../lib/live';
import { sectorLabel, statusLabel, useMeta } from '../lib/meta';

const STAGES = ['new', 'qualified', 'to_contact', 'contacted', 'meeting', 'proposal', 'won'];
const OUTCOMES = [['no_answer', 'Pas de réponse'], ['interested', 'Intéressé'], ['callback', 'Rappeler'], ['not_interested', 'Pas intéressé'], ['wrong_contact', 'Mauvais interlocuteur'], ['wrong_number', 'Numéro erroné'], ['other', 'Autre']];
const SITE_CLASS: Record<string, string> = { not_found: 'Aucun site trouvé', social_only: 'Présence sociale uniquement', google_generated: 'Page générée (pas un vrai site)', unreachable: 'Site inaccessible', basic_template: 'Site basique ou daté', correct: 'Site correct', good: 'Bon site', unknown: 'À analyser' };
const VERIF: Record<string, [string, string, string]> = { published_link: ['Publié', '#E6F6EE', '#0A6B45'], confirmed_manual: ['Confirmé', '#E6F6EE', '#0A6B45'], unverified: ['Source', '#EAF4FD', '#084E8A'], invalid: ['Invalide', '#FDECEA', '#B42318'] };

export function Company() {
  const { id } = useParams();
  const { meta } = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const { data, reload, error } = useApi<any>(`/api/companies/${id}`, [id]);
  const users = useApi<{ id: string; name: string }[]>('/api/users/assignable');
  const [modal, setModal] = useState<null | 'edit' | 'contact' | 'dnc'>(null);
  useLive((e) => { if (e.type === 'analysis' && e.id === id) { reload(true); toast('Analyse mise à jour.'); } });

  const c = data?.company;
  const opp = useCountUp(c?.score ?? 0), pres = useCountUp(c?.presence_score ?? 0);
  if (data?.redirect) return <Navigate to={`/entreprises/${data.redirect}`} replace />;
  if (error) return <Page><Empty title="Fiche introuvable">{error}</Empty></Page>;
  if (!c) return <Page><Skeleton h={290} /><Skeleton h={60} /><div className="row" style={{ gap: 16 }}><Skeleton h={420} /><Skeleton h={420} /></div></Page>;

  const patch = async (body: Record<string, unknown>, msg = 'Enregistré.') => {
    try { await api(`/api/companies/${id}`, { method: 'PATCH', body }); toast(msg); reload(true); } catch (e) { toast((e as Error).message, true); }
  };
  const tint = sectorTint(c.sector);
  const seg = SEGMENTS[c.segment] ?? SEGMENTS.unknown;
  const p = c.lat != null ? project(c.lat, c.lon) : project(33.23, -8.5);
  const fx = (p.x / MAP_W) * 100, fy = (p.y / MAP_H) * 100;
  const stageIdx = STAGES.indexOf(c.crm_status);

  return (
    <Page>
      {/* En-tête cinématique */}
      <section style={{ position: 'relative', borderRadius: 26, overflow: 'hidden', minHeight: 290, background: '#E4EFFA', boxShadow: 'var(--shadow)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, perspective: 900, perspectiveOrigin: '60% 0%', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '64%', top: '64%', width: MAP_W, height: MAP_H, transformOrigin: `${fx}% ${fy}%`, transform: `translate(-${fx}%, -${fy}%) rotateX(52deg) scale(1.7)` }}>
            <img src="/map/map-base.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </div>
          <div className="hero-pin" style={{ position: 'absolute', left: '64%', top: '64%' }}>
            <span className="ping" style={{ position: 'absolute', left: -26, top: -12, width: 52, height: 24, borderRadius: '50%', border: `3px solid ${seg.color}`, display: 'block' }} />
            <span className="a-bob" style={{ position: 'absolute', left: -70, top: -128, width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ padding: '7px 12px', borderRadius: 12, background: seg.color, color: '#fff', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: `0 10px 24px -10px ${seg.color}` }}>Ici · {seg.label.toLowerCase()}</span>
              <span style={{ width: 3, height: 86, background: `linear-gradient(to top, ${seg.color}, rgba(255,255,255,0))` }} />
            </span>
          </div>
        </div>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(238,244,250,.97) 0%, rgba(238,244,250,.86) 40%, rgba(238,244,250,0) 72%)' }} />
        <div className="row wrap" style={{ position: 'relative', zIndex: 2, padding: 24, gap: 24, alignItems: 'flex-end', minHeight: 290 }}>
          <div className="col" style={{ flex: '1 1 380px', maxWidth: 640, gap: 12 }}>
            <Link to="/entreprises" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,.85)' }}><I.back size={14} />Base entreprises</Link>
            <div className="row" style={{ gap: 14 }}>
              <span className="mono-badge" style={{ width: 60, height: 60, borderRadius: 18, background: tint[0], color: tint[1], fontSize: 20 }}>{initials(c.name)}</span>
              <div className="col" style={{ gap: 4 }}>
                <h1 style={{ fontSize: 30, fontWeight: 600 }}>{c.name}</h1>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{c.ref} · {sectorLabel(meta, c.sector)}{c.subsector ? ` › ${c.subsector}` : ''} · {c.city ?? '—'}{c.region ? `, ${c.region}` : ''}</span>
              </div>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <SegPill segment={c.segment} />
              {c.is_demo && <DemoBadge />}
              <span className="pill" style={{ background: 'rgba(255,255,255,.9)', color: 'var(--ink-2)' }}>{data.sources.length} source(s) · {[...new Set(data.sources.map((s: any) => srcStyle(s.source).label))].join(', ')}</span>
              <span className="pill" style={{ background: 'rgba(255,255,255,.9)', color: 'var(--ink-2)' }}>{c.last_verified_at ? `Vérifiée ${ago(c.last_verified_at)}` : 'Analyse en attente'}</span>
              <span className="pill" style={{ background: c.confidence === 'high' ? '#E6F6EE' : c.confidence === 'medium' ? '#EAF4FD' : '#FFF1E4', color: c.confidence === 'high' ? '#0A6B45' : c.confidence === 'medium' ? '#084E8A' : '#8A3E00' }}>Confiance {c.confidence === 'high' ? 'élevée' : c.confidence === 'medium' ? 'moyenne' : 'faible'}</span>
              {c.do_not_contact && <span className="pill" style={{ background: '#FDECEA', color: '#B42318' }}><I.ban size={13} />Ne pas contacter</span>}
            </div>
          </div>
          <div className="glass row wrap" style={{ gap: 14, padding: '14px 16px', borderRadius: 22, maxWidth: '100%' }}>
            <div className="col" style={{ alignItems: 'center', gap: 4 }}><Ring value={opp} size={96} stroke={9} color="#F07D1A" label={`Opportunité ${c.score ?? 0} sur 100`}><text x="48" y="55" textAnchor="middle" fontFamily="Sora" fontSize="24" fontWeight="700" fill="#0B2545">{c.score == null ? '—' : Math.round(opp)}</text></Ring><span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>Opportunité</span></div>
            <div className="col" style={{ alignItems: 'center', gap: 4 }}><Ring value={c.presence_score == null ? null : pres} size={96} stroke={9} color="#2E9BEA" label={`Présence digitale ${c.presence_score ?? 0} sur 100`}><text x="48" y="55" textAnchor="middle" fontFamily="Sora" fontSize="24" fontWeight="700" fill="#0B2545">{c.presence_score == null ? '—' : Math.round(pres)}</text></Ring><span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>Présence digitale</span></div>
            <div className="col" style={{ gap: 6 }}>
              {can(user, 'edit') && <button className="btn btn-ghost btn-sm" onClick={() => setModal('edit')}><I.edit size={14} />Corriger</button>}
              {can(user, 'crm') && <button className="btn btn-ghost btn-sm" onClick={async () => { await api(`/api/companies/${id}/analyze`, { method: 'POST' }); toast('Analyse relancée.'); }}><I.refresh size={14} />Ré-analyser</button>}
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section aria-label="Étape commerciale" className="card row wrap" style={{ padding: 8, gap: 6, borderRadius: 20 }}>
        {STAGES.map((s, i) => {
          const on = c.crm_status === s, done = stageIdx > i;
          return <button key={s} disabled={!can(user, 'crm') || c.do_not_contact} aria-pressed={on} onClick={() => patch({ crm_status: s }, `Étape : ${statusLabel(meta, s)}`)}
            style={{ flex: '1 1 110px', height: 44, borderRadius: 14, border: 0, fontSize: 13, fontWeight: 800, background: on ? 'var(--ink)' : done ? 'var(--sky-bg)' : '#F7FAFD', color: on ? '#fff' : done ? 'var(--sky-ink)' : 'var(--muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .25s' }}>
            <span style={{ width: 20, height: 20, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: on ? 'var(--sky-2)' : done ? 'var(--sky)' : '#E1ECF7', color: on || done ? '#fff' : 'var(--muted)' }}>{done ? <I.check size={12} /> : i + 1}</span>{statusLabel(meta, s)}</button>;
        })}
        <label style={{ flex: '1 1 150px' }}><span className="sr">Autre statut</span><select className="select" style={{ height: 44 }} disabled={!can(user, 'crm')} value={STAGES.includes(c.crm_status) ? '' : c.crm_status} onChange={(e) => e.target.value && (e.target.value === 'do_not_contact' ? setModal('dnc') : patch({ crm_status: e.target.value }))}>
          <option value="">Autre…</option>{['replied', 'negotiation', 'later', 'lost', 'do_not_contact'].map((s) => <option key={s} value={s}>{statusLabel(meta, s)}</option>)}</select></label>
        <label style={{ flex: '1 1 170px' }}><span className="sr">Responsable</span><select className="select" style={{ height: 44 }} disabled={!can(user, 'crm')} value={c.owner_id ?? ''} onChange={(e) => patch({ owner_id: e.target.value || null }, 'Responsable mis à jour.')}>
          <option value="">Sans responsable</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      </section>

      {data.merges.length > 0 && <div className="notice warn row wrap"><I.merge size={16} />Doublon possible avec <Link to={`/entreprises/${data.merges[0].other_id}`} style={{ fontWeight: 800 }}>{data.merges[0].other_name}</Link> ({(data.merges[0].signals?.reasons ?? []).join(', ')}).
        {can(user, 'edit') && <><button className="btn btn-sm btn-primary" onClick={async () => { await api(`/api/merge-candidates/${data.merges[0].id}`, { body: { decision: 'merge' } }); toast('Fiches fusionnées (réversible).'); reload(); }}>Fusionner</button>
          <button className="btn btn-sm btn-ghost" onClick={async () => { await api(`/api/merge-candidates/${data.merges[0].id}`, { body: { decision: 'reject' } }); toast('Ce ne sont pas les mêmes : noté.'); reload(); }}>Ce sont deux entreprises différentes</button></>}</div>}

      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
        <Contacts data={data} onAdd={() => setModal('contact')} reload={() => reload(true)} />
        <section className="col" style={{ flex: '999 1 540px', minWidth: 0, gap: 16 }}>
          <Pillars c={c} audit={data.audit} />
          <ScoreWhy score={data.score} />
          <Composer data={data} reload={() => reload(true)} />
        </section>
        <aside className="col" style={{ flex: '1 1 290px', gap: 16 }}>
          <Rivals c={c} rivals={data.competitors} />
          <Timeline data={data} reload={() => reload(true)} onDnc={() => setModal('dnc')} />
          <Provenance data={data} />
        </aside>
      </div>

      {modal === 'edit' && <EditModal c={c} onClose={() => setModal(null)} onSave={async (b) => { await patch(b, 'Corrections enregistrées : elles ne seront plus écrasées.'); setModal(null); }} />}
      {modal === 'contact' && <ContactModal id={id!} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(true); }} />}
      {modal === 'dnc' && <DncModal id={id!} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(true); }} />}
    </Page>
  );
}

function Contacts({ data, onAdd, reload }: { data: any; onAdd: () => void; reload: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const k = data.contacts as any[];
  const rows = [
    ...k.filter((x) => x.kind === 'whatsapp').map((x) => ({ id: x.id, Icon: I.wa, tone: 'green', label: 'WhatsApp', value: phoneFr(x.value_normalized), copy: x.value_normalized, verif: x.verification, src: x.source, url: x.source_url, at: x.collected_at, raw: x })),
    ...k.filter((x) => x.kind === 'phone').map((x) => ({ id: x.id, Icon: x.phone_type === 'mobile' ? I.mobile : I.phone, tone: 'sky', label: x.phone_type === 'mobile' ? 'Mobile' : x.phone_type === 'fixed' ? 'Fixe' : 'Téléphone', value: phoneFr(x.value_normalized), copy: x.value_normalized, verif: x.verification, src: x.source, url: x.source_url, at: x.collected_at, raw: x })),
    ...k.filter((x) => x.kind === 'email').map((x) => ({ id: x.id, Icon: I.mail, tone: 'sky', label: 'Email', value: x.value_normalized, copy: x.value_normalized, verif: x.verification, src: x.source, url: x.source_url, at: x.collected_at, raw: x })),
    ...(data.socials as any[]).filter((s) => s.official_status !== 'rejected').map((s) => ({ id: s.id, Icon: s.platform === 'instagram' ? I.ig : s.platform === 'facebook' ? I.fb : I.globe, tone: 'sky', label: s.platform === 'link_page' ? 'Page de liens' : s.platform[0].toUpperCase() + s.platform.slice(1), value: s.url.replace(/^https?:\/\/(www\.)?/, ''), copy: s.url, verif: s.official_status === 'linked_from_official_site' ? 'published_link' : 'unverified', src: s.source, url: s.url, at: s.collected_at, raw: s })),
    ...(data.websites as any[]).map((w) => ({ id: w.id, Icon: I.globe, tone: 'sky', label: 'Site web', value: w.domain, copy: w.url, verif: 'unverified', src: w.source, url: w.url, at: w.detected_at, raw: w })),
  ];
  const has = (kind: string) => k.some((x) => x.kind === kind);
  const missing = [!has('email') && 'Email', !(data.socials as any[]).some((s) => s.platform === 'instagram') && 'Instagram', !has('whatsapp') && 'WhatsApp publié'].filter(Boolean) as string[];
  const mobileNoWa = k.some((x) => x.kind === 'phone' && x.phone_type === 'mobile') && !has('whatsapp');
  return (
    <section className="card col" aria-label="Moyens de contact" style={{ flex: '1 1 320px', padding: 18, gap: 8, borderRadius: 24 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}><h2 className="panel-title">Moyens de contact</h2><span className="pill" style={{ background: rows.length ? '#E6F6EE' : '#FFF1E4', color: rows.length ? '#0A6B45' : '#8A3E00' }}>{rows.length} trouvé(s)</span></div>
      {rows.length === 0 && <div className="notice warn">Aucun moyen de contact trouvé dans les sources. Ajoutez-en un après une visite ou une recherche.</div>}
      {rows.map((r) => {
        const v = VERIF[r.verif] ?? VERIF.unverified, s = srcStyle(r.src);
        return (
          <div key={r.id} className="row" style={{ gap: 12, padding: 10, borderRadius: 14, background: r.verif === 'invalid' ? '#FFF7F6' : '#F7FBFF', opacity: r.verif === 'invalid' ? 0.6 : 1 }}>
            <span className="mono-badge" style={{ width: 38, height: 38, borderRadius: 12, background: r.tone === 'green' ? '#E6F6EE' : '#EAF4FD', color: r.tone === 'green' ? '#0A6B45' : '#084E8A' }}><r.Icon size={17} /></span>
            <span className="col grow" style={{ gap: 2 }}>
              <span className="row" style={{ gap: 8 }}><span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{r.label}</span><span className="pill" style={{ fontSize: 10.5, padding: '1px 6px', background: v[1], color: v[2] }}>{r.verif === 'unverified' ? s.label : v[0]}</span></span>
              <span style={{ fontSize: 14, fontWeight: 800, overflowWrap: 'anywhere', textDecoration: r.verif === 'invalid' ? 'line-through' : 'none' }}>{r.value}</span>
              <span className="muted" style={{ fontSize: 11 }}>{s.label} · {dateFr(r.at)}{r.url && r.url !== r.copy && <> · <a href={r.url} target="_blank" rel="noopener noreferrer">page source</a></>}</span>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard?.writeText(r.copy).catch(() => {}); setCopied(r.id); setTimeout(() => setCopied(null), 1500); }} aria-label={`Copier ${r.label}`} style={{ color: copied === r.id ? 'var(--green-ink)' : 'var(--sky)' }}>{copied === r.id ? <I.check size={14} /> : <I.copy size={14} />}</button>
            {can(user, 'crm') && ['whatsapp', 'phone', 'email'].includes(r.raw.kind) && r.verif !== 'invalid' && <button className="btn btn-ghost btn-sm" title="Marquer comme invalide" aria-label="Marquer comme invalide" onClick={async () => { await api(`/api/contacts/${r.id}`, { method: 'PATCH', body: { verification: 'invalid' } }); toast('Contact marqué invalide.'); reload(); }}><I.x size={14} /></button>}
          </div>
        );
      })}
      {mobileNoWa && <div className="notice" style={{ fontSize: 12 }}>Un mobile n’est pas forcément sur WhatsApp : il ne sera marqué « WhatsApp » que si l’entreprise publie un lien, ou si vous le confirmez après un échange.</div>}
      {missing.length > 0 && <span className="muted" style={{ fontSize: 12 }}>Non trouvés (recherchés) : {missing.join(', ')}</span>}
      {can(user, 'crm') && <button className="btn btn-ghost" style={{ borderStyle: 'dashed' }} onClick={onAdd}><I.plus size={16} />Ajouter ou confirmer un contact</button>}
    </section>
  );
}

function Pillars({ c, audit }: { c: any; audit: any }) {
  const P = c.pillars ?? {};
  const site = P.site ?? {}, g = P.google ?? {};
  const color = (s: number | null) => (s == null ? '#A7B4C6' : s >= 70 ? '#0A7A4F' : s >= 40 ? '#F07D1A' : '#B42318');
  const cards = [
    { n: '1', title: 'Site web', score: site.score ?? null, verdict: SITE_CLASS[c.site_class] ?? '—', checks: site.checks ?? [], basis: c.site_class === 'not_found' ? (c.web_presence_basis?.note ?? '') : audit ? `Audit du ${dateFr(audit.ran_at, true)}${audit.metrics?.cms ? ` · ${audit.metrics.cms}` : ''} · ${audit.limits}` : 'Pas encore audité.', link: site.url },
    { n: '2', title: 'Fiche Google', score: g.score ?? null, verdict: g.score == null ? 'Non disponible' : g.score >= 80 ? 'Complète' : 'Incomplète', checks: g.checks ?? [], basis: g.score == null ? 'Visible seulement si la source Google Places a été utilisée.' : `Google Places · ${dateFr(c.google_profile?.at)}`, link: c.google_profile?.mapsUrl },
    { n: '3', title: 'Référencement', score: null, verdict: 'Non mesuré', checks: [], basis: P.seo?.note ?? 'Prévu en V2.', locked: true },
    { n: '4', title: 'Visibilité IA', score: null, verdict: 'Non mesuré', checks: [], basis: P.ai?.note ?? 'Prévu en V2.', locked: true },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
      {cards.map((p, i) => (
        <div key={p.n} className="card col" style={{ padding: 16, gap: 10, animation: `rise .5s ${i * 70}ms both`, opacity: p.locked ? 0.78 : 1, borderStyle: p.locked ? 'dashed' : 'solid' }}>
          <div className="row" style={{ gap: 12 }}>
            <Ring value={p.score} size={48} stroke={6} color={color(p.score)}><text x="24" y="29" textAnchor="middle" fontFamily="Sora" fontSize="13" fontWeight="700" fill="#0B2545">{p.score ?? '—'}</text></Ring>
            <span className="col" style={{ gap: 2 }}><span className="kicker" style={{ color: 'var(--muted)', fontSize: 11 }}>{p.n} · {p.title}</span><span className="display" style={{ fontSize: 16, fontWeight: 600 }}>{p.verdict}</span></span>
          </div>
          {p.checks.length > 0 && <div className="col" style={{ gap: 6 }}>
            {p.checks.map((k: any) => <span key={k.id} className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--ink-2)', alignItems: 'flex-start' }}>
              <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: k.ok === true ? '#E6F6EE' : k.ok === false ? '#FDECEA' : '#F2F5F9', color: k.ok === true ? '#0A6B45' : k.ok === false ? '#B42318' : '#4A5A70' }}>{k.ok === true ? '✓' : k.ok === false ? '✕' : '·'}</span>
              <span>{k.label}{k.detail ? <span className="muted"> · {k.detail}</span> : null}</span></span>)}
          </div>}
          {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 800 }}>Ouvrir ↗</a>}
          <span className="muted" style={{ fontSize: 11, lineHeight: 1.45 }}>{p.basis}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreWhy({ score }: { score: any }) {
  if (!score) return null;
  const signals = (score.signals as any[]) ?? [];
  const max = Math.max(...signals.map((s) => Math.abs(s.points)), 1);
  return (
    <div className="card col" style={{ padding: 18, gap: 10, borderRadius: 22 }}>
      <div className="row"><h2 className="panel-title grow">Pourquoi ce score ?</h2><span className="muted" style={{ fontSize: 12 }}>Règles {score.rule_version} · {dateFr(score.computed_at, true)}</span></div>
      {signals.map((s) => (
        <div key={s.id} className="row" style={{ gap: 12, fontSize: 13 }}>
          <span style={{ width: 44, textAlign: 'right', fontWeight: 800, color: s.points > 0 ? 'var(--green-ink)' : s.points < 0 ? 'var(--red)' : 'var(--muted)' }}>{s.points > 0 ? '+' : ''}{s.points}</span>
          <span style={{ width: 120, height: 8, borderRadius: 4, background: '#EEF4FA', overflow: 'hidden', flexShrink: 0 }}><span style={{ display: 'block', height: 8, width: `${(Math.abs(s.points) / max) * 100}%`, background: s.points >= 0 ? (s.id === 'base' ? '#A7B4C6' : 'var(--sky)') : 'var(--red)', borderRadius: 4 }} /></span>
          <span className="grow" style={{ color: 'var(--ink-2)' }}>{s.label}{s.evidence && <span className="muted"> · {s.evidence}</span>}</span>
        </div>
      ))}
      <span className="muted" style={{ fontSize: 11 }}>Le score aide à prioriser. Il ne prétend pas connaître l’intention d’achat de l’entreprise.</span>
    </div>
  );
}

function Composer({ data, reload }: { data: any; reload: () => void }) {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const c = data.company;
  const k = data.contacts as any[];
  const wa = k.find((x) => x.kind === 'whatsapp' && x.verification !== 'invalid');
  const email = k.find((x) => x.kind === 'email' && x.verification !== 'invalid');
  const phone = k.find((x) => x.kind === 'phone' && x.verification !== 'invalid');
  const mobile = k.find((x) => x.kind === 'phone' && x.phone_type === 'mobile' && x.verification !== 'invalid');
  const fb = (data.socials as any[]).find((s) => s.platform === 'facebook');
  const [chan, setChan] = useState<'wa' | 'mail' | 'fb' | 'call'>(wa ? 'wa' : email ? 'mail' : fb ? 'fb' : 'call');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState('');
  const first = user?.name.split(' ')[0] ?? '[PRÉNOM]';
  const sector = sectorLabel(meta, c.sector).toLowerCase();
  const g = c.google_profile ?? {};
  const rating = g.rating ? ` avec une note de ${String(g.rating).replace('.', ',')} ★ (${g.reviews ?? 0} avis)` : '';
  const issues = ((c.pillars?.site?.checks ?? []) as any[]).filter((x) => x.ok === false).slice(0, 2).map((x) => x.label.toLowerCase());
  const constat = useMemo(() => {
    switch (c.segment) {
      case 'no_site': return `En cherchant « ${sector} ${c.city ?? ''} » sur Google, ${c.name.replace(' (démo)', '')} apparaît${rating}, mais sans site web : vos clients ne peuvent ni découvrir vos services ni vous contacter facilement.`;
      case 'social_or_generated': return `Votre présence en ligne repose aujourd’hui sur ${fb ? 'votre page Facebook' : 'une page générée automatiquement'} : vous ne contrôlez ni votre image ni la façon dont les clients vous contactent.`;
      case 'weak_site': return `Votre site existe, mais nos contrôles montrent des points faibles${issues.length ? ` (${issues.join(', ')})` : ''} qui font perdre des demandes.`;
      case 'good_site': return `Votre site est solide. La prochaine étape : apparaître en tête sur Google et dans les réponses des assistants IA quand on cherche « ${sector} ${c.city ?? ''} ».`;
      default: return `Nous avons regardé votre présence en ligne.`;
    }
  }, [c, sector, rating, issues.join(), fb]); // eslint-disable-line
  const TEMPLATES = {
    wa: `Bonjour, je suis ${first} de Digilago, agence web à El Jadida.\n${constat}\nJ’ai préparé un diagnostic gratuit de votre présence en ligne (site, fiche Google, référencement). Je peux vous l’envoyer ici ?`,
    mail: `Bonjour,\n\n${constat}\n\nNous avons préparé un diagnostic gratuit de votre présence en ligne : site, fiche Google, référencement et visibilité sur les assistants IA. Souhaitez-vous le recevoir ?\n\n${first} · Digilago`,
    fb: `Bonjour ! Nous sommes Digilago, une agence web marocaine. ${constat} Nous avons préparé un petit diagnostic gratuit : ça vous intéresse ?`,
    call: `1. Présentation : « Bonjour, ${first}, de Digilago. »\n2. Constat : « ${constat} »\n3. Proposition : « Je vous envoie un diagnostic gratuit, sur WhatsApp ou par email ? »\n4. Noter le résultat ci-dessous.`,
  };
  const body = edits[chan] ?? TEMPLATES[chan];
  const subject = `${c.name.replace(' (démo)', '')} : votre diagnostic de présence en ligne`;
  const log = async (channel: string, content: string, out?: string) => {
    await api(`/api/companies/${c.id}/activities`, { body: { type: 'contact', channel, content, outcome: out || undefined } }).catch((e) => toast(e.message, true));
    reload();
  };
  const digits = (e164: string) => e164.replace(/\D/g, '');
  const action = (() => {
    if (c.do_not_contact) return null;
    if (chan === 'wa') return wa ? { label: 'Ouvrir dans WhatsApp', cls: 'btn-green', href: `https://wa.me/${digits(wa.value_normalized)}?text=${encodeURIComponent(body)}`, channel: 'whatsapp' }
      : mobile ? { label: 'Essayer WhatsApp (numéro non confirmé)', cls: 'btn-ghost', href: `https://wa.me/${digits(mobile.value_normalized)}?text=${encodeURIComponent(body)}`, channel: 'whatsapp' } : null;
    if (chan === 'mail') return email ? { label: 'Ouvrir dans ma messagerie', cls: 'btn-primary', href: `mailto:${email.value_normalized}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, channel: 'email' } : null;
    if (chan === 'fb') return fb ? { label: 'Ouvrir la page Facebook', cls: 'btn-primary', href: fb.url, channel: 'facebook', copyFirst: true } : null;
    return phone ? { label: `Appeler ${phoneFr(phone.value_normalized)}`, cls: 'btn-dark', href: `tel:${phone.value_normalized}`, channel: 'phone' } : null;
  })();
  return (
    <div className="card col" style={{ padding: 18, gap: 14, borderRadius: 24 }}>
      <div className="row wrap">
        <h2 className="panel-title">Message proposé</h2>
        <div className="seg" role="tablist" aria-label="Canal">
          {([['wa', 'WhatsApp'], ['mail', 'Email'], ['fb', 'Facebook'], ['call', 'Script d’appel']] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={chan === id} className={chan === id ? 'on' : ''} onClick={() => setChan(id)}>{l}</button>)}
        </div>
        <div className="grow" />
        <span className="muted" style={{ fontSize: 12 }}>Adapté à : {SEGMENTS[c.segment]?.label.toLowerCase()} · {sectorLabel(meta, c.sector)}</span>
      </div>
      {chan === 'mail' && <label className="row" style={{ padding: '0 14px', height: 44, borderRadius: 12, border: '1px solid var(--line-2)', background: '#F7FBFF' }}><span style={{ fontWeight: 800, color: 'var(--muted)', fontSize: 13 }}>Objet</span><span style={{ fontSize: 14, fontWeight: 700 }}>{subject}</span></label>}
      <label><span className="sr">Texte du message</span><textarea className="textarea" rows={7} value={body} onChange={(e) => setEdits({ ...edits, [chan]: e.target.value })} /></label>
      {c.do_not_contact ? <div className="error-box">Cette entreprise a demandé à ne pas être contactée.</div> : (
        <div className="row wrap">
          {action ? <a className={`btn ${action.cls}`} href={action.href} target="_blank" rel="noopener noreferrer" onClick={async () => { if ((action as any).copyFirst) await navigator.clipboard?.writeText(body).catch(() => {}); if (can(user, 'crm')) log(action.channel, chan === 'call' ? 'Appel' : 'Message préparé et ouvert'); }}>{action.label}</a>
            : <span className="notice warn" style={{ padding: '10px 12px' }}>Aucun {chan === 'wa' ? 'numéro WhatsApp ni mobile' : chan === 'mail' ? 'email' : chan === 'fb' ? 'page Facebook' : 'téléphone'} pour ce canal.</span>}
          <button className="btn btn-ghost" onClick={async () => { await navigator.clipboard?.writeText(body).catch(() => {}); toast('Message copié.'); }}><I.copy size={15} />Copier</button>
          <span className="muted" style={{ fontSize: 12, maxWidth: 320 }}>Le message s’ouvre déjà rédigé : c’est vous qui l’envoyez, un par un. Aucun envoi automatique.</span>
        </div>
      )}
      {can(user, 'crm') && !c.do_not_contact && (
        <div className="row wrap" style={{ paddingTop: 10, borderTop: '1px solid #EEF3F8' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>Résultat du contact :</span>
          <select className="select" style={{ width: 200, height: 38 }} value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">Choisir…</option>{OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button className="btn btn-dark btn-sm" disabled={!outcome} onClick={async () => { await log(chan === 'wa' ? 'whatsapp' : chan === 'mail' ? 'email' : chan === 'fb' ? 'facebook' : 'phone', OUTCOMES.find((o) => o[0] === outcome)?.[1] ?? '', outcome); setOutcome(''); toast('Résultat noté.'); }}>Noter</button>
        </div>
      )}
    </div>
  );
}

function Rivals({ c, rivals }: { c: any; rivals: any[] }) {
  if (!rivals?.length) return null;
  const withSite = rivals.filter((r) => ['good_site', 'weak_site'].includes(r.segment)).length;
  return (
    <div className="card col" style={{ padding: 18, gap: 8, borderRadius: 24 }}>
      <h2 className="panel-title" style={{ fontSize: 15 }}>Concurrents proches</h2>
      {rivals.map((r, i) => (
        <Link key={r.id} to={`/entreprises/${r.id}`} className="row" style={{ gap: 10, padding: '8px 0', borderTop: i ? '1px solid #F0F5FA' : 0, color: 'var(--ink)' }}>
          <span className="mono-badge" style={{ width: 30, height: 30, borderRadius: 9, background: '#EEF4FA', color: 'var(--ink-2)', fontSize: 11 }}>{i + 1}</span>
          <span className="col grow" style={{ gap: 1 }}><span className="ellipsis" style={{ fontSize: 13, fontWeight: 800 }}>{r.name}</span><span className="muted" style={{ fontSize: 11 }}>{r.rating ? `${String(r.rating).replace('.', ',')} ★ · ${r.reviews} avis · ` : ''}{fmt(r.dist)} m</span></span>
          <SegPill segment={r.segment} />
        </Link>
      ))}
      {withSite > 0 && c.segment === 'no_site' && <span className="notice" style={{ background: '#FFF4EA', color: 'var(--orange-ink)' }}>Argument : <strong>{withSite} concurrent(s) sur {rivals.length}</strong> ont déjà un site.</span>}
    </div>
  );
}

function Timeline({ data, reload, onDnc }: { data: any; reload: () => void; onDnc: () => void }) {
  const { user } = useAuth();
  const { meta } = useMeta();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const acts = data.activities as any[];
  const label = (a: any) => a.type === 'status_change' ? `Étape : ${statusLabel(meta, a.content) || a.content}` : a.type === 'contact' ? `Contact ${a.channel ?? ''}${a.outcome ? ` · ${OUTCOMES.find((o) => o[0] === a.outcome)?.[1]}` : ''}` : a.type === 'task' ? `Tâche : ${a.content}` : a.type === 'assignment' ? 'Responsable changé' : a.type === 'correction' ? a.content : a.content;
  const color = (t: string) => ({ status_change: '#0A7A4F', contact: '#2E9BEA', task: '#F07D1A', note: '#0B6FC2', correction: '#5B2C9C' } as Record<string, string>)[t] ?? '#A7B4C6';
  const add = async (type: 'note' | 'task') => {
    if (!note.trim()) return;
    try { await api(`/api/companies/${data.company.id}/activities`, { body: { type, content: note.trim(), due_at: type === 'task' && due ? new Date(due).toISOString() : undefined } }); setNote(''); setDue(''); reload(); toast(type === 'task' ? 'Tâche créée.' : 'Note ajoutée.'); }
    catch (e) { toast((e as Error).message, true); }
  };
  return (
    <div className="card col" style={{ padding: 18, gap: 8, borderRadius: 24 }}>
      <h2 className="panel-title" style={{ fontSize: 15 }}>Suivi</h2>
      {data.company.next_action_at && <div className="notice row" style={{ gap: 8 }}><I.calendar size={15} /><span><strong>{data.company.next_action}</strong> · {dateFr(data.company.next_action_at, true)}</span></div>}
      {can(user, 'crm') && (
        <div className="col" style={{ gap: 8 }}>
          <textarea className="textarea" rows={2} placeholder="Note, ou tâche à faire…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => add('note')} disabled={!note.trim()}><I.note size={14} />Note</button>
            <input type="datetime-local" className="input" style={{ height: 34, width: 190, fontSize: 12 }} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Échéance de la tâche" />
            <button className="btn btn-ghost btn-sm" onClick={() => add('task')} disabled={!note.trim() || !due}><I.calendar size={14} />Tâche</button>
          </div>
        </div>
      )}
      <div className="col" style={{ gap: 0, marginTop: 6 }}>
        {acts.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Aucune action pour l’instant.</span>}
        {acts.slice(0, 12).map((a, i) => (
          <div key={a.id} className="row" style={{ gap: 12, alignItems: 'stretch', animation: `rise .4s ${i * 40}ms both` }}>
            <span className="col" style={{ alignItems: 'center', gap: 0 }}><span style={{ width: 12, height: 12, borderRadius: 6, background: color(a.type), border: '3px solid #fff', boxShadow: `0 0 0 1px ${color(a.type)}`, marginTop: 3 }} /><span style={{ width: 2, flex: 1, minHeight: 18, background: '#E1ECF7' }} /></span>
            <span className="col" style={{ gap: 2, paddingBottom: 10 }}><span style={{ fontSize: 13, fontWeight: 800 }}>{label(a)}</span>{a.type === 'note' || (a.type === 'contact' && a.content && !a.outcome) ? null : null}<span className="muted" style={{ fontSize: 11 }}>{dateFr(a.created_at, true)}{a.user_name ? ` · ${a.user_name}` : ''}{a.due_at ? ` · échéance ${dateFr(a.due_at, true)}` : ''}</span></span>
          </div>
        ))}
      </div>
      {can(user, 'crm') && !data.company.do_not_contact && <button className="btn btn-danger" onClick={onDnc}><I.ban size={15} />Ne pas contacter</button>}
    </div>
  );
}

function Provenance({ data }: { data: any }) {
  const c = data.company;
  const prov = c.field_provenance ?? {};
  return (
    <details className="card" style={{ padding: 18, borderRadius: 24 }}>
      <summary className="panel-title" style={{ fontSize: 15, cursor: 'pointer' }}>Sources & traçabilité</summary>
      <div className="col" style={{ gap: 8, marginTop: 12 }}>
        {(data.sources as any[]).map((s) => (
          <div key={s.id} className="row" style={{ gap: 10, fontSize: 12 }}>
            <SourceBadge id={s.source} size={28} />
            <span className="col grow" style={{ gap: 1 }}><span style={{ fontWeight: 800 }}>{srcStyle(s.source).label}{s.attribution ? ` · ${s.attribution}` : ''}</span><span className="muted">Collectée le {dateFr(s.collected_at, true)}{s.expires_at ? ` · à rafraîchir avant le ${dateFr(s.expires_at)}` : ''}</span></span>
            {s.source_url && <a href={s.source_url} target="_blank" rel="noopener noreferrer" aria-label="Voir la source">↗</a>}
          </div>
        ))}
        {(c.locked_fields ?? []).length > 0 && <div className="notice" style={{ fontSize: 12 }}>Champs corrigés à la main (jamais écrasés) : <strong>{c.locked_fields.join(', ')}</strong></div>}
        {Object.keys(prov).length > 0 && <div className="muted" style={{ fontSize: 11 }}>{Object.entries(prov).map(([k, v]: any) => `${k} : ${srcStyle(v.source).label} (${dateFr(v.at)})`).join(' · ')}</div>}
        {c.web_presence_basis?.sources && <div className="muted" style={{ fontSize: 11 }}>Diagnostic : sources consultées {c.web_presence_basis.sources.map((x: string) => srcStyle(x).label).join(', ')} · règles {c.web_presence_basis.rules}</div>}
      </div>
    </details>
  );
}

function EditModal({ c, onClose, onSave }: { c: any; onClose: () => void; onSave: (b: Record<string, unknown>) => void }) {
  const { meta } = useMeta();
  const [v, setV] = useState({ name: c.name, sector: c.sector ?? '', subsector: c.subsector ?? '', city: c.city ?? '', description: c.description ?? '', activity_status: c.activity_status });
  const changed = Object.fromEntries(Object.entries(v).filter(([k, x]) => (x || null) !== (c[k] || null)).map(([k, x]) => [k, x === '' ? null : x]));
  return (
    <Modal title="Corriger la fiche" onClose={onClose}>
      <div className="notice">Les champs que vous corrigez sont verrouillés : les prochains balayages ne les écraseront pas.</div>
      <label className="field">Nom<input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        <label className="field">Secteur<select className="select" value={v.sector} onChange={(e) => setV({ ...v, sector: e.target.value })}><option value="">—</option>{meta?.sectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label className="field">Sous-secteur<input className="input" value={v.subsector} onChange={(e) => setV({ ...v, subsector: e.target.value })} /></label>
        <label className="field">Ville<input className="input" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} /></label>
        <label className="field">Activité<select className="select" value={v.activity_status} onChange={(e) => setV({ ...v, activity_status: e.target.value })}><option value="active">Active</option><option value="inactive">Fermée</option><option value="unknown">Inconnue</option></select></label>
      </div>
      <label className="field">Description<textarea className="textarea" rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!Object.keys(changed).length} onClick={() => onSave(changed)}>Enregistrer</button></div>
    </Modal>
  );
}

function ContactModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<'phone' | 'email' | 'whatsapp'>('phone');
  const [value, setValue] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal title="Ajouter ou confirmer un contact" onClose={onClose}>
      <div className="seg">{([['phone', 'Téléphone'], ['email', 'Email'], ['whatsapp', 'WhatsApp']] as const).map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
      <label className="field">{kind === 'email' ? 'Adresse email' : 'Numéro'}<input className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus inputMode={kind === 'email' ? 'email' : 'tel'} /></label>
      {kind === 'whatsapp' && <label className="row" style={{ fontSize: 13, fontWeight: 600, alignItems: 'flex-start' }}><input type="checkbox" className="check" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />J’atteste que ce numéro est bien sur WhatsApp (l’entreprise a échangé avec nous sur WhatsApp, ou l’affiche elle-même).</label>}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={value.length < 3} onClick={async () => { try { await api(`/api/companies/${id}/contacts`, { body: { kind, value, confirmed } }); toast('Contact enregistré.'); onDone(); } catch (e) { toast((e as Error).message, true); } }}>Enregistrer</button></div>
    </Modal>
  );
}

function DncModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [by, setBy] = useState('');
  return (
    <Modal title="Ne plus contacter cette entreprise" onClose={onClose}>
      <div className="notice warn">L’entreprise et tous ses numéros et emails seront exclus des listes, des exports et des messages, y compris si ses coordonnées réapparaissent dans un futur balayage.</div>
      <label className="field">Motif *<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. demande du gérant au téléphone" autoFocus /></label>
      <label className="field">Demandé par<input className="input" value={by} onChange={(e) => setBy(e.target.value)} placeholder="ex. le gérant" /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-danger" disabled={reason.length < 2} onClick={async () => { try { await api(`/api/companies/${id}/dnc`, { body: { reason, requestedBy: by || undefined } }); toast('Ajoutée à la liste « ne pas contacter ».'); onDone(); } catch (e) { toast((e as Error).message, true); } }}>Confirmer</button></div>
    </Modal>
  );
}
