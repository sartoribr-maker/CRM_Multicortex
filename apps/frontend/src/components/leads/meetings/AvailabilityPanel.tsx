import { useEffect, useMemo, useState } from 'react';
import { calendarApi, type CalendarAvailability } from '../../../lib/calendarApi';
import { Icon } from '../../Icon';

// Brasília (UTC−03:00), como no restante do CRM.
const BRT_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

interface DaySegment {
  email: string;
  label: string;
}

/** "AAAA-MM-DD" do dia em Brasília. */
function brtDay(time: number): string {
  return new Date(time - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

function brtTime(time: number): string {
  return new Date(time - BRT_OFFSET_MS).toISOString().slice(11, 16);
}

/** Quebra um intervalo ocupado em trechos por dia (Brasília). */
export function splitByDay(email: string, start: number, end: number) {
  const segments: Array<DaySegment & { day: string }> = [];
  let cursor = start;
  while (cursor < end) {
    const day = brtDay(cursor);
    const dayEnd = Date.parse(`${day}T00:00:00-03:00`) + DAY_MS;
    const segmentEnd = Math.min(end, dayEnd);
    const wholeDay = brtTime(cursor) === '00:00' && segmentEnd === dayEnd;
    segments.push({
      email,
      day,
      label: wholeDay
        ? 'Dia inteiro'
        : `${brtTime(cursor)}–${segmentEnd === dayEnd ? '24:00' : brtTime(segmentEnd)}`,
    });
    cursor = segmentEnd;
  }
  return segments;
}

interface AvailabilityPanelProps {
  /** E-mails do domínio do Workspace cuja agenda será consultada. */
  emails: string[];
  currentUserEmail?: string;
  /** Data escolhida (AAAA-MM-DD) e horário da reunião, em Brasília. */
  date: string;
  time: string;
  durationMinutes: number;
  onPickDate: (date: string) => void;
}

/** Mostra apenas "Ocupado" e o horário; os compromissos nunca são exibidos. */
export function AvailabilityPanel({
  emails,
  currentUserEmail,
  date,
  time,
  durationMinutes,
  onPickDate,
}: AvailabilityPanelProps) {
  const month = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : brtDay(Date.now()).slice(0, 7);
  const [calendars, setCalendars] = useState<CalendarAvailability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailsKey = [...emails].sort().join(',');

  useEffect(() => {
    if (!emailsKey) return;
    const [year, monthNumber] = month.split('-').map(Number);
    const monthStart = Date.parse(`${month}-01T00:00:00-03:00`);
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
    const monthEnd = Date.parse(`${nextMonth}-01T00:00:00-03:00`);
    const from = Math.max(monthStart, Date.now());
    if (from >= monthEnd) {
      setCalendars([]);
      return;
    }
    let current = true;
    setCalendars(null);
    setError(null);
    const timeout = window.setTimeout(() => {
      calendarApi
        .availability(
          emailsKey.split(','),
          new Date(from).toISOString(),
          new Date(monthEnd).toISOString(),
        )
        .then((result) => current && setCalendars(result.calendars))
        .catch(
          (err) =>
            current && setError(err instanceof Error ? err.message : 'Erro ao consultar agendas.'),
        );
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [emailsKey, month]);

  const label = (email: string) => (email === currentUserEmail ? `${email} (você)` : email);

  const days = useMemo(() => {
    const byDay = new Map<string, DaySegment[]>();
    for (const calendar of calendars ?? []) {
      for (const interval of calendar.busy) {
        for (const segment of splitByDay(
          calendar.email,
          Date.parse(interval.start),
          Date.parse(interval.end),
        )) {
          if (!byDay.has(segment.day)) byDay.set(segment.day, []);
          byDay.get(segment.day)!.push(segment);
        }
      }
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [calendars]);

  const conflicts = useMemo(() => {
    const start = Date.parse(`${date}T${time}:00-03:00`);
    if (Number.isNaN(start)) return [];
    const end = start + durationMinutes * 60_000;
    return (calendars ?? []).filter((calendar) =>
      calendar.busy.some(
        (interval) => Date.parse(interval.start) < end && Date.parse(interval.end) > start,
      ),
    );
  }, [calendars, date, time, durationMinutes]);

  const [year, monthNumber] = month.split('-').map(Number);

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Icon name="calendar" className="h-4 w-4 text-brand-blue" />
        Agenda de {MONTHS[monthNumber - 1]} de {year}
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Horários ocupados (Brasília) dos convidados @ do domínio. Os compromissos não são exibidos.
      </p>

      {conflicts.length > 0 && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
        >
          Conflito no horário escolhido:{' '}
          {conflicts.map((calendar) => label(calendar.email)).join(', ')}{' '}
          {conflicts.length > 1 ? 'estão ocupados' : 'está ocupado'}.
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {!calendars && !error && <p className="mt-3 text-xs text-slate-400">Consultando agendas…</p>}
      {calendars
        ?.filter((calendar) => calendar.unavailable)
        .map((calendar) => (
          <p key={calendar.email} className="mt-2 text-xs text-slate-500">
            {label(calendar.email)}: agenda indisponível para consulta.
          </p>
        ))}

      {calendars && (
        <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {days.map(([day, segments]) => {
            const weekday = WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
            return (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => onPickDate(day)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition hover:border-brand-purple ${
                    day === date ? 'border-brand-purple bg-purple-50' : 'border-slate-200 bg-white'
                  }`}
                  title="Usar esta data"
                >
                  <span className="text-xs font-bold text-slate-700">
                    {weekday}, {day.slice(8, 10)}/{day.slice(5, 7)}
                  </span>
                  <span className="mt-1 block space-y-0.5">
                    {[...new Set(segments.map((segment) => segment.email))].map((email) => (
                      <span key={email} className="block text-[11px] leading-5 text-slate-500">
                        <span className="font-semibold text-slate-600">{label(email)}</span>
                        {': '}
                        {segments
                          .filter((segment) => segment.email === email)
                          .map((segment) => `Ocupado ${segment.label}`)
                          .join(' · ')}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
          {days.length === 0 && (
            <li className="text-xs text-slate-500">Nenhum horário ocupado neste mês.</li>
          )}
        </ol>
      )}
    </section>
  );
}
