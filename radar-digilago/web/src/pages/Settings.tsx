import { useState } from 'react';
import { Link } from 'react-router-dom';
import { I } from '../components/Icons';
import { Page } from '../components/Shell';
import { Empty, Modal, SourceBadge, useToast } from '../components/ui';
import { api } from '../lib/api';
import { can, ROLE_LABEL, useAuth, type User } from '../lib/auth';
import { ago, dateFr, fmt } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useMeta } from '../lib/meta';

type Tab = 'sources' | 'team' | 'review' | 'data' | 'compliance';

export function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('sources');
  const tabs: [Tab, string, boolean][] = [['sources', 'Sources & quotas', true], ['review', 'Doublons à valider', true], ['team', 'Équipe & rôles', can(user, 'admin')], ['data', 'Données & journal', can(user, 'admin')], ['compliance', 'Conformité', true]];
  return (
    <Page>
      <div className="page-head"><div className="col" style={{ gap: 4 }}><span className="kicker">Paramètres</span><h1>Réglages du <strong>Radar</strong></h1></div></div>
      <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>{tabs.filter((t) => t[2]).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>)}</div>
      {tab === 'sources' && <Sources />}
      {tab === 'review' && <Review />}
      {tab === 'team' && <Team />}
      {tab === 'data' && <Data />}
      {tab === 'compliance' && <Compliance />}
    </Page>
  );
}

function Sources() {
  const { meta } = useMeta();
  const queue = useApi<{ stats: { type: string; status: string; n: number }[] }>('/api/admin/queue', [], { interval: 5000 });
  const pending = (queue.data?.stats ?? []).filter((s) => ['queued', 'running'].includes(s.status)).reduce((a, s) => a + s.n, 0);
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="notice">Les clés d’API se règlent uniquement côté serveur (variables d’environnement) : elles ne transitent jamais par le navigateur. Voir le fichier README, section « Brancher Google Places ».</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {meta?.sources.map((s) => (
          <div key={s.id} className="card col" style={{ padding: 18, gap: 10 }}>
            <div className="row"><SourceBadge id={s.id} /><span className="grow"><div style={{ fontWeight: 800, fontSize: 15 }}>{s.label}</div><div className="muted" style={{ fontSize: 12 }}>{s.attribution}</div></span>
              <span className="pill" style={{ background: s.health.ok ? '#E6F6EE' : '#FFF1E4', color: s.health.ok ? '#0A6B45' : '#8A3E00' }}><span className="dot" style={{ background: s.health.ok ? 'var(--green)' : 'var(--orange)' }} />{s.enabled ? 'Active' : 'Inactive'}</span></div>
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{s.health.message}</span>
            <span className="muted" style={{ fontSize: 12 }}>{s.coverageNote}</span>
            <div className="col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}><span>Requêtes aujourd’hui</span><span>{fmt(s.usedToday)} / {fmt(s.dailyLimit)}</span></div>
              <div className="progress"><span style={{ width: `${Math.min(100, (s.usedToday / Math.max(1, s.dailyLimit)) * 100)}%` }} /></div>
              <span className="muted" style={{ fontSize: 12 }}>{s.costPerRequest ? `Coût estimé aujourd’hui : ${s.costToday.toFixed(2)} $ (${s.costPerRequest} $ / requête, à vérifier sur la grille officielle)` : 'Pas de coût par requête.'}</span>
            </div>
          </div>
        ))}
        {meta?.plannedSources.map((s) => (
          <div key={s.id} className="card col" style={{ padding: 18, gap: 8, borderStyle: 'dashed', opacity: 0.8 }}>
            <div className="row"><span className="mono-badge" style={{ background: '#F2F5F9', color: '#7A8899' }}>{s.mono}</span><span className="grow" style={{ fontWeight: 800 }}>{s.label}</span><span className="pill" style={{ background: '#F2F5F9', color: '#4A5A70' }}>À venir</span></div>
            <span className="muted" style={{ fontSize: 12 }}>{s.note}</span>
          </div>
        ))}
      </div>
      <div className="card row" style={{ padding: 16, gap: 12 }}><span className="dot a-blink" style={{ background: pending ? 'var(--sky-2)' : 'var(--green)' }} /><span className="grow" style={{ fontSize: 13 }}><strong>File de travail :</strong> {pending ? `${pending} tâche(s) en cours ou en attente (balayages, analyses de sites).` : 'rien en attente.'}</span></div>
    </div>
  );
}

function Review() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi<any[]>('/api/merge-candidates');
  const decide = async (id: string, decision: 'merge' | 'reject') => { try { await api(`/api/merge-candidates/${id}`, { body: { decision } }); toast(decision === 'merge' ? 'Fusionnées (réversible par un administrateur).' : 'Noté : deux entreprises différentes.'); reload(true); } catch (e) { toast((e as Error).message, true); } };
  if (data && !data.length) return <div className="card"><Empty title="Aucun doublon à valider">Les correspondances incertaines apparaissent ici. Le Radar ne fusionne jamais seul un cas douteux.</Empty></div>;
  return (
    <div className="card" style={{ borderRadius: 22 }}>
      <div className="table-wrap"><table className="data" style={{ minWidth: 760 }}>
        <thead><tr><th>Fiche A</th><th>Fiche B</th><th>Pourquoi</th><th>Proposée</th><th /></tr></thead>
        <tbody>{data?.map((m) => (
          <tr key={m.id}>
            <td><Link to={`/entreprises/${m.company_a}`} style={{ fontWeight: 800 }}>{m.a_name}</Link><div className="muted" style={{ fontSize: 12 }}>{m.a_city}</div></td>
            <td><Link to={`/entreprises/${m.company_b}`} style={{ fontWeight: 800 }}>{m.b_name}</Link><div className="muted" style={{ fontSize: 12 }}>{m.b_city}</div></td>
            <td style={{ fontSize: 12 }}>{(m.signals?.reasons ?? []).join(' · ')}</td>
            <td className="muted" style={{ fontSize: 12 }}>{ago(m.created_at)}</td>
            <td>{can(user, 'edit') && <div className="row" style={{ gap: 6 }}><button className="btn btn-primary btn-sm" onClick={() => decide(m.id, 'merge')}>Fusionner</button><button className="btn btn-ghost btn-sm" onClick={() => decide(m.id, 'reject')}>Différentes</button></div>}</td>
          </tr>))}</tbody>
      </table></div>
    </div>
  );
}

function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, reload } = useApi<(User & { active: boolean; last_login_at: string | null })[]>('/api/users');
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ email: '', name: '', role: 'sales', password: '' });
  const update = async (id: string, body: Record<string, unknown>) => { try { await api(`/api/users/${id}`, { method: 'PATCH', body }); toast('Utilisateur mis à jour.'); reload(true); } catch (e) { toast((e as Error).message, true); } };
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row"><span className="muted grow" style={{ fontSize: 13 }}>Administrateur : tout. Opérateur : balayages et corrections. Commercial : suivi, contacts, exports. Lecture seule : consultation.</span><button className="btn btn-primary" onClick={() => setOpen(true)}><I.plus size={16} />Ajouter un membre</button></div>
      <div className="card" style={{ borderRadius: 22 }}><div className="table-wrap"><table className="data" style={{ minWidth: 640 }}>
        <thead><tr><th>Membre</th><th>Rôle</th><th>Dernière connexion</th><th>Accès</th></tr></thead>
        <tbody>{data?.map((u) => (
          <tr key={u.id}>
            <td><div style={{ fontWeight: 800 }}>{u.name}</div><div className="muted" style={{ fontSize: 12 }}>{u.email}</div></td>
            <td><select className="select" style={{ height: 36, width: 170 }} value={u.role} disabled={u.id === user?.id} onChange={(e) => update(u.id, { role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
            <td className="muted" style={{ fontSize: 12 }}>{u.last_login_at ? ago(u.last_login_at) : 'jamais'}</td>
            <td>{u.id !== user?.id && <button className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-ghost'}`} onClick={() => update(u.id, { active: !u.active })}>{u.active ? 'Désactiver' : 'Réactiver'}</button>}</td>
          </tr>))}</tbody>
      </table></div></div>
      {open && <Modal title="Ajouter un membre" onClose={() => setOpen(false)}>
        <label className="field">Nom<input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <label className="field">Email<input className="input" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
        <label className="field">Rôle<select className="select" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field">Mot de passe provisoire (10 caractères minimum)<input className="input" type="text" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button><button className="btn btn-primary" disabled={!v.name || !v.email || v.password.length < 10} onClick={async () => { try { await api('/api/users', { body: v }); toast('Membre ajouté.'); setOpen(false); reload(true); } catch (e) { toast((e as Error).message, true); } }}>Ajouter</button></div>
      </Modal>}
    </div>
  );
}

function Data() {
  const toast = useToast();
  const { meta } = useMeta();
  const log = useApi<any[]>('/api/admin/audit-log');
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row wrap" style={{ gap: 12 }}>
        <div className="card col" style={{ flex: '1 1 300px', padding: 18, gap: 10 }}>
          <h2 className="panel-title">Données de démonstration</h2>
          <span className="muted" style={{ fontSize: 13 }}>Supprime toutes les fiches fictives (badge « FICTIF ») et leurs balayages. Les vraies données ne sont pas touchées.</span>
          {confirm ? <div className="row"><button className="btn btn-danger" onClick={async () => { const r = await api<{ deleted: number }>('/api/admin/purge-demo', { method: 'POST' }); toast(`${r.deleted} fiche(s) fictive(s) supprimée(s).`); setConfirm(false); }}>Confirmer la suppression</button><button className="btn btn-ghost" onClick={() => setConfirm(false)}>Annuler</button></div>
            : <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirm(true)}>Supprimer les données fictives</button>}
          {meta?.demoEnabled && <span className="notice warn" style={{ fontSize: 12 }}>La source démo est active : désactivez-la en production (DEMO_SOURCE_ENABLED=false).</span>}
        </div>
        <div className="card col" style={{ flex: '1 1 300px', padding: 18, gap: 10 }}>
          <h2 className="panel-title">Recalculer les diagnostics</h2>
          <span className="muted" style={{ fontSize: 13 }}>Relance l’analyse des sites et le score de toutes les entreprises (utile après un changement des règles).</span>
          <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={async () => { const r = await api<{ queued: number }>('/api/admin/reanalyze', { body: {} }); toast(`${r.queued} analyse(s) programmée(s).`); }}><I.refresh size={15} />Tout ré-analyser</button>
        </div>
      </div>
      <div className="card" style={{ borderRadius: 22 }}>
        <div className="row" style={{ padding: '16px 18px 4px' }}><h2 className="panel-title grow">Journal des actions</h2><span className="muted" style={{ fontSize: 12 }}>200 dernières actions</span></div>
        <div className="table-wrap"><table className="data" style={{ minWidth: 640 }}>
          <thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Objet</th></tr></thead>
          <tbody>{log.data?.map((a) => <tr key={a.id}><td className="muted" style={{ fontSize: 12 }}>{dateFr(a.at, true)}</td><td>{a.user_name ?? 'système'}</td><td><span className="pill" style={{ background: '#EAF4FD', color: '#084E8A' }}>{a.action}</span></td><td style={{ fontSize: 12 }}>{a.entity}{a.entity_id ? ` · ${String(a.entity_id).slice(0, 8)}` : ''}</td></tr>)}</tbody>
        </table></div>
      </div>
    </div>
  );
}

function Compliance() {
  return (
    <div className="card col" style={{ padding: 22, gap: 12, maxWidth: 860, lineHeight: 1.6, fontSize: 14 }}>
      <h2 className="panel-title">Comment le Radar protège Digilago</h2>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <li><strong>Sources officielles uniquement</strong> : API Google Places et OpenStreetMap, sites officiels lus en respectant robots.txt et un délai entre les requêtes. Aucun contournement de CAPTCHA, de connexion ou de limite.</li>
        <li><strong>Provenance et date</strong> sur chaque coordonnée, visibles dans les fiches et les exports.</li>
        <li><strong>WhatsApp jamais deviné</strong> : seulement si l’entreprise publie un lien WhatsApp, ou si un membre de l’équipe le confirme.</li>
        <li><strong>Pas d’envoi automatique</strong> : les messages s’ouvrent rédigés, un humain les envoie un par un.</li>
        <li><strong>Liste « ne pas contacter »</strong> appliquée partout, y compris aux coordonnées qui réapparaissent plus tard.</li>
        <li><strong>Journal</strong> de toutes les actions sensibles (exports, corrections, fusions, oppositions).</li>
        <li><strong>Rétention</strong> : les contenus Google portent une date de rafraîchissement (paramètre GOOGLE_PLACES_RETENTION_DAYS) à aligner sur les conditions Google en vigueur.</li>
      </ul>
      <div className="notice warn">À faire avant un usage à grande échelle : faire valider la démarche par un juriste (loi 09-08) et, si nécessaire, déclarer le traitement à la CNDP, en particulier pour les numéros mobiles de gérants et les auto-entrepreneurs.</div>
    </div>
  );
}
