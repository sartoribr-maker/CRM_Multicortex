import { useEffect, useState, type FormEvent } from 'react';
import { apiJson } from '../../lib/api';

type Settings = {
  enabled: boolean;
  startTime: string;
  intervalDays: number;
  monitorUserId: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
};
type User = { id: string; name: string; email: string };
const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

export function MonitoringSettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    Promise.all([
      apiJson<Settings>('/monitoring-settings'),
      apiJson<User[]>('/monitoring-settings/users'),
    ])
      .then(([data, options]) => {
        setSettings(data);
        setUsers(options);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar configuração.'),
      );
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { enabled, startTime, intervalDays, monitorUserId } = settings;
      setSettings(
        await apiJson<Settings>('/monitoring-settings', {
          method: 'PUT',
          body: JSON.stringify({ enabled, startTime, intervalDays, monitorUserId }),
        }),
      );
      setMessage('Configuração salva com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
          {message}
        </p>
      )}
      {!settings ? (
        <p>
          {error
            ? 'Não foi possível carregar a configuração. Recarregue a página para tentar novamente.'
            : 'Carregando configuração…'}
        </p>
      ) : (
        <>
          <fieldset disabled={saving} className="space-y-5">
            <label className="flex items-center gap-3 font-semibold">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
              />
              Monitoramento ativo
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className="form-label">Horário de ativação (Brasília)</span>
                <input
                  required
                  type="time"
                  className="form-control"
                  value={settings.startTime}
                  onChange={(event) => setSettings({ ...settings, startTime: event.target.value })}
                />
              </label>
              <label>
                <span className="form-label">Periodicidade: a cada quantos dias?</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  className="form-control"
                  value={settings.intervalDays}
                  onChange={(event) =>
                    setSettings({ ...settings, intervalDays: Number(event.target.value) })
                  }
                />
                <span className="text-xs text-slate-500">
                  1 = diariamente; 7 = semanalmente. Sempre no horário informado.
                </span>
              </label>
            </div>
            <label className="block">
              <span className="form-label">Usuário de monitoramento</span>
              <select
                required={settings.enabled}
                className="form-control"
                value={settings.monitorUserId ?? ''}
                onChange={(event) =>
                  setSettings({ ...settings, monitorUserId: event.target.value || null })
                }
              >
                <option value="">Selecione um usuário ativo</option>
                {settings.monitorUserId &&
                  !users.some((user) => user.id === settings.monitorUserId) && (
                    <option value={settings.monitorUserId}>
                      Usuário indisponível — selecione outro
                    </option>
                  )}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar configuração'}
            </button>
          </fieldset>
          <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              Tarefas atrasadas, exceto concluídas e canceladas: cada responsável recebe suas
              tarefas. O usuário de monitoramento e os usuários com “Cobrar” marcado recebem todas
              as tarefas atrasadas.
            </p>
            <p>
              Oportunidades nas etapas Backlog ou Leads: relatório separado, enviado apenas ao
              usuário de monitoramento e aos cobradores.
            </p>
            <p>
              Somente usuários ativos recebem e-mails. Relatórios sem pendências não são enviados.
              Configure e ative o SMTP em Configuração de E-mail.
            </p>
            <p>Próxima execução: {formatDate(settings.nextRunAt)} (Brasília)</p>
            <p>Última tentativa: {formatDate(settings.lastRunAt)} (Brasília)</p>
            {settings.lastError && (
              <p role="alert" className="text-red-700">
                {settings.lastError}
              </p>
            )}
          </div>
        </>
      )}
    </form>
  );
}
