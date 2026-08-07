import { type FormEvent, useEffect, useState } from 'react';
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
          assigneeId: t.assignee.id,
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
      nav(`/tasks/${r.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tarefa.');
    } finally {
      setSaving(false);
    }
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
                  <label className="form-label">Responsável</label>
                  <select
                    className="form-control"
                    value={form.assigneeId ?? ''}
                    onChange={(e) => field('assigneeId', e.target.value || undefined)}
                  >
                    <option value="">Eu mesmo</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
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
