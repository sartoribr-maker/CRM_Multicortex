import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { tasksApi } from '../../lib/tasksApi';
import { usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskFilters,
} from '../../types/tasks';
type Sort = 'title' | 'dueDate' | 'priority' | 'status' | 'assignee';
export default function TasksListPage() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdministrator = user?.role.name.trim().toLocaleLowerCase('pt-BR') === 'administrador';
  const canCreate = user?.permissions.includes('tasks.create') ?? false;
  const canEdit = user?.permissions.includes('tasks.edit') ?? false;
  const [items, setItems] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({ page: 1, pageSize: 20 });
  const [sort, setSort] = useState<{ key: Sort; dir: 'asc' | 'desc' }>({
    key: 'dueDate',
    dir: 'asc',
  });
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
  }, [filters]);
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const v = {
          title: [a.title, b.title],
          dueDate: [a.dueDate, b.dueDate],
          priority: [a.priority, b.priority],
          status: [a.status, b.status],
          assignee: [a.assignee.name, b.assignee.name],
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
    !['DONE', 'CANCELED'].includes(t.status) && new Date(t.dueDate) < new Date();
  async function complete(t: Task) {
    try {
      const u = await tasksApi.complete(t.id);
      setItems((c) => c.map((i) => (i.id === t.id ? u : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao concluir.');
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
                <th>Oportunidade</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button
                      className="text-left font-semibold text-slate-800 hover:text-brand-purple"
                      onClick={() => nav(`/tasks/${t.id}`)}
                    >
                      {t.title}
                    </button>
                  </td>
                  <td>
                    <span className={overdue(t) ? 'font-bold text-red-600' : 'text-slate-600'}>
                      {new Date(t.dueDate).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
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
                  <td>{t.assignee.name}</td>
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
                    </div>
                  </td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    Nenhuma tarefa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
