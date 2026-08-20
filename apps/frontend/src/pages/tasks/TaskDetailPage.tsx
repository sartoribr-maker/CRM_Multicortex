import { type ChangeEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { brazilianDateToIso, formatDate, isoToBrazilianDate } from '../../lib/formatters';
import { tasksApi } from '../../lib/tasksApi';
import { useAuthStore } from '../../store/useAuthStore';
import { usersApi, type UserOption } from '../../lib/usersApi';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskAttachment,
  type TaskHistoryEntry,
} from '../../types/tasks';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function TaskDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.permissions.includes('tasks.create') ?? false;
  const canEdit = user?.permissions.includes('tasks.edit') ?? false;
  const canDelete = user?.permissions.includes('tasks.delete') ?? false;
  const isAdministrator = user?.role.name.trim().toLocaleLowerCase('pt-BR') === 'administrador';
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  useEffect(() => {
    if (id)
      tasksApi
        .get(id)
        .then(setTask)
        .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar tarefa.'));
  }, [id]);
  useEffect(() => {
    if (id) {
      tasksApi.listAttachments(id).then(setAttachments).catch(() => undefined);
      tasksApi.history(id).then(setHistory).catch(() => undefined);
    }
    if (isAdministrator) usersApi.list().then(setUsers).catch(() => undefined);
  }, [id, isAdministrator]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    if (!id) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const oversized = files.find((file) => file.size > 15 * 1024 * 1024);
    if (oversized) {
      setError(`O arquivo ${oversized.name} excede o limite de 15 MB.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(files.map((file) => tasksApi.uploadAttachment(id, file)));
      setAttachments((current) => [...uploaded, ...current]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Erro ao enviar anexo.');
    } finally {
      setUploading(false);
    }
  }
  async function removeAttachment(attachment: TaskAttachment) {
    if (!id || !window.confirm(`Remover o anexo ${attachment.fileName}?`)) return;
    await tasksApi.removeAttachment(id, attachment.id);
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
  }
  async function viewAttachment(attachment: TaskAttachment) {
    if (!id) return;
    try {
      await tasksApi.viewAttachment(id, attachment.id);
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : 'Erro ao visualizar anexo.');
    }
  }
  async function extendDeadline() {
    if (!task) return;
    const nextDate = new Date(task.dueDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const dueDate = window.prompt(
      'Informe o novo prazo (DD/MM/AAAA):',
      isoToBrazilianDate(nextDate.toISOString()),
    );
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
      setTask(updated);
      setHistory(await tasksApi.history(task.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao prorrogar prazo.');
    }
  }
  async function transfer() {
    if (!task) return;
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
      const updated = await tasksApi.transfer(task.id, newAssignee.id, reason.trim());
      setTask(updated);
      setHistory(await tasksApi.history(task.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Erro ao transferir tarefa.');
    }
  }
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
              {canCreate && (
                <button className="btn-secondary" onClick={() => nav('/tasks/nova')}>
                  <Icon name="plus" className="h-4 w-4" />
                  Nova tarefa
                </button>
              )}
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
                <dt className="text-xs text-slate-400">Responsáveis</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {task.assignees.map(({ user }) => user.name).join(', ')}
                </dd>
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
              <>
                <button className="btn-primary mt-4 w-full" onClick={complete}>
                  <Icon name="view" className="h-4 w-4" />
                  Marcar como concluída
                </button>
                <button className="btn-secondary mt-3 w-full" onClick={extendDeadline}>
                  Prorrogar prazo
                </button>
                {isAdministrator && (
                  <button className="btn-secondary mt-3 w-full" onClick={transfer}>
                    Transferir tarefa
                  </button>
                )}
              </>
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
        <section className="card mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-heading font-bold text-slate-800">Anexos</h2>
              <p className="mt-1 text-xs text-slate-400">Documentos e arquivos relacionados à tarefa</p>
            </div>
            {canEdit && (
              <label className="btn-secondary cursor-pointer">
                <Icon name="upload" className="h-4 w-4" />
                {uploading ? 'Enviando…' : 'Adicionar arquivos'}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".doc,.docx,.xls,.xlsx,.pdf,image/*,.txt,.zip"
                  disabled={uploading}
                  onChange={upload}
                />
              </label>
            )}
          </div>
          {attachments.length ? (
            <ul className="divide-y divide-slate-100">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon name="file" className="h-5 w-5 shrink-0 text-brand-purple" />
                    <div className="min-w-0">
                      <button
                        className="block max-w-full truncate text-left text-sm font-semibold text-brand-blue hover:underline"
                        title="Clique para visualizar"
                        onClick={() => viewAttachment(attachment)}
                      >
                        {attachment.fileName}
                      </button>
                      <p className="text-xs text-slate-400">{formatBytes(attachment.sizeBytes)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary" onClick={() => viewAttachment(attachment)}>
                      Visualizar
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => tasksApi.downloadAttachment(task.id, attachment.id, attachment.fileName)}
                    >
                      Baixar
                    </button>
                    {canEdit && (
                      <button className="btn-danger" onClick={() => removeAttachment(attachment)}>
                        Remover
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-slate-400">Nenhum arquivo anexado.</p>
          )}
        </section>
        <section className="card mt-5 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-heading font-bold text-slate-800">Histórico de prorrogações e transferências</h2>
          </div>
          {history.length ? (
            <ul className="divide-y divide-slate-100">
              {history.map((entry) => (
                <li key={entry.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      {entry.type === 'DEADLINE_EXTENDED' ? 'Prazo prorrogado' : 'Tarefa transferida'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(entry.createdAt)} · {entry.actorUser.name}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {entry.type === 'DEADLINE_EXTENDED'
                      ? `${formatDate(entry.metadata.previousDueDate)} → ${formatDate(entry.metadata.newDueDate)}`
                      : `${entry.metadata.previousAssignees?.map((item) => item.name).join(', ')} → ${entry.metadata.newAssignee?.name}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Justificativa: {entry.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-slate-400">Nenhuma prorrogação ou transferência registrada.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
