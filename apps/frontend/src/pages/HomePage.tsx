import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();
  const canManageSettings = user?.permissions.includes('settings.manage') ?? false;

  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="flex items-center justify-between bg-brand-purple-dark px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Multicortex" className="h-8" />
        </div>
        <div className="flex items-center gap-2">
          {canManageSettings && (
            <Link
              to="/settings"
              className="rounded-card border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
            >
              Configurações
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="rounded-card border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center gap-6 px-4 py-16">
        <div className="w-full max-w-lg rounded-card bg-surface p-6 shadow-md">
          <h1 className="font-heading text-xl font-bold text-brand-purple-dark">
            Olá, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-ink/70">
            Você está logado como <span className="font-semibold">{user?.role.name}</span>.
          </p>

          <div className="mt-4 rounded-card border border-surface-muted p-4">
            <p className="text-sm text-ink/70">E-mail</p>
            <p className="text-sm font-medium text-ink">{user?.email}</p>
          </div>

          <p className="mt-4 text-xs text-ink/50">
            Esta é uma tela provisória (Fase 1). O dashboard executivo completo chega na Fase 7.
          </p>
        </div>
      </main>
    </div>
  );
}
