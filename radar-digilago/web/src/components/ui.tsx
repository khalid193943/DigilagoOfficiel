import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { SEGMENTS, srcStyle } from '../lib/format';
import { I } from './Icons';

// ----- Toasts -----
type Toast = { id: number; text: string; err?: boolean };
const ToastCtx = createContext<(text: string, err?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, err = false) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, err }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), err ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{list.map((t) => <div key={t.id} className={`toast${t.err ? ' err' : ''}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ----- Modale -----
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row"><h2 className="panel-title grow" style={{ fontSize: 19 }}>{title}</h2>
          <button className="btn btn-ghost icon-btn sm" onClick={onClose} aria-label="Fermer"><I.x size={16} /></button></div>
        {children}
      </div>
    </div>
  );
}

// ----- Pastilles -----
export function SegPill({ segment }: { segment?: string | null }) {
  const s = SEGMENTS[segment ?? 'unknown'] ?? SEGMENTS.unknown;
  return <span className="pill" style={{ background: s.bg, color: s.ink }}><span className="dot" style={{ background: s.color }} />{s.label}</span>;
}
export function SourceBadge({ id, size = 34 }: { id: string; size?: number }) {
  const s = srcStyle(id);
  return <span className="mono-badge" title={s.label} style={{ background: s.bg, color: s.fg, width: size, height: size, fontSize: size < 30 ? 11 : 12 }}>{s.mono}</span>;
}
export function DemoBadge() { return <span className="badge-demo" title="Données inventées pour la démonstration">FICTIF</span>; }

const CH = [
  { k: 'has_email', label: 'Email', Icon: I.mail, on: ['#E3F1FC', '#084E8A'] },
  { k: 'has_whatsapp', label: 'WhatsApp publié par l’entreprise', Icon: I.wa, on: ['#E6F6EE', '#0A6B45'] },
  { k: 'has_facebook', label: 'Page Facebook', Icon: I.fb, on: ['#E3F1FC', '#084E8A'] },
  { k: 'has_instagram', label: 'Instagram', Icon: I.ig, on: ['#FBEAF3', '#8E2463'] },
  { k: 'has_mobile', label: 'Mobile', Icon: I.mobile, on: ['#E3F1FC', '#084E8A'] },
  { k: 'has_fixed', label: 'Fixe', Icon: I.phone, on: ['#E3F1FC', '#084E8A'] },
] as const;
export function Channels({ row }: { row: Record<string, any> }) {
  return (
    <div className="row" style={{ gap: 4 }}>
      {CH.map(({ k, label, Icon, on }) => {
        const has = !!row[k];
        return <span key={k} className="ch" title={`${label} : ${has ? 'trouvé' : 'non trouvé'}`} style={{ background: has ? on[0] : '#F4F6F9', color: has ? on[1] : '#B5C0CE' }}><Icon size={15} /><span className="sr">{label} {has ? 'trouvé' : 'non trouvé'}</span></span>;
      })}
    </div>
  );
}

// ----- Graphiques -----
export function Ring({ value, size = 48, stroke = 6, color = '#0B6FC2', label, children }: { value: number | null; size?: number; stroke?: number; color?: string; label?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF4FA" strokeWidth={stroke} />
      {value != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)' }} />}
      {children}
    </svg>
  );
}
export function Donut({ parts, size = 128, stroke = 14, center, sub }: { parts: { value: number; color: string }[]; size?: number; stroke?: number; center: string; sub: string }) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF4FA" strokeWidth={stroke} />
      {parts.map((p, i) => {
        const len = (C * p.value) / total, off = -acc; acc += len;
        return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${Math.max(0, len - (len > 4 ? 3 : 0))} ${C}`} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(.2,.8,.2,1), stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }} />;
      })}
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontFamily="Sora, sans-serif" fontSize={size / 5.8} fontWeight="700" fill="#0B2545">{center}</text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="11" fontWeight="700" fill="#4A5A70">{sub}</text>
    </svg>
  );
}
export function Spark({ values, color = '#0B6FC2', w = 84, h = 32 }: { values: number[]; color?: string; w?: number; h?: number }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = max - min || 1;
  const pts = values.map((v, i) => `${(2 + (i * (w - 4)) / Math.max(1, values.length - 1)).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <path d={`M${pts.split(' ').join(' L')} L${w - 2},${h} L2,${h} Z`} fill={color} fillOpacity=".1" />
      <polyline className="a-draw" points={pts} stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><svg width="56" height="56" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="16" fill="#EAF4FD" /><circle cx="19" cy="19" r="10" fill="none" stroke="#8EC5F0" strokeWidth="1.5" /><g className="a-spin" style={{ transformOrigin: '19px 19px' }}><path d="M19,19 L29,19 A10,10 0 0,0 26.7,12.6 Z" fill="#5AB4F2" /></g></svg><h3>{title}</h3>{children && <div style={{ maxWidth: 420 }}>{children}</div>}{action}</div>;
}
export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: number | string }) { return <div className="skeleton" style={{ height: h, width: w }} />; }
