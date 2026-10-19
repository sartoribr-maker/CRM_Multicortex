import { FormEvent, useEffect, useState } from 'react';
import { leadsApi } from '../../lib/leadsApi';
import { formatDate } from '../../lib/formatters';
import { LEAD_ACTIVITY_LABELS, type LeadActivity } from '../../types/leads';

export function LeadTimeline({ leadId, canComment }: { leadId: string; canComment: boolean }) {
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
