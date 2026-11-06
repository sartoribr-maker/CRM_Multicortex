import { type DragEvent, useState } from 'react';
import { TaskDeadline, taskDeadlineStatus } from '../../components/TaskDeadline';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../types/tasks';

export const TASK_KANBAN_COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELED'];

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  TODO: 'bg-sky-500',
  IN_PROGRESS: 'bg-brand-purple',
  DONE: 'bg-emerald-500',
  CANCELED: 'bg-slate-500',
};

/**
 * Cores do post-it por prioridade. Os textos usam tons próprios (não "slate")
 * para continuarem escuros no tema escuro, já que o papel é sempre claro.
 */
export const POSTIT_COLORS: Record<
  TaskPriority,
  { paper: string; fold: string; text: string; muted: string; chip: string }
> = {
  LOW: {
    paper: 'bg-[#d8f5c4]',
    fold: 'from-[#b5e09a]',
    text: 'text-[#1f3a12]',
    muted: 'text-[#3f5f2e]',
    chip: 'bg-[#1f3a12]/10',
  },
  MEDIUM: {
    paper: 'bg-[#fff2a1]',
    fold: 'from-[#e8d66b]',
    text: 'text-[#3d3305]',
    muted: 'text-[#6b5c16]',
    chip: 'bg-[#3d3305]/10',
  },
  HIGH: {
    paper: 'bg-[#ffd39a]',
    fold: 'from-[#efb262]',
    text: 'text-[#4a2600]',
    muted: 'text-[#7a4510]',
    chip: 'bg-[#4a2600]/10',
  },
  URGENT: {
    paper: 'bg-[#ffb0b5]',
    fold: 'from-[#ef8088]',
    text: 'text-[#4d0a12]',
    muted: 'text-[#80222d]',
    chip: 'bg-[#4d0a12]/10',
  },
};

// Inclinações leves e determinísticas, para o quadro parecer de post-its sem "pular" ao recarregar.
const TILTS = ['-rotate-1', 'rotate-[0.6deg]', '-rotate-[0.4deg]', 'rotate-1'];
function tiltFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TILTS[Math.abs(hash) % TILTS.length];
}

interface TaskKanbanBoardProps {
  columns: Record<TaskStatus, Task[]>;
  totals: Record<TaskStatus, number>;
  canDrag: boolean;
  movingId: string | null;
  onMove: (task: Task, status: TaskStatus) => void;
  onOpen: (task: Task) => void;
}

export function TaskKanbanBoard({
  columns,
  totals,
  canDrag,
  movingId,
  onMove,
  onOpen,
}: TaskKanbanBoardProps) {
  const [dragged, setDragged] = useState<Task | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  function drop(event: DragEvent, status: TaskStatus) {
    event.preventDefault();
    setOverStatus(null);
    const task = dragged;
    setDragged(null);
    if (task && task.status !== status) onMove(task, status);
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-5 md:-mx-8 md:px-8">
      <div className="flex min-w-max items-start gap-4">
        {TASK_KANBAN_COLUMNS.map((status) => {
          const tasks = columns[status];
          const highlighted = overStatus === status && dragged && dragged.status !== status;
          return (
            <section
              key={status}
              className={`w-[calc(100vw-3rem)] rounded-2xl border bg-slate-100/70 p-3 transition sm:w-[300px] ${
                highlighted
                  ? 'border-brand-purple bg-purple-50 ring-4 ring-purple-100'
                  : 'border-slate-200/80'
              }`}
              onDragOver={(event) => {
                if (!dragged) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = dragged.status === status ? 'none' : 'move';
                setOverStatus(status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setOverStatus(null);
              }}
              onDrop={(event) => drop(event, status)}
            >
              <header className="mb-3 flex items-center gap-2 px-1 pb-2">
                <span className={`status-dot ${COLUMN_ACCENT[status]}`} />
                <h2 className="text-sm font-bold text-slate-800">{TASK_STATUS_LABELS[status]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm">
                  {totals[status] ?? tasks.length}
                </span>
              </header>
              <div className="flex min-h-[140px] flex-col gap-4 px-1 pt-1">
                {tasks.map((task) => (
                  <PostIt
                    key={task.id}
                    task={task}
                    draggable={canDrag && task.status !== 'DONE' && movingId === null}
                    moving={movingId === task.id}
                    dragging={dragged?.id === task.id}
                    onDragStart={(event) => {
                      setDragged(task);
                      event.dataTransfer.setData('text/task-id', task.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragged(null);
                      setOverStatus(null);
                    }}
                    onOpen={() => onOpen(task)}
                  />
                ))}
                {tasks.length === 0 && (
                  <div className="flex min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/50 px-5 text-center text-xs leading-5 text-slate-400">
                    {canDrag ? 'Arraste uma tarefa para esta coluna' : 'Nenhuma tarefa'}
                  </div>
                )}
                {totals[status] > tasks.length && (
                  <p className="text-center text-[11px] font-semibold text-slate-400">
                    Exibindo {tasks.length} de {totals[status]}. Refine os filtros para ver as
                    demais.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface PostItProps {
  task: Task;
  draggable: boolean;
  moving: boolean;
  dragging: boolean;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onOpen: () => void;
}

function PostIt({
  task,
  draggable,
  moving,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: PostItProps) {
  const color = POSTIT_COLORS[task.priority];
  const overdue =
    !['DONE', 'CANCELED'].includes(task.status) && taskDeadlineStatus(task.dueDate) === 'overdue';
  const closed = task.status === 'DONE' || task.status === 'CANCELED';
  return (
    <article
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(event) => event.key === 'Enter' && onOpen()}
      title={
        task.status === 'DONE'
          ? 'Tarefa concluída: o status não pode ser alterado pelo Kanban'
          : draggable
            ? 'Arraste para outra coluna para alterar o status'
            : undefined
      }
      className={`group relative select-none rounded-sm ${color.paper} ${color.text} p-4 pb-3 pt-5 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.45)] transition duration-150 ${tiltFor(task.id)} hover:z-10 hover:rotate-0 hover:scale-[1.02] hover:shadow-[0_14px_24px_-10px_rgba(15,23,42,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${dragging ? 'opacity-40' : ''} ${moving ? 'animate-pulse' : ''} ${closed ? 'opacity-75' : ''}`}
    >
      {/* Fita adesiva */}
      <span
        aria-hidden
        className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 rotate-[-2deg] rounded-[2px] bg-white/55 shadow-sm"
      />
      {/* Canto dobrado */}
      <span
        aria-hidden
        className={`absolute bottom-0 right-0 h-5 w-5 bg-gradient-to-tl ${color.fold} to-transparent`}
        style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${color.chip}`}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        {overdue && (
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
            Atrasada
          </span>
        )}
      </div>
      <h3
        className={`font-heading text-[15px] font-bold leading-snug ${task.status === 'CANCELED' ? 'line-through' : ''}`}
      >
        {task.title}
      </h3>
      {task.lead && (
        <p className={`mt-1.5 line-clamp-2 text-xs font-semibold ${color.muted}`}>
          {task.lead.name}
          {task.lead.companyName ? ` · ${task.lead.companyName}` : ''}
        </p>
      )}
      <div
        className={`mt-3 flex items-end justify-between gap-2 border-t border-black/10 pt-2 text-xs ${color.muted}`}
      >
        <span className="[&_*]:!text-inherit">
          <TaskDeadline dueDate={task.dueDate} />
        </span>
        <span className="line-clamp-2 text-right font-semibold">
          {task.assignees.map(({ user }) => user.name.split(' ')[0]).join(', ')}
        </span>
      </div>
    </article>
  );
}
