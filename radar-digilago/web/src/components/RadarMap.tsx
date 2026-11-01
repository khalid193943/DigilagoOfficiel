import { useEffect, useMemo, useRef } from 'react';
import { MA_CELLS, MA_PATH, MAP_H, MAP_W, HEX_R, cellAt, cellCenter, pctX, pctY, project } from '../lib/geo';

export type MapLayer = 'density' | 'opportunity' | 'coverage';
export type Pin = { id: string; name: string; lat: number; lon: number; n: number; metric: string; selected?: boolean; major?: boolean; onClick?: () => void };
type Props = {
  points: [number, number, number][];
  tiles?: [number, number, number, number, number][];
  layer: MapLayer;
  focus: { lat: number; lon: number };
  zoom?: number; tilt?: number; anchor?: [string, string];
  pins?: Pin[]; sweep?: boolean; arcs?: { lat: number; lon: number }[];
  blips?: { lat: number; lon: number; hot?: boolean; key: string | number }[];
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
function ramp(stops: [number, string][], t: number) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) if (t <= stops[i + 1][0]) return lerp(hex(stops[i][1]), hex(stops[i + 1][1]), (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0] || 1));
  return hex(stops[stops.length - 1][1]);
}
const BLUE: [number, string][] = [[0, '#CFE4F7'], [0.3, '#8EC5F0'], [0.6, '#3E97E0'], [1, '#0A5DAE']];
const ORNG: [number, string][] = [[0, '#FBE3CC'], [0.4, '#F7B27A'], [0.75, '#EC7A1F'], [1, '#B44F00']];

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = ((60 * i - 30) * Math.PI) / 180; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
}
function column(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, top: number[], side: number[]) {
  ctx.fillStyle = rgb(side);
  for (let k = 0; k < h; k += 2) { hexPath(ctx, x, y - k, HEX_R); ctx.fill(); }
  ctx.fillStyle = rgb(lerp(top, [255, 255, 255], 0.1));
  hexPath(ctx, x, y - h, HEX_R); ctx.fill();
}

/** Carte 3D du Maroc : fond hexagonal + colonnes calculées à partir des vraies données. */
export function RadarMap({ points, tiles = [], layer, focus, zoom = 1, tilt = 40, anchor = ['47%', '57%'], pins = [], sweep = true, arcs = [], blips = [] }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  // agrégation par hexagone
  const cells = useMemo(() => {
    const m = new Map<number, { n: number; none: number; analyzed: number }>();
    for (const [lat, lon, seg] of points) {
      const { x, y } = project(lat, lon);
      const k = cellAt(x, y);
      const c = m.get(k) ?? { n: 0, none: 0, analyzed: 0 };
      c.n++; if (seg > 0) c.analyzed++; if (seg === 1) c.none++;
      m.set(k, c);
    }
    return m;
  }, [points]);
  const cover = useMemo(() => {
    const m = new Map<number, number>();
    for (const [s, w, n, e, done] of tiles) {
      const a = project(n, w), b = project(s, e);
      for (const k of MA_CELLS) {
        const c = cellCenter(k);
        if (c.x >= a.x && c.x <= b.x && c.y >= a.y && c.y <= b.y) m.set(k, Math.max(m.get(k) ?? 0, done ? 1 : 0.5));
      }
    }
    return m;
  }, [tiles]);

  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    const max = Math.max(8, ...[...cells.values()].map((c) => c.n));
    const keys = layer === 'coverage' ? [...new Set([...cover.keys(), ...cells.keys()])] : [...cells.keys()];
    keys.sort((a, b) => a - b);
    for (const k of keys) {
      const { x, y } = cellCenter(k), c = cells.get(k);
      const t = c ? Math.log1p(c.n) / Math.log1p(max) : 0;
      if (layer === 'density' && c) {
        const top = ramp(BLUE, Math.pow(t, 0.6));
        column(ctx, x, y, 3 + 46 * Math.pow(t, 1.4), top, lerp(top, hex('#3F79B3'), 0.35));
      } else if (layer === 'opportunity' && c) {
        const share = c.analyzed ? c.none / c.analyzed : 0;
        const top = c.analyzed ? ramp(ORNG, 0.15 + share * 0.85) : hex('#E3EEF9');
        column(ctx, x, y, 3 + 40 * Math.pow(t, 1.2) * (c.analyzed ? Math.max(0.25, share) : 0.1), top, lerp(top, hex('#8A3E00'), 0.3));
      } else if (layer === 'coverage') {
        const v = cover.get(k);
        if (!v && !c) continue;
        const top = v === 1 ? hex('#0B6FC2') : v ? hex('#8EC5F0') : hex('#C9D6E4');
        column(ctx, x, y, (v === 1 ? 8 : v ? 4 : 2) + (c ? 14 * t : 0), top, lerp(top, hex('#3F79B3'), 0.35));
      }
    }
  }, [cells, cover, layer]);

  const f = project(focus.lat, focus.lon);
  const fx = (f.x / MAP_W) * 100, fy = (f.y / MAP_H) * 100;
  const R = 560;
  const P = (a: number) => `${(f.x + R * Math.cos((a * Math.PI) / 180)).toFixed(1)},${(f.y - R * Math.sin((a * Math.PI) / 180)).toFixed(1)}`;
  const wedge = (a0: number, a1: number) => `M${f.x},${f.y} L${P(a0)} A${R},${R} 0 0,0 ${P(a1)} Z`;
  const arcPath = arcs.map((a) => { const t = project(a.lat, a.lon), mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2, d = Math.hypot(t.x - f.x, t.y - f.y); return `M${f.x},${f.y} Q${mx.toFixed(0)},${(my - d * 0.35).toFixed(0)} ${t.x.toFixed(0)},${t.y.toFixed(0)}`; }).join(' ');
  const maxPin = Math.max(1, ...pins.map((p) => p.n));
  // hauteur des balises : proportionnelle au volume, puis décalée si deux étiquettes voisines se gênent
  const beams = useMemo(() => {
    const placed: { x: number; y: number; h: number }[] = [];
    const out = new Map<string, number>();
    for (const p of [...pins].sort((a, b) => Number(!!b.selected) - Number(!!a.selected) || b.n - a.n)) {
      const pp = project(p.lat, p.lon);
      let h = Math.round(28 + 150 * Math.sqrt(p.n / maxPin)) + (p.selected ? 30 : 0);
      for (let guard = 0; guard < 3; guard++) {
        const clash = placed.find((q) => Math.abs(q.x - pp.x) < 150 && Math.abs((q.y - q.h) - (pp.y - h)) < 58);
        if (!clash) break;
        h += 62;
      }
      placed.push({ x: pp.x, y: pp.y, h }); out.set(p.id, h);
    }
    return out;
  }, [pins, maxPin]);

  return (
    <div className="stage-wrap" style={{ perspectiveOrigin: `${anchor[0]} 34%` }}>
      <div className="stage" style={{ left: anchor[0], top: anchor[1], transformOrigin: `${fx}% ${fy}%`, transform: `translate(-${fx}%, -${fy}%) rotateX(${tilt}deg) scale(${zoom})` }}>
        <div className="floor" />
        <img src="/map/map-base.webp" alt="" draggable={false} />
        <canvas ref={canvas} width={MAP_W} height={MAP_H} aria-hidden="true" />
        <svg className="map-layer" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true" style={{ overflow: 'visible' }}>
          <defs>
            <clipPath id="rd-land"><path d={MA_PATH} /></clipPath>
            <linearGradient id="rd-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#F07D1A" /><stop offset="1" stopColor="#0B9BE8" /></linearGradient>
          </defs>
          {sweep && (
            <g clipPath="url(#rd-land)">
              <g fill="none" stroke="#0B6FC2" strokeWidth="1.5" strokeDasharray="4 10" opacity=".45">{[140, 280, 420, 560].map((r) => <circle key={r} cx={f.x} cy={f.y} r={r} />)}</g>
              <g className="a-spin" style={{ transformOrigin: `${f.x}px ${f.y}px` }}>
                {[[42, 64, 0.04], [26, 42, 0.07], [15, 26, 0.11], [7, 15, 0.17], [0, 7, 0.26]].map(([a, b, o]) => <path key={a} d={wedge(a, b)} fill="#0B9BE8" fillOpacity={o} />)}
                <line x1={f.x} y1={f.y} x2={f.x + R} y2={f.y} stroke="#0B9BE8" strokeWidth="3" opacity=".9" />
              </g>
            </g>
          )}
          {arcPath && <><path d={arcPath} fill="none" stroke="url(#rd-arc)" strokeWidth="3" strokeDasharray="10 14" opacity=".75" className="flow" />
            <path d={arcPath} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 60" className="flow-fast" /></>}
          <circle className="ping" cx={f.x} cy={f.y} r="26" fill="none" stroke="#F07D1A" strokeWidth="4" />
          <circle className="ping" cx={f.x} cy={f.y} r="26" fill="none" stroke="#F07D1A" strokeWidth="4" style={{ animationDelay: '1.3s' }} />
          <text x="420" y="620" fontFamily="Sora, sans-serif" fontSize="30" fontWeight="600" letterSpacing="14" fill="#7FA9CF" opacity=".75">OCÉAN ATLANTIQUE</text>
          <text x="1440" y="70" fontFamily="Sora, sans-serif" fontSize="24" fontWeight="600" letterSpacing="12" fill="#7FA9CF" opacity=".75">MER MÉDITERRANÉE</text>
        </svg>
        {blips.map((b, i) => { const p = project(b.lat, b.lon); return <span key={b.key} className="blip" style={{ left: pctX(p.x), top: pctY(p.y), background: b.hot ? '#F07D1A' : '#0B9BE8', boxShadow: `0 0 0 5px ${b.hot ? 'rgba(240,125,26,.22)' : 'rgba(11,155,232,.22)'}`, animationDelay: `${(i * 0.41) % 4.8}s` }} />; })}
        {pins.map((p) => {
          const pp = project(p.lat, p.lon), sel = !!p.selected;
          const beam = beams.get(p.id) ?? 40;
          return (
            <button key={p.id} type="button" className={`pin${sel ? ' sel' : ''}`} onClick={p.onClick} aria-pressed={sel} aria-label={`${p.name} : ${p.metric}`}
              style={{ left: pctX(pp.x), top: pctY(pp.y), transform: `translate(-50%, -100%) rotateX(-${tilt}deg)` }}>
              {p.major || sel ? <span className={`pin-chip${sel ? ' a-bob' : ''}`}><b>{p.name}</b><small>{p.metric}</small></span> : <span className="pin-label">{p.name}</span>}
              <span className="pin-beam" style={{ height: beam, background: `linear-gradient(to top, ${sel ? '#F07D1A' : '#0B6FC2'}, rgba(255,255,255,0))` }} />
              <span className="pin-base" style={{ background: sel ? '#F07D1A' : '#0B6FC2', boxShadow: `0 0 0 5px ${sel ? 'rgba(240,125,26,.25)' : 'rgba(11,111,194,.18)'}` }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
