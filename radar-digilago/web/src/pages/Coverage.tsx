import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RadarMap, type MapLayer } from '../components/RadarMap';
import { Page } from '../components/Shell';
import { Ring, SourceBadge } from '../components/ui';
import { ago, fmt } from '../lib/format';
import { useApi } from '../lib/hooks';

type Cov = {
  zones: { id: string; name: string; region: string; lat: number; lon: number; status: 'done' | 'partial' | 'never'; last: string | null; n: number }[];
  regions: { name: string; zones: number; done: number; partial: number; pct: number; n: number; last: string | null; lat: number | null; lon: number | null }[];
  matrix: { sector: string; label: string; total: number; single: number; cells: { source: string; pct: number }[] }[];
  sources: { id: string; label: string }[];
  totals: { zones: number; done: number; partial: number; regionsWithData: number };
};
const RAMP = [['#F4F8FC', '#33445C'], ['#D6EAFA', '#084E8A'], ['#9ACDF2', '#063C6B'], ['#4FA8E8', '#fff'], ['#0B6FC2', '#fff']];

export function Coverage() {
  const { data } = useApi<Cov>('/api/coverage');
  const map = useApi<{ points: [number, number, number][]; tiles: [number, number, number, number, number][] }>('/api/map/points');
  const [region, setRegion] = useState<string>('Casablanca-Settat');
  const [layer, setLayer] = useState<MapLayer>('coverage');
  const r = data?.regions.find((x) => x.name === region);
  const focus = r?.lat != null ? { lat: r.lat, lon: r.lon! } : { lat: 31.8, lon: -7.1 };
  const pins = useMemo(() => (data?.zones ?? []).map((z) => ({ id: z.id, name: z.name, lat: z.lat, lon: z.lon, n: Math.max(z.n, 1), metric: z.status === 'done' ? 'balayée' : z.status === 'partial' ? 'partielle' : 'jamais', selected: z.region.replace('’', "'") === region.replace('’', "'") && z.lat === r?.lat, major: z.status !== 'never' })), [data, region, r]);
  const t = data?.totals;
  const kpis = t ? [
    { label: 'Régions avec données', done: t.regionsWithData, total: 12, color: '#0B6FC2' },
    { label: 'Zones balayées entièrement', done: t.done, total: t.zones, color: '#2E9BEA' },
    { label: 'Zones partielles', done: t.partial, total: t.zones, color: '#5AB4F2' },
    { label: 'Zones jamais balayées', done: t.zones - t.done - t.partial, total: t.zones, color: '#F07D1A' },
  ] : [];
  return (
    <Page>
      <div className="page-head"><div className="col" style={{ gap: 4 }}><span className="kicker">Couverture du Maroc</span><h1>Chaque zone a un statut. <strong>Aucune n’est oubliée.</strong></h1></div></div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card row" style={{ padding: '14px 16px', gap: 14, borderRadius: 20 }}>
            <Ring value={(k.done / Math.max(1, k.total)) * 100} size={58} stroke={7} color={k.color}><text x="29" y="33" textAnchor="middle" fontFamily="Sora" fontSize="12" fontWeight="700" fill="#0B2545">{Math.round((k.done / Math.max(1, k.total)) * 100)}%</text></Ring>
            <span className="col" style={{ gap: 2 }}><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{k.label}</span><span className="display" style={{ fontSize: 24, fontWeight: 600 }}>{k.done} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>/ {k.total}</span></span></span>
          </div>
        ))}
      </section>
      <div className="row wrap" style={{ gap: 16, alignItems: 'stretch' }}>
        <section style={{ flex: '999 1 560px', minWidth: 0, position: 'relative', minHeight: 560, borderRadius: 26, overflow: 'hidden', background: '#E7F0F9', boxShadow: 'var(--shadow)' }}>
          <RadarMap points={map.data?.points ?? []} tiles={map.data?.tiles ?? []} layer={layer} focus={focus} zoom={0.62} tilt={42} anchor={['50%', '55%']} pins={pins} sweep={false} />
          <div className="row wrap" style={{ position: 'absolute', zIndex: 2, left: 16, top: 16, right: 16 }}>
            <div className="seg dark glass" style={{ borderRadius: 14 }}>{([['coverage', 'Couverture'], ['density', 'Densité'], ['opportunity', 'Opportunités']] as const).map(([id, l]) => <button key={id} className={layer === id ? 'on' : ''} onClick={() => setLayer(id)}>{l}</button>)}</div>
          </div>
          {r && <div className="glass col" style={{ position: 'absolute', zIndex: 2, left: 16, bottom: 16, maxWidth: 380, padding: '14px 16px', borderRadius: 18, gap: 6 }}>
            <span className="kicker" style={{ color: 'var(--orange-ink)' }}>Région sélectionnée</span>
            <span className="display" style={{ fontSize: 20, fontWeight: 600 }}>{r.name}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.pct} % couvert · {r.zones} zone(s) de référence · {fmt(r.n)} entreprises · {r.last ? `dernier balayage ${ago(r.last)}` : 'jamais balayée'}</span>
            <Link to="/balayages" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Balayer cette région</Link>
          </div>}
        </section>
        <section className="card col" style={{ flex: '1 1 380px', padding: 16, gap: 4, borderRadius: 26 }}>
          <div className="row" style={{ justifyContent: 'space-between', padding: '2px 6px 8px' }}><h2 className="panel-title">Les 12 régions</h2><span className="muted" style={{ fontSize: 12 }}>cliquez pour survoler</span></div>
          {(data?.regions ?? []).map((x) => {
            const on = x.name === region;
            return (
              <button key={x.name} onClick={() => setRegion(x.name)} aria-pressed={on} className="row" style={{ gap: 12, padding: '9px 10px', borderRadius: 14, border: `1px solid ${on ? 'var(--sky)' : 'transparent'}`, background: on ? 'var(--sky-bg)' : 'transparent', textAlign: 'left' }}>
                <span className="col grow" style={{ gap: 5 }}>
                  <span className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}><span className="ellipsis" style={{ fontWeight: 800 }}>{x.name}</span><span style={{ fontWeight: 800, color: x.pct ? 'var(--sky-ink)' : 'var(--muted)' }}>{x.pct} %</span></span>
                  <span className="progress" style={{ height: 6 }}><span style={{ width: `${x.pct}%`, background: x.pct >= 50 ? 'var(--sky)' : x.pct ? 'var(--sky-3)' : '#C9D6E4' }} /></span>
                </span>
                <span style={{ width: 64, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{x.n ? fmt(x.n) : '—'}</span>
              </button>
            );
          })}
          <div className="notice" style={{ marginTop: 8, fontSize: 12 }}>Référentiel actuel : {t?.zones ?? 20} zones urbaines. Le découpage officiel complet (≈ 1 500 communes) s’ajoute en important la liste des communes : chaque commune aura alors son propre statut.</div>
        </section>
      </div>
      <section className="card col" style={{ padding: '18px 20px', gap: 12, borderRadius: 26 }}>
        <div className="row wrap" style={{ alignItems: 'baseline' }}><h2 className="panel-title">Qui trouve quoi</h2><span className="muted" style={{ fontSize: 12 }}>Part des entreprises de chaque secteur trouvées par chaque source. Sert à décider quelles sources valent leur prix.</span></div>
        {!data?.matrix.length && <span className="muted">Disponible après le premier balayage.</span>}
        <div className="table-wrap">
          {!!data?.matrix.length && (
            <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${data.sources.length}, minmax(90px, 1fr)) 130px`, gap: 5, minWidth: 600, fontSize: 12 }}>
              <span />{data.sources.map((s) => <span key={s.id} className="row" style={{ justifyContent: 'center', gap: 6, fontWeight: 800, color: 'var(--muted)' }}><SourceBadge id={s.id} size={22} />{s.label.split(' ')[0]}</span>)}<span style={{ fontWeight: 800, color: 'var(--muted)', textAlign: 'center' }}>Une seule source</span>
              {data.matrix.map((m) => [
                <span key={m.sector} style={{ fontWeight: 800, padding: '10px 0' }}>{m.label} <span className="muted" style={{ fontWeight: 600 }}>({fmt(m.total)})</span></span>,
                ...m.cells.map((c) => { const j = Math.min(4, Math.floor(c.pct / 20)); return <span key={m.sector + c.source} title={`${c.pct} %`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: 10, fontWeight: 800, background: RAMP[j][0], color: RAMP[j][1] }}>{c.pct} %</span>; }),
                <span key={m.sector + 'u'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: 10, fontWeight: 800, background: '#FFF4EA', color: '#8A3E00' }}>{m.single} %</span>,
              ])}
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}
