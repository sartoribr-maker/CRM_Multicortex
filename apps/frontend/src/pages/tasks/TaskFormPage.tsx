import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { DateInput } from '../../components/MaskedInputs';
import { leadsApi } from '../../lib/leadsApi';
import { tasksApi } from '../../lib/tasksApi';
import { usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPayload,
  type TaskPriority,
  type TaskStatus,
} from '../../types/tasks';
import type { LeadListItem } from '../../types/leads';
function localDate(value: Date) {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}
export default function TaskFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdministrator = user?.role.name.trim().toLocaleLowerCase('pt-BR') === 'administrador';
  const [form, setForm] = useState<TaskPayload>({
    title: '',
    dueDate: localDate(new Date(Date.now() + 86400000)),
    priority: 'MEDIUM',
    status: 'TODO',
    leadId: params.get('leadId') ?? undefined,
  });
  const [users, setUsers] = useState<UserOption[]>([]);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => {
    leadsApi.list({ pageSize: 100 }).then((r) => setLeads(r.items));
    if (isAdministrator) usersApi.list().then(setUsers);
  }, [isAdministrator]);
  useEffect(() => {
    if (!id) return;
    tasksApi
      .get(id)
      .then((t) =>
        setForm({
          title: t.title,
          description: t.description ?? undefined,
          status: t.status,
          priority: t.priority,
          dueDate: localDate(new Date(t.dueDate)),
          leadId: t.lead?.id,
          assigneeIds: t.assignees.map(({ user: assignee }) => assignee.id),
        }),
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [id]);
  function field<K extends keyof TaskPayload>(k: K, v: TaskPayload[K]) {
    setForm((c) => ({ ...c, [k]: v }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, dueDate: new Date(`${form.dueDate}T12:00:00`).toISOString() };
      const r = editing ? await tasksApi.update(id!, payload) : await tasksApi.create(payload);
      await Promise.all(files.map((file) => tasksApi.uploadAttachment(r.id, file)));
      nav(`/tasks/${r.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tarefa.');
    } finally {
      setSaving(false);
    }
  }
  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const oversized = selected.find((file) => file.size > 15 * 1024 * 1024);
    if (oversized) {
      setError(`O arquivo ${oversized.name} excede o limite de 15 MB.`);
      event.target.value = '';
      return;
    }
    setFiles((current) => [...current, ...selected]);
    event.target.value = '';
  }
  if (loading)
    return <div className="flex min-h-screen items-center justify-center">Carregando…</div>;
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Agenda comercial"
          title={editing ? 'Editar tarefa' : 'Nova tarefa'}
          description="Organize o próximo passo, responsável e prazo da atividade."
          actions={
            <button className="btn-secondary" onClick={() => nav('/tasks')}>
              <Icon name="x" className="h-4 w-4" />
              Cancelar
            </button>
          }
        />
        <form onSubmit={submit} className="space-y-5">
          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading font-bold text-slate-800">Informações da tarefa</h2>
            </div>
            <div className="form-section-body">
              <div className="md:col-span-2">
                <label className="form-label">Título *</label>
                <input
                  required
                  className="form-control"
                  value={form.title}
                  onChange={(e) => field('title', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Prazo *</label>
                <DateInput
                  required
                  className="form-control"
                  value={form.dueDate}
                  onValueChange={(value) => field('dueDate', value ?? '')}
                />
              </div>
              <div>
                <label className="form-label">Prioridade</label>
                <select
                  className="form-control"
                  value={form.priority}
                  onChange={(e) => field('priority', e.target.value as TaskPriority)}
                >
                  {Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={form.status}
                  onChange={(e) => field('status', e.target.value as TaskStatus)}
                >
                  {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              {isAdministrator && (
                <div>
                  <label className="form-label">Responsáveis *</label>
                  <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                    {users.map((responsible) => {
                      const checked = form.assigneeIds?.includes(responsible.id) ?? false;
                      return (
                        <label key={responsible.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              field(
                                'assigneeIds',
                                event.target.checked
                                  ? [...(form.assigneeIds ?? []), responsible.id]
                                  : (form.assigneeIds ?? []).filter((id) => id !== responsible.id),
                              )
                            }
                          />
                          <span>{responsible.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="form-label">Oportunidade relacionada</label>
                <select
                  className="form-control"
                  value={form.leadId ?? ''}
                  onChange={(e) => field('leadId', e.target.value || undefined)}
                >
                  <option value="">Sem oportunidade vinculada</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.companyName ? ` · ${l.companyName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Descrição</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={form.description ?? ''}
                  onChange={(e) => field('description', e.target.value || undefined)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Anexos</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-purple/40 bg-purple-50/40 px-4 py-5 text-sm font-semibold text-brand-purple hover:bg-purple-50">
                  <Icon name="upload" className="h-4 w-4" />
                  Selecionar arquivos
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".doc,.docx,.xls,.xlsx,.pdf,image/*,.txt,.zip"
                    onChange={selectFiles}
                  />
                </label>
                <p className="mt-2 text-xs text-slate-400">
                  DOC, DOCX, PDF, XLS, XLSX, imagens, TXT ou ZIP — até 15 MB por arquivo.
                </p>
                {files.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="ml-3 text-red-500 hover:text-red-700"
                          onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <div className="sticky bottom-4 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
            <button type="button" className="btn-secondary" onClick={() => nav('/tasks')}>
              Cancelar
            </button>
            <button disabled={saving} className="btn-primary">
              <Icon name="view" className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar tarefa'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
