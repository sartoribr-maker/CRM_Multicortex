import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { Icon } from '../../components/Icon';
import { apiFetch } from '../../lib/api';
import { avatarUrl } from '../../lib/usersApi';
import { APP_VERSION } from '../../lib/version';
import { isThirdPartyUser } from '../../routes/ProtectedRoute';
import { useAuthStore } from '../../store/useAuthStore';
import { useUiStore } from '../../store/useUiStore';

const tabs = [
  { to: '/terceiro', label: 'Dashboard', end: true },
  { to: '/terceiro/kanban', label: 'Kanban comercial', end: false },
];

/** Layout do Portal de Terceiros: sem o menu lateral do CRM interno. */
export function ThirdPartyShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const navigate = useNavigate();
  const initials = user?.name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-app-bg">
      <a href="#conteudo-principal" className="skip-link">
        Ir para o conteúdo principal
      </a>
      <header className="mobile-header sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 md:px-8">
          <img src={logo} alt="Multicortex" className="h-8 w-auto shrink-0 object-contain" />
          <span className="hidden rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-purple sm:inline">
            Portal SDR
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!isThirdPartyUser(user) && (
              <Link to="/" className="btn-secondary hidden !py-2 text-xs md:inline-flex">
                <Icon name="arrow-left" className="h-4 w-4" />
                Voltar ao CRM
              </Link>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-button"
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" />
            </button>
            {user?.avatarUrl ? (
              <img
                src={avatarUrl(user.id, user.avatarUrl)}
                alt={`Foto de ${user.name}`}
                className="h-9 w-9 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-brand-purple text-xs font-bold text-white">
                {initials}
              </div>
            )}
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold text-slate-700">{user?.name}</p>
              <p className="text-[10px] text-slate-400">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="icon-button"
              aria-label="Sair"
              title="Sair"
            >
              <Icon name="logout" className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-[1600px] gap-1 overflow-x-auto px-4 md:px-8">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'border-brand-purple text-brand-purple'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main
        id="conteudo-principal"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1600px] px-4 py-6 outline-none md:px-8 md:py-8"
      >
        {children}
      </main>
      <p className="pb-6 text-center text-[10px] text-slate-400">Versão {APP_VERSION}</p>
    </div>
  );
}
