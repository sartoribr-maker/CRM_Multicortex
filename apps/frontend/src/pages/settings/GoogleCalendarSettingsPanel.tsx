import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  calendarApi,
  type GoogleCalendarSettings,
  type GoogleCalendarSettingsPayload,
} from '../../lib/calendarApi';
import { stagesApi } from '../../lib/settingsApi';
import type { Stage } from '../../types/settings';

export function GoogleCalendarSettingsPanel() {
  const [settings, setSettings] = useState<GoogleCalendarSettings | null>(null);
  const [form, setForm] = useState<GoogleCalendarSettingsPayload | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load(data: GoogleCalendarSettings) {
    setSettings(data);
    setForm({
      enabled: data.enabled,
      workspaceDomain: data.workspaceDomain,
      fallbackOrganizerEmail: data.fallbackOrganizerEmail,
      meetingStageId: data.meetingStageId,
      defaultDurationMinutes: data.defaultDurationMinutes,
    });
  }

  useEffect(() => {
    Promise.all([calendarApi.getSettings(), stagesApi.list()])
      .then(([data, stageData]) => {
        load(data);
        setStages([...stageData].sort((a, b) => a.order - b.order));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'));
  }, []);

  function update<K extends keyof GoogleCalendarSettingsPayload>(
    key: K,
    value: GoogleCalendarSettingsPayload[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setMessage('');
  }

  async function onKeyFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) update('serviceAccountKey', await file.text());
    event.target.value = '';
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      load(await calendarApi.updateSettings(form));
      setMessage('Configuração salva.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setError('');
    setMessage('');
    try {
      setMessage((await calendarApi.testSettings()).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no teste.');
    } finally {
      setTesting(false);
    }
  }

  if (!form || !settings) return <p className="text-sm text-slate-400">{error || 'Carregando…'}</p>;

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        <p className="font-semibold text-slate-700">Como funciona</p>
        <p>
          Usuários do domínio <strong>@{form.workspaceDomain}</strong> criam a reunião na própria
          agenda; os demais (como SDRs terceirizados), na agenda de{' '}
          <strong>{form.fallbackOrganizerEmail}</strong>, como convidados. Os contatos recebem o
          convite do Google com o link do Meet. Passo a passo da chave em{' '}
          <code>docs/GOOGLE_AGENDA.md</code>.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => update('enabled', event.target.checked)}
        />
        Integração com o Google Agenda ativa
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Domínio do Google Workspace</label>
          <input
            required
            className="form-control"
            value={form.workspaceDomain}
            onChange={(event) => update('workspaceDomain', event.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Agenda padrão (usuários de fora do domínio)</label>
          <input
            required
            type="email"
            className="form-control"
            value={form.fallbackOrganizerEmail}
            onChange={(event) => update('fallbackOrganizerEmail', event.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Etapa que oferece o agendamento</label>
          <select
            className="form-control"
            value={form.meetingStageId ?? ''}
            onChange={(event) => update('meetingStageId', event.target.value || null)}
          >
            <option value="">Nenhuma (não perguntar)</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Duração padrão (minutos)</label>
          <input
            type="number"
            min={15}
            max={480}
            required
            className="form-control"
            value={form.defaultDurationMinutes}
            onChange={(event) => update('defaultDurationMinutes', Number(event.target.value))}
          />
        </div>
      </div>

      <div>
        <label className="form-label">Chave da conta de serviço (JSON)</label>
        <p className="mb-2 text-xs text-slate-400">
          {settings.hasServiceAccountKey
            ? `Chave configurada para ${settings.serviceAccountEmail}. Envie outra apenas para substituí-la.`
            : 'Nenhuma chave configurada.'}
        </p>
        <input type="file" accept="application/json,.json" onChange={onKeyFile} className="text-sm" />
        {form.serviceAccountKey && (
          <p className="mt-2 text-xs font-semibold text-emerald-600">
            Nova chave carregada; será criptografada ao salvar.
          </p>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={test}
          disabled={testing || !settings.hasServiceAccountKey}
        >
          {testing ? 'Testando…' : 'Testar conexão'}
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </form>
  );
}
