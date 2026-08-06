import { type DragEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { leadsApi, type LeadListFilters } from '../../lib/leadsApi';
import { prioritiesApi, projectTypesApi, stagesApi } from '../../lib/settingsApi';
import { avatarUrl, usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { LeadListItem } from '../../types/leads';
import type { Priority, ProjectType, Stage } from '../../types/settings';

interface PendingMove {
  lead: LeadListItem;
  stage: Stage;
}

function money(value: string | number | null) {
  if (value === null) return 'Valor não informado';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export default function LeadsKanbanPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
  const canCreate = user?.permissions.includes('leads.create') ?? false;
  const canEdit = user?.permissions.includes('leads.edit') ?? false;
  const [stages, setStages] = useState<Stage[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [filters, setFilters] = useState<LeadListFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [moveOwnerIds, setMoveOwnerIds] = useState<string[]>([]);
  const [createTask, setCreateTask] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    Promise.all([
      stagesApi.list(),
      prioritiesApi.list(),
      projectTypesApi.list(),
      canViewAll ? usersApi.list() : Promise.resolve([]),
    ])
      .then(([stageData, priorityData, projectData, userData]) => {
        setStages([...stageData].sort((a, b) => a.order - b.order));
        setPriorities(priorityData);
        setProjectTypes(projectData);
        setUsers(userData);
      })
      .catch(() => setError('Não foi possível carregar as configurações do funil.'));
  }, [canViewAll]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    leadsApi
      .list({ ...filters, page: 1, pageSize: 100 })
      .then(async (first) => {
        const rest =
          first.totalPages > 1
            ? await Promise.all(
                Array.from({ length: first.totalPages - 1 }, (_, index) =>
                  leadsApi.list({ ...filters, page: index + 2, pageSize: 100 }),
                ),
              )
            : [];
        if (!cancelled) setLeads([first, ...rest].flatMap((page) => page.items));
      })
      .catch(
        (err) =>
          !cancelled && setError(err instanceof Error ? err.message : 'Erro ao carregar o Kanban.'),
      )
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const grouped = useMemo(
    () =>
      new Map(
        stages.map((stage) => [stage.id, leads.filter((lead) => lead.stage.id === stage.id)]),
      ),
    [leads, stages],
  );
  const totalValue = useMemo(
    () => leads.reduce((sum, lead) => sum + Number(lead.estimatedValue ?? 0), 0),
    [leads],
  );
  function updateFilter(key: keyof LeadListFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  function requestMove(leadId: string, stage: Stage) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.stage.id === stage.id || !canEdit) return;
    setPendingMove({ lead, stage });
    setLossReason('');
    setActionDescription('');
    setMoveOwnerIds(lead.assignees.map((assignment) => assignment.user.id));
    setCreateTask(false);
    setTaskDueDate('');
    setTaskPriority('MEDIUM');
  }

  async function persistMove(lead: LeadListItem, stage: Stage) {
    const previous = leads;
    setIsMoving(true);
    setError(null);
    setLeads((items) =>
      items.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              stage,
              status: stage.isWonStage ? 'WON' : stage.isLostStage ? 'LOST' : 'OPEN',
              stageEnteredAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    try {
      const updatedLead = await leadsApi.update(lead.id, {
        stageId: stage.id,
        lossReason: stage.isLostStage ? lossReason.trim() : undefined,
        actionDescription: actionDescription.trim(),
        ownerIds: moveOwnerIds,
        createTask,
        taskDueDate: createTask ? new Date(taskDueDate).toISOString() : undefined,
        taskPriority: createTask ? taskPriority : undefined,
      });
      setLeads((items) => items.map((item) => (item.id === lead.id ? updatedLead : item)));
      setPendingMove(null);
      setLossReason('');
    } catch (err) {
      setLeads(previous);
      setError(err instanceof Error ? err.message : 'Não foi possível mover o lead.');
    } finally {
      setIsMoving(false);
      setDraggedId(null);
      setDragOverStageId(null);
    }
  }

  function onDrop(event: DragEvent, stage: Stage) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData('text/lead-id') || draggedId;
    setDragOverStageId(null);
    if (leadId) requestMove(leadId, stage);
  }
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const moveUserOptions = users.length
    ? users
    : (pendingMove?.lead.assignees.map((assignment) => assignment.user) ?? []);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Pipeline comercial"
        title="Kanban de oportunidades"
        description={`${leads.length} oportunidades · ${money(totalValue)} em valor estimado`}
        actions={
          canCreate && (
            <button className="btn-primary" onClick={() => navigate('/leads/novo')}>
              <Icon name="plus" className="h-4 w-4" />
              Nova oportunidade
            </button>
          )
        }
      />
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="relative min-w-[260px] flex-1">
          <Icon name="search" className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            className="form-control pl-10"
            placeholder="Buscar oportunidade..."
            value={filters.search ?? ''}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </div>
        <select
          className="form-control xl:w-48"
          value={filters.priorityId ?? ''}
          onChange={(event) => updateFilter('priorityId', event.target.value)}
        >
          <option value="">Todas as prioridades</option>
          {priorities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          className="form-control xl:w-48"
          value={filters.projectTypeId ?? ''}
          onChange={(event) => updateFilter('projectTypeId', event.target.value)}
        >
          <option value="">Todos os projetos</option>
          {projectTypes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {canViewAll && (
          <select
            className="form-control xl:w-48"
            value={filters.ownerId ?? ''}
            onChange={(event) => updateFilter('ownerId', event.target.value)}
          >
            <option value="">Todos os responsáveis</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
        {activeFilterCount > 0 && (
          <button
            className="h-10 whitespace-nowrap px-2 text-xs font-bold text-brand-purple"
            onClick={() => setFilters({})}
          >
            Limpar filtros
          </button>
        )}
      </div>
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}
      {isLoading ? (
        <div className="card flex h-72 items-center justify-center text-sm text-slate-400">
          Carregando seu funil comercial…
        </div>
      ) : stages.length === 0 ? (
        <div className="card p-12 text-center">
          <Icon name="settings" className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">O funil ainda não possui etapas</p>
          <button className="btn-primary mt-5" onClick={() => navigate('/settings/stages')}>
            Configurar etapas
          </button>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-5 md:-mx-8 md:px-8">
          <div className="flex min-w-max items-start gap-4">
            {stages.map((stage) => {
              const columnLeads = grouped.get(stage.id) ?? [];
              const columnValue = columnLeads.reduce(
                (sum, lead) => sum + Number(lead.estimatedValue ?? 0),
                0,
              );
              return (
                <section
                  key={stage.id}
                  className={`w-[calc(100vw-3rem)] rounded-2xl border bg-slate-100/70 p-3 transition sm:w-[310px] ${dragOverStageId === stage.id ? 'border-brand-purple bg-purple-50 ring-4 ring-purple-100' : 'border-slate-200/80'}`}
                  onDragOver={(event) => {
                    if (canEdit) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDragOverStageId(stage.id);
                    }
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node))
                      setDragOverStageId(null);
                  }}
                  onDrop={(event) => onDrop(event, stage)}
                >
                  <header className="mb-3 px-1 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shadow-sm"
                          style={{ backgroundColor: stage.color }}
                        />
                        <h2 className="text-sm font-bold text-slate-800">{stage.name}</h2>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm">
                          {columnLeads.length}
                        </span>
                      </div>
                      <button
                        className="icon-button !h-7 !w-7"
                        onClick={() => navigate('/leads/novo')}
                        title="Adicionar"
                      >
                        <Icon name="plus" className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {money(columnValue)}
                    </p>
                  </header>
                  <div className="flex min-h-[120px] flex-col gap-3">
                    {columnLeads.map((lead) => (
                      <article
                        key={lead.id}
                        draggable={canEdit && !isMoving}
                        onDragStart={(event) => {
                          setDraggedId(lead.id);
                          event.dataTransfer.setData('text/lead-id', lead.id);
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverStageId(null);
                        }}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className={`group cursor-pointer rounded-xl border border-amber-200/80 bg-amber-50 p-4 shadow-sm shadow-amber-200/30 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100/70 hover:shadow-md ${draggedId === lead.id ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-800 group-hover:text-brand-purple">
                              {lead.name}
                            </h3>
                            <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                              {lead.companyName || 'Empresa não informada'}
                            </p>
                          </div>
                          {lead.priority && (
                            <span
                              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: lead.priority.color }}
                              title={lead.priority.name}
                            />
                          )}
                        </div>
                        <div className="my-3 h-px bg-amber-200/60" />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-slate-700">
                              {new Date(lead.stageEnteredAt || lead.createdAt).toLocaleDateString(
                                'pt-BR',
                              )}
                            </span>
                            {lead.estimatedValue !== null && (
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {money(lead.estimatedValue)}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {lead.projectType?.name ?? 'Sem categoria'}
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
                            {lead.source?.name.toLocaleLowerCase('pt-BR') === 'parceiro' &&
                            lead.partner
                              ? ` · ${lead.partner.name}`
                              : ''}
                          </p>
                        </div>
                      </article>
                    ))}
                    {columnLeads.length === 0 && (
                      <div className="flex min-h-[110px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/50 px-5 text-center text-xs leading-5 text-slate-400">
                        Arraste uma oportunidade para esta etapa
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
      {pendingMove && (
        <div className="mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                actionDescription.trim() &&
                (!pendingMove.stage.isLostStage || lossReason.trim())
              ) {
                void persistMove(pendingMove.lead, pendingMove.stage);
              }
            }}
            className="mobile-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-brand-purple">
              <Icon name="edit" className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-bold text-slate-900">
              Registrar movimentação
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Registre a ação para mover{' '}
              <strong className="text-slate-700">{pendingMove.lead.name}</strong> para{' '}
              {pendingMove.stage.name}.
            </p>
            <label className="form-label mt-5">Ação realizada *</label>
            <textarea
              autoFocus
              required
              className="form-control"
              rows={3}
              value={actionDescription}
              onChange={(event) => setActionDescription(event.target.value)}
              placeholder="Ex.: reunião realizada, proposta apresentada..."
            />
            {pendingMove.stage.isLostStage && (
              <>
                <label className="form-label mt-4">Motivo da perda *</label>
                <textarea
                  required
                  className="form-control"
                  rows={2}
                  value={lossReason}
                  onChange={(event) => setLossReason(event.target.value)}
                />
              </>
            )}
            <label className="form-label mt-4">Responsáveis</label>
            <div className="grid max-h-36 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
              {moveUserOptions.map((responsible) => (
                <label
                  key={responsible.id}
                  className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50"
                >
                  <input
                    type="checkbox"
                    checked={moveOwnerIds.includes(responsible.id)}
                    onChange={(event) =>
                      setMoveOwnerIds((ids) =>
                        event.target.checked
                          ? [...ids, responsible.id]
                          : ids.filter((id) => id !== responsible.id),
                      )
                    }
                  />
                  {responsible.name}
                </label>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={createTask}
                onChange={(event) => setCreateTask(event.target.checked)}
              />
              Cadastrar tarefa para esta ação
            </label>
            {createTask && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">Prazo *</label>
                  <input
                    required
                    type="datetime-local"
                    className="form-control"
                    value={taskDueDate}
                    onChange={(event) => setTaskDueDate(event.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Prioridade *</label>
                  <select
                    className="form-control"
                    value={taskPriority}
                    onChange={(event) => setTaskPriority(event.target.value as typeof taskPriority)}
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPendingMove(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  isMoving ||
                  !actionDescription.trim() ||
                  moveOwnerIds.length === 0 ||
                  (pendingMove.stage.isLostStage && !lossReason.trim())
                }
                className="btn-primary"
              >
                Confirmar movimentação
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
