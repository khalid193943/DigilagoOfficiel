import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 18, p: P) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p });

export const I = {
  search: ({ size, ...p }: P) => <svg {...base(size, p)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>,
  bell: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 21h4" /></svg>,
  mail: ({ size, ...p }: P) => <svg {...base(size, p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  wa: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M20 12a8 8 0 01-11.8 7L4 20l1.1-4A8 8 0 1120 12z" /><path d="M9 11.5l2 2 4-4" /></svg>,
  fb: ({ size, ...p }: P) => <svg {...base(size, p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7M18 14.6c2 .7 3.2 2.7 3.5 5.4" /></svg>,
  ig: ({ size, ...p }: P) => <svg {...base(size, p)}><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2.5h5L16 6" /></svg>,
  mobile: ({ size, ...p }: P) => <svg {...base(size, p)}><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18h2" /></svg>,
  phone: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>,
  globe: ({ size, ...p }: P) => <svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>,
  plus: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M12 5v14M5 12h14" /></svg>,
  x: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  check: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  upload: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></svg>,
  download: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></svg>,
  copy: ({ size, ...p }: P) => <svg {...base(size, p)}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg>,
  edit: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></svg>,
  ban: ({ size, ...p }: P) => <svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>,
  refresh: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></svg>,
  arrow: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  back: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  settings: ({ size, ...p }: P) => <svg {...base(size, p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>,
  logout: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></svg>,
  note: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M5 4h14v12l-4 4H5z" /><path d="M15 20v-4h4M8 9h8M8 13h5" /></svg>,
  calendar: ({ size, ...p }: P) => <svg {...base(size, p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  merge: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M6 3v6a6 6 0 006 6h6M18 21v-6M6 21v-4" /><circle cx="6" cy="3" r="0" /></svg>,
  map: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>,
  spark: ({ size, ...p }: P) => <svg {...base(size, p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>,
};

/** Logo animé : petit radar qui tourne. */
export function RadarMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" aria-hidden="true">
      <circle cx="19" cy="19" r="12" fill="none" stroke="#2E9BEA" strokeWidth="1.5" opacity=".6" />
      <circle cx="19" cy="19" r="6" fill="none" stroke="#2E9BEA" strokeWidth="1.5" opacity=".8" />
      <g className="a-spin" style={{ transformOrigin: '19px 19px' }}><path d="M19,19 L31,19 A12,12 0 0,0 28.2,11.3 Z" fill="#5AB4F2" opacity=".9" /></g>
      <circle cx="19" cy="19" r="2" fill="#fff" />
    </svg>
  );
}
