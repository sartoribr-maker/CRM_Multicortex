import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { TaskDeadline, taskDeadlineStatus } from '../../components/TaskDeadline';
import { TaskStatusContextMenu } from './TaskStatusContextMenu';
import { tasksApi } from '../../lib/tasksApi';
import { brazilianDateToIso, isoToBrazilianDate } from '../../lib/formatters';
import { usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskFilters,
  type TaskStatus,
} from '../../types/tasks';
import { canDeleteRecord } from '../../lib/permissions';
type Sort = 'title' | 'dueDate' | 'priority' | 'status' | 'assignee';

export default function TasksListPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isAdministrator = user?.role.name.trim().toLocaleLowerCase('pt-BR') === 'administrador';
  const canCreate = user?.permissions.includes('tasks.create') ?? false;
  const canEdit = user?.permissions.includes('tasks.edit') ?? false;
  const [items, setItems] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMenu, setStatusMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    page: 1,
    pageSize: 20,
    mine: true,
    status: 'IN_PROGRESS',
    overdue: searchParams.get('overdue') === 'true' || undefined,
  });
  const [sort, setSort] = useState<{ key: Sort; dir: 'asc' | 'desc' }>({
    key: 'dueDate',
    dir: 'asc',
  });
  // Contagem por status para os cards: respeita os demais filtros, mas não o de status.
  const [summary, setSummary] = useState<Record<TaskStatus, number> | null>(null);
  const loadSummary = useCallback((current: TaskFilters) => {
    tasksApi
      .summary(current)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);
  useEffect(() => {
    if (isAdministrator) usersApi.list().then(setUsers);
  }, [isAdministrator]);
  useEffect(() => {
    setLoading(true);
    tasksApi
      .list(filters)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar tarefas.'))
      .finally(() => setLoading(false));
    loadSummary(filters);
  }, [filters, loadSummary]);
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const v = {
          title: [a.title, b.title],
          dueDate: [a.dueDate, b.dueDate],
          priority: [a.priority, b.priority],
          status: [a.status, b.status],
          assignee: [
            a.assignees.map(({ user }) => user.name).join(', '),
            b.assignees.map(({ user }) => user.name).join(', '),
          ],
        }[sort.key];
        const r = String(v[0]).localeCompare(String(v[1]), 'pt-BR');
        return sort.dir === 'asc' ? r : -r;
      }),
    [items, sort],
  );
  function upd(p: Partial<TaskFilters>) {
    setFilters((c) => ({ ...c, ...p, page: 1 }));
  }
  function toggle(key: Sort) {
    setSort((c) => ({ key, dir: c.key === key && c.dir === 'asc' ? 'desc' : 'asc' }));
  }
  const H = ({ f, c }: { f: Sort; c: string }) => (
    <button className="inline-flex items-center gap-1" onClick={() => toggle(f)}>
      {c}
      <Icon
        name="sort"
        className={`h-3.5 w-3.5 ${sort.key === f ? 'text-brand-purple' : 'text-slate-300'}`}
      />
    </button>
  );
  const overdue = (t: Task) =>
    !['DONE', 'CANCELED'].includes(t.status) && taskDeadlineStatus(t.dueDate) === 'overdue';
  const assignedDays = (task: Task) => {
    const assignedAt = new Date(task.assigneeAssignedAt);
    const elapsed = Date.now() - assignedAt.getTime();
    return Math.max(0, Math.floor(elapsed / 86_400_000));
  };
  async function complete(t: Task) {
    const reason = window.prompt('Informe a justificativa obrigatória para concluir a tarefa:');
    if (!reason?.trim()) return;
    try {
      const u = await tasksApi.complete(t.id, reason.trim());
      setItems((c) => c.map((i) => (i.id === t.id ? u : i)));
      loadSummary(filters);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao concluir.');
    }
  }
  async function extendDeadline(task: Task) {
    const current = new Date(task.dueDate);
    current.setDate(current.getDate() + 1);
    const suggestedDate = isoToBrazilianDate(current.toISOString());
    const dueDate = window.prompt('Informe o novo prazo (DD/MM/AAAA):', suggestedDate);
    if (!dueDate) return;
    const isoDate = brazilianDateToIso(dueDate.trim());
    if (!isoDate) {
      setError('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    const reason = window.prompt('Informe a justificativa obrigatória para a prorrogação:');
    if (!reason?.trim()) return;
    try {
      const updated = await tasksApi.extendDeadline(
        task.id,
        new Date(`${isoDate}T12:00:00`).toISOString(),
        reason.trim(),
      );
      setItems((currentItems) =>
        currentItems.map((item) => (item.id === task.id ? updated : item)),
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao prorrogar prazo.');
    }
  }
  async function transfer(task: Task) {
    const options = users.filter(
      (candidate) => !task.assignees.some(({ user: assignee }) => assignee.id === candidate.id),
    );
    if (!options.length) {
      setError('Nenhum outro responsável está disponível para transferência.');
      return;
    }
    const choice = window.prompt(
      `Escolha o novo responsável pelo número:\n\n${options.map((candidate, index) => `${index + 1}. ${candidate.name}`).join('\n')}`,
    );
    if (!choice) return;
    const newAssignee = options[Number(choice) - 1];
    if (!newAssignee) {
      setError('Responsável inválido.');
      return;
    }
    const reason = window.prompt('Informe a justificativa obrigatória para a transferência:');
    if (!reason?.trim()) return;
    try {
      await tasksApi.transfer(task.id, newAssignee.id, reason.trim());
      setFilters((current) => ({ ...current }));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao transferir tarefa.');
    }
  }
  function openStatusMenu(event: React.MouseEvent, task: Task) {
    // Tarefa concluída (ou usuário sem permissão) mantém o menu padrão do navegador.
    if (!canEdit || task.status === 'DONE') return;
    event.preventDefault();
    setStatusMenu({ task, x: event.clientX, y: event.clientY });
  }
  const closeStatusMenu = useCallback(() => setStatusMenu(null), []);
  async function changeStatus(task: Task, status: TaskStatus) {
    setStatusMenu(null);
    // "Concluída" exige justificativa: segue o mesmo fluxo do botão Concluir.
    if (status === 'DONE') {
      await complete(task);
      return;
    }
    try {
      await tasksApi.update(task.id, { status });
      // Recarrega a lista: a tarefa pode sair do filtro de status atual.
      setFilters((current) => ({ ...current }));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao alterar status.');
    }
  }
  async function remove(t: Task) {
    const confirmation = window.prompt(
      `Exclusão definitiva. Digite o título da tarefa para confirmar:\n\n${t.title}`,
    );
    if (confirmation !== t.title) {
      if (confirmation !== null) window.alert('O título informado não corresponde à tarefa.');
      return;
    }
    try {
      await tasksApi.remove(t.id);
      setItems((current) => current.filter((item) => item.id !== t.id));
      setTotal((current) => Math.max(0, current - 1));
      loadSummary(filters);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir a tarefa.');
    }
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow="Produtividade"
        title="Tarefas"
        description={`${total} tarefa${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'} na sua agenda.`}
        actions={
          canCreate && (
            <button className="btn-primary" onClick={() => nav('/tasks/nova')}>
              <Icon name="plus" className="h-4 w-4" />
              Nova tarefa
            </button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {(
          [
            { status: undefined, label: 'Todas', accent: 'bg-slate-400' },
            { status: 'TODO', label: TASK_STATUS_LABELS.TODO, accent: 'bg-sky-500' },
            {
              status: 'IN_PROGRESS',
              label: TASK_STATUS_LABELS.IN_PROGRESS,
              accent: 'bg-brand-purple',
            },
            { status: 'DONE', label: TASK_STATUS_LABELS.DONE, accent: 'bg-emerald-500' },
            { status: 'CANCELED', label: TASK_STATUS_LABELS.CANCELED, accent: 'bg-slate-500' },
          ] as { status: TaskStatus | undefined; label: string; accent: string }[]
        ).map(({ status, label, accent }) => {
          const active = filters.status === status;
          const count = summary
            ? status
              ? summary[status]
              : Object.values(summary).reduce((sum, value) => sum + value, 0)
            : null;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              className={`card flex flex-col items-start gap-1 p-4 text-left transition hover:border-brand-purple/60 ${active ? '!border-brand-purple ring-2 ring-purple-200' : ''}`}
              onClick={() => upd({ status })}
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span className={`status-dot ${accent}`} />
                {label}
              </span>
              <span className="font-heading text-2xl font-bold text-slate-900">{count ?? '—'}</span>
            </button>
          );
        })}
      </div>
      <div className="filter-panel">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Icon name="search" className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              className="form-control pl-10"
              placeholder="Buscar tarefa ou oportunidade..."
              value={filters.search ?? ''}
              onChange={(e) => upd({ search: e.target.value || undefined })}
            />
          </div>
          <select
            className="form-control"
            value={filters.status ?? ''}
            onChange={(e) =>
              upd({ status: (e.target.value || undefined) as TaskFilters['status'] })
            }
          >
            <option value="">Todos os status</option>
            {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={filters.priority ?? ''}
            onChange={(e) =>
              upd({ priority: (e.target.value || undefined) as TaskFilters['priority'] })
            }
          >
            <option value="">Todas as prioridades</option>
            {Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {isAdministrator ? (
            <select
              className="form-control"
              value={filters.assigneeId ?? ''}
              onChange={(e) => upd({ assigneeId: e.target.value || undefined, mine: undefined })}
            >
              <option value="">Toda a equipe</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : (
            <button
              className={`btn-secondary ${filters.overdue ? '!border-red-200 !bg-red-50 !text-red-600' : ''}`}
              onClick={() => upd({ overdue: filters.overdue ? undefined : true })}
            >
              Somente atrasadas
            </button>
          )}
          {isAdministrator && (
            <label
              className={`flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${filters.mine ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              <input
                type="checkbox"
                checked={filters.mine ?? false}
                onChange={(event) =>
                  upd({ mine: event.target.checked || undefined, assigneeId: undefined })
                }
              />
              Minhas tarefas
            </label>
          )}
        </div>
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="table-shell overflow-x-auto">
        {loading ? (
          <p className="p-12 text-center text-sm text-slate-400">Carregando tarefas…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <H f="title" c="Tarefa" />
                </th>
                <th>
                  <H f="dueDate" c="Prazo" />
                </th>
                <th>
                  <H f="priority" c="Prioridade" />
                </th>
                <th>
                  <H f="status" c="Status" />
                </th>
                <th>
                  <H f="assignee" c="Responsável" />
                </th>
                <th>Dias atribuída</th>
                <th>Oportunidade</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  className={statusMenu?.task.id === t.id ? 'bg-purple-50' : undefined}
                  title={
                    canEdit && t.status !== 'DONE'
                      ? 'Clique com o botão direito para alterar o status'
                      : undefined
                  }
                  onContextMenu={(event) => openStatusMenu(event, t)}
                >
                  <td>
                    <button
                      className="text-left font-semibold text-slate-800 hover:text-brand-purple"
                      onClick={() => nav(`/tasks/${t.id}`)}
                    >
                      {t.title}
                    </button>
                  </td>
                  <td>
                    <TaskDeadline dueDate={t.dueDate} />
                    {overdue(t) && (
                      <p className="text-[10px] font-bold uppercase text-red-500">Atrasada</p>
                    )}
                  </td>
                  <td>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${TASK_PRIORITY_COLORS[t.priority]}`}
                    >
                      {TASK_PRIORITY_LABELS[t.priority]}
                    </span>
                  </td>
                  <td>{TASK_STATUS_LABELS[t.status]}</td>
                  <td>{t.assignees.map(({ user }) => user.name).join(', ')}</td>
                  <td>
                    <span className="whitespace-nowrap font-semibold text-slate-600">
                      {assignedDays(t)} {assignedDays(t) === 1 ? 'dia' : 'dias'}
                    </span>
                  </td>
                  <td>
                    {t.lead ? (
                      <button
                        className="text-xs font-semibold text-brand-blue hover:underline"
                        onClick={() => nav(`/leads/${t.lead!.id}`)}
                      >
                        {t.lead.name}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {canEdit && t.status !== 'DONE' && (
                        <button
                          className="icon-button hover:!text-emerald-600"
                          title="Concluir"
                          onClick={() => complete(t)}
                        >
                          <Icon name="view" className="h-4 w-4" />
                        </button>
                      )}
                      {canEdit && t.status !== 'DONE' && (
                        <button
                          title="Prorrogar prazo"
                          className="icon-button"
                          onClick={() => extendDeadline(t)}
                        >
                          ⏱
                        </button>
                      )}
                      {canEdit && isAdministrator && t.status !== 'DONE' && (
                        <button
                          title="Transferir tarefa"
                          className="icon-button"
                          onClick={() => transfer(t)}
                        >
                          ⇄
                        </button>
                      )}
                      <button
                        className="icon-button"
                        title="Ver"
                        onClick={() => nav(`/tasks/${t.id}`)}
                      >
                        <Icon name="external" className="h-4 w-4" />
                      </button>
                      {canEdit && (
                        <button
                          className="icon-button"
                          title="Editar"
                          onClick={() => nav(`/tasks/${t.id}/editar`)}
                        >
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                      )}
                      {canDeleteRecord(user, 'tasks', t.createdByUser.id) && (
                        <button
                          className="icon-button hover:!text-red-600"
                          title="Excluir definitivamente"
                          onClick={() => void remove(t)}
                        >
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    Nenhuma tarefa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {statusMenu && (
        <TaskStatusContextMenu
          task={statusMenu.task}
          x={statusMenu.x}
          y={statusMenu.y}
          onClose={closeStatusMenu}
          onSelect={(status) => void changeStatus(statusMenu.task, status)}
        />
      )}
    </AppShell>
  );
}
