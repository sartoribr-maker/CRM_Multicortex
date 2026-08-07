import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { formatDate } from '../../lib/formatters';
import { tasksApi } from '../../lib/tasksApi';
import { useAuthStore } from '../../store/useAuthStore';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
} from '../../types/tasks';
export default function TaskDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.permissions.includes('tasks.edit') ?? false;
  const canDelete = user?.permissions.includes('tasks.delete') ?? false;
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (id)
      tasksApi
        .get(id)
        .then(setTask)
        .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar tarefa.'));
  }, [id]);
  async function complete() {
    if (task) setTask(await tasksApi.complete(task.id));
  }
  async function archive() {
    if (task && window.confirm('Arquivar esta tarefa?')) {
      await tasksApi.archive(task.id);
      nav('/tasks');
    }
  }
  async function remove() {
    if (!task) return;
    const confirmation = window.prompt(
      `Esta exclusão é definitiva. Para confirmar, digite o título da tarefa:\n\n${task.title}`,
    );
    if (confirmation !== task.title) {
      if (confirmation !== null) window.alert('O título informado não corresponde à tarefa.');
      return;
    }
    await tasksApi.remove(task.id);
    nav('/tasks');
  }
  if (error)
    return (
      <AppShell>
        <p className="bg-red-50 p-4 text-red-600">{error}</p>
      </AppShell>
    );
  if (!task)
    return <div className="flex min-h-screen items-center justify-center">Carregando…</div>;
  const late = !['DONE', 'CANCELED'].includes(task.status) && new Date(task.dueDate) < new Date();
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Detalhes da tarefa"
          title={task.title}
          description={`Criada por ${task.createdByUser.name}`}
          actions={
            <>
              <button className="btn-secondary" onClick={() => nav('/tasks')}>
                <Icon name="arrow-left" className="h-4 w-4" />
                Voltar
              </button>
              {canEdit && (
                <button className="btn-primary" onClick={() => nav(`/tasks/${task.id}/editar`)}>
                  <Icon name="edit" className="h-4 w-4" />
                  Editar
                </button>
              )}
              {canDelete && (
                <>
                  <button className="btn-secondary" onClick={archive}>
                    <Icon name="archive" className="h-4 w-4" />
                    Arquivar
                  </button>
                  <button className="btn-danger" onClick={remove}>
                    <Icon name="trash" className="h-4 w-4" />
                    Excluir
                  </button>
                </>
              )}
            </>
          }
        />
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <section className="card p-6">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-lg px-3 py-1 text-xs font-bold ${TASK_PRIORITY_COLORS[task.priority]}`}
              >
                {TASK_PRIORITY_LABELS[task.priority]}
              </span>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {TASK_STATUS_LABELS[task.status]}
              </span>
              {late && (
                <span className="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                  Atrasada
                </span>
              )}
            </div>
            {task.description ? (
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {task.description}
              </p>
            ) : (
              <p className="mt-6 text-sm text-slate-400">Sem descrição.</p>
            )}
            <dl className="mt-8 grid gap-6 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-400">Prazo</dt>
                <dd className={`mt-1 font-semibold ${late ? 'text-red-600' : 'text-slate-700'}`}>
                  {formatDate(task.dueDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Responsável</dt>
                <dd className="mt-1 font-semibold text-slate-700">{task.assignee.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Oportunidade</dt>
                <dd className="mt-1">
                  {task.lead ? (
                    <button
                      className="font-semibold text-brand-blue hover:underline"
                      onClick={() => nav(`/leads/${task.lead!.id}`)}
                    >
                      {task.lead.name}
                    </button>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Concluída em</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {formatDate(task.completedAt)}
                </dd>
              </div>
            </dl>
          </section>
          <aside className="card h-fit p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Próxima ação
            </p>
            {task.status !== 'DONE' && canEdit ? (
              <button className="btn-primary mt-4 w-full" onClick={complete}>
                <Icon name="view" className="h-4 w-4" />
                Marcar como concluída
              </button>
            ) : (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-600">
                Tarefa concluída
              </div>
            )}
            {task.lead && (
              <button
                className="btn-secondary mt-3 w-full"
                onClick={() => nav(`/leads/${task.lead!.id}`)}
              >
                Abrir oportunidade
              </button>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
