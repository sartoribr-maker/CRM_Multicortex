import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';

const inputClass =
  'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const data = await apiJson<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível processar o pedido.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail para receber o link de redefinição"
    >
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

        {message && (
          <p className="rounded-card bg-success/10 px-3 py-2 text-sm text-success">{message}</p>
        )}
        {error && (
          <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-60"
        >
          {isSubmitting ? 'Enviando…' : 'Enviar link de redefinição'}
        </button>

        <Link to="/login" className="text-center text-sm text-brand-blue hover:text-brand-blue-dark">
          Voltar para o login
        </Link>
      </form>
    </AuthLayout>
  );
}
