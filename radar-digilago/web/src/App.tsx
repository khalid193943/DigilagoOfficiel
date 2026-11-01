import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { MetaProvider } from './lib/meta';
import { Login } from './pages/Login';
import { Command } from './pages/Command';

const Scan = lazy(() => import('./pages/Scan').then((m) => ({ default: m.Scan })));
const Companies = lazy(() => import('./pages/Companies').then((m) => ({ default: m.Companies })));
const Company = lazy(() => import('./pages/Company').then((m) => ({ default: m.Company })));
const Coverage = lazy(() => import('./pages/Coverage').then((m) => ({ default: m.Coverage })));
const Pipeline = lazy(() => import('./pages/Pipeline').then((m) => ({ default: m.Pipeline })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

function Gate() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="empty" style={{ minHeight: '100vh' }}><div className="skeleton" style={{ width: 160, height: 12 }} /></div>;
  if (!user) return <Login />;
  return (
    <MetaProvider>
      <Suspense fallback={<div className="page"><div className="skeleton" style={{ height: 64 }} /><div className="skeleton" style={{ height: 420 }} /></div>}>
        <Routes>
          <Route path="/" element={<Command />} />
          <Route path="/balayages" element={<Scan />} />
          <Route path="/balayages/:id" element={<Scan />} />
          <Route path="/entreprises" element={<Companies />} />
          <Route path="/entreprises/:id" element={<Company />} />
          <Route path="/couverture" element={<Coverage />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/parametres" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </MetaProvider>
  );
}

export function App() {
  return <BrowserRouter><ToastProvider><AuthProvider><Gate /></AuthProvider></ToastProvider></BrowserRouter>;
}
