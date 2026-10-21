import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { ClaimLeadModal } from '../../components/leads/kanban/ClaimLeadModal';
import { KanbanBoard } from '../../components/leads/kanban/KanbanBoard';
import { daysInStage } from '../../components/leads/kanban/LeadKanbanCard';
import { MoveLeadModal, type MoveLeadPayload } from '../../components/leads/kanban/MoveLeadModal';
import { openFirstExternalLink } from '../../components/LeadPartyExtraFields';
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

/** Intervalo para distinguir o clique simples (abre a oportunidade) do duplo clique (LinkedIn). */
const DOUBLE_CLICK_DELAY_MS = 250;

export default function SdrKanbanPage() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const isThirdParty = useAuthStore((s) => s.user?.portal === 'THIRD_PARTY');
  const canCreate = permissions.includes('leads.create');
  const canEdit = permissions.includes('leads.edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const openLeadId = searchParams.get('lead');
  const clickTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);
  const [config, setConfig] = useState<SdrPortalConfig | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [filters, setFilters] = useState<LeadListFilters>({});
  const [staleOnly, setStaleOnly] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingClaim, setPendingClaim] = useState<Omit<PendingMove, 'actionDescription'> | null>(
    null,
  );
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

  const sdrPartnerId = config?.sdrPartnerId;
  const loadLeads = useCallback(() => {
    // Só leads do parceiro comercial SDR (o backend também restringe para o SDR).
    if (config === null) return;
    if (!sdrPartnerId) {
      setLeads([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const query = { ...filters, partnerId: sdrPartnerId };
    leadsApi
      .list({ ...query, page: 1, pageSize: 100 })
      .then(async (first) => {
        const rest =
          first.totalPages > 1
            ? await Promise.all(
                Array.from({ length: first.totalPages - 1 }, (_, index) =>
                  leadsApi.list({ ...query, page: index + 2, pageSize: 100 }),
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
  }, [filters, config, sdrPartnerId]);

  useEffect(loadLeads, [loadLeads]);

  const visibleStageIds = useMemo(
    () => new Set(config?.visibleStages.map((stage) => stage.id)),
    [config],
  );
  const allowedTargetIds = useMemo(
    () => new Set(config?.allowedTargetStages.map((stage) => stage.id)),
    [config],
  );
  /** Responsáveis presentes nos leads do portal (opções do filtro). */
  const ownerOptions = useMemo(() => {
    const users = new Map<string, string>();
    for (const lead of leads) {
      users.set(lead.owner.id, lead.owner.name);
      for (const { user } of lead.assignees) users.set(user.id, user.name);
    }
    return [...users.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [leads]);
  const boardLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          visibleStageIds.has(lead.stage.id) &&
          (!staleOnly || !config || daysInStage(lead) > config.staleDays) &&
          (!ownerFilter ||
            lead.owner.id === ownerFilter ||
            lead.assignees.some(({ user }) => user.id === ownerFilter)),
      ),
    [leads, visibleStageIds, staleOnly, config, ownerFilter],
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
    onProceed: (lead, stage, actionDescription) =>
      setPendingMove({ lead, stage, actionDescription }),
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
    if (lead.awaitingClaim) setPendingClaim({ lead, stage });
    else meetingScheduling.startMove(lead, stage);
  }

  async function persistMove({ lead, stage }: PendingMove, payload: MoveLeadPayload) {
    const previous = leads;
    setIsMoving(true);
    setError(null);
    setLeads((items) =>
      items.map((item) =>
        item.id === lead.id ? { ...item, stage, stageEnteredAt: new Date().toISOString() } : item,
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

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (staleOnly ? 1 : 0) + (ownerFilter ? 1 : 0);
  const notConfigured =
    config !== null && (config.visibleStages.length === 0 || !config.sdrPartnerId);

  return (
    <ThirdPartyShell>
      <PageHeader
        eyebrow="Portal SDR"
        title="Kanban comercial"
        description={`${boardLeads.length} oportunidades do parceiro SDR`}
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
          <select
            className="form-control"
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            aria-label="Responsável"
          >
            <option value="">Todos os responsáveis</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
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
                setOwnerFilter('');
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
            Solicite ao administrador que defina as etapas e o parceiro SDR do portal.
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
          onOpen={(leadId) => {
            // Espera para distinguir do duplo clique: o painel aberto cobriria o card.
            window.clearTimeout(clickTimer.current);
            clickTimer.current = window.setTimeout(() => openLead(leadId), DOUBLE_CLICK_DELAY_MS);
          }}
          onDoubleOpen={(leadId) => {
            // Duplo clique: LinkedIn do contato; senão o da empresa; senão nada.
            window.clearTimeout(clickTimer.current);
            const lead = leads.find((item) => item.id === leadId);
            openFirstExternalLink(lead?.contactLinkedinUrl, lead?.companyLinkedinUrl);
          }}
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
      {pendingClaim && (
        <ClaimLeadModal
          lead={pendingClaim.lead}
          stage={pendingClaim.stage}
          onDecline={() => setPendingClaim(null)}
          onClaim={() => {
            setPendingClaim(null);
            meetingScheduling.startMove(pendingClaim.lead, pendingClaim.stage);
          }}
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
          // Para o SDR o backend define tipo e parceiro; usuários internos os enviam.
          extraPayload={
            isThirdParty || !sdrPartnerId
              ? undefined
              : { leadType: 'OUTBOUND', partnerId: sdrPartnerId }
          }
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
