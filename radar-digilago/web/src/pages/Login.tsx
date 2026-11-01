import { useState } from 'react';
import { RadarMark } from '../components/Icons';
import { useAuth } from '../lib/auth';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, perspective: 1200, overflow: 'hidden' }}>
        <img src="/map/map-base.webp" alt="" style={{ position: 'absolute', left: '50%', top: '58%', width: 1500, transform: 'translate(-50%, -50%) rotateX(48deg)', opacity: 0.9 }} />
      </div>
      <form className="glass a-rise" style={{ position: 'relative', width: 'min(420px, 100%)', borderRadius: 28, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await login(email, password); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="brand-mark" style={{ width: 52, height: 52, borderRadius: 16 }}><RadarMark size={52} /></span>
          <div><div className="display" style={{ fontSize: 24, fontWeight: 700 }}>Radar</div><div className="kicker" style={{ letterSpacing: '.18em' }}>DIGILAGO</div></div>
        </div>
        <p className="muted" style={{ margin: 0 }}>Toutes les entreprises du Maroc, leur présence en ligne, et qui contacter aujourd’hui.</p>
        <label className="field">Email<input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Mot de passe<input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <div className="error-box" role="alert">{err}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <span className="muted" style={{ fontSize: 12 }}>Accès réservé à l’équipe Digilago. Toutes les actions sont journalisées.</span>
      </form>
    </div>
  );
}
