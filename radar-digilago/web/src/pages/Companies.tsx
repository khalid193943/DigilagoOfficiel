import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { I } from '../components/Icons';
import { Page } from '../components/Shell';
import { Channels, DemoBadge, Empty, Modal, Ring, SegPill, Skeleton, SourceBadge, useToast } from '../components/ui';
import { api, qs } from '../lib/api';
import { can, useAuth } from '../lib/auth';
import { ago, fmt, initials, pct, SEG_ORDER, SEGMENTS, sectorTint } from '../lib/format';
import { useApi, useDebounced } from '../lib/hooks';
import { sectorLabel, statusLabel, useMeta } from '../lib/meta';

type Row = { id: string; ref: string; name: string; sector: string | null; subsector: string | null; city: string | null; segment: string; score: number | null; crm_status: string; is_demo: boolean; needs_review: boolean; sources: string[]; last_verified_at: string | null; created_at: string; [k: string]: any };
type List = { rows: Row[]; total: number; page: number; pageSize: number; views: Record<string, number>; segments: { segment: string; n: number }[] };

const VIEWS = [['today', 'Liste du jour'], ['all', 'Toutes'], ['new', 'Nouvelles · 7 j'], ['nosite', 'Sans site'], ['wa', 'WhatsApp prouvé'], ['follow', 'À relancer'], ['review', 'À valider']] as const;
const CHANNELS = [['', 'Tous les canaux'], ['any', 'Au moins un canal'], ['email', 'Email'], ['whatsapp', 'WhatsApp prouvé'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['mobile', 'Mobile'], ['fixed_only', 'Fixe uniquement'], ['none', 'Aucun canal']] as const;

export function Companies() {
  const [sp, setSp] = useSearchParams();
  const { meta } = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const f = Object.fromEntries(sp.entries());
  const view = f.view ?? 'today';
  const [q, setQ] = useState(f.q ?? '');
  const dq = useDebounced(q, 300);
  useEffect(() => { if ((f.q ?? '') !== dq) set({ q: dq || undefined, page: undefined }); }, [dq]); // eslint-disable-line
  const query = qs({ ...f, view });
  const list = useApi<List>(`/api/companies${query}`, [query]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'add' | 'import' | 'export'>(null);
  useEffect(() => { setSel(new Set()); }, [query]);

  function set(patch: Record<string, string | undefined>) {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v == null || v === '' ? n.delete(k) : n.set(k, v));
    setSp(n, { replace: true });
  }
  const d = list.data;
  const segCount = (s: string) => d?.segments.find((x) => x.segment === s)?.n ?? 0;
  const segTotal = SEG_ORDER.reduce((a, s) => a + segCount(s), 0);
  const city = meta?.cities.find((c) => c.id === f.city);
  const page = Number(f.page ?? 1), pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  const allSel = !!d?.rows.length && d.rows.every((r) => sel.has(r.id));

  const bulk = async (action: string, value?: string | null) => {
    try { await api('/api/companies/bulk', { body: { ids: [...sel], action, value } }); toast(action === 'analyze' ? 'Analyses programmées.' : 'Modifications enregistrées.'); setSel(new Set()); list.reload(true); }
    catch (e) { toast((e as Error).message, true); }
  };

  return (
    <Page>
      <div className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <span className="kicker">Base entreprises</span>
          <h1><strong>{d ? fmt(d.views.all) : '…'}</strong> entreprises{city ? ` à ${city.name}` : ' au Maroc'}</h1>
        </div>
        <div className="grow" />
        {can(user, 'export') && <button className="btn btn-ghost" onClick={() => setModal('export')}><I.download size={16} />Exporter</button>}
        {can(user, 'edit') && <button className="btn btn-ghost" onClick={() => setModal('import')}><I.upload size={16} />Importer Excel</button>}
        {can(user, 'edit') && <button className="btn btn-primary" onClick={() => setModal('add')}><I.plus size={16} />Ajouter une entreprise</button>}
      </div>

      <div role="tablist" aria-label="Vues" className="row wrap" style={{ gap: 6 }}>
        {VIEWS.map(([id, label]) => {
          const on = view === id;
          return <button key={id} role="tab" aria-selected={on} onClick={() => set({ view: id, page: undefined })} className="btn btn-sm" style={{ height: 38, border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`, background: on ? 'var(--ink)' : '#fff', color: on ? '#fff' : 'var(--ink-2)' }}>
            {label}<span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 7, background: on ? 'rgba(255,255,255,.18)' : '#EEF4FA' }}>{d ? fmt(d.views[id]) : '·'}</span></button>;
        })}
      </div>

      <section aria-label="Filtrer par case" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {SEG_ORDER.map((s) => {
          const on = f.segment === s, S = SEGMENTS[s], n = segCount(s);
          return (
            <button key={s} aria-pressed={on} onClick={() => set({ segment: on ? undefined : s, page: undefined })} className="card" style={{ textAlign: 'left', padding: '16px 18px', border: `2px solid ${on ? S.color : '#fff'}`, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: on ? `0 20px 40px -24px ${S.color}` : 'var(--shadow-sm)', transition: 'all .25s ease' }}>
              <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 800 }}><span style={{ width: 10, height: 10, borderRadius: 4, background: S.color }} />{S.label}<span className="grow" /><span className="muted" style={{ fontSize: 12 }}>{pct(n, segTotal)} %</span></span>
              <span className="display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.02em' }}>{fmt(n)}</span>
              <span className="progress" style={{ height: 6 }}><span style={{ width: `${pct(n, segTotal)}%`, background: S.color }} /></span>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>« {S.pitch} »</span>
            </button>
          );
        })}
      </section>

      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
        <section className="card" style={{ flex: '999 1 640px', minWidth: 0, position: 'relative', borderRadius: 22 }}>
          <div className="row wrap" style={{ padding: '14px 16px', borderBottom: '1px solid #EEF3F8', gap: 8 }}>
            <label className="search" style={{ flex: '1 1 220px', height: 38, background: '#F7FBFF' }}><I.search size={15} /><span className="sr">Rechercher dans la liste</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, domaine…" /></label>
            <Sel label="Ville" value={f.city ?? ''} onChange={(v) => set({ city: v, page: undefined })} options={[['', 'Toutes les villes'], ...(meta?.cities.map((c) => [c.id, c.name] as [string, string]) ?? [])]} />
            <Sel label="Secteur" value={f.sector ?? ''} onChange={(v) => set({ sector: v, page: undefined })} options={[['', 'Tous les secteurs'], ...(meta?.sectors.map((s) => [s.id, s.label] as [string, string]) ?? [])]} />
            <Sel label="Canal" value={f.channel ?? ''} onChange={(v) => set({ channel: v, page: undefined })} options={CHANNELS.map((c) => [c[0], c[1]])} />
            <Sel label="Statut" value={f.status ?? ''} onChange={(v) => set({ status: v, page: undefined })} options={[['', 'Tous les statuts'], ...(meta?.crmStatuses.map((s) => [s.id, s.label] as [string, string]) ?? [])]} />
            <Sel label="Tri" value={f.sort ?? 'score'} onChange={(v) => set({ sort: v })} options={[['score', 'Score'], ['recent', 'Plus récentes'], ['verified', 'Vérifiées récemment'], ['name', 'Nom']]} />
          </div>
          {list.error && <div className="error-box" style={{ margin: 16 }}>{list.error}</div>}
          <div className="table-wrap">
            <table className="data" style={{ minWidth: 880 }}>
              <thead><tr>
                <th style={{ width: 28 }}><input type="checkbox" className="check" checked={allSel} aria-label="Tout sélectionner" onChange={() => setSel(allSel ? new Set() : new Set(d?.rows.map((r) => r.id)))} /></th>
                <th>Entreprise</th><th>Case</th><th>Canaux</th><th>Score</th><th>Sources</th><th>Statut</th>
              </tr></thead>
              <tbody>
                {list.loading && !d && Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={7}><Skeleton h={30} /></td></tr>)}
                {d?.rows.map((r, i) => {
                  const tint = sectorTint(r.sector), s = r.score ?? 0;
                  return (
                    <tr key={r.id} className={`clickable${preview === r.id ? ' selected' : ''}`} onClick={() => setPreview(r.id)} style={{ animation: `rise .4s ${i * 25}ms both` }}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="check" checked={sel.has(r.id)} aria-label={`Sélectionner ${r.name}`} onChange={() => { const n = new Set(sel); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSel(n); }} /></td>
                      <td>
                        <div className="row" style={{ gap: 12 }}>
                          <span className="mono-badge" style={{ width: 38, height: 38, borderRadius: 12, background: tint[0], color: tint[1], fontSize: 13 }}>{initials(r.name)}</span>
                          <span className="col" style={{ gap: 2, minWidth: 0 }}>
                            <span className="row" style={{ gap: 6 }}><Link to={`/entreprises/${r.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 800, color: 'var(--ink)' }} className="ellipsis">{r.name}</Link>{r.is_demo && <DemoBadge />}{r.needs_review && <span className="pill" style={{ fontSize: 10.5, padding: '2px 7px', background: '#FFF1E4', color: '#8A3E00' }}>doublon ?</span>}</span>
                            <span className="muted ellipsis" style={{ fontSize: 12 }}>{sectorLabel(meta, r.sector)}{r.subsector ? ` › ${r.subsector}` : ''} · {r.city ?? '—'} · {r.ref}</span>
                          </span>
                        </div>
                      </td>
                      <td><SegPill segment={r.segment} /></td>
                      <td><Channels row={r} /></td>
                      <td><div className="row" style={{ gap: 8 }}><Ring value={r.score} size={34} stroke={4} color={s >= 80 ? '#F07D1A' : s >= 60 ? '#0B6FC2' : '#A7B4C6'} /><span className="display" style={{ fontSize: 15, fontWeight: 600 }}>{r.score ?? '—'}</span></div></td>
                      <td><div className="row" style={{ gap: 4 }}>{r.sources.map((x) => <SourceBadge key={x} id={x} size={24} />)}</div><div className="muted" style={{ fontSize: 11 }}>{r.last_verified_at ? `vérifiée ${ago(r.last_verified_at)}` : 'à analyser'}</div></td>
                      <td><span className="pill" style={{ background: r.crm_status === 'do_not_contact' ? '#FDECEA' : r.crm_status === 'won' ? '#E6F6EE' : '#EAF4FD', color: r.crm_status === 'do_not_contact' ? '#B42318' : r.crm_status === 'won' ? '#0A6B45' : '#084E8A' }}>{statusLabel(meta, r.crm_status)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {d && d.rows.length === 0 && <Empty title="Aucune entreprise ne correspond" action={<button className="btn btn-ghost" onClick={() => setSp(new URLSearchParams({ view: 'all' }))}>Réinitialiser les filtres</button>}>Essayez la vue « Toutes » ou lancez un balayage sur une nouvelle zone.</Empty>}
          <div className="row wrap" style={{ padding: '12px 16px', borderTop: '1px solid #EEF3F8', fontSize: 12, color: 'var(--muted)' }}>
            <span>Icône grisée = canal non trouvé. WhatsApp n’est coché que si l’entreprise publie elle-même un lien WhatsApp.</span>
            <div className="grow" />
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} aria-label="Page précédente"><I.back size={14} /></button>
            <span>Page {page} / {pages} · {d ? fmt(d.total) : '…'} résultats</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} aria-label="Page suivante"><I.arrow size={14} /></button>
          </div>
          {sel.size > 0 && (
            <div className="a-rise row wrap" style={{ position: 'sticky', bottom: 16, margin: '0 16px 16px', padding: '10px 10px 10px 16px', borderRadius: 18, background: 'var(--ink)', color: '#fff', boxShadow: '0 24px 48px -20px rgba(11,37,69,.7)', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{sel.size} sélectionnée(s)</span>
              <div className="grow" />
              {can(user, 'crm') && <BulkStatus onPick={(v) => bulk('status', v)} />}
              {can(user, 'crm') && <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#fff' }} onClick={() => bulk('assign', user!.id)}>M’assigner</button>}
              {can(user, 'crm') && <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#fff' }} onClick={() => bulk('analyze')}>Ré-analyser</button>}
              <button className="btn btn-sm" style={{ background: '#2E9BEA', color: '#fff' }} onClick={() => nav(`/entreprises/${[...sel][0]}`)}>Préparer le 1er message <I.arrow size={14} /></button>
              <button className="btn btn-sm icon-btn sm" style={{ background: 'rgba(255,255,255,.1)', color: '#fff' }} onClick={() => setSel(new Set())} aria-label="Tout désélectionner"><I.x size={14} /></button>
            </div>
          )}
        </section>
        {preview && <Preview id={preview} onClose={() => setPreview(null)} />}
      </div>

      {modal === 'add' && <AddCompany onClose={() => setModal(null)} onDone={(id) => { setModal(null); nav(`/entreprises/${id}`); }} defaultCity={f.city} />}
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} onDone={() => { setModal(null); list.reload(true); }} defaultCity={f.city} />}
      {modal === 'export' && <ExportModal onClose={() => setModal(null)} filters={{ ...f, view }} total={d?.total ?? 0} />}
    </Page>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <label style={{ flex: '0 1 170px' }}><span className="sr">{label}</span><select className="select" style={{ height: 38, fontSize: 13 }} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
function BulkStatus({ onPick }: { onPick: (v: string) => void }) {
  const { meta } = useMeta();
  return <label><span className="sr">Changer le statut</span><select className="select" style={{ height: 34, width: 170, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.25)', fontSize: 12 }} value="" onChange={(e) => e.target.value && onPick(e.target.value)}>
    <option value="" style={{ color: '#0B2545' }}>Changer le statut…</option>{meta?.crmStatuses.filter((s) => s.id !== 'do_not_contact').map((s) => <option key={s.id} value={s.id} style={{ color: '#0B2545' }}>{s.label}</option>)}</select></label>;
}

function Preview({ id, onClose }: { id: string; onClose: () => void }) {
  const { meta } = useMeta();
  const { data } = useApi<any>(`/api/companies/${id}`, [id]);
  const c = data?.company;
  const best = useMemo(() => {
    if (!data) return null;
    const k = data.contacts as any[];
    if (k.some((x) => x.kind === 'whatsapp')) return 'WhatsApp (publié par l’entreprise)';
    if (k.some((x) => x.kind === 'email')) return 'Email';
    if (k.some((x) => x.kind === 'phone' && x.phone_type === 'mobile')) return 'Appel mobile';
    if ((data.socials as any[]).some((s) => s.platform === 'facebook')) return 'Message sur la page Facebook';
    if (k.some((x) => x.kind === 'phone')) return 'Appel fixe';
    return 'Aucun canal : visite ou recherche manuelle';
  }, [data]);
  const tint = sectorTint(c?.sector);
  return (
    <aside className="card a-slide col" aria-label="Aperçu de l’entreprise" style={{ flex: '1 1 320px', maxWidth: 380, padding: 18, gap: 14, borderRadius: 22, position: 'sticky', top: 16 }}>
      {!c ? <><Skeleton h={48} /><Skeleton h={80} /><Skeleton h={120} /></> : <>
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <span className="mono-badge" style={{ width: 48, height: 48, borderRadius: 14, background: tint[0], color: tint[1], fontSize: 16 }}>{initials(c.name)}</span>
          <div className="col grow" style={{ gap: 3 }}><span className="display" style={{ fontSize: 18, fontWeight: 600 }}>{c.name}</span><span className="muted" style={{ fontSize: 12 }}>{sectorLabel(meta, c.sector)} · {c.city ?? '—'}</span>{c.is_demo && <DemoBadge />}</div>
          <button className="btn btn-ghost icon-btn sm" onClick={onClose} aria-label="Fermer l’aperçu"><I.x size={14} /></button>
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
          <div className="grow" style={{ padding: 12, borderRadius: 14, background: SEGMENTS[c.segment]?.bg }}><div style={{ fontSize: 11, fontWeight: 800, color: SEGMENTS[c.segment]?.ink }}>CASE</div><div style={{ fontSize: 14, fontWeight: 800, color: SEGMENTS[c.segment]?.ink, marginTop: 4 }}>{SEGMENTS[c.segment]?.label}</div></div>
          <div style={{ width: 96, padding: 12, borderRadius: 14, background: '#F4F9FF' }}><div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>SCORE</div><div className="display" style={{ fontSize: 22, fontWeight: 600 }}>{c.score ?? '—'}</div></div>
        </div>
        <div className="col" style={{ gap: 6 }}><span className="kicker" style={{ color: 'var(--muted)' }}>Argument d’approche</span><span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>{c.pitch_angle ?? 'Analyse en cours.'}</span></div>
        <div className="col" style={{ gap: 6 }}><span className="kicker" style={{ color: 'var(--muted)' }}>Meilleur canal</span><span className="row" style={{ padding: '10px 12px', borderRadius: 12, background: '#F4F9FF', fontSize: 13, fontWeight: 800 }}><span className="dot" style={{ background: 'var(--green)' }} />{best}</span></div>
        {data.score?.signals && <div className="col" style={{ gap: 4 }}><span className="kicker" style={{ color: 'var(--muted)' }}>Pourquoi ce score</span>{(data.score.signals as any[]).slice(1, 6).map((s) => <span key={s.id} className="row" style={{ fontSize: 12, gap: 8 }}><span style={{ width: 34, fontWeight: 800, color: s.points >= 0 ? 'var(--green-ink)' : 'var(--red)' }}>{s.points > 0 ? '+' : ''}{s.points}</span><span className="grow" style={{ color: 'var(--ink-2)' }}>{s.label}</span></span>)}</div>}
        <Link to={`/entreprises/${id}`} className="btn btn-primary">Ouvrir la fiche complète <I.arrow size={16} /></Link>
      </>}
    </aside>
  );
}

function AddCompany({ onClose, onDone, defaultCity }: { onClose: () => void; onDone: (id: string) => void; defaultCity?: string }) {
  const { meta } = useMeta();
  const toast = useToast();
  const [v, setV] = useState<Record<string, string>>({ cityId: defaultCity ?? 'el-jadida' });
  const [busy, setBusy] = useState(false);
  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string; created: boolean; matched: string | null; review: boolean }>('/api/companies', { body: { ...v, email: v.email || undefined } });
      toast(r.created ? (r.review ? 'Ajoutée. Un doublon possible est à valider.' : 'Entreprise ajoutée. Analyse en cours…') : 'Déjà connue : la fiche existante a été complétée.');
      onDone(r.id);
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };
  return (
    <Modal title="Ajouter une entreprise" onClose={onClose}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Repérée sur le terrain, sur Facebook ou par recommandation. Le Radar vérifie d’abord qu’elle n’existe pas déjà.</p>
      <label className="field">Nom de l’entreprise *<input className="input" value={v.name ?? ''} onChange={up('name')} autoFocus /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        <label className="field">Secteur<select className="select" value={v.sector ?? ''} onChange={up('sector')}><option value="">—</option>{meta?.sectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label className="field">Ville<select className="select" value={v.cityId ?? ''} onChange={up('cityId')}>{meta?.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field">Téléphone<input className="input" value={v.phone ?? ''} onChange={up('phone')} inputMode="tel" /></label>
        <label className="field">Email<input className="input" type="email" value={v.email ?? ''} onChange={up('email')} /></label>
        <label className="field">Site web<input className="input" value={v.website ?? ''} onChange={up('website')} placeholder="https://" /></label>
        <label className="field">Page Facebook<input className="input" value={v.facebook ?? ''} onChange={up('facebook')} placeholder="https://facebook.com/…" /></label>
        <label className="field">Instagram<input className="input" value={v.instagram ?? ''} onChange={up('instagram')} /></label>
        <label className="field">Lien WhatsApp publié<input className="input" value={v.whatsappLink ?? ''} onChange={up('whatsappLink')} placeholder="https://wa.me/212…" /></label>
      </div>
      <label className="field">Adresse<input className="input" value={v.address ?? ''} onChange={up('address')} /></label>
      <label className="field">Note<textarea className="textarea" rows={3} value={v.note ?? ''} onChange={up('note')} /></label>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={busy || !v.name || v.name.length < 2} onClick={save}>{busy ? 'Ajout…' : 'Ajouter'}</button></div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone, defaultCity }: { onClose: () => void; onDone: () => void; defaultCity?: string }) {
  const { meta } = useMeta();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [cityId, setCityId] = useState(defaultCity ?? '');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const go = async () => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    if (cityId) fd.append('cityId', cityId);
    fd.append('file', file);
    try { setRes(await api('/api/import', { form: fd })); toast('Import terminé.'); } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };
  return (
    <Modal title="Importer un fichier Excel ou CSV" onClose={onClose}>
      <div className="notice">Colonnes reconnues : <strong>Nom</strong> (obligatoire), Téléphone, Email, Site, Facebook, Instagram, WhatsApp, Ville, Secteur, Adresse. Les doublons sont détectés automatiquement ; chaque fiche garde la trace du fichier d’origine.</div>
      <label className="field">Ville par défaut (si la colonne est absente)<select className="select" value={cityId} onChange={(e) => setCityId(e.target.value)}><option value="">Lire la colonne « Ville »</option>{meta?.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="col" style={{ gap: 8, padding: 22, borderRadius: 16, border: '2px dashed #B9DBF5', background: '#F7FBFF', alignItems: 'center', cursor: 'pointer', textAlign: 'center' }}>
        <I.upload size={26} /><strong>{file ? file.name : 'Choisir un fichier .xlsx ou .csv'}</strong><span className="muted" style={{ fontSize: 12 }}>5 000 lignes maximum</span>
        <input type="file" accept=".xlsx,.csv" className="sr" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {res && <div className="notice" style={{ background: '#E6F6EE', color: '#0A6B45' }}><strong>{res.rows}</strong> lignes lues · <strong>{res.created}</strong> nouvelles · <strong>{res.matched}</strong> déjà connues (complétées) · {res.review} doublon(s) à valider · {res.skipped} ignorée(s)</div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>{res ? <button className="btn btn-primary" onClick={onDone}>Voir la liste</button> : <><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!file || busy} onClick={go}>{busy ? 'Import…' : 'Importer'}</button></>}</div>
    </Modal>
  );
}

function ExportModal({ onClose, filters, total }: { onClose: () => void; filters: Record<string, string>; total: number }) {
  const cols = useApi<{ columns: { id: string; label: string }[]; defaults: string[] }>('/api/export/columns');
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? cols.data?.defaults ?? [];
  const href = (format: string) => `/api/export${qs({ ...filters, format, columns: chosen.join(','), page: undefined, pageSize: undefined })}`;
  return (
    <Modal title="Exporter la liste" onClose={onClose} wide>
      <div className="notice">L’export reprend exactement les filtres actifs ({fmt(total)} entreprises, 5 000 maximum). Chaque coordonnée indique sa source et sa date. Les entreprises « ne pas contacter » sont exclues. L’export est journalisé.</div>
      <div className="row wrap" style={{ gap: 8 }}>
        {cols.data?.columns.map((c) => { const on = chosen.includes(c.id); return <button key={c.id} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setPicked(on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])}>{on && <I.check size={13} />}{c.label}</button>; })}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <a className="btn btn-ghost" href={href('csv')} onClick={() => setTimeout(onClose, 300)}><I.download size={16} />CSV</a>
        <a className="btn btn-primary" href={href('xlsx')} onClick={() => setTimeout(onClose, 300)}><I.download size={16} />Excel (.xlsx)</a>
      </div>
    </Modal>
  );
}
