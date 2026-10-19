import type { DragEvent } from 'react';
import { formatCurrency, formatDate } from '../../../lib/formatters';
import { Icon } from '../../Icon';
import { avatarUrl } from '../../../lib/usersApi';
import { LEAD_TYPE_LABELS, type LeadListItem } from '../../../types/leads';

const DAY_MS = 86_400_000;

export function money(value: string | number | null) {
  return value === null ? 'Valor não informado' : formatCurrency(value);
}

function isMandatoryPriority(lead: LeadListItem) {
  return (
    lead.priority?.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase() === 'mandatoria'
  );
}

export function daysInStage(lead: Pick<LeadListItem, 'stageEnteredAt' | 'createdAt'>, now = Date.now()) {
  return Math.floor((now - new Date(lead.stageEnteredAt || lead.createdAt).getTime()) / DAY_MS);
}

interface LeadKanbanCardProps {
  lead: LeadListItem;
  draggable: boolean;
  isDragging: boolean;
  /** Oculta o valor estimado (Portal SDR). */
  hideFinancial?: boolean;
  /** Destaca leads sem movimentação há mais de N dias. */
  staleDays?: number;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

export function LeadKanbanCard({
  lead,
  draggable,
  isDragging,
  hideFinancial = false,
  staleDays,
  onDragStart,
  onDragEnd,
  onClick,
}: LeadKanbanCardProps) {
  const mandatory = isMandatoryPriority(lead);
  const idleDays = daysInStage(lead);
  const isStale = staleDays !== undefined && idleDays > staleDays;
  const meeting = lead.meetings?.[0];

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group cursor-pointer rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        mandatory
          ? 'border-rose-200 bg-rose-50 shadow-rose-200/30 hover:border-rose-300 hover:bg-rose-100/70'
          : 'border-amber-200/80 bg-amber-50 shadow-amber-200/30 hover:border-amber-300 hover:bg-amber-100/70'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-800 group-hover:text-brand-purple">
            {lead.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            {[lead.businessCode, lead.companyName || 'Empresa não informada']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {lead.leadType && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                lead.leadType === 'INBOUND'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-violet-100 text-violet-700'
              }`}
              title="Tipo de lead"
            >
              {LEAD_TYPE_LABELS[lead.leadType]}
            </span>
          )}
          {meeting && (
            <span
              className="flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-blue"
              title={`Reunião agendada: ${meeting.title} — ${formatDate(meeting.startAt)} ${new Date(meeting.startAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`}
              aria-label="Reunião agendada"
            >
              <Icon name="calendar" className="h-3.5 w-3.5" />
              {new Date(meeting.startAt).toLocaleDateString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
          )}
          {lead.priority && (
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: lead.priority.color }}
              title={lead.priority.name}
            />
          )}
        </div>
      </div>
      <div className={`my-3 h-px ${mandatory ? 'bg-rose-200/70' : 'bg-amber-200/60'}`} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-slate-700">
            {formatDate(lead.stageEnteredAt || lead.createdAt)}
          </span>
          {isStale && (
            <p className="mt-0.5 text-[10px] font-bold text-rose-600">Parado há {idleDays} dias</p>
          )}
          {!hideFinancial && lead.estimatedValue != null && (
            <p className="mt-0.5 text-[10px] text-slate-400">{money(lead.estimatedValue)}</p>
          )}
        </div>
        <span className="text-[10px] font-semibold text-slate-400">
          {lead.projectTypes.length
            ? lead.projectTypes.map(({ projectType }) => projectType.name).join(', ')
            : 'Sem categoria'}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-0">
          {lead.assignees.slice(0, 4).map(({ user: responsible }, index) =>
            responsible.avatarUrl ? (
              <img
                key={responsible.id}
                src={avatarUrl(responsible.id, responsible.avatarUrl)}
                alt={responsible.name}
                title={responsible.name}
                className={`h-7 w-7 rounded-full border-2 border-white object-cover ${index ? '-ml-1.5' : ''}`}
              />
            ) : (
              <span
                key={responsible.id}
                title={responsible.name}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-blue/10 text-[9px] font-bold text-brand-blue ${index ? '-ml-1.5' : ''}`}
              >
                {responsible.name
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()}
              </span>
            ),
          )}
          <span className="ml-1.5 max-w-[105px] truncate text-[11px] font-medium text-slate-500">
            {lead.assignees.map((assignment) => assignment.user.name).join(', ')}
          </span>
        </div>
        <p className="max-w-[115px] text-right text-[10px] leading-4 text-slate-400">
          <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-300">
            Origem
          </span>
          {lead.source?.name ?? 'Não informada'}
          {lead.partner ? ` · Comercial: ${lead.partner.name}` : ''}
        </p>
      </div>
    </article>
  );
}
