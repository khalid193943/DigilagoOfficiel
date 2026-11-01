import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, can, useAuth } from '../lib/auth';
import { useMeta } from '../lib/meta';
import { I, RadarMark } from './Icons';

export function TopBar({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const { meta } = useMeta();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const demoOnly = meta?.sources.filter((s) => s.enabled).every((s) => s.id === 'demo');
  return (
    <header className="topbar">
      <NavLink to="/" className="brand" aria-label="Radar Digilago, accueil">
        <span className="brand-mark"><RadarMark /></span>
        <span className="brand-name"><b>Radar</b><small>DIGILAGO</small></span>
      </NavLink>
      <nav className="nav" aria-label="Navigation principale">
        <NavLink to="/" end><span className="dot a-blink" style={{ background: '#0B9BE8', width: 7, height: 7 }} />Radar</NavLink>
        <NavLink to="/balayages">Balayages</NavLink>
        <NavLink to="/entreprises">Entreprises</NavLink>
        <NavLink to="/couverture">Couverture</NavLink>
        <NavLink to="/pipeline">Pipeline</NavLink>
      </nav>
      <form className="search grow" style={{ flex: '1 1 240px' }} onSubmit={(e) => { e.preventDefault(); nav(`/entreprises?q=${encodeURIComponent(q)}&view=all`); }} role="search">
        <I.search size={17} />
        <label className="sr" htmlFor="global-q">Rechercher</label>
        <input id="global-q" ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Entreprise, téléphone, domaine, ville…" />
        <kbd>⌘ K</kbd>
      </form>
      {children}
      {demoOnly && <span className="badge-demo" style={{ height: 30, padding: '0 11px', borderRadius: 15 }} title="Seule la source de démonstration est active">MODE DÉMO · FICTIF</span>}
      <div style={{ position: 'relative' }}>
        <button className="avatar" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Compte : ${user?.name}`}>{user?.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</button>
        {open && (
          <div className="menu" role="menu" onMouseLeave={() => setOpen(false)}>
            <div style={{ padding: '8px 12px 10px' }}><div style={{ fontWeight: 800 }}>{user?.name}</div><div className="muted" style={{ fontSize: 12 }}>{user?.email} · {user ? ROLE_LABEL[user.role] : ''}</div></div>
            <NavLink to="/parametres" role="menuitem" onClick={() => setOpen(false)}><I.settings size={16} />Paramètres{can(user, 'admin') ? ' & équipe' : ''}</NavLink>
            <button role="menuitem" onClick={() => { setOpen(false); logout(); }}><I.logout size={16} />Se déconnecter</button>
          </div>
        )}
      </div>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="page"><TopBar />{children}</div>;
}
