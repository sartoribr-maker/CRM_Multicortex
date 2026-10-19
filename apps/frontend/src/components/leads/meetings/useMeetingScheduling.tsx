import { useEffect, useState } from 'react';
import { calendarApi, type CalendarConfig } from '../../../lib/calendarApi';
import type { LeadListItem, LeadMeetingSummary } from '../../../types/leads';
import type { Stage } from '../../../types/settings';
import { Icon } from '../../Icon';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';

interface MoveRequest {
  lead: LeadListItem;
  stage: Stage;
}

function meetingActionDescription(meeting: LeadMeetingSummary) {
  const when = new Date(meeting.startAt).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return `Reunião "${meeting.title}" agendada para ${when}${meeting.meetLink ? ' (Google Meet)' : ''}.`;
}

/**
 * Ao mover um lead para a etapa de reunião configurada, pergunta se o usuário
 * quer agendar uma reunião no Google Agenda antes de seguir com a movimentação.
 */
export function useMeetingScheduling({
  onProceed,
  onMeetingScheduled,
}: {
  /** Segue para a confirmação da movimentação (com a ação já descrita, se houve reunião). */
  onProceed: (lead: LeadListItem, stage: Stage, actionDescription?: string) => void;
  onMeetingScheduled: (leadId: string, meeting: LeadMeetingSummary) => void;
}) {
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [prompt, setPrompt] = useState<MoveRequest | null>(null);
  const [scheduling, setScheduling] = useState<MoveRequest | null>(null);

  useEffect(() => {
    calendarApi
      .config()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  function startMove(lead: LeadListItem, stage: Stage) {
    if (config?.enabled && config.meetingStageId === stage.id) setPrompt({ lead, stage });
    else onProceed(lead, stage);
  }

  const modals = (
    <>
      {prompt && (
        <div className="mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="mobile-modal-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
              <Icon name="calendar" className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-bold text-slate-900">
              Agendar uma reunião?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              <strong className="text-slate-700">{prompt.lead.name}</strong> está indo para{' '}
              {prompt.stage.name}. Deseja agendar uma reunião com{' '}
              {[prompt.lead.contactName, prompt.lead.companyName].filter(Boolean).join(' — ') ||
                'a empresa'}{' '}
              no Google Agenda?
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setPrompt(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPrompt(null);
                  onProceed(prompt.lead, prompt.stage);
                }}
              >
                Mover sem agendar
              </button>
              <button
                type="button"
                className="btn-primary"
                autoFocus
                onClick={() => {
                  setScheduling(prompt);
                  setPrompt(null);
                }}
              >
                Agendar reunião
              </button>
            </div>
          </div>
        </div>
      )}
      {scheduling && (
        <ScheduleMeetingModal
          lead={scheduling.lead}
          defaultDurationMinutes={config?.defaultDurationMinutes ?? 60}
          workspaceDomain={config?.workspaceDomain}
          onCancel={() => setScheduling(null)}
          onScheduled={(meeting) => {
            const { lead, stage } = scheduling;
            setScheduling(null);
            onMeetingScheduled(lead.id, meeting);
            onProceed({ ...lead, meetings: [meeting] }, stage, meetingActionDescription(meeting));
          }}
        />
      )}
    </>
  );

  return { startMove, modals };
}
