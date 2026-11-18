import { formatDate } from '../lib/formatters';

type DeadlineStatus = 'overdue' | 'near' | 'on-time' | 'none';

const STATUS_STYLES: Record<DeadlineStatus, { color: string; label: string }> = {
  overdue: { color: 'bg-red-500', label: 'Prazo vencido' },
  near: { color: 'bg-amber-400', label: 'Prazo em até 5 dias' },
  'on-time': { color: 'bg-emerald-500', label: 'Prazo acima de 5 dias' },
  none: { color: 'bg-slate-300', label: 'Sem prazo' },
};

/** Tarefas criadas no Multicortex Projetos podem não ter prazo. */
export function taskDeadlineStatus(dueDate: string | null, now = new Date()): DeadlineStatus {
  if (!dueDate) return 'none';
  const deadline = new Date(dueDate);
  const today = new Date(now);
  deadline.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (deadline < today) return 'overdue';

  const fiveDaysFromToday = new Date(today);
  fiveDaysFromToday.setDate(fiveDaysFromToday.getDate() + 5);
  return deadline <= fiveDaysFromToday ? 'near' : 'on-time';
}

export function TaskDeadline({ dueDate }: { dueDate: string | null }) {
  const status = STATUS_STYLES[taskDeadlineStatus(dueDate)];

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-black">
      {dueDate ? formatDate(dueDate) : 'Sem prazo'}
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.color}`}
        aria-label={status.label}
        title={status.label}
      />
    </span>
  );
}
