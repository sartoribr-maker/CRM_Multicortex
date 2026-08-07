import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { emailSettingsApi } from '../../lib/settingsApi';
import type { EmailSettings, EmailSettingsPayload } from '../../types/settings';

const INITIAL_FORM: EmailSettingsPayload = {
  enabled: false,
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  username: 'sartori.br@gmail.com',
  password: '',
  fromEmail: 'sartori.br@gmail.com',
  fromName: 'Multicortex CRM',
};

function settingsToForm(settings: EmailSettings): EmailSettingsPayload {
  return {
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    password: '',
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
  };
}

export function EmailSettingsPanel() {
  const [form, setForm] = useState<EmailSettingsPayload>(INITIAL_FORM);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    emailSettingsApi
      .get()
      .then((data) => {
        setSettings(data);
        setForm(settingsToForm(data));
      })
      .catch((error) =>
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Erro ao carregar a configuração.',
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof EmailSettingsPayload>(key: K, value: EmailSettingsPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await emailSettingsApi.update(form);
      setSettings(updated);
      setForm(settingsToForm(updated));
      setMessage({ type: 'success', text: 'Configuração de e-mail salva com sucesso.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao salvar a configuração.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function testEmail() {
    setTesting(true);
    setMessage(null);
    try {
      const result = await emailSettingsApi.test();
      setMessage({ type: 'success', text: `E-mail de teste enviado para ${result.recipient}.` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao enviar o teste.',
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading)
    return <p className="py-12 text-center text-sm text-slate-400">Carregando configuração…</p>;

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading font-bold text-slate-800">Notificações automáticas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Envia avisos aos responsáveis por oportunidades e tarefas.
          </p>
        </div>
        <label className="flex items-center gap-3 font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => update('enabled', event.target.checked)}
            className="h-5 w-5 accent-brand-purple"
          />
          Envio ativo
        </label>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Servidor SMTP">
          <input
            required
            className="form-control"
            value={form.host}
            onChange={(event) => update('host', event.target.value)}
          />
        </Field>
        <Field label="Porta">
          <input
            required
            type="number"
            min={1}
            max={65535}
            className="form-control"
            value={form.port}
            onChange={(event) => update('port', Number(event.target.value))}
          />
        </Field>
        <Field label="Usuário / e-mail">
          <input
            required
            type="email"
            autoComplete="username"
            className="form-control"
            value={form.username}
            onChange={(event) => update('username', event.target.value)}
          />
        </Field>
        <Field
          label="Senha de aplicativo"
          hint={
            settings?.hasPassword
              ? 'Uma senha já está cadastrada. Deixe vazio para mantê-la.'
              : 'No Gmail, utilize uma senha de aplicativo de 16 caracteres.'
          }
        >
          <input
            type="password"
            autoComplete="new-password"
            className="form-control"
            value={form.password ?? ''}
            onChange={(event) => update('password', event.target.value)}
            placeholder={
              settings?.hasPassword ? '••••••••••••••••' : 'Informe a senha de aplicativo'
            }
          />
        </Field>
        <Field label="E-mail remetente">
          <input
            required
            type="email"
            className="form-control"
            value={form.fromEmail}
            onChange={(event) => update('fromEmail', event.target.value)}
          />
        </Field>
        <Field label="Nome do remetente">
          <input
            required
            className="form-control"
            value={form.fromName}
            onChange={(event) => update('fromName', event.target.value)}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={form.secure}
          onChange={(event) => update('secure', event.target.checked)}
          className="h-4 w-4 accent-brand-purple"
        />
        Conexão SSL direta (normalmente ativa na porta 465; deixe desmarcada para Gmail na porta
        587)
      </label>

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          className="btn-secondary"
          disabled={testing || !settings?.hasPassword || !settings.enabled}
          onClick={testEmail}
        >
          <Icon name="mail" className="h-4 w-4" />
          {testing ? 'Enviando…' : 'Enviar e-mail de teste'}
        </button>
        <button className="btn-primary" disabled={saving}>
          <Icon name="view" className="h-4 w-4" />
          {saving ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label>
      <span className="form-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-5 text-slate-400">{hint}</span>}
    </label>
  );
}
