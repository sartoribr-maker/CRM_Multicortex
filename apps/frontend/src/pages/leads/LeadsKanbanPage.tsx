import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { KanbanBoard } from '../../components/leads/kanban/KanbanBoard';
import { money } from '../../components/leads/kanban/LeadKanbanCard';
import { MoveLeadModal, type MoveLeadPayload } from '../../components/leads/kanban/MoveLeadModal';
import { leadsApi, type LeadListFilters } from '../../lib/leadsApi';
import { partnersApi } from '../../lib/partnersApi';
import {
  dealSizesApi,
  prioritiesApi,
  projectTypesApi,
  sourcesApi,
  stagesApi,
} from '../../lib/settingsApi';
import { usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { LEAD_LINE_LABELS, type LeadListItem } from '../../types/leads';
import type { Partner } from '../../types/partners';
import type { DealSize, Priority, ProjectType, Source, Stage } from '../../types/settings';

interface PendingMove {
  lead: LeadListItem;
  stage: Stage;
}

export default function LeadsKanbanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
  const canCreate = user?.permissions.includes('leads.create') ?? false;
  const canEdit = user?.permissions.includes('leads.edit') ?? false;
  const [stages, setStages] = useState<Stage[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [dealSizes, setDealSizes] = useState<DealSize[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [filters, setFilters] = useState<LeadListFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    Promise.all([
      stagesApi.list(),
      prioritiesApi.list(),
      dealSizesApi.list(),
      sourcesApi.list(),
      projectTypesApi.list(),
      canViewAll ? usersApi.list() : Promise.resolve([]),
      partnersApi.options(),
    ])
      .then(
        ([
          stageData,
          priorityData,
          dealSizeData,
          sourceData,
          projectData,
          userData,
          partnerData,
        ]) => {
          setStages([...stageData].sort((a, b) => a.order - b.order));
          setPriorities(priorityData);
          setDealSizes(dealSizeData);
          setSources(sourceData);
          setProjectTypes(projectData);
          setUsers(userData);
          setPartners(partnerData);
        },
      )
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
  const visibleStages = useMemo(
    () => (filters.stageId ? stages.filter((stage) => stage.id === filters.stageId) : stages),
    [filters.stageId, stages],
  );
  const totalValue = useMemo(
    () => leads.reduce((sum, lead) => sum + Number(lead.estimatedValue ?? 0), 0),
    [leads],
  );
  function updateFilter(key: keyof LeadListFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  function openLead(leadId: string) {
    navigate(`/leads/${leadId}`, {
      state: { returnTo: `${location.pathname}${location.search}` },
    });
  }

  function requestMove(leadId: string, stage: Stage) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.stage.id === stage.id || !canEdit) return;
    setPendingMove({ lead, stage });
  }

  async function persistMove(lead: LeadListItem, stage: Stage, payload: MoveLeadPayload) {
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
      const updatedLead = await leadsApi.update(lead.id, payload);
      setLeads((items) => items.map((item) => (item.id === lead.id ? updatedLead : item)));
      setPendingMove(null);
    } catch (err) {
      setLeads(previous);
      setError(err instanceof Error ? err.message : 'Não foi possível mover o lead.');
    } finally {
      setIsMoving(false);
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
      <div className="filter-panel mb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative sm:col-span-2">
            <Icon name="search" className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              className="form-control pl-10"
              placeholder="Buscar por lead, empresa ou contato..."
              value={filters.search ?? ''}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>
          <select
            className="form-control"
            value={filters.line ?? ''}
            onChange={(event) => updateFilter('line', event.target.value)}
          >
            <option value="">Todas as linhas</option>
            {Object.entries(LEAD_LINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={filters.stageId ?? ''}
            onChange={(event) => updateFilter('stageId', event.target.value)}
          >
            <option value="">Todas as etapas</option>
            {stages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="form-control"
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
            className="form-control"
            value={filters.dealSizeId ?? ''}
            onChange={(event) => updateFilter('dealSizeId', event.target.value)}
          >
            <option value="">Todos os portes</option>
            {dealSizes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={filters.sourceId ?? ''}
            onChange={(event) => updateFilter('sourceId', event.target.value)}
          >
            <option value="">Todas as origens</option>
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="form-control"
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
          <select
            className="form-control"
            value={filters.partnerId ?? ''}
            onChange={(event) => updateFilter('partnerId', event.target.value)}
          >
            <option value="">Todos os parceiros comerciais</option>
            {partners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="form-control"
            value={filters.technicalPartnerId ?? ''}
            onChange={(event) => updateFilter('technicalPartnerId', event.target.value)}
          >
            <option value="">Todos os parceiros técnicos</option>
            {partners.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {canViewAll && (
            <select
              className="form-control"
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
              className="h-10 justify-self-start whitespace-nowrap px-2 text-xs font-bold text-brand-purple"
              onClick={() => setFilters({})}
            >
              Limpar filtros
            </button>
          )}
        </div>
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
        <KanbanBoard
          stages={visibleStages}
          leadsByStage={grouped}
          canDrag={canEdit}
          isMoving={isMoving}
          onMove={requestMove}
          onOpen={openLead}
          onAdd={() => navigate('/leads/novo')}
        />
      )}
      {pendingMove && (
        <MoveLeadModal
          lead={pendingMove.lead}
          stage={pendingMove.stage}
          isSubmitting={isMoving}
          userOptions={users}
          onCancel={() => setPendingMove(null)}
          onConfirm={(payload) => void persistMove(pendingMove.lead, pendingMove.stage, payload)}
        />
      )}
    </AppShell>
  );
}
