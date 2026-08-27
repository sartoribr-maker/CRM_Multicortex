import { formatDate } from '../lib/formatters';

type DeadlineStatus = 'overdue' | 'near' | 'on-time';

const STATUS_STYLES: Record<DeadlineStatus, { color: string; label: string }> = {
  overdue: { color: 'bg-red-500', label: 'Prazo vencido' },
  near: { color: 'bg-amber-400', label: 'Prazo em até 5 dias' },
  'on-time': { color: 'bg-emerald-500', label: 'Prazo acima de 5 dias' },
};

export function taskDeadlineStatus(dueDate: string, now = new Date()): DeadlineStatus {
  const deadline = new Date(dueDate);
  const today = new Date(now);
  deadline.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (deadline < today) return 'overdue';

  const fiveDaysFromToday = new Date(today);
  fiveDaysFromToday.setDate(fiveDaysFromToday.getDate() + 5);
  return deadline <= fiveDaysFromToday ? 'near' : 'on-time';
}

export function TaskDeadline({ dueDate }: { dueDate: string }) {
  const status = STATUS_STYLES[taskDeadlineStatus(dueDate)];

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-black">
      {formatDate(dueDate)}
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.color}`}
        aria-label={status.label}
        title={status.label}
      />
    </span>
  );
}
