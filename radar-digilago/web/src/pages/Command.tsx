import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { I } from '../components/Icons';
import { RadarMap, type MapLayer } from '../components/RadarMap';
import { TopBar } from '../components/Shell';
import { DemoBadge, Donut, Empty, SourceBadge, Spark } from '../components/ui';
import { can, useAuth } from '../lib/auth';
import { ago, fmt, fmtK, pct, SEG_ORDER, SEGMENTS } from '../lib/format';
import { useApi, useCountUp } from '../lib/hooks';
import { useLive, type LiveEvent } from '../lib/live';
import { sectorLabel, useMeta } from '../lib/meta';

type City = { id: string; name: string; region: string; lat: number; lon: number; n: number; contactable: number; noSite: number; analyzed: number; new7: number; cases: number[]; sectors: { id: string; label: string; n: number }[]; lastScan: string | null; tilesDone: number; tilesTotal: number };
type Dash = { kpis: Record<string, number>; daily: { d: string; n: number }[]; cities: City[]; sources: { source: string; n: number; uniq: number }[]; running: { id: string; params: any; progress: any; status: string }[]; usage: { source: string; requests: number; cost: number }[] };
type FeedItem = { id: string; name: string; city: string | null; sector: string | null; segment: string; is_demo: boolean; created_at: string; source: string; lat: number | null; lon: number | null; fresh?: boolean };

const LAYERS: { id: MapLayer; label: string; swatch: string; title: string; bar: string; lo: string; hi: string }[] = [
  { id: 'density', label: 'Densité', swatch: '#0B6FC2', title: 'ENTREPRISES DÉTECTÉES', bar: 'linear-gradient(90deg, #CFE4F7, #3E97E0, #0A5DAE)', lo: 'Peu', hi: 'Beaucoup' },
  { id: 'opportunity', label: 'Opportunités', swatch: '#F07D1A', title: 'PART SANS SITE TROUVÉ', bar: 'linear-gradient(90deg, #FBE3CC, #F7B27A, #B44F00)', lo: 'Faible', hi: 'Forte' },
  { id: 'coverage', label: 'Couverture', swatch: '#8EC5F0', title: 'ZONES BALAYÉES', bar: 'linear-gradient(90deg, #C9D6E4 0 33%, #8EC5F0 33% 66%, #0B6FC2 66%)', lo: 'Jamais', hi: 'Complète' },
];

export function Command() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const nav = useNavigate();
  const dash = useApi<Dash>('/api/dashboard', [], { interval: 60000 });
  const map = useApi<{ points: [number, number, number][]; tiles: [number, number, number, number, number][] }>('/api/map/points');
  const feedApi = useApi<FeedItem[]>('/api/feed?limit=12');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [layer, setLayer] = useState<MapLayer>('density');
  const [zoom, setZoom] = useState(1);
  const [cityId, setCityId] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<{ label: string; text: string } | null>(null);
  const [liveBlips, setLiveBlips] = useState<{ lat: number; lon: number; hot: boolean; key: string }[]>([]);
  const reloadT = useRef<number>();

  useEffect(() => { if (feedApi.data) setFeed(feedApi.data); }, [feedApi.data]);
  const d = dash.data;
  const cities = d?.cities ?? [];
  useEffect(() => {
    if (!cityId && cities.length) setCityId([...cities].sort((a, b) => b.n - a.n)[0].n > 0 ? [...cities].sort((a, b) => b.n - a.n)[0].id : 'el-jadida');
  }, [cities, cityId]);
  const sel = cities.find((c) => c.id === cityId) ?? cities.find((c) => c.id === 'el-jadida');

  const scheduleReload = () => {
    window.clearTimeout(reloadT.current);
    reloadT.current = window.setTimeout(() => { dash.reload(true); map.reload(true); }, 1500);
  };
  useLive((e: LiveEvent) => {
    if (e.type === 'company') {
      const item: FeedItem = { id: e.id, name: e.name, city: e.city, sector: e.sector, segment: 'unknown', is_demo: e.source === 'demo', created_at: new Date().toISOString(), source: e.source, lat: null, lon: null, fresh: true };
      setFeed((f) => [item, ...f.filter((x) => x.id !== item.id)].slice(0, 12));
      const c = cities.find((x) => x.name === e.city);
      if (c) setLiveBlips((b) => [...b.slice(-24), { lat: c.lat + (Math.random() - 0.5) * 0.06, lon: c.lon + (Math.random() - 0.5) * 0.06, hot: true, key: e.id }]);
      scheduleReload();
    } else if (e.type === 'scan') {
      const p = e.progress ?? {};
      setScanInfo(e.status === 'running' ? { label: 'BALAYAGE EN COURS', text: `tuiles ${p.tiles_done ?? 0}/${p.tiles_total ?? '?'} · ${p.found ?? 0} fiches · ${p.fresh ?? 0} nouvelles` } : { label: 'BALAYAGE TERMINÉ', text: `${p.found ?? 0} fiches · ${p.fresh ?? 0} nouvelles` });
      scheduleReload();
    } else if (e.type === 'analysis') {
      setFeed((f) => f.map((x) => (x.id === e.id ? { ...x, segment: e.segment } : x)));
      scheduleReload();
    }
  });

  const blips = useMemo(() => {
    const pts = map.data?.points ?? [];
    const step = Math.max(1, Math.floor(pts.length / 36));
    const base = pts.filter((_, i) => i % step === 0).slice(0, 36).map(([lat, lon, seg], i) => ({ lat, lon, hot: seg === 1, key: `p${i}` }));
    return [...base, ...liveBlips];
  }, [map.data, liveBlips]);

  const ranked = [...cities].sort((a, b) => b.n - a.n);
  const majors = new Set(ranked.filter((c) => c.n > 0).slice(0, 7).map((c) => c.id));
  const metricOf = (c: City) => layer === 'density' ? `${fmt(c.n)} entreprises` : layer === 'opportunity' ? (c.analyzed ? `${pct(c.noSite, c.analyzed)} % sans site` : 'à analyser') : (c.tilesTotal ? `${pct(c.tilesDone, c.tilesTotal)} % balayé` : 'jamais balayée');
  const pins = cities.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lon: c.lon, n: c.n, metric: metricOf(c), selected: c.id === sel?.id, major: majors.has(c.id), onClick: () => setCityId(c.id) }));
  const arcs = sel ? ranked.filter((c) => c.id !== sel.id && c.n > 0).slice(0, 6) : [];

  const k = d?.kpis ?? {};
  const total = useCountUp(k.total ?? 0), contact = useCountUp(k.contactable ?? 0), noSite = useCountUp(k.no_site ?? 0), new7 = useCountUp(k.new7 ?? 0), wa = useCountUp(k.whatsapp ?? 0);
  const zonesScanned = cities.filter((c) => c.tilesDone > 0).length;
  const spark = d?.daily.map((x) => x.n) ?? [];
  const L = LAYERS.find((l) => l.id === layer)!;
  const running = d?.running?.[0];
  const ticker = scanInfo ?? (running ? { label: 'BALAYAGE EN COURS', text: `${running.params?.cityId ?? ''} · tuiles ${running.progress?.tiles_done ?? 0}/${running.progress?.tiles_total ?? '?'} · ${running.progress?.found ?? 0} fiches` } : null);
  const isEmpty = d && (k.total ?? 0) === 0;

  const selC = useCountUp(sel?.n ?? 0, 900), selContact = useCountUp(sel?.contactable ?? 0, 900), selNew = useCountUp(sel?.new7 ?? 0, 900);

  return (
    <div className="cmd">
      {sel && <RadarMap points={map.data?.points ?? []} tiles={map.data?.tiles ?? []} layer={layer} focus={{ lat: sel.lat, lon: sel.lon }} zoom={zoom} pins={pins} arcs={arcs} blips={blips} />}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 140, background: 'linear-gradient(#EEF4FA, rgba(238,244,250,0))', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, background: 'linear-gradient(rgba(238,244,250,0), #EEF4FA 70%)', pointerEvents: 'none' }} />

      <div className="cmd-fg">
        <TopBar />
        <div className="cmd-mid">
          {/* Flux en direct */}
          <aside className="glass" aria-label="Détections en direct" style={{ flex: '1 1 300px', maxWidth: 340, minWidth: 270, display: 'flex', flexDirection: 'column', gap: 4, padding: 16, borderRadius: 24, overflow: 'hidden' }}>
            <div className="row" style={{ justifyContent: 'space-between', padding: '2px 4px 8px' }}>
              <div><h2 className="panel-title">Flux en direct</h2><span className="muted" style={{ fontSize: 12 }}><strong style={{ color: 'var(--ink)' }}>{fmt(k.new1 ?? 0)}</strong> détections en 24 h</span></div>
              <span className="pill" style={{ background: '#E3F1FC', color: '#084E8A', fontSize: 11 }}><span className="dot a-blink" style={{ background: '#0B9BE8', width: 7, height: 7 }} />LIVE</span>
            </div>
            {feed.length === 0 && <div className="muted" style={{ padding: 12, fontSize: 13 }}>Aucune détection pour l’instant. Les nouvelles entreprises apparaîtront ici en direct pendant les balayages.</div>}
            {feed.slice(0, 7).map((f, i) => {
              const s = SEGMENTS[f.segment] ?? SEGMENTS.unknown;
              return (
                <Link key={f.id} to={`/entreprises/${f.id}`} className={f.fresh && i === 0 ? 'a-drop' : ''} style={{ display: 'flex', gap: 12, padding: i === 0 ? 12 : '10px 12px', borderRadius: 14, color: 'var(--ink)', background: i === 0 ? '#fff' : 'transparent', boxShadow: i === 0 ? '0 10px 24px -14px rgba(11,111,194,.5)' : 'none', opacity: 1 - i * 0.08 }}>
                  <SourceBadge id={f.source ?? 'manual'} size={i === 0 ? 38 : 34} />
                  <span className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="row" style={{ justifyContent: 'space-between', gap: 6 }}><span className="ellipsis" style={{ fontSize: 13, fontWeight: 800 }}>{f.name}</span>{i === 0 && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green-ink)' }}>NOUVEAU</span>}</span>
                    <span className="row" style={{ gap: 6, fontSize: 11, color: 'var(--muted)' }}><span className="dot" style={{ background: s.color, width: 7, height: 7 }} /><span className="ellipsis">{sectorLabel(meta, f.sector)} · {f.city ?? '—'} · {ago(f.created_at)}</span></span>
                  </span>
                </Link>
              );
            })}
            <div className="grow" />
            <div className="row wrap" style={{ gap: 6, padding: '8px 4px 0', borderTop: '1px solid #E4EEF8' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Sources :</span>
              {(d?.sources ?? []).slice(0, 4).map((s) => <span key={s.source} className="row" style={{ gap: 4, fontSize: 11, fontWeight: 800 }}><SourceBadge id={s.source} size={22} />{fmt(s.n)}</span>)}
            </div>
          </aside>

          {/* Contrôles de carte */}
          <div style={{ flex: '999 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 420, pointerEvents: 'none' }}>
            <div className="glass" style={{ pointerEvents: 'auto', borderRadius: 16, padding: 0 }}>
              <div className="seg dark" role="group" aria-label="Calque de la carte" style={{ background: 'transparent' }}>
                {LAYERS.map((l) => <button key={l.id} className={layer === l.id ? 'on' : ''} aria-pressed={layer === l.id} onClick={() => setLayer(l.id)} style={{ height: 36 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: l.swatch }} />{l.label}</button>)}
              </div>
            </div>
            {isEmpty && (
              <div className="glass a-rise" style={{ pointerEvents: 'auto', borderRadius: 24, maxWidth: 440 }}>
                <Empty title="Le radar est prêt." action={can(user, 'search') ? <Link to="/balayages" className="btn btn-primary">Lancer le premier balayage <I.arrow size={16} /></Link> : undefined}>
                  Choisissez une ville et des métiers : le Radar découpe la zone, trouve les entreprises et analyse leur présence en ligne.
                </Empty>
              </div>
            )}
            <div className="row wrap" style={{ pointerEvents: 'none', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div className="glass" style={{ pointerEvents: 'auto', position: 'relative', width: 132, height: 134, borderRadius: 18, overflow: 'hidden' }} aria-hidden="true">
                <img src="/map/map-base.webp" alt="" style={{ position: 'absolute', left: 6, top: 6, width: 120, height: 122 }} />
                {sel && <span style={{ position: 'absolute', left: 6 + ((sel.lon + 18.6) * Math.cos(29 * Math.PI / 180) * 119.1) / 2000 * 120 - 22, top: 6 + ((37 - sel.lat) * 119.1) / 2037 * 122 - 15, width: 44, height: 30, border: '1.5px solid #0B6FC2', borderRadius: 6, background: 'rgba(11,111,194,.08)', transition: 'all 1.5s cubic-bezier(.2,.8,.2,1)' }} />}
              </div>
              <div className="row" style={{ pointerEvents: 'auto', flex: '1 1 260px', minWidth: 0, maxWidth: 520, gap: 12, padding: '12px 16px', borderRadius: 18, background: 'rgba(11,37,69,.9)', color: '#E7F2FC', boxShadow: '0 18px 40px -22px rgba(11,37,69,.7)' }}>
                <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="12" fill="none" stroke="#2E9BEA" strokeWidth="1.5" opacity=".5" /><g className="a-spin" style={{ transformOrigin: '15px 15px', animationDuration: ticker ? '2s' : '8s' }}><path d="M15,15 L27,15 A12,12 0 0,0 24.2,7.3 Z" fill="#5AB4F2" /></g></svg>
                <span className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#8EC5F0' }}>{ticker?.label ?? 'RADAR EN VEILLE'}</span>
                  <span className="ellipsis" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{ticker?.text ?? `${fmt(k.total ?? 0)} entreprises suivies · ${zonesScanned} zone(s) balayée(s)`}<span className="a-caret" style={{ color: '#5AB4F2' }}>▌</span></span>
                </span>
              </div>
              <div className="row" style={{ pointerEvents: 'auto', alignItems: 'flex-end' }}>
                <div className="glass" style={{ padding: '10px 14px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 170 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.06em' }}>{L.title}</span>
                  <span style={{ height: 8, borderRadius: 4, background: L.bar }} />
                  <span className="row" style={{ justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}><span>{L.lo}</span><span>{L.hi}</span></span>
                </div>
                <div className="col" style={{ gap: 6 }}>
                  <button className="btn btn-ghost icon-btn sm" style={{ width: 40, height: 40 }} onClick={() => setZoom((z) => Math.min(1.8, z + 0.2))} aria-label="Zoomer"><I.plus size={16} /></button>
                  <button className="btn btn-ghost icon-btn sm" style={{ width: 40, height: 40, fontSize: 20 }} onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))} aria-label="Dézoomer">−</button>
                </div>
              </div>
            </div>
          </div>

          {/* Ville sélectionnée */}
          {sel && (
            <aside className="glass" aria-label="Ville sélectionnée" style={{ flex: '1 1 320px', maxWidth: 360, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14, padding: 18, borderRadius: 24 }}>
              <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div className="col" style={{ gap: 3 }}>
                  <span className="kicker" style={{ color: 'var(--orange-ink)' }}>Ville sélectionnée</span>
                  <span className="display" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.02em' }}>{sel.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{sel.region} · {sel.lastScan ? `balayée ${ago(sel.lastScan)}` : 'jamais balayée'}</span>
                </div>
                <span className="a-glow" style={{ width: 12, height: 12, marginTop: 6, borderRadius: 6, background: 'var(--orange)' }} />
              </div>
              <div className="row" style={{ gap: 16 }}>
                <Donut parts={SEG_ORDER.map((s, i) => ({ value: sel.cases[i] || 0, color: SEGMENTS[s].color }))} center={fmt(selC)} sub="entreprises" />
                <div className="col grow" style={{ gap: 7 }}>
                  {SEG_ORDER.map((s, i) => <span key={s} className="row" style={{ gap: 8, fontSize: 12, fontWeight: 700 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: SEGMENTS[s].color, flexShrink: 0 }} /><span className="grow ellipsis" style={{ color: 'var(--ink-2)' }}>{SEGMENTS[s].short}</span><span style={{ whiteSpace: 'nowrap' }}>{pct(sel.cases[i], sel.analyzed)} %</span></span>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 14, background: '#fff', border: '1px solid #E4EEF8' }}><div className="display" style={{ fontSize: 18, fontWeight: 600 }}>{fmt(selContact)}</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>contactables</div></div>
                <div style={{ padding: 10, borderRadius: 14, background: '#FFF4EA', border: '1px solid #FBE0C8' }}><div className="display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--orange-ink)' }}>{pct(sel.noSite, sel.analyzed)} %</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange-ink)' }}>sans site</div></div>
                <div style={{ padding: 10, borderRadius: 14, background: '#fff', border: '1px solid #E4EEF8' }}><div className="display" style={{ fontSize: 18, fontWeight: 600, color: 'var(--green-ink)' }}>+{fmt(selNew)}</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>en 7 jours</div></div>
              </div>
              <div className="col" style={{ gap: 9 }}>
                <span className="kicker" style={{ color: 'var(--muted)', fontSize: 11 }}>Top secteurs</span>
                {sel.sectors.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Pas encore de données pour cette ville.</span>}
                {sel.sectors.map((s) => (
                  <div key={s.id} className="row" style={{ gap: 10, fontSize: 12, fontWeight: 700 }}>
                    <span className="ellipsis" style={{ width: 120, flexShrink: 0, color: 'var(--ink-2)' }}>{s.label}</span>
                    <span className="progress grow"><span style={{ width: `${(s.n / sel.sectors[0].n) * 100}%` }} /></span>
                    <span style={{ width: 40, textAlign: 'right' }}>{fmt(s.n)}</span>
                  </div>
                ))}
              </div>
              <div className="grow" />
              <div className="row">
                <button className="btn btn-primary grow" onClick={() => nav(`/entreprises?city=${sel.id}&view=all`)}>Voir les entreprises <I.arrow size={16} /></button>
                {can(user, 'search') && <button className="btn btn-ghost" onClick={() => nav(`/balayages?city=${sel.id}`)}>Balayer</button>}
              </div>
            </aside>
          )}
        </div>

        {/* Indicateurs */}
        <section aria-label="Indicateurs clés" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Entreprises détectées', value: fmt(total), trend: `+${fmtK(k.new7 ?? 0)} · 7 j`, tone: 'up', sub: `${(d?.sources ?? []).length} source(s) · ${zonesScanned} zone(s)`, color: '#0B6FC2' },
            { label: 'Contactables', value: fmt(contact), trend: `${pct(k.contactable ?? 0, k.total ?? 0)} %`, tone: 'info', sub: 'au moins un canal trouvé', color: '#2E9BEA' },
            { label: 'Sans site trouvé', value: fmt(noSite), trend: `${pct(k.no_site ?? 0, k.analyzed ?? 0)} %`, tone: 'warn', sub: 'cibles prioritaires', color: '#F07D1A' },
            { label: 'Nouvelles · 7 jours', value: fmt(new7), trend: `+${fmtK(k.new1 ?? 0)} · 24 h`, tone: 'up', sub: 'fiches apparues', color: '#0A7A4F' },
            { label: 'WhatsApp prouvés', value: fmt(wa), trend: `${pct(k.whatsapp ?? 0, k.total ?? 0)} %`, tone: 'up', sub: 'lien publié par l’entreprise', color: '#0B6FC2' },
            { label: 'À valider', value: fmt(k.review ?? 0), trend: 'doublons', tone: 'info', sub: 'propositions de fusion', color: '#5AB4F2' },
          ].map((x) => (
            <div key={x.label} className="glass kpi">
              <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{x.label}</span>
                <span className="trend" style={{ background: x.tone === 'warn' ? '#FFF1E4' : x.tone === 'up' ? '#E6F6EE' : '#E3F1FC', color: x.tone === 'warn' ? '#8A3E00' : x.tone === 'up' ? '#0A6B45' : '#084E8A' }}>{x.trend}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}><span className="value">{x.value}</span><Spark values={spark} color={x.color} /></div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{x.sub}</span>
            </div>
          ))}
        </section>
        {(k.demo ?? 0) > 0 && <div className="notice warn" style={{ pointerEvents: 'auto' }}><DemoBadge /> {fmt(k.demo)} fiche(s) de démonstration sont fictives. Elles se suppriment en un clic dans Paramètres.</div>}
      </div>
    </div>
  );
}
