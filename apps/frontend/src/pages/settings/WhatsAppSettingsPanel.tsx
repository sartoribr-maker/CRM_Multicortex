import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { PhoneInput } from '../../components/MaskedInputs';
import { whatsappSettingsApi } from '../../lib/settingsApi';
import type { WhatsAppSettings, WhatsAppSettingsPayload } from '../../types/settings';

const INITIAL: WhatsAppSettingsPayload = {
  enabled: false,
  apiVersion: 'v23.0',
  phoneNumberId: '',
  businessAccountId: '',
  accessToken: '',
  languageCode: 'pt_BR',
  testTemplate: 'hello_world',
  leadCreatedTemplate: '',
  leadStageTemplate: '',
  taskCreatedTemplate: '',
  taskUpdatedTemplate: '',
  testPhone: '',
  notifyLeadCreated: true,
  notifyLeadStageChanged: true,
  notifyTaskCreated: true,
  notifyTaskUpdated: true,
};

type NotificationToggle =
  'notifyLeadCreated' | 'notifyLeadStageChanged' | 'notifyTaskCreated' | 'notifyTaskUpdated';

function toForm(item: WhatsAppSettings): WhatsAppSettingsPayload {
  return {
    enabled: item.enabled,
    apiVersion: item.apiVersion,
    phoneNumberId: item.phoneNumberId,
    businessAccountId: item.businessAccountId,
    accessToken: '',
    languageCode: item.languageCode,
    testTemplate: item.testTemplate,
    leadCreatedTemplate: item.leadCreatedTemplate,
    leadStageTemplate: item.leadStageTemplate,
    taskCreatedTemplate: item.taskCreatedTemplate,
    taskUpdatedTemplate: item.taskUpdatedTemplate,
    testPhone: item.testPhone,
    notifyLeadCreated: item.notifyLeadCreated,
    notifyLeadStageChanged: item.notifyLeadStageChanged,
    notifyTaskCreated: item.notifyTaskCreated,
    notifyTaskUpdated: item.notifyTaskUpdated,
  };
}

export function WhatsAppSettingsPanel() {
  const [form, setForm] = useState<WhatsAppSettingsPayload>(INITIAL);
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    whatsappSettingsApi
      .get()
      .then((item) => {
        setSettings(item);
        setForm(toForm(item));
      })
      .catch((error) =>
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Erro ao carregar.',
        }),
      )
      .finally(() => setLoading(false));
  }, []);
  function update<K extends keyof WhatsAppSettingsPayload>(
    key: K,
    value: WhatsAppSettingsPayload[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const item = await whatsappSettingsApi.update(form);
      setSettings(item);
      setForm(toForm(item));
      setMessage({ type: 'success', text: 'Configuração do WhatsApp salva.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao salvar.',
      });
    } finally {
      setSaving(false);
    }
  }
  async function test() {
    setTesting(true);
    setMessage(null);
    try {
      const result = await whatsappSettingsApi.test();
      setMessage({ type: 'success', text: `Mensagem de teste enviada para ${result.recipient}.` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha no teste.',
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
          <h2 className="font-heading font-bold text-slate-800">WhatsApp Business Cloud API</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configuração preparada para a integração oficial da Meta.
          </p>
        </div>
        <label className="flex items-center gap-3 font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-purple"
            checked={form.enabled}
            onChange={(event) => update('enabled', event.target.checked)}
          />
          Integração ativa
        </label>
      </div>
      {!form.enabled && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-700">
          A integração está desativada. Você pode organizar e salvar os campos agora; nenhuma
          mensagem será enviada até ativá-la.
        </div>
      )}
      {message && (
        <div
          className={`rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}
        >
          {message.text}
        </div>
      )}

      <section>
        <h3 className="mb-4 font-heading font-bold text-slate-800">Credenciais da Meta</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Versão da Graph API"
            hint="Exemplo: v23.0. Ajuste conforme a versão habilitada na Meta."
          >
            <input
              required
              className="form-control"
              value={form.apiVersion}
              onChange={(e) => update('apiVersion', e.target.value)}
            />
          </Field>
          <Field label="Phone Number ID">
            <input
              className="form-control"
              value={form.phoneNumberId}
              onChange={(e) => update('phoneNumberId', e.target.value)}
            />
          </Field>
          <Field label="WhatsApp Business Account ID">
            <input
              className="form-control"
              value={form.businessAccountId}
              onChange={(e) => update('businessAccountId', e.target.value)}
            />
          </Field>
          <Field
            label="Token de acesso"
            hint={
              settings?.hasAccessToken
                ? 'Um token já está armazenado. Deixe vazio para mantê-lo.'
                : 'Use preferencialmente um token permanente de usuário do sistema.'
            }
          >
            <input
              type="password"
              autoComplete="new-password"
              className="form-control"
              value={form.accessToken ?? ''}
              onChange={(e) => update('accessToken', e.target.value)}
              placeholder={settings?.hasAccessToken ? '••••••••••••••••' : 'Cole o token da Meta'}
            />
          </Field>
        </div>
      </section>

      <section className="border-t border-slate-100 pt-6">
        <h3 className="mb-4 font-heading font-bold text-slate-800">Templates aprovados</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Idioma">
            <input
              required
              className="form-control"
              value={form.languageCode}
              onChange={(e) => update('languageCode', e.target.value)}
            />
          </Field>
          <Field label="Template de teste">
            <input
              className="form-control"
              value={form.testTemplate}
              onChange={(e) => update('testTemplate', e.target.value)}
            />
          </Field>
          <Field label="Criação de oportunidade">
            <input
              className="form-control"
              value={form.leadCreatedTemplate}
              onChange={(e) => update('leadCreatedTemplate', e.target.value)}
            />
          </Field>
          <Field label="Mudança de etapa">
            <input
              className="form-control"
              value={form.leadStageTemplate}
              onChange={(e) => update('leadStageTemplate', e.target.value)}
            />
          </Field>
          <Field label="Criação de tarefa">
            <input
              className="form-control"
              value={form.taskCreatedTemplate}
              onChange={(e) => update('taskCreatedTemplate', e.target.value)}
            />
          </Field>
          <Field label="Alteração de tarefa">
            <input
              className="form-control"
              value={form.taskUpdatedTemplate}
              onChange={(e) => update('taskUpdatedTemplate', e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="border-t border-slate-100 pt-6">
        <h3 className="mb-4 font-heading font-bold text-slate-800">
          Eventos que enviarão mensagens
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['notifyLeadCreated', 'Novo Lead/Oportunidade'],
              ['notifyLeadStageChanged', 'Mudança de etapa'],
              ['notifyTaskCreated', 'Nova tarefa'],
              ['notifyTaskUpdated', 'Alteração de tarefa'],
            ] as Array<[NotificationToggle, string]>
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-purple"
                checked={form[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-100 pt-6">
        <Field
          label="Telefone para teste"
          hint="Informe DDI + DDD + número, somente dígitos. Exemplo: 5511999999999."
        >
          <PhoneInput
            className="form-control"
            value={form.testPhone}
            onValueChange={(value) => update('testPhone', value)}
          />
        </Field>
      </section>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          className="btn-secondary"
          disabled={testing || !settings?.enabled || !settings.hasAccessToken}
          onClick={test}
        >
          <Icon name="mail" className="h-4 w-4" />
          {testing ? 'Enviando…' : 'Enviar mensagem de teste'}
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
