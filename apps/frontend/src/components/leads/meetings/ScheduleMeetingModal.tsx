import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { calendarApi, type AttendeeSuggestion } from '../../../lib/calendarApi';
import { useAuthStore } from '../../../store/useAuthStore';
import type { LeadListItem, LeadMeetingSummary } from '../../../types/leads';
import { Icon } from '../../Icon';
import { DateInput } from '../../MaskedInputs';
import { AvailabilityPanel } from './AvailabilityPanel';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DURATIONS = [30, 45, 60, 90, 120];

function tomorrowIso() {
  const date = new Date(Date.now() + 86_400_000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface ScheduleMeetingModalProps {
  lead: LeadListItem;
  defaultDurationMinutes: number;
  /** Domínio do Workspace: convidados dele têm a agenda (livre/ocupado) consultada. */
  workspaceDomain?: string;
  onCancel: () => void;
  onScheduled: (meeting: LeadMeetingSummary) => void;
}

/** Formulário de reunião: cria o evento no Google Agenda (com Meet) e envia os convites. */
export function ScheduleMeetingModal({
  lead,
  defaultDurationMinutes,
  workspaceDomain,
  onCancel,
  onScheduled,
}: ScheduleMeetingModalProps) {
  const currentUserEmail = useAuthStore((s) => s.user?.email.toLowerCase());
  const [title, setTitle] = useState(
    `Reunião Multicortex — ${lead.companyName || lead.contactName || lead.name}`,
  );
  const [date, setDate] = useState(tomorrowIso());
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(
    DURATIONS.includes(defaultDurationMinutes) ? defaultDurationMinutes : 60,
  );
  const [description, setDescription] = useState(
    [lead.businessCode, lead.name].filter(Boolean).join(' — '),
  );
  const [withMeet, setWithMeet] = useState(true);
  // Contato do lead e quem está agendando (quem moveu o card para a etapa de reunião).
  const [attendees, setAttendees] = useState<string[]>(() => [
    ...new Set(
      [lead.contactEmail?.toLowerCase(), currentUserEmail].filter((email): email is string =>
        Boolean(email),
      ),
    ),
  ]);
  const [guestInput, setGuestInput] = useState('');
  const [suggestions, setSuggestions] = useState<AttendeeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const search = guestInput.trim();
    if (search.length < 2) {
      setSuggestions([]);
      return;
    }
    let current = true;
    const timeout = window.setTimeout(() => {
      calendarApi
        .attendeeSuggestions(search)
        .then((items) => current && setSuggestions(items))
        .catch(() => current && setSuggestions([]));
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [guestInput]);

  function addGuest(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError(`"${email}" não é um e-mail válido.`);
      return;
    }
    setError(null);
    setAttendees((items) => (items.includes(normalized) ? items : [...items, normalized]));
    setGuestInput('');
    setSuggestions([]);
  }

  function onGuestKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === 'Enter' || event.key === ',' || event.key === ';') && guestInput.trim()) {
      event.preventDefault();
      addGuest(guestInput);
    } else if (event.key === 'Backspace' && !guestInput && attendees.length) {
      setAttendees((items) => items.slice(0, -1));
    }
  }

  const domainEmails = workspaceDomain
    ? [...new Set([...(currentUserEmail ? [currentUserEmail] : []), ...attendees])].filter(
        (email) => email.endsWith(`@${workspaceDomain}`),
      )
    : [];
  const hasGuestFromDomain = attendees.some((email) => domainEmails.includes(email));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (guestInput.trim()) {
      addGuest(guestInput);
      return;
    }
    // Horário informado em Brasília (UTC−03:00), como o restante do CRM.
    const startAt = new Date(`${date}T${time}:00-03:00`);
    if (Number.isNaN(startAt.getTime())) {
      setError('Informe data e horário válidos.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const meeting = await calendarApi.createMeeting(lead.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        startAt: startAt.toISOString(),
        endAt: new Date(startAt.getTime() + duration * 60_000).toISOString(),
        attendees,
        withMeet,
      });
      onScheduled(meeting);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível agendar a reunião.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`mobile-modal-panel max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${hasGuestFromDomain ? 'max-w-5xl' : 'max-w-2xl'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
              <Icon name="calendar" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold text-slate-900">Agendar reunião</h2>
              <p className="text-sm text-slate-500">
                O evento é criado no Google Agenda e os convidados recebem o convite por e-mail.
              </p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Fechar">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className={hasGuestFromDomain ? 'mt-5 grid gap-5 lg:grid-cols-[1fr_360px]' : 'mt-5'}>
          <div className="space-y-4">
            <div>
              <label className="form-label">Título *</label>
              <input
                required
                className="form-control"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="form-label">Data *</label>
                <DateInput
                  required
                  className="form-control"
                  value={date}
                  onValueChange={(value) => setDate(value ?? '')}
                />
              </div>
              <div>
                <label className="form-label">Início (Brasília) *</label>
                <input
                  required
                  type="time"
                  className="form-control"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Duração</label>
                <select
                  className="form-control"
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                >
                  {DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`.replace('.5', ',5')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={withMeet}
                onChange={(event) => setWithMeet(event.target.checked)}
              />
              <Icon name="video" className="h-5 w-5 text-emerald-600" />
              Adicionar videoconferência do Google Meet
            </label>

            <div>
              <label className="form-label" htmlFor="meeting-guests">
                Convidados
              </label>
              <div className="relative">
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 p-2">
                  {attendees.map((email) => (
                    <span
                      key={email}
                      className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-slate-700"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() =>
                          setAttendees((items) => items.filter((item) => item !== email))
                        }
                        aria-label={`Remover ${email}`}
                      >
                        <Icon name="x" className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    id="meeting-guests"
                    className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
                    placeholder="Nome ou e-mail e Enter"
                    value={guestInput}
                    onChange={(event) => setGuestInput(event.target.value)}
                    onKeyDown={onGuestKeyDown}
                    autoComplete="off"
                  />
                </div>
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {suggestions.map((user) => (
                      <li key={user.email}>
                        <button
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-purple-50"
                          onClick={() => addGuest(user.email)}
                        >
                          <span className="block font-semibold text-slate-700">{user.name}</span>
                          <span className="block text-xs text-slate-400">{user.email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                O contato do lead já vem incluído. Digite o nome de um usuário do CRM ou qualquer
                e-mail.
                {!lead.contactEmail && ' Este lead não tem e-mail de contato cadastrado.'}
              </p>
            </div>

            <div>
              <label className="form-label">Descrição</label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          {hasGuestFromDomain && (
            <AvailabilityPanel
              emails={domainEmails}
              currentUserEmail={currentUserEmail}
              date={date}
              time={time}
              durationMinutes={duration}
              onPickDate={setDate}
            />
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving || !title.trim()}>
            <Icon name="calendar" className="h-4 w-4" />
            {isSaving ? 'Agendando…' : 'Agendar no Google Agenda'}
          </button>
        </div>
      </form>
    </div>
  );
}
