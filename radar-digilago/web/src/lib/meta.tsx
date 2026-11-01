import { createContext, useContext, type ReactNode } from 'react';
import { useApi } from './hooks';

export type Meta = {
  sectors: { id: string; label: string; priority: boolean; keywords: number }[];
  cities: { id: string; name: string; region: string; lat: number; lon: number; radiusKm: number }[];
  regions: string[];
  sources: { id: string; label: string; mono: string; enabled: boolean; requiresKey: boolean; tiled: boolean; coverageNote: string; attribution: string; costPerRequest: number; dailyLimit: number; usedToday: number; costToday: number; health: { ok: boolean; message: string } }[];
  plannedSources: { id: string; label: string; mono: string; note: string }[];
  segments: { id: string; label: string }[];
  crmStatuses: { id: string; label: string }[];
  demoEnabled: boolean;
};
const MetaCtx = createContext<{ meta: Meta | null; reload: () => void }>({ meta: null, reload: () => {} });
export function MetaProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useApi<Meta>('/api/meta');
  return <MetaCtx.Provider value={{ meta: data, reload: () => reload(true) }}>{children}</MetaCtx.Provider>;
}
export const useMeta = () => useContext(MetaCtx);
export const sectorLabel = (meta: Meta | null, id?: string | null) => meta?.sectors.find((s) => s.id === id)?.label ?? id ?? '—';
export const statusLabel = (meta: Meta | null, id?: string | null) => meta?.crmStatuses.find((s) => s.id === id)?.label ?? id ?? '—';
