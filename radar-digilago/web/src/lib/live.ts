import { useEffect, useRef } from 'react';

export type LiveEvent = { type: 'company' | 'scan' | 'analysis'; [k: string]: any };
type Listener = (e: LiveEvent) => void;

let source: EventSource | null = null;
const listeners = new Set<Listener>();
let retry = 1000;

function connect() {
  if (source) return;
  source = new EventSource('/api/live', { withCredentials: true });
  source.onmessage = (m) => { retry = 1000; try { const ev = JSON.parse(m.data); listeners.forEach((l) => l(ev)); } catch { /* ignore */ } };
  source.onerror = () => { source?.close(); source = null; if (listeners.size) setTimeout(connect, (retry = Math.min(retry * 2, 30000))); };
}

/** Abonnement au flux temps réel du serveur (nouvelles entreprises, balayages, analyses). */
export function useLive(fn: Listener) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const l: Listener = (e) => ref.current(e);
    listeners.add(l);
    connect();
    return () => { listeners.delete(l); if (!listeners.size) { source?.close(); source = null; } };
  }, []);
}
