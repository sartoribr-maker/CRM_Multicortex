import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { LeadAttachments } from '../../components/leads/LeadAttachments';
import { LeadTimeline } from '../../components/leads/LeadTimeline';
import { TaskDeadline } from '../../components/TaskDeadline';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { leadsApi } from '../../lib/leadsApi';
import { tasksApi } from '../../lib/tasksApi';
import { useAuthStore } from '../../store/useAuthStore';
import { LEAD_LINE_LABELS, type LeadDetail, type StageHistoryEntry } from '../../types/leads';
import type { SdrPortalConfig } from '../../types/sdrPortal';
import type { Priority, ProjectType, Segment, Stage } from '../../types/settings';
import { TASK_STATUS_LABELS, type Task } from '../../types/tasks';
import {
  SdrLeadFields,
  sdrFormFromLead,
  sdrPayloadFromForm,
  type SdrLeadFormState,
} from './SdrLeadFields';

type Tab = 'details' | 'timeline' | 'history' | 'attachments' | 'tasks';

interface SdrLeadDrawerProps {
  leadId: string;
  config: SdrPortalConfig;
  priorities: Priority[];
  projectTypes: ProjectType[];
  segments: Segment[];
  /** Muda quando o lead é alterado fora do drawer (ex.: movimentação). */
  reloadKey?: number;
  onClose: () => void;
  onSaved: (lead: LeadDetail) => void;
  onRequestMove: (lead: LeadDetail, stage: Stage) => void;
}

export function SdrLeadDrawer({
  leadId,
  config,
  priorities,
  projectTypes,
  segments,
  reloadKey = 0,
  onClose,
  onSaved,
  onRequestMove,
}: SdrLeadDrawerProps) {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const canEdit = permissions.includes('leads.edit');
  const canViewTasks = permissions.includes('tasks.view');
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [form, setForm] = useState<SdrLeadFormState | null>(null);
  const [tab, setTab] = useState<Tab>('details');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLead(null);
    setError(null);
    leadsApi
      .get(leadId)
      .then((data) => {
        setLead(data);
        setForm(sdrFormFromLead(data));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Não foi possível carregar a oportunidade.'),
      );
  }, [leadId, reloadKey]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!lead || !form) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await leadsApi.update(lead.id, sdrPayloadFromForm(form, 'update'));
      setLead(updated);
      setForm(sdrFormFromLead(updated));
      setSaved(true);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  }

  const moveTargets = lead
    ? config.allowedTargetStages.filter((stage) => stage.id !== lead.stage.id)
    : [];
  const tabs: Array<[Tab, string]> = [
    ['details', 'Dados'],
    ['timeline', 'Linha do tempo'],
    ['history', 'Etapas'],
    ['attachments', 'Anexos'],
    ...(canViewTasks ? ([['tasks', 'Tarefas']] as Array<[Tab, string]>) : []),
  ];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={lead?.name ?? 'Oportunidade'}
        className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
      >
        <header className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-purple">
                {[lead?.businessCode, lead?.line ? LEAD_LINE_LABELS[lead.line] : null]
                  .filter(Boolean)
                  .join(' · ') || 'Oportunidade'}
              </p>
              <h2 className="mt-1 truncate font-heading text-xl font-bold text-slate-900">
                {lead?.name ?? 'Carregando…'}
              </h2>
              {lead && (
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className="status-dot" style={{ backgroundColor: lead.stage.color }} />
                  {lead.stage.name} · desde {formatDate(lead.stageEnteredAt)}
                </p>
              )}
            </div>
            <button className="icon-button shrink-0" onClick={onClose} aria-label="Fechar">
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
          {lead && canEdit && moveTargets.length > 0 && (
            <label className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              Mover para
              <select
                className="form-control !h-9 !w-auto !py-1 text-sm"
                value=""
                onChange={(event) => {
                  const stage = moveTargets.find((item) => item.id === event.target.value);
                  if (stage) onRequestMove(lead, stage);
                }}
              >
                <option value="">Selecione a etapa…</option>
                {moveTargets.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <nav className="-mb-5 mt-4 flex gap-1 overflow-x-auto">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
                  tab === key
                    ? 'border-brand-purple text-brand-purple'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          {!lead || !form ? (
            !error && <p className="text-sm text-slate-400">Carregando…</p>
          ) : (
            <>
              {tab === 'details' && (
                <form onSubmit={handleSave}>
                  {!config.hideFinancialValues && lead.estimatedValue != null && (
                    <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Valor estimado: <strong>{formatCurrency(lead.estimatedValue)}</strong>
                    </p>
                  )}
                  <fieldset disabled={!canEdit || isSaving}>
                    <SdrLeadFields
                      form={form}
                      onChange={(next) => {
                        setForm(next);
                        setSaved(false);
                      }}
                      priorities={priorities}
                      projectTypes={projectTypes}
                      segments={segments}
                    />
                  </fieldset>
                  {canEdit && (
                    <div className="mt-6 flex items-center justify-end gap-3">
                      {saved && (
                        <span className="text-xs font-semibold text-emerald-600">Salvo.</span>
                      )}
                      <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Salvando…' : 'Salvar alterações'}
                      </button>
                    </div>
                  )}
                </form>
              )}
              {tab === 'timeline' && <LeadTimeline leadId={lead.id} canComment={canEdit} />}
              {tab === 'history' && <StageHistory leadId={lead.id} />}
              {tab === 'attachments' && (
                <LeadAttachments leadId={lead.id} canUpload={canEdit} canRemove={false} />
              )}
              {tab === 'tasks' && <LeadTasks leadId={lead.id} />}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function StageHistory({ leadId }: { leadId: string }) {
  const [entries, setEntries] = useState<StageHistoryEntry[] | null>(null);

  useEffect(() => {
    leadsApi.listStageHistory(leadId).then((items) => setEntries([...items].reverse()));
  }, [leadId]);

  if (!entries) return <p className="text-sm text-slate-400">Carregando…</p>;
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-xl border border-slate-100 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">
              {entry.fromStage ? `${entry.fromStage.name} → ` : ''}
              {entry.toStage.name}
            </span>
            <span className="text-xs text-slate-400">{formatDate(entry.createdAt)}</span>
          </div>
          {entry.reason && <p className="mt-1 text-slate-600">{entry.reason}</p>}
          <p className="mt-1 text-xs text-slate-400">
            por {entry.changedByUser.name}
            {entry.timeInPreviousStageSeconds !== null &&
              ` · ${Math.round(entry.timeInPreviousStageSeconds / 86400)} dia(s) na etapa anterior`}
          </p>
        </li>
      ))}
      {entries.length === 0 && <p className="text-sm text-slate-400">Sem movimentações.</p>}
    </ol>
  );
}

function LeadTasks({ leadId }: { leadId: string }) {
  const canComplete = useAuthStore((s) => s.user?.permissions.includes('tasks.edit') ?? false);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    tasksApi
      .list({ leadId, pageSize: 100 })
      .then((page) => setTasks(page.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas.'));
  }

  useEffect(refresh, [leadId]);

  async function handleComplete(event: FormEvent) {
    event.preventDefault();
    if (!completing || !reason.trim()) return;
    setError(null);
    try {
      await tasksApi.complete(completing.id, reason.trim());
      setCompleting(null);
      setReason('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a tarefa.');
    }
  }

  if (!tasks) return <p className="text-sm text-slate-400">{error ?? 'Carregando…'}</p>;
  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {tasks.map((task) => {
          const open = task.status !== 'DONE' && task.status !== 'CANCELED';
          return (
            <li key={task.id} className="rounded-xl border border-slate-100 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-700">{task.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {open ? <TaskDeadline dueDate={task.dueDate} /> : formatDate(task.dueDate)}
                    <span>{TASK_STATUS_LABELS[task.status]}</span>
                  </p>
                </div>
                {open && canComplete && (
                  <button
                    className="btn-secondary !py-1.5 text-xs"
                    onClick={() => {
                      setCompleting(task);
                      setReason('');
                    }}
                  >
                    Concluir
                  </button>
                )}
              </div>
              {completing?.id === task.id && (
                <form onSubmit={handleComplete} className="mt-3 space-y-2">
                  <label className="form-label">Justificativa da conclusão *</label>
                  <textarea
                    autoFocus
                    required
                    className="form-control"
                    rows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setCompleting(null)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={!reason.trim()}>
                      Concluir tarefa
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
        {tasks.length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma tarefa sua nesta oportunidade.</p>
        )}
      </ul>
    </div>
  );
}
