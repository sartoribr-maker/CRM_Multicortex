import { useEffect, useState } from 'react';
import type { ApiHealthResponse } from '@multicortex/shared';
import { fetchHealth } from './lib/api';
import logo from './assets/logo.png';

type HealthState =
  | { status: 'loading' }
  | { status: 'success'; data: ApiHealthResponse }
  | { status: 'error'; message: string };

function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    fetchHealth()
      .then((data) => setHealth({ status: 'success', data }))
      .catch((error: Error) => setHealth({ status: 'error', message: error.message }));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <img src={logo} alt="Multicortex" className="h-16" />

      <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-md">
        <h1 className="font-heading text-xl font-bold text-brand-purple-dark">
          Multicortex CRM
        </h1>
        <p className="mt-1 text-sm text-ink/70">
          Fase 0 — verificação de integração frontend ↔ backend
        </p>

        <div className="mt-4 rounded-card border border-surface-muted p-4">
          {health.status === 'loading' && (
            <p className="text-sm text-ink/70">Consultando API…</p>
          )}
          {health.status === 'success' && (
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-success" />
              <p className="text-sm text-ink">
                Backend OK — status{' '}
                <span className="font-semibold text-success">{health.data.status}</span> em{' '}
                {new Date(health.data.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
          {health.status === 'error' && (
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-danger" />
              <p className="text-sm text-danger">Falha ao conectar: {health.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
