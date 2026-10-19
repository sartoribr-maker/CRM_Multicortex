import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { KanbanBoard } from '../../components/leads/kanban/KanbanBoard';
import { daysInStage } from '../../components/leads/kanban/LeadKanbanCard';
import { MoveLeadModal, type MoveLeadPayload } from '../../components/leads/kanban/MoveLeadModal';
import { useMeetingScheduling } from '../../components/leads/meetings/useMeetingScheduling';
import { leadsApi, type LeadListFilters } from '../../lib/leadsApi';
import { prioritiesApi, projectTypesApi, segmentsApi } from '../../lib/settingsApi';
import { sdrPortalApi } from '../../lib/sdrPortalApi';
import { useAuthStore } from '../../store/useAuthStore';
import { LEAD_LINE_LABELS, type LeadListItem } from '../../types/leads';
import type { SdrPortalConfig } from '../../types/sdrPortal';
import type { Priority, ProjectType, Segment, Stage } from '../../types/settings';
import { SdrLeadDrawer } from './SdrLeadDrawer';
import { SdrLeadFormModal } from './SdrLeadFormModal';
import { ThirdPartyShell } from './ThirdPartyShell';

interface PendingMove {
  lead: LeadListItem;
  stage: Stage;
  actionDescription?: string;
}

export default function SdrKanbanPage() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const canCreate = permissions.includes('leads.create');
  const canEdit = permissions.includes('leads.edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const openLeadId = searchParams.get('lead');
  const [config, setConfig] = useState<SdrPortalConfig | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [filters, setFilters] = useState<LeadListFilters>({});
  const [staleOnly, setStaleOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [drawerReloadKey, setDrawerReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([
      sdrPortalApi.config(),
      prioritiesApi.list(),
      projectTypesApi.list(),
      segmentsApi.list(),
    ])
      .then(([configData, priorityData, projectData, segmentData]) => {
        setConfig(configData);
        setPriorities(priorityData);
        setProjectTypes(projectData);
        setSegments(segmentData);
      })
      .catch(() => setError('Não foi possível carregar a configuração do portal.'));
  }, []);

  const loadLeads = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
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
          !cancelled &&
          setError(err instanceof Error ? err.message : 'Erro ao carregar oportunidades.'),
      )
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(loadLeads, [loadLeads]);

  const visibleStageIds = useMemo(
    () => new Set(config?.visibleStages.map((stage) => stage.id)),
    [config],
  );
  const allowedTargetIds = useMemo(
    () => new Set(config?.allowedTargetStages.map((stage) => stage.id)),
    [config],
  );
  const boardLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          visibleStageIds.has(lead.stage.id) &&
          (!staleOnly || !config || daysInStage(lead) > config.staleDays),
      ),
    [leads, visibleStageIds, staleOnly, config],
  );
  const grouped = useMemo(
    () =>
      new Map(
        (config?.visibleStages ?? []).map((stage) => [
          stage.id,
          boardLeads.filter((lead) => lead.stage.id === stage.id),
        ]),
      ),
    [boardLeads, config],
  );

  function updateFilter(key: keyof LeadListFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }

  function openLead(leadId: string | null) {
    const next = new URLSearchParams(searchParams);
    if (leadId) next.set('lead', leadId);
    else next.delete('lead');
    setSearchParams(next, { replace: true });
  }

  /** Atualiza o card local; se saiu das etapas visíveis, ele deixa o quadro. */
  function applyLead(updated: LeadListItem) {
    setLeads((items) =>
      visibleStageIds.has(updated.stage.id)
        ? items.map((item) => (item.id === updated.id ? updated : item))
        : items.filter((item) => item.id !== updated.id),
    );
  }

  const meetingScheduling = useMeetingScheduling({
    onProceed: (lead, stage, actionDescription) => setPendingMove({ lead, stage, actionDescription }),
    onMeetingScheduled: (leadId, meeting) => {
      setLeads((items) =>
        items.map((item) => (item.id === leadId ? { ...item, meetings: [meeting] } : item)),
      );
      setDrawerReloadKey((key) => key + 1);
    },
  });

  function requestMove(lead: LeadListItem, stage: Stage) {
    if (lead.stage.id === stage.id || !canEdit) return;
    if (!allowedTargetIds.has(stage.id)) {
      setNotice(`Movimentação para "${stage.name}" não é permitida no Portal SDR.`);
      return;
    }
    setNotice(null);
    meetingScheduling.startMove(lead, stage);
  }

  async function persistMove({ lead, stage }: PendingMove, payload: MoveLeadPayload) {
    const previous = leads;
    setIsMoving(true);
    setError(null);
    setLeads((items) =>
      items.map((item) =>
        item.id === lead.id
          ? { ...item, stage, stageEnteredAt: new Date().toISOString() }
          : item,
      ),
    );
    try {
      applyLead(await leadsApi.update(lead.id, payload));
      setPendingMove(null);
      setDrawerReloadKey((key) => key + 1);
      if (!visibleStageIds.has(stage.id) && openLeadId === lead.id) openLead(null);
    } catch (err) {
      setLeads(previous);
      setError(err instanceof Error ? err.message : 'Não foi possível mover a oportunidade.');
    } finally {
      setIsMoving(false);
    }
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (staleOnly ? 1 : 0);
  const notConfigured = config !== null && config.visibleStages.length === 0;

  return (
    <ThirdPartyShell>
      <PageHeader
        eyebrow="Portal SDR"
        title="Kanban comercial"
        description={`${boardLeads.length} oportunidades em prospecção no CRM`}
        actions={
          canCreate &&
          !notConfigured && (
            <button className="btn-primary" onClick={() => setIsCreating(true)}>
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
              placeholder="Buscar por empresa, contato ou código..."
              value={filters.search ?? ''}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>
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
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={staleOnly}
              onChange={(event) => setStaleOnly(event.target.checked)}
            />
            Parados há mais de {config?.staleDays ?? '…'} dias
          </label>
          {activeFilterCount > 0 && (
            <button
              className="h-10 justify-self-start whitespace-nowrap px-2 text-xs font-bold text-brand-purple"
              onClick={() => {
                setFilters({});
                setStaleOnly(false);
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>
      {(error || notice) && (
        <div
          role="alert"
          className={`mb-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-amber-200 bg-amber-50 text-amber-700'}`}
        >
          <span>{error ?? notice}</span>
          <button
            onClick={() => {
              setError(null);
              setNotice(null);
            }}
            aria-label="Fechar aviso"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}
      {notConfigured ? (
        <div className="card p-12 text-center">
          <Icon name="settings" className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">Portal SDR ainda não configurado</p>
          <p className="mt-1 text-sm text-slate-500">
            Solicite ao administrador que defina as etapas do portal.
          </p>
        </div>
      ) : isLoading || !config ? (
        <div className="card flex h-72 items-center justify-center text-sm text-slate-400">
          Carregando oportunidades…
        </div>
      ) : (
        <KanbanBoard
          stages={config.visibleStages}
          leadsByStage={grouped}
          canDrag={canEdit}
          isMoving={isMoving}
          hideFinancial={config.hideFinancialValues}
          staleDays={config.staleDays}
          canDropOn={(stage) => allowedTargetIds.has(stage.id)}
          onBlockedDrop={(stage) =>
            setNotice(`Movimentação para "${stage.name}" não é permitida no Portal SDR.`)
          }
          onMove={(leadId, stage) => {
            const lead = leads.find((item) => item.id === leadId);
            if (lead) requestMove(lead, stage);
          }}
          onOpen={openLead}
        />
      )}
      {config && openLeadId && (
        <SdrLeadDrawer
          leadId={openLeadId}
          config={config}
          priorities={priorities}
          projectTypes={projectTypes}
          segments={segments}
          reloadKey={drawerReloadKey}
          onClose={() => openLead(null)}
          onSaved={applyLead}
          onRequestMove={(lead, stage) => requestMove(lead, stage)}
        />
      )}
      {pendingMove && (
        <MoveLeadModal
          lead={pendingMove.lead}
          stage={pendingMove.stage}
          isSubmitting={isMoving}
          showOwnerSelector={false}
          initialActionDescription={pendingMove.actionDescription}
          onCancel={() => setPendingMove(null)}
          onConfirm={(payload) => void persistMove(pendingMove, payload)}
        />
      )}
      {meetingScheduling.modals}
      {isCreating && (
        <SdrLeadFormModal
          priorities={priorities}
          projectTypes={projectTypes}
          segments={segments}
          onClose={() => setIsCreating(false)}
          onCreated={(lead) => {
            setIsCreating(false);
            setLeads((items) => [lead, ...items]);
            openLead(lead.id);
          }}
        />
      )}
    </ThirdPartyShell>
  );
}
