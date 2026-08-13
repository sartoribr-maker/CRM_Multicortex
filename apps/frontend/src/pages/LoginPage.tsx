import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';
import { APP_VERSION } from '../lib/version';
import { useAuthStore } from '../store/useAuthStore';
import type { AuthUser } from '../types/auth';

type LoginResponse =
  | { passwordChangeRequired: true; changeToken: string }
  | { passwordChangeRequired: false; accessToken: string; user: AuthUser };

const inputClass =
  'form-control';
const REMEMBERED_EMAIL_KEY = 'multicortex.rememberedEmail';

export default function LoginPage() {
  const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const data = await apiJson<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (rememberEmail) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      if (data.passwordChangeRequired) {
        navigate('/change-password', { replace: true, state: { changeToken: data.changeToken } });
        return;
      }
      setSession(data.accessToken, data.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse o Multicortex CRM">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="form-label">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" className="form-label">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-purple"
            checked={rememberEmail}
            onChange={(e) => setRememberEmail(e.target.checked)}
          />
          Lembrar meu e-mail no próximo login
        </label>

        {error && (
          <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary mt-2 w-full"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>

        <Link
          to="/forgot-password"
          className="text-center text-sm text-brand-blue hover:text-brand-blue-dark"
        >
          Esqueci minha senha
        </Link>

        <p className="pt-1 text-center text-[11px] text-slate-400">
          MultiCortex CRM · Versão {APP_VERSION}
        </p>
      </form>
    </AuthLayout>
  );
}
