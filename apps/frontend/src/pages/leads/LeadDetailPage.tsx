import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { TaskDeadline } from '../../components/TaskDeadline';
import { leadsApi } from '../../lib/leadsApi';
import { tasksApi } from '../../lib/tasksApi';
import { formatCurrency, formatDate, formatPhone } from '../../lib/formatters';
import { avatarUrl } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LEAD_ACTIVITY_LABELS,
  LEAD_LINE_LABELS,
  LEAD_PERIODICITY_LABELS,
  LEAD_STATUS_LABELS,
  type LeadActivity,
  type LeadAttachment,
  type LeadDetail,
} from '../../types/leads';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
} from '../../types/tasks';

type Tab = 'overview' | 'tasks' | 'timeline' | 'attachments';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedReturnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo =
    typeof requestedReturnTo === 'string' &&
    (requestedReturnTo === '/leads/kanban' ||
      requestedReturnTo === '/leads' ||
      requestedReturnTo.startsWith('/leads?'))
      ? requestedReturnTo
      : '/leads';
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.permissions.includes('leads.edit') ?? false;
  const canCreate = user?.permissions.includes('leads.create') ?? false;
  const canDelete = user?.permissions.includes('leads.delete') ?? false;
  const canCreateTask = user?.permissions.includes('tasks.create') ?? false;
  const canViewTasks = user?.permissions.includes('tasks.view') ?? false;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const [tab, setTab] = useState<Tab>(requestedTab === 'tasks' ? 'tasks' : 'overview');
  const [error, setError] = useState<string | null>(null);

  function loadLead() {
    if (!id) return;
    leadsApi
      .get(id)
      .then(setLead)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar lead.'));
  }

  useEffect(loadLead, [id]);

  async function handleArchive() {
    if (!id || !window.confirm('Arquivar este lead?')) return;
    await leadsApi.archive(id);
    navigate('/leads');
  }

  async function handleDelete() {
    if (!id || !lead) return;
    const confirmation = window.prompt(
      `Esta exclusão é definitiva e também removerá históricos e anexos. Para confirmar, digite o nome da oportunidade:\n\n${lead.name}`,
    );
    if (confirmation !== lead.name) {
      if (confirmation !== null) window.alert('O nome informado não corresponde à oportunidade.');
      return;
    }
    await leadsApi.remove(id);
    navigate('/leads');
  }

  if (error) {
    return <p className="p-8 text-center text-danger">{error}</p>;
  }
  if (!lead) {
    return <p className="p-8 text-center text-ink/60">Carregando…</p>;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Detalhes da oportunidade"
          title={lead.name}
          description={[lead.businessCode, lead.companyName ?? 'Empresa não informada']
            .filter(Boolean)
            .join(' · ')}
          actions={
            <>
              <button onClick={() => navigate(returnTo)} className="btn-secondary">
                <Icon name="arrow-left" className="h-4 w-4" />
                Voltar
              </button>
              {canCreate && (
                <button onClick={() => navigate('/leads/novo')} className="btn-secondary">
                  <Icon name="plus" className="h-4 w-4" />
                  Novo lead
                </button>
              )}
              {canCreateTask && (
                <button
                  onClick={() =>
                    navigate(`/tasks/nova?leadId=${lead.id}`, {
                      state: { returnTo: `/leads/${lead.id}?tab=tasks` },
                    })
                  }
                  className="btn-secondary"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Nova tarefa
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => navigate(`/leads/${lead.id}/editar`, { state: { returnTo } })}
                  className="btn-primary"
                >
                  <Icon name="edit" className="h-4 w-4" />
                  Editar
                </button>
              )}
              {canDelete && (
                <>
                  <button onClick={handleArchive} className="btn-secondary">
                    <Icon name="archive" className="h-4 w-4" />
                    Arquivar
                  </button>
                  <button onClick={handleDelete} className="btn-danger">
                    <Icon name="trash" className="h-4 w-4" />
                    Excluir
                  </button>
                </>
              )}
            </>
          }
        />
        <div className="card flex flex-col justify-between gap-5 overflow-hidden p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="h-11 w-1 rounded-full" style={{ backgroundColor: lead.stage.color }} />
            <div>
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: lead.stage.color }}
              >
                {lead.stage.name}
              </span>
              <div className="mt-2 flex items-center">
                {lead.assignees.slice(0, 5).map(({ user: responsible }, index) =>
                  responsible.avatarUrl ? (
                    <img
                      key={responsible.id}
                      src={avatarUrl(responsible.id, responsible.avatarUrl)}
                      alt={responsible.name}
                      title={responsible.name}
                      className={`h-7 w-7 rounded-full border-2 border-white object-cover ${index ? '-ml-1.5' : ''}`}
                    />
                  ) : (
                    <span
                      key={responsible.id}
                      title={responsible.name}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-purple-100 text-[9px] font-bold text-brand-purple ${index ? '-ml-1.5' : ''}`}
                    >
                      {responsible.name.slice(0, 2).toUpperCase()}
                    </span>
                  ),
                )}
                <span className="ml-2 text-xs font-semibold text-slate-600">
                  {lead.assignees.map((item) => item.user.name).join(', ')}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Valor estimado</p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {formatCurrency(lead.estimatedValue)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-1 border-b border-slate-200">
          {(
            [
              ['overview', 'Visão Geral'],
              ['tasks', 'Tarefas'],
              ['timeline', 'Linha do Tempo'],
              ['attachments', 'Anexos'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-t-card px-4 py-2 text-sm font-medium transition ${
                tab === key
                  ? 'border-b-2 border-brand-purple text-brand-purple-dark'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={tab === 'overview' ? 'mt-5' : 'mt-5 card p-5 md:p-7'}>
          {tab === 'overview' && <OverviewTab lead={lead} />}
          {tab === 'tasks' && (
            <TasksTab leadId={lead.id} canView={canViewTasks} canCreate={canCreateTask} />
          )}
          {tab === 'timeline' && <TimelineTab leadId={lead.id} canComment={canEdit} />}
          {tab === 'attachments' && (
            <AttachmentsTab leadId={lead.id} canEdit={canEdit} onUploaded={loadLead} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function TasksTab({
  leadId,
  canView,
  canCreate,
}: {
  leadId: string;
  canView: boolean;
  canCreate: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.permissions.includes('tasks.edit') ?? false;
  const canDelete = user?.permissions.includes('tasks.delete') ?? false;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadTasks() {
      const firstPage = await tasksApi.list({ leadId, page: 1, pageSize: 100 });
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
          tasksApi.list({ leadId, page: index + 2, pageSize: 100 }),
        ),
      );
      return [firstPage, ...remainingPages].flatMap((page) => page.items);
    }

    loadTasks()
      .then((items) => {
        if (!cancelled) setTasks(items);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canView, leadId]);

  if (!canView) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Você não tem permissão para visualizar tarefas.
      </p>
    );
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-400">Carregando tarefas…</p>;
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>;
  }

  const openTask = (taskId: string) =>
    navigate(`/tasks/${taskId}`, {
      state: { returnTo: `${location.pathname}?tab=tasks` },
    });

  const editTask = (taskId: string) =>
    navigate(`/tasks/${taskId}/editar`, {
      state: { returnTo: `${location.pathname}?tab=tasks` },
    });

  async function removeTask(task: Task) {
    const confirmation = window.prompt(
      `Esta exclusão é definitiva. Para confirmar, digite o título da tarefa:\n\n${task.title}`,
    );
    if (confirmation !== task.title) {
      if (confirmation !== null) window.alert('O título informado não corresponde à tarefa.');
      return;
    }
    try {
      await tasksApi.remove(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir a tarefa.');
    }
  }

  async function sendReminder(task: Task) {
    const recipients = task.assignees.map(({ user: assignee }) => assignee.name).join(', ');
    if (!window.confirm(`Enviar um e-mail de lembrete para ${recipients}?`)) return;
    setSendingReminderId(task.id);
    setError(null);
    try {
      await tasksApi.sendReminder(task.id);
      window.alert('E-mail de lembrete enviado com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar o lembrete.');
    } finally {
      setSendingReminderId(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-800">Tarefas da oportunidade</h2>
          <p className="mt-1 text-xs text-slate-400">
            {tasks.length} tarefa{tasks.length === 1 ? '' : 's'} vinculada
            {tasks.length === 1 ? '' : 's'}
          </p>
        </div>
        {canCreate && (
          <button
            className="btn-primary"
            onClick={() =>
              navigate(`/tasks/nova?leadId=${leadId}`, {
                state: { returnTo: `${location.pathname}?tab=tasks` },
              })
            }
          >
            <Icon name="plus" className="h-4 w-4" />
            Nova tarefa
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-card border border-slate-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Prazo</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Responsável</th>
              <th className="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <button
                    className="text-left font-semibold text-slate-800 hover:text-brand-purple"
                    onClick={() => openTask(task.id)}
                  >
                    {task.title}
                  </button>
                  {task.description && (
                    <p className="mt-1 max-w-sm truncate text-xs text-slate-400">
                      {task.description}
                    </p>
                  )}
                </td>
                <td>
                  <TaskDeadline dueDate={task.dueDate} />
                </td>
                <td>
                  <span
                    className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold ${TASK_PRIORITY_COLORS[task.priority]}`}
                  >
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </span>
                </td>
                <td className="whitespace-nowrap">{TASK_STATUS_LABELS[task.status]}</td>
                <td>{task.assignees.map(({ user: assignee }) => assignee.name).join(', ')}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit && (
                      <button
                        className="icon-button"
                        title="Enviar lembrete por e-mail"
                        disabled={sendingReminderId === task.id}
                        onClick={() => void sendReminder(task)}
                      >
                        <Icon name="mail" className="h-4 w-4" />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className="icon-button"
                        title="Editar tarefa"
                        onClick={() => editTask(task.id)}
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="icon-button hover:!text-red-600"
                        title="Excluir tarefa"
                        onClick={() => void removeTask(task)}
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      className="icon-button"
                      title="Abrir tarefa"
                      onClick={() => openTask(task.id)}
                    >
                      <Icon name="external" className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  Nenhuma tarefa vinculada a esta oportunidade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverviewTab({ lead }: { lead: LeadDetail }) {
  const probability = lead.successProbability ?? 0;
  const statusTone =
    lead.status === 'WON'
      ? 'bg-emerald-50 text-emerald-700'
      : lead.status === 'LOST'
        ? 'bg-red-50 text-red-700'
        : 'bg-blue-50 text-blue-700';

  const Field = ({
    label,
    value,
    accent,
  }: {
    label: string;
    value?: string | number | null;
    accent?: boolean;
  }) => (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
      <dd
        className={`mt-1 truncate text-sm ${accent ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}
      >
        {value === null || value === undefined || value === '' ? 'Não informado' : value}
      </dd>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Status comercial
          </p>
          <span
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusTone}`}
          >
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Valor estimado
          </p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(lead.estimatedValue)}
          </p>
          <p className="mt-1 text-xs text-slate-400">{LEAD_PERIODICITY_LABELS[lead.periodicity]}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CAPEX</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(lead.capexValue)}</p>
          <p className="mt-1 text-xs text-slate-400">Parcela única</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">OPEX</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{formatCurrency(lead.opexValue)}</p>
          <p className="mt-1 text-xs text-slate-400">Valor mensal</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Probabilidade
            </p>
            <span className="text-sm font-bold text-brand-purple">
              {lead.successProbability === null ? '—' : `${probability}%`}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-cyan"
              style={{ width: `${probability}%` }}
            />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Previsão de fechamento
          </p>
          <p className="mt-2 text-base font-bold text-slate-800">
            {lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : 'Não definida'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Cadastro em {formatDate(lead.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card overflow-hidden lg:col-span-3">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-heading font-bold text-slate-800">Empresa e classificação</h3>
            <p className="mt-1 text-xs text-slate-400">Contexto comercial da oportunidade</p>
          </div>
          <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="ID da oportunidade" value={lead.businessCode} accent />
            <Field label="Linha" value={lead.line ? LEAD_LINE_LABELS[lead.line] : null} />
            <Field label="Empresa" value={lead.companyName} accent />
            <Field label="Documento" value={lead.companyDocument} />
            <Field label="Segmento" value={lead.companySegment} />
            <Field label="Prioridade" value={lead.priority?.name} />
            <Field label="Porte" value={lead.dealSize?.name} />
            <Field
              label="Tipos de produto"
              value={lead.projectTypes.map(({ projectType }) => projectType.name).join(', ')}
            />
            <Field label="Origem" value={lead.source?.name} />
            <Field label="Parceiro comercial" value={lead.partner?.name} />
            <Field label="Parceiro técnico" value={lead.technicalPartner?.name} />
            <Field
              label="Valor do serviço técnico"
              value={formatCurrency(lead.technicalServiceValue)}
            />
            <Field label="Etapa atual" value={lead.stage.name} accent />
          </dl>
        </section>

        <section className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-heading font-bold text-slate-800">Contato principal</h3>
            <p className="mt-1 text-xs text-slate-400">Pessoa responsável pelo contato comercial</p>
          </div>
          <dl className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Nome" value={lead.contactName} accent />
            <Field label="E-mail" value={lead.contactEmail} />
            <Field label="Telefone" value={formatPhone(lead.contactPhone)} />
          </dl>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-heading font-bold text-slate-800">Responsáveis pela oportunidade</h3>
        </div>
        <div className="flex flex-wrap gap-3 p-5">
          {lead.assignees.map(({ user: responsible }) => (
            <div
              key={responsible.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              {responsible.avatarUrl ? (
                <img
                  src={avatarUrl(responsible.id, responsible.avatarUrl)}
                  alt={responsible.name}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-brand-purple">
                  {responsible.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-700">{responsible.name}</p>
                <p className="text-[11px] text-slate-400">{responsible.email}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {(lead.description || lead.lossReason || lead.customFieldValues.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {(lead.description || lead.lossReason) && (
            <section className="card p-5">
              <h3 className="font-heading font-bold text-slate-800">Observações</h3>
              {lead.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {lead.description}
                </p>
              )}
              {lead.lossReason && (
                <div className="mt-4 rounded-xl bg-red-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-red-500">Motivo da perda</p>
                  <p className="mt-1 text-sm text-red-700">{lead.lossReason}</p>
                </div>
              )}
            </section>
          )}
          {lead.customFieldValues.length > 0 && (
            <section className="card p-5">
              <h3 className="font-heading font-bold text-slate-800">Informações personalizadas</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {lead.customFieldValues.map((entry) => (
                  <Field
                    key={entry.id}
                    label={entry.customField.name}
                    value={
                      Array.isArray(entry.value) ? entry.value.join(', ') : String(entry.value)
                    }
                  />
                ))}
              </dl>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineTab({ leadId, canComment }: { leadId: string; canComment: boolean }) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function refresh() {
    leadsApi.listActivities(leadId).then(setActivities);
  }

  useEffect(refresh, [leadId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setIsSubmitting(true);
    try {
      await leadsApi.addComment(leadId, comment.trim());
      setComment('');
      refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {canComment && (
        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <input
            className="flex-1 rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
            placeholder="Adicionar um comentário…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-60"
          >
            Comentar
          </button>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {activities.map((activity) => (
          <li key={activity.id} className="rounded-card border border-surface-muted p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-brand-purple-dark">
                {LEAD_ACTIVITY_LABELS[activity.type]}
              </span>
              <span className="text-xs text-ink/50">{formatDate(activity.createdAt)}</span>
            </div>
            <p className="mt-1 text-ink/80">{activity.message}</p>
            {activity.actorUser && (
              <p className="mt-1 text-xs text-ink/50">por {activity.actorUser.name}</p>
            )}
          </li>
        ))}
        {activities.length === 0 && <p className="text-sm text-ink/50">Nenhuma atividade ainda.</p>}
      </ul>
    </div>
  );
}

function AttachmentsTab({
  leadId,
  canEdit,
  onUploaded,
}: {
  leadId: string;
  canEdit: boolean;
  onUploaded: () => void;
}) {
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function refresh() {
    leadsApi.listAttachments(leadId).then(setAttachments);
  }

  useEffect(refresh, [leadId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      await leadsApi.uploadAttachment(leadId, file);
      refresh();
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  async function handleRemove(attachmentId: string) {
    if (!window.confirm('Remover este anexo?')) return;
    await leadsApi.removeAttachment(leadId, attachmentId);
    refresh();
  }

  async function handleDownload(attachment: LeadAttachment) {
    await leadsApi.downloadAttachment(leadId, attachment.id, attachment.fileName);
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-4">
          <label className="inline-block cursor-pointer rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark">
            {isUploading ? 'Enviando…' : '+ Adicionar anexo'}
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
          <p className="mt-1 text-xs text-ink/50">
            Máximo 15MB. Imagens, PDF, Office, texto ou zip.
          </p>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <ul className="flex flex-col gap-2">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex items-center justify-between rounded-card border border-surface-muted p-3 text-sm"
          >
            <div>
              <p className="font-medium text-ink">{attachment.fileName}</p>
              <p className="text-xs text-ink/50">
                {formatBytes(attachment.sizeBytes)} · {formatDate(attachment.createdAt)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDownload(attachment)}
                className="text-sm text-brand-blue hover:text-brand-blue-dark"
              >
                Baixar
              </button>
              {canEdit && (
                <button
                  onClick={() => handleRemove(attachment.id)}
                  className="text-sm text-danger hover:text-danger/80"
                >
                  Remover
                </button>
              )}
            </div>
          </li>
        ))}
        {attachments.length === 0 && <p className="text-sm text-ink/50">Nenhum anexo ainda.</p>}
      </ul>
    </div>
  );
}
