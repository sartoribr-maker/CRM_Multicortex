import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import type { AuthUser } from '../types/auth';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

const inputClass =
  'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
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
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
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

        {error && (
          <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-60"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>

        <Link
          to="/forgot-password"
          className="text-center text-sm text-brand-blue hover:text-brand-blue-dark"
        >
          Esqueci minha senha
        </Link>
      </form>
    </AuthLayout>
  );
}
