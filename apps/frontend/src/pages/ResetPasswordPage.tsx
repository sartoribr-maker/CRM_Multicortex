import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';

const inputClass =
  'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiJson('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link inválido" subtitle="O link de redefinição de senha está incompleto.">
        <Link to="/forgot-password" className="text-sm text-brand-blue hover:text-brand-blue-dark">
          Solicitar um novo link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Redefinir senha" subtitle="Escolha uma nova senha para sua conta">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-ink">
            Nova senha
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        {success && (
          <p className="rounded-card bg-success/10 px-3 py-2 text-sm text-success">
            Senha redefinida com sucesso! Redirecionando para o login…
          </p>
        )}
        {error && (
          <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || success}
          className="mt-2 rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-60"
        >
          {isSubmitting ? 'Salvando…' : 'Redefinir senha'}
        </button>
      </form>
    </AuthLayout>
  );
}
