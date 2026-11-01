import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Shell';
import { DemoBadge, SegPill, useToast } from '../components/ui';
import { api } from '../lib/api';
import { can, useAuth } from '../lib/auth';
import { dateFr, fmt } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useMeta } from '../lib/meta';

const COLS = ['to_contact', 'contacted', 'replied', 'meeting', 'proposal', 'negotiation', 'won'];

export function Pipeline() {
  const { meta } = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const [mine, setMine] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const tasks = useApi<any[]>(`/api/tasks${mine ? '?mine=1' : ''}`, [mine, rev]);
  const move = async (id: string, status: string) => {
    try { await api(`/api/companies/${id}`, { method: 'PATCH', body: { crm_status: status } }); setRev((r) => r + 1); toast('Étape mise à jour.'); } catch (e) { toast((e as Error).message, true); }
  };
  return (
    <Page>
      <div className="page-head">
        <div className="col" style={{ gap: 4 }}><span className="kicker">Pipeline commercial</span><h1>Du premier contact au <strong>client signé</strong>.</h1></div>
        <div className="grow" />
        <div className="seg"><button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>Toute l’équipe</button><button className={mine ? 'on' : ''} onClick={() => setMine(true)}>Mes prospects</button></div>
        <Link to="/entreprises?view=today" className="btn btn-primary">Liste du jour</Link>
      </div>
      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: '999 1 700px', minWidth: 0, overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS.length}, minmax(220px, 1fr))`, gap: 12, minWidth: COLS.length * 232 }}>
            {COLS.map((s) => <Column key={s + rev} status={s} label={meta?.crmStatuses.find((x) => x.id === s)?.label ?? s} mine={mine ? user!.id : undefined}
              dragging={drag} over={over === s} onOver={setOver} onDrop={(id) => { setOver(null); if (can(user, 'crm')) move(id, s); }} onDrag={setDrag} />)}
          </div>
        </div>
        <aside className="card col" style={{ flex: '1 1 280px', padding: 18, gap: 10, borderRadius: 22 }}>
          <h2 className="panel-title">Tâches à faire</h2>
          {tasks.data?.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Aucune tâche en attente.</span>}
          {tasks.data?.map((t) => {
            const late = t.due_at && new Date(t.due_at) < new Date();
            return (
              <div key={t.id} className="row" style={{ gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #F0F5FA' }}>
                <input type="checkbox" className="check" aria-label="Marquer comme faite" onChange={async () => { await api(`/api/activities/${t.id}`, { method: 'PATCH', body: { done: true } }); setRev((r) => r + 1); toast('Tâche terminée.'); }} />
                <span className="col grow" style={{ gap: 2 }}><span style={{ fontSize: 13, fontWeight: 800 }}>{t.content}</span><Link to={`/entreprises/${t.company_id}`} style={{ fontSize: 12 }}>{t.company_name}</Link><span style={{ fontSize: 11, fontWeight: 700, color: late ? 'var(--red)' : 'var(--muted)' }}>{t.due_at ? `${late ? 'En retard · ' : ''}${dateFr(t.due_at, true)}` : 'sans échéance'}</span></span>
              </div>
            );
          })}
        </aside>
      </div>
    </Page>
  );
}

function Column({ status, label, mine, dragging, over, onOver, onDrop, onDrag }: { status: string; label: string; mine?: string; dragging: string | null; over: boolean; onOver: (s: string | null) => void; onDrop: (id: string) => void; onDrag: (id: string | null) => void }) {
  const { data } = useApi<{ rows: any[]; total: number }>(`/api/companies?view=all&status=${status}&pageSize=30&sort=score${mine ? `&owner=${mine}` : ''}`, [status, mine]);
  return (
    <section aria-label={label} onDragOver={(e) => { if (dragging) { e.preventDefault(); onOver(status); } }} onDragLeave={() => onOver(null)} onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id); }}
      className="col" style={{ gap: 8, padding: 10, borderRadius: 18, background: over ? '#E3F1FC' : '#E8F0F8', minHeight: 420, transition: 'background .2s', outline: over ? '2px dashed var(--sky-2)' : 'none' }}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '4px 6px' }}><span style={{ fontSize: 13, fontWeight: 800 }}>{label}</span><span className="pill" style={{ background: '#fff', color: 'var(--ink-2)', fontSize: 11 }}>{fmt(data?.total ?? 0)}</span></div>
      {data?.rows.map((r) => (
        <Link key={r.id} to={`/entreprises/${r.id}`} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', r.id); onDrag(r.id); }} onDragEnd={() => onDrag(null)}
          className="card col" style={{ padding: 12, gap: 6, borderRadius: 14, color: 'var(--ink)', cursor: 'grab', boxShadow: '0 10px 20px -18px rgba(11,60,110,.6)', opacity: dragging === r.id ? 0.5 : 1 }}>
          <span className="row" style={{ gap: 6 }}><span className="ellipsis grow" style={{ fontSize: 13, fontWeight: 800 }}>{r.name}</span>{r.is_demo && <DemoBadge />}</span>
          <span className="muted" style={{ fontSize: 11 }}>{r.city ?? '—'} · score {r.score ?? '—'}</span>
          <SegPill segment={r.segment} />
        </Link>
      ))}
      {data && !data.rows.length && <span className="muted" style={{ fontSize: 12, padding: 6 }}>Glissez une carte ici.</span>}
    </section>
  );
}
