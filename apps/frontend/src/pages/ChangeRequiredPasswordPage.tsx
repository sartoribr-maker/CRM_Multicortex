import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { apiJson } from '../lib/api';

export default function ChangeRequiredPasswordPage() {
  const location = useLocation();
  const changeToken = (location.state as { changeToken?: string } | null)?.changeToken;
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!changeToken && !success) return <Navigate to="/login" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setSaving(true);
    try {
      await apiJson('/auth/change-required-password', {
        method: 'POST',
        body: JSON.stringify({ changeToken, newPassword }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout title="Crie uma nova senha" subtitle="A troca é obrigatória antes de acessar o CRM">
      {success ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-card bg-green-50 px-3 py-2 text-sm text-green-700">
            Senha alterada com sucesso.
          </p>
          <Link to="/login" className="btn-primary text-center">Entrar com a nova senha</Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div>
            <label htmlFor="new-password" className="form-label">Nova senha</label>
            <input id="new-password" type="password" required minLength={8} autoComplete="new-password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="password-confirmation" className="form-label">Confirmar nova senha</label>
            <input id="password-confirmation" type="password" required minLength={8} autoComplete="new-password" className="form-control" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          {error && <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary mt-2 w-full">
            {saving ? 'Salvando…' : 'Alterar senha'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
