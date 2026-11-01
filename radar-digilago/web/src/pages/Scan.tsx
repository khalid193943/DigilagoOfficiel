import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { I } from '../components/Icons';
import { Page } from '../components/Shell';
import { DemoBadge, Empty, SourceBadge, useToast } from '../components/ui';
import { api } from '../lib/api';
import { can, useAuth } from '../lib/auth';
import { ago, fmt } from '../lib/format';
import { COAST, rectAround } from '../lib/geo';
import { useApi, useCountUp, useDebounced } from '../lib/hooks';
import { useLive } from '../lib/live';
import { useMeta } from '../lib/meta';

type Tile = { id: string; source: string; label: string; south: number; west: number; north: number; east: number; depth: number; status: string; results: number };
type Job = { id: string; label: string; status: string; params: any; counters: any; progress: any; log: { at: string; tag: string; msg: string }[]; coverage_note: string | null; est_cost: string | null; created_at: string; started_at: string | null; finished_at: string | null; source_reports: any[] };
type Estimate = { tiles: number; requests: number; cost: number; perSource: { source: string; label: string; requests: number; cost: number; enabled: boolean }[] };

const STATUS: Record<string, [string, string, string]> = {
  pending: ['En attente', '#EEF2F6', '#33445C'], running: ['En cours', '#E3F1FC', '#084E8A'], done: ['Complet', '#E6F6EE', '#0A6B45'],
  partial: ['Partiel', '#FFF1E4', '#8A3E00'], error: ['Erreur', '#FDECEA', '#B42318'], cancelled: ['Annulé', '#EEF2F6', '#33445C'],
};
const TAG_COLOR: Record<string, string> = { GOOGLE: '#5AB4F2', OSM: '#8EE0B8', 'DÉMO': '#F7B27A', DÉPART: '#8EC5F0', FIN: '#8EE0B8', QUOTA: '#F7B27A', ERREUR: '#FF9B91', BUDGET: '#F7B27A', ARRÊT: '#C9D6E4' };

export function Scan() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { meta } = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const history = useApi<Job[]>('/api/scans');
  const jobApi = useApi<{ job: Job; tiles: Tile[]; analysis: { pending: number; done: number } }>(id ? `/api/scans/${id}` : null, [id]);
  const job = jobApi.data?.job;
  const live = job && ['pending', 'running'].includes(job.status);
  useEffect(() => { if (!live) return; const t = setInterval(() => jobApi.reload(true), 1200); return () => clearInterval(t); }, [live]); // eslint-disable-line
  useEffect(() => { if (job && !live) history.reload(true); }, [job?.status]); // eslint-disable-line
  useLive((e) => { if (e.type === 'scan') { if (e.id === id) jobApi.reload(true); history.reload(true); } });

  // ----- configuration -----
  const [cityId, setCityId] = useState(sp.get('city') ?? 'el-jadida');
  const [region, setRegion] = useState<string>('');
  const [sectors, setSectors] = useState<string[]>(['sante', 'education', 'beaute', 'construction', 'services_pro']);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kw, setKw] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [mode, setMode] = useState<'quick' | 'full'>('full');
  const [analyze, setAnalyze] = useState(true);
  const [budget, setBudget] = useState(400);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (meta && !sources.length) setSources(meta.sources.filter((s) => s.enabled).map((s) => s.id)); }, [meta]); // eslint-disable-line
  useEffect(() => { if (job) { setCityId(job.params.cityId); setSectors(job.params.sectors); setKeywords(job.params.keywords); setSources(job.params.sources); setMode(job.params.mode); } }, [job?.id]); // eslint-disable-line
  const city = meta?.cities.find((c) => c.id === cityId);
  useEffect(() => { if (city) setRegion(city.region); }, [city?.id]); // eslint-disable-line

  const estKey = useDebounced(JSON.stringify({ cityId, sectors, keywords, sources, mode }), 250);
  const [est, setEst] = useState<Estimate | null>(null);
  useEffect(() => { const b = JSON.parse(estKey); if (!b.sources.length) return; api<Estimate>('/api/scans/estimate', { body: b }).then(setEst).catch(() => setEst(null)); }, [estKey]);

  const launch = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/scans', { body: { cityId, sectors, keywords, sources, mode, analyze, maxRequests: budget } });
      toast('Balayage lancé. Les entreprises arrivent en direct.');
      nav(`/balayages/${r.id}`);
      history.reload(true);
    } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  };
  const cancel = async () => { if (!id) return; await api(`/api/scans/${id}/cancel`, { method: 'POST' }); toast('Balayage arrêté.'); jobApi.reload(true); };

  // ----- vue de zone -----
  const tiles = jobApi.data?.tiles ?? [];
  const zone = useMemo(() => {
    if (!city) return null;
    // Vue au format 2:1 : toutes les tuiles visibles, avec la mer et la terre autour
    const half = city.radiusKm * 1.22, k = Math.cos((city.lat * Math.PI) / 180);
    const dLat = half / 111.32, dLon = (half * 2) / (111.32 * k);
    const r = { south: city.lat - dLat, north: city.lat + dLat, west: city.lon - dLon, east: city.lon + dLon };
    const W = 1000, H = 500;
    const X = (lon: number) => ((lon - r.west) / (r.east - r.west)) * W, Y = (lat: number) => ((r.north - lat) / (r.north - r.south)) * H;
    const coast = COAST.map((poly) => 'M' + poly.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join(' L') + 'Z').join(' ');
    const plan = rectAround(city.lat, city.lon, city.radiusKm);
    const n = mode === 'quick' ? 1 : Math.max(1, Math.min(6, Math.ceil((city.radiusKm * 2) / 4)));
    const preview: { x: number; y: number; w: number; h: number; label: string }[] = [];
    const ROWS = 'ABCDEFGH';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const s = plan.south + (i * (plan.north - plan.south)) / n, no = plan.south + ((i + 1) * (plan.north - plan.south)) / n;
      const w = plan.west + (j * (plan.east - plan.west)) / n, e = plan.west + ((j + 1) * (plan.east - plan.west)) / n;
      preview.push({ x: X(w), y: Y(no), w: X(e) - X(w), h: Y(s) - Y(no), label: n === 1 ? 'Zone' : `${ROWS[n - 1 - i]}${j + 1}` });
    }
    return { W, H, X, Y, coast, preview };
  }, [city, mode]);
  const mainSource = job ? (job.params.sources.find((s: string) => s !== 'osm') ?? job.params.sources[0]) : null;
  const shownTiles = tiles.filter((t) => t.source === mainSource);
  const points = useApi<{ points: [number, number, number][] }>(job ? '/api/map/points' : null, [job?.progress?.found]);
  const zonePoints = useMemo(() => {
    if (!zone || !city || !points.data) return [];
    const half = city.radiusKm * 1.22, k = Math.cos((city.lat * Math.PI) / 180);
    const r = { south: city.lat - half / 111.32, north: city.lat + half / 111.32, west: city.lon - (half * 2) / (111.32 * k), east: city.lon + (half * 2) / (111.32 * k) };
    return points.data.points.filter(([la, lo]) => la > r.south && la < r.north && lo > r.west && lo < r.east).slice(0, 1500);
  }, [points.data, zone, city]);

  const found = useCountUp(job?.progress?.found ?? 0, 600), fresh = useCountUp(job?.progress?.fresh ?? 0, 600);
  const pctDone = job?.progress?.tiles_total ? Math.round((job.progress.tiles_done / job.progress.tiles_total) * 100) : 0;
  const running = job?.status === 'running' || job?.status === 'pending';
  const enabledSources = meta?.sources ?? [];
  const regions = meta?.regions ?? [];
  const citiesInRegion = (meta?.cities ?? []).filter((c) => !region || c.region.replace('’', "'") === region.replace('’', "'"));
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const allowed = can(user, 'search');
  const locked = running || !allowed;

  return (
    <Page>
      <div className="page-head">
        <div className="col" style={{ gap: 4 }}>
          <span className="kicker">{job ? 'Balayage' : 'Nouveau balayage'}</span>
          <h1>Balayer <strong>{city?.name ?? '…'}</strong>, rue par rue.</h1>
        </div>
        <div className="grow" />
        {job && <Link to="/balayages" className="btn btn-ghost"><I.plus size={16} />Nouveau balayage</Link>}
        <span className="muted" style={{ fontSize: 13, maxWidth: 420 }}>La zone est découpée en tuiles. Une tuile trop dense est redécoupée automatiquement : rien n’est oublié.</span>
      </div>
      {!allowed && <div className="notice">Votre rôle permet de consulter les balayages, pas d’en lancer.</div>}

      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 18 }}>
        {/* Configuration */}
        <section aria-label="Paramètres du balayage" className="col" style={{ flex: '1 1 420px', gap: 14 }}>
          <Step n={1} title="Zone" right={<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-ink)' }}>{est ? `${est.tiles} tuile(s)` : ''}</span>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
              <label className="field">Région<select className="select" value={region} disabled={locked} onChange={(e) => { setRegion(e.target.value); const c = meta?.cities.find((x) => x.region.replace('’', "'") === e.target.value.replace('’', "'")); if (c) setCityId(c.id); }}>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
              <label className="field">Ville / zone<select className="select" value={cityId} disabled={locked} onChange={(e) => setCityId(e.target.value)}>
                {citiesInRegion.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.radiusKm} km</option>)}</select></label>
            </div>
          </Step>
          <Step n={2} title="Secteurs & métiers" right={<button className="btn btn-ghost btn-sm" disabled={locked} onClick={() => setSectors(sectors.length === meta?.sectors.length ? [] : meta?.sectors.map((s) => s.id) ?? [])}>{sectors.length === meta?.sectors.length ? 'Tout retirer' : 'Tout sélectionner'}</button>}>
            <div className="row wrap" style={{ gap: 8 }}>
              {meta?.sectors.map((s) => {
                const on = sectors.includes(s.id);
                return <button key={s.id} className={`chip${on ? ' on' : ''}`} disabled={locked} aria-pressed={on} onClick={() => setSectors(toggle(sectors, s.id))}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--sky)' : '#fff', border: `1.5px solid ${on ? 'var(--sky)' : '#B9CCE0'}`, color: '#fff' }}>{on && <I.check size={11} />}</span>
                  {s.label}{s.priority && <span title="Secteur prioritaire" style={{ color: 'var(--orange)' }}>★</span>}</button>;
              })}
            </div>
            <label className="field">Métiers ou mots-clés précis
              <div className="row wrap" style={{ gap: 6, minHeight: 44, padding: '6px 8px', borderRadius: 12, border: '1px solid var(--line-2)', background: '#F7FBFF' }}>
                {keywords.map((k) => <span key={k} className="pill" style={{ background: 'var(--sky-bg)', color: 'var(--sky-ink)' }}>{k}<button aria-label={`Retirer ${k}`} disabled={locked} onClick={() => setKeywords(keywords.filter((x) => x !== k))} style={{ border: 0, background: 'transparent', padding: 0, color: 'inherit' }}><I.x size={12} /></button></span>)}
                <input value={kw} disabled={locked} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ',') && kw.trim()) { e.preventDefault(); setKeywords([...new Set([...keywords, kw.trim()])]); setKw(''); } }}
                  placeholder="ex. école privée, مدرسة خاصة… puis Entrée" style={{ flex: 1, minWidth: 140, border: 0, outline: 'none', background: 'transparent', fontSize: 13, textTransform: 'none', letterSpacing: 0, fontWeight: 600 }} />
              </div>
            </label>
          </Step>
          <Step n={3} title="Sources">
            {enabledSources.map((s) => {
              const on = sources.includes(s.id), dis = !s.enabled || locked;
              return (
                <button key={s.id} className="row" disabled={dis} aria-pressed={on} onClick={() => setSources(toggle(sources, s.id))}
                  style={{ padding: '10px 12px', borderRadius: 14, border: `1px solid ${on ? '#B9DBF5' : '#EEF3F8'}`, background: on ? '#F5FAFF' : '#fff', textAlign: 'left', gap: 12 }}>
                  <SourceBadge id={s.id} />
                  <span className="grow col" style={{ gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{s.label}</span><span className="muted" style={{ fontSize: 12 }}>{s.enabled ? s.coverageNote : s.requiresKey ? 'Clé API à ajouter dans la configuration du serveur (voir Paramètres).' : 'Source désactivée.'}</span></span>
                  <span className="pill" style={{ fontSize: 11, background: s.enabled ? (s.id === 'demo' ? '#FFF1E4' : '#E6F6EE') : '#FFF1E4', color: s.enabled ? (s.id === 'demo' ? '#8A3E00' : '#0A6B45') : '#8A3E00' }}>{!s.enabled ? (s.requiresKey ? 'Clé requise' : 'Désactivée') : s.id === 'demo' ? 'Fictif' : s.costPerRequest ? `${s.usedToday}/${s.dailyLimit} auj.` : 'Gratuit'}</span>
                  <span aria-hidden="true" style={{ width: 42, height: 24, flexShrink: 0, borderRadius: 12, background: on ? 'var(--sky)' : '#C9D6E4', display: 'flex', alignItems: 'center', padding: 2, justifyContent: on ? 'flex-end' : 'flex-start', transition: 'all .2s' }}><span style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.25)' }} /></span>
                </button>
              );
            })}
            {meta?.plannedSources.map((s) => (
              <div key={s.id} className="row" style={{ padding: '8px 12px', borderRadius: 14, border: '1px dashed #DCE6F0', gap: 12, opacity: 0.75 }}>
                <span className="mono-badge" style={{ background: '#F2F5F9', color: '#7A8899' }}>{s.mono}</span>
                <span className="grow col" style={{ gap: 2 }}><span style={{ fontSize: 13, fontWeight: 800 }}>{s.label}</span><span className="muted" style={{ fontSize: 12 }}>{s.note}</span></span>
                <span className="pill" style={{ fontSize: 11, background: '#F2F5F9', color: '#4A5A70' }}>À venir</span>
              </div>
            ))}
          </Step>
          <Step n={4} title="Mode">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
              {([['quick', 'Rapide', 'Un seul passage pour tester'], ['full', 'Balayage complet', 'Tuiles + redécoupage automatique']] as const).map(([m, t, s]) => (
                <button key={m} disabled={locked} aria-pressed={mode === m} onClick={() => setMode(m)} style={{ textAlign: 'left', padding: 14, borderRadius: 14, border: `2px solid ${mode === m ? 'var(--sky)' : 'var(--line)'}`, background: mode === m ? 'var(--sky-bg)' : '#fff' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: mode === m ? 'var(--sky)' : 'var(--ink)' }}>{t}</div><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s}</div></button>
              ))}
            </div>
            <label className="row" style={{ fontSize: 13, fontWeight: 600 }}><input type="checkbox" className="check" checked={analyze} disabled={locked} onChange={(e) => setAnalyze(e.target.checked)} />Analyser aussitôt les sites et les fiches Google (diagnostic)</label>
            <label className="field">Budget maximum : {budget} requêtes<input type="range" min={20} max={2000} step={20} value={budget} disabled={locked} onChange={(e) => setBudget(Number(e.target.value))} style={{ accentColor: 'var(--sky)' }} /></label>
          </Step>
        </section>

        {/* Zone + exécution */}
        <section className="col" style={{ flex: '999 1 560px', minWidth: 0, gap: 14 }}>
          <div className="card" style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, boxShadow: 'var(--shadow)' }}>
            <div className="row wrap" style={{ position: 'absolute', zIndex: 2, left: 16, top: 16, right: 16, gap: 8 }}>
              <span className="pill" style={{ height: 34, background: 'rgba(255,255,255,.92)', border: '1px solid var(--line)', fontSize: 13 }}>
                <span className={`dot${running ? ' a-blink' : ''}`} style={{ background: running ? '#0B9BE8' : job ? STATUS[job.status]?.[2] : '#A7B4C6' }} />
                {job ? `${STATUS[job.status]?.[0]} · ${city?.name}` : `Prêt · ${city?.name ?? ''}`}</span>
              <div className="grow" />
              {[['#0B6FC2', 'Balayée'], ['#F07D1A', 'Redécoupée'], ['#8EC5F0', 'En cours']].map(([c, l]) => <span key={l} className="pill" style={{ background: 'rgba(255,255,255,.92)', fontSize: 11 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>)}
            </div>
            {zone && (
              <svg viewBox={`0 0 ${zone.W} ${zone.H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Zone de ${city?.name} découpée en tuiles`} style={{ display: 'block', width: '100%', height: 'auto' }}>
                <defs>
                  <pattern id="sc-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.4" fill="#C9E0F4" /></pattern>
                  <linearGradient id="sc-sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#CFE6FA" /><stop offset="1" stopColor="#E4F1FC" /></linearGradient>
                  <linearGradient id="sc-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B9BE8" stopOpacity="0" /><stop offset="1" stopColor="#0B9BE8" stopOpacity=".5" /></linearGradient>
                  <clipPath id="sc-clip"><rect width={zone.W} height={zone.H} /></clipPath>
                </defs>
                <rect width={zone.W} height={zone.H} fill="url(#sc-sea)" />
                <g clipPath="url(#sc-clip)"><path d={zone.coast} fill="#FBFDFF" stroke="#8EC5F0" strokeWidth="3" /><path d={zone.coast} fill="url(#sc-dots)" /></g>
                {!job && zone.preview.map((t) => <g key={t.label}><rect x={t.x + 2} y={t.y + 2} width={t.w - 4} height={t.h - 4} rx="8" fill="#fff" fillOpacity=".25" stroke="#7FA6C9" strokeWidth="2" strokeDasharray="6 5" /><text x={t.x + 12} y={t.y + 24} fontFamily="Sora" fontSize="14" fontWeight="700" fill="#4A6F94">{t.label}</text></g>)}
                {shownTiles.map((t) => {
                  const x = zone.X(t.west), y = zone.Y(t.north), w = zone.X(t.east) - x, h = zone.Y(t.south) - y;
                  const S: Record<string, [string, number, string, string]> = { done: ['#0B6FC2', 0.13, '#0B6FC2', 'none'], partial: ['#F07D1A', 0.1, '#F07D1A', '4 3'], split: ['#F07D1A', 0.08, '#F07D1A', 'none'], running: ['#0B9BE8', 0.2, '#0B9BE8', 'none'], todo: ['#fff', 0.15, '#7FA6C9', '6 5'], error: ['#B42318', 0.1, '#B42318', '4 3'] };
                  const st = S[t.status] ?? S.todo;
                  return (
                    <g key={t.id}>
                      <rect x={x + 2} y={y + 2} width={Math.max(0, w - 4)} height={Math.max(0, h - 4)} rx={t.depth ? 5 : 8} fill={st[0]} fillOpacity={st[1]} stroke={st[2]} strokeWidth="2" strokeDasharray={st[3]} style={{ transition: 'all .4s ease' }} />
                      {t.status === 'running' && <rect x={x + 2} y={y + 2} width={Math.max(0, w - 4)} height="16" fill="url(#sc-beam)" style={{ animation: 'scanline 1.4s ease-in-out infinite', ['--h' as any]: `${h - 20}px` }} />}
                      {t.depth === 0 && <text x={x + 12} y={y + 24} fontFamily="Sora" fontSize="14" fontWeight="700" fill={t.status === 'todo' ? '#5B7590' : t.status === 'split' ? '#8A3E00' : '#084E8A'}>{t.label}{t.status === 'split' ? ' · saturée' : t.status === 'done' || t.status === 'partial' ? ` · ${t.results}` : ''}</text>}
                    </g>
                  );
                })}
                {zonePoints.map(([la, lo, seg], i) => <circle key={i} cx={zone.X(lo)} cy={zone.Y(la)} r="4" fill={seg === 1 ? '#F07D1A' : '#0B6FC2'} stroke="#fff" strokeWidth="1.2" style={{ animation: `rise .5s ${Math.min(i * 4, 900)}ms both` }} />)}
              </svg>
            )}
            {job && (
              <div className="row wrap" style={{ position: 'absolute', zIndex: 2, left: 16, bottom: 16, gap: 8 }}>
                {[['Tuiles', `${job.progress?.tiles_done ?? 0} / ${job.progress?.tiles_total ?? 0}`, '#fff'], ['Fiches', fmt(found), '#fff'], ['Nouvelles', fmt(fresh), '#8EE0B8']].map(([l, v, c]) => (
                  <span key={l} style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(11,37,69,.88)', color: '#fff', fontSize: 12, fontWeight: 700 }}>{l} <strong className="display" style={{ fontSize: 14, color: c }}>{v}</strong></span>
                ))}
              </div>
            )}
          </div>

          {!job && est && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                ['Requêtes estimées', `≈ ${fmt(Math.min(est.requests, budget))}`, `${est.perSource.length} source(s) · plafond ${budget}`],
                ['Coût estimé', est.cost ? `≈ ${(Math.min(est.cost, budget * Math.max(...est.perSource.map((s) => s.requests ? s.cost / s.requests : 0)))).toFixed(2).replace('.', ',')} $` : '0 $', est.cost ? 'selon le coût par requête configuré' : 'sources gratuites ou fictives'],
                ['Durée estimée', `≈ ${Math.max(1, Math.round(Math.min(est.requests, budget) / 25))} min`, 'requêtes espacées, quotas respectés'],
                ['Tuiles', String(est.tiles), mode === 'full' ? 'redécoupées si saturées' : 'un seul passage'],
              ].map(([l, v, s]) => <div key={l} className="card" style={{ padding: '14px 16px' }}><div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{l}</div><div className="display" style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{v}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{s}</div></div>)}
            </div>
          )}

          <div className="row wrap" style={{ gap: 12 }}>
            {!job && allowed && <button className="btn btn-primary btn-lg" style={{ minWidth: 240 }} disabled={busy || !sources.length || (!sectors.length && !keywords.length)} onClick={launch}>{busy ? 'Lancement…' : 'Lancer le balayage'}</button>}
            {job && running && allowed && <button className="btn btn-dark btn-lg" onClick={cancel}>Arrêter le balayage</button>}
            {job && !running && <Link className="btn btn-primary btn-lg" to={`/entreprises?city=${job.params.cityId}&view=all&sort=recent`}>Voir les entreprises <I.arrow size={16} /></Link>}
            {job && !running && allowed && <button className="btn btn-ghost btn-lg" onClick={async () => { const r = await api<{ id: string }>(`/api/scans/${job.id}/rerun`, { method: 'POST' }); nav(`/balayages/${r.id}`); }}><I.refresh size={16} />Relancer</button>}
            {job && (
              <div className="grow col" style={{ gap: 6, minWidth: 220 }}>
                <div className="progress"><span style={{ width: `${running ? pctDone : 100}%` }} /></div>
                <span className="muted" style={{ fontSize: 12 }}>{running ? `${pctDone} % des tuiles` : job.coverage_note}{jobApi.data?.analysis?.pending ? ` · ${jobApi.data.analysis.pending} analyse(s) de sites en cours` : ''}</span>
              </div>
            )}
            {sources.includes('demo') && !job && <span className="row" style={{ gap: 6, fontSize: 12, color: 'var(--orange-ink)' }}><DemoBadge />La source démo crée des entreprises fictives.</span>}
          </div>

          <div className="console" style={{ minHeight: 200 }} aria-live="polite">
            <div className="row" style={{ marginBottom: 4, fontFamily: 'var(--body)' }}><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#8EC5F0' }}>JOURNAL DU BALAYAGE</span><div className="grow" />{job?.est_cost && Number(job.est_cost) > 0 && <span style={{ fontSize: 11, color: '#7FA6C9' }}>coût estimé : {Number(job.est_cost).toFixed(2)} $</span>}</div>
            {(job?.log ?? []).slice(-9).map((l, i) => (
              <div key={`${l.at}-${i}`} className="line"><span style={{ color: '#5E86AD', flexShrink: 0 }}>{new Date(l.at).toLocaleTimeString('fr-FR')}</span><span style={{ color: TAG_COLOR[l.tag] ?? '#C9D6E4', fontWeight: 700, flexShrink: 0, width: 92 }}>{l.tag}</span><span style={{ color: '#E7F2FC' }}>{l.msg}</span></div>
            ))}
            {!job && <div className="line"><span style={{ color: '#5E86AD' }}>--:--:--</span><span style={{ color: '#8EC5F0', fontWeight: 700, width: 92 }}>PRÊT</span><span>Choisissez vos secteurs et vos sources, puis lancez le balayage.</span></div>}
            <span style={{ color: '#5AB4F2' }}><span className="a-caret">▌</span></span>
          </div>
        </section>
      </div>

      {/* Historique */}
      <section className="card" style={{ borderRadius: 24 }}>
        <div className="row" style={{ padding: '16px 18px 4px' }}><h2 className="panel-title grow">Historique des balayages</h2></div>
        {history.data && history.data.length === 0 && <Empty title="Aucun balayage pour l’instant" />}
        <div className="table-wrap">
          <table className="data" style={{ minWidth: 760 }}>
            <thead><tr><th>Balayage</th><th>Statut</th><th>Sources</th><th>Fiches</th><th>Nouvelles</th><th>À valider</th><th>Quand</th></tr></thead>
            <tbody>
              {(history.data ?? []).map((h) => {
                const st = STATUS[h.status] ?? STATUS.pending;
                return (
                  <tr key={h.id} className={`clickable${h.id === id ? ' selected' : ''}`} onClick={() => nav(`/balayages/${h.id}`)}>
                    <td><Link to={`/balayages/${h.id}`} style={{ fontWeight: 800, color: 'var(--ink)' }}>{h.label}</Link><div className="muted" style={{ fontSize: 12 }}>{h.params?.mode === 'quick' ? 'Rapide' : 'Complet'}</div></td>
                    <td><span className="pill" style={{ background: st[1], color: st[2] }}>{st[0]}</span></td>
                    <td><div className="row" style={{ gap: 4 }}>{(h.params?.sources ?? []).map((s: string) => <SourceBadge key={s} id={s} size={26} />)}</div></td>
                    <td className="display" style={{ fontWeight: 600 }}>{fmt(h.counters?.found ?? 0)}</td>
                    <td style={{ color: 'var(--green-ink)', fontWeight: 800 }}>+{fmt(h.counters?.created ?? 0)}</td>
                    <td>{fmt(h.counters?.review ?? 0)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{ago(h.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}

function Step({ n, title, right, children }: { n: number; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card col" style={{ padding: 18, gap: 12 }}>
      <div className="row"><span style={{ width: 26, height: 26, borderRadius: 9, background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{n}</span><h2 className="panel-title grow" style={{ fontSize: 15 }}>{title}</h2>{right}</div>
      {children}
    </div>
  );
}
