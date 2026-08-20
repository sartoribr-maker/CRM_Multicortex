import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { FixedHorizontalScrollbar } from '../../components/FixedHorizontalScrollbar';
import { Icon } from '../../components/Icon';
import { DateInput } from '../../components/MaskedInputs';
import { leadsApi } from '../../lib/leadsApi';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { partnersApi } from '../../lib/partnersApi';
import { dealSizesApi, prioritiesApi, projectTypesApi, sourcesApi, stagesApi, } from '../../lib/settingsApi';
import { avatarUrl, usersApi } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { LEAD_LINE_LABELS } from '../../types/leads';
function money(value) {
    return value === null ? 'Valor não informado' : formatCurrency(value);
}
function isMandatoryPriority(lead) {
    return (lead.priority?.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() === 'mandatoria');
}
export default function LeadsKanbanPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const kanbanScrollRef = useRef(null);
    const cardClickTimerRef = useRef(null);
    const user = useAuthStore((state) => state.user);
    const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
    const canCreate = user?.permissions.includes('leads.create') ?? false;
    const canEdit = user?.permissions.includes('leads.edit') ?? false;
    const [stages, setStages] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [projectTypes, setProjectTypes] = useState([]);
    const [dealSizes, setDealSizes] = useState([]);
    const [sources, setSources] = useState([]);
    const [partners, setPartners] = useState([]);
    const [users, setUsers] = useState([]);
    const [leads, setLeads] = useState([]);
    const [filters, setFilters] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [draggedId, setDraggedId] = useState(null);
    const [dragOverStageId, setDragOverStageId] = useState(null);
    const [pendingMove, setPendingMove] = useState(null);
    const [lossReason, setLossReason] = useState('');
    const [actionDescription, setActionDescription] = useState('');
    const [moveOwnerIds, setMoveOwnerIds] = useState([]);
    const [createTask, setCreateTask] = useState(false);
    const [taskDueDate, setTaskDueDate] = useState('');
    const [taskPriority, setTaskPriority] = useState('MEDIUM');
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
            .then(([stageData, priorityData, dealSizeData, sourceData, projectData, userData, partnerData,]) => {
            setStages([...stageData].sort((a, b) => a.order - b.order));
            setPriorities(priorityData);
            setDealSizes(dealSizeData);
            setSources(sourceData);
            setProjectTypes(projectData);
            setUsers(userData);
            setPartners(partnerData);
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
            const rest = first.totalPages > 1
                ? await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => leadsApi.list({ ...filters, page: index + 2, pageSize: 100 })))
                : [];
            if (!cancelled)
                setLeads([first, ...rest].flatMap((page) => page.items));
        })
            .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Erro ao carregar o Kanban.'))
            .finally(() => !cancelled && setIsLoading(false));
        return () => {
            cancelled = true;
        };
    }, [filters]);
    const grouped = useMemo(() => new Map(stages.map((stage) => [stage.id, leads.filter((lead) => lead.stage.id === stage.id)])), [leads, stages]);
    const visibleStages = useMemo(() => (filters.stageId ? stages.filter((stage) => stage.id === filters.stageId) : stages), [filters.stageId, stages]);
    const totalValue = useMemo(() => leads.reduce((sum, lead) => sum + Number(lead.estimatedValue ?? 0), 0), [leads]);
    function updateFilter(key, value) {
        setFilters((current) => ({ ...current, [key]: value || undefined }));
    }
    function openLeadAfterClick(leadId) {
        if (cardClickTimerRef.current)
            window.clearTimeout(cardClickTimerRef.current);
        cardClickTimerRef.current = window.setTimeout(() => navigate(`/leads/${leadId}`, {
            state: { returnTo: `${location.pathname}${location.search}` },
        }), 250);
    }
    async function markAsMandatory(lead) {
        if (!canEdit || isMandatoryPriority(lead))
            return;
        const mandatoryPriority = priorities.find((priority) => priority.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase() === 'mandatoria');
        if (!mandatoryPriority) {
            setError('A prioridade Mandatória não foi encontrada nas configurações.');
            return;
        }
        try {
            const updated = await leadsApi.update(lead.id, { priorityId: mandatoryPriority.id });
            setLeads((items) => items.map((item) => (item.id === lead.id ? updated : item)));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível alterar a prioridade.');
        }
    }
    function requestMove(leadId, stage) {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead || lead.stage.id === stage.id || !canEdit)
            return;
        setPendingMove({ lead, stage });
        setLossReason('');
        setActionDescription('');
        setMoveOwnerIds(lead.assignees.map((assignment) => assignment.user.id));
        setCreateTask(false);
        setTaskDueDate('');
        setTaskPriority('MEDIUM');
    }
    async function persistMove(lead, stage) {
        const previous = leads;
        setIsMoving(true);
        setError(null);
        setLeads((items) => items.map((item) => item.id === lead.id
            ? {
                ...item,
                stage,
                status: stage.isWonStage ? 'WON' : stage.isLostStage ? 'LOST' : 'OPEN',
                stageEnteredAt: new Date().toISOString(),
            }
            : item));
        try {
            const updatedLead = await leadsApi.update(lead.id, {
                stageId: stage.id,
                lossReason: stage.isLostStage ? lossReason.trim() : undefined,
                actionDescription: actionDescription.trim(),
                ownerIds: moveOwnerIds,
                createTask,
                taskDueDate: createTask ? new Date(`${taskDueDate}T12:00:00`).toISOString() : undefined,
                taskPriority: createTask ? taskPriority : undefined,
            });
            setLeads((items) => items.map((item) => (item.id === lead.id ? updatedLead : item)));
            setPendingMove(null);
            setLossReason('');
        }
        catch (err) {
            setLeads(previous);
            setError(err instanceof Error ? err.message : 'Não foi possível mover o lead.');
        }
        finally {
            setIsMoving(false);
            setDraggedId(null);
            setDragOverStageId(null);
        }
    }
    function onDrop(event, stage) {
        event.preventDefault();
        const leadId = event.dataTransfer.getData('text/lead-id') || draggedId;
        setDragOverStageId(null);
        if (leadId)
            requestMove(leadId, stage);
    }
    const activeFilterCount = Object.values(filters).filter(Boolean).length;
    const moveUserOptions = users.length
        ? users
        : (pendingMove?.lead.assignees.map((assignment) => assignment.user) ?? []);
    return (_jsxs(AppShell, { children: [_jsx(PageHeader, { eyebrow: "Pipeline comercial", title: "Kanban de oportunidades", description: `${leads.length} oportunidades · ${money(totalValue)} em valor estimado`, actions: canCreate && (_jsxs("button", { className: "btn-primary", onClick: () => navigate('/leads/novo'), children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Nova oportunidade"] })) }), _jsx("div", { className: "filter-panel mb-5", children: _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: [_jsxs("label", { className: "relative sm:col-span-2", children: [_jsx(Icon, { name: "search", className: "absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" }), _jsx("input", { className: "form-control pl-10", placeholder: "Buscar por lead, empresa ou contato...", value: filters.search ?? '', onChange: (event) => updateFilter('search', event.target.value) })] }), _jsxs("select", { className: "form-control", value: filters.line ?? '', onChange: (event) => updateFilter('line', event.target.value), children: [_jsx("option", { value: "", children: "Todas as linhas" }), Object.entries(LEAD_LINE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value)))] }), _jsxs("select", { className: "form-control", value: filters.stageId ?? '', onChange: (event) => updateFilter('stageId', event.target.value), children: [_jsx("option", { value: "", children: "Todas as etapas" }), stages.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), _jsxs("select", { className: "form-control", value: filters.priorityId ?? '', onChange: (event) => updateFilter('priorityId', event.target.value), children: [_jsx("option", { value: "", children: "Todas as prioridades" }), priorities.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), _jsxs("select", { className: "form-control", value: filters.dealSizeId ?? '', onChange: (event) => updateFilter('dealSizeId', event.target.value), children: [_jsx("option", { value: "", children: "Todos os portes" }), dealSizes.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), _jsxs("select", { className: "form-control", value: filters.sourceId ?? '', onChange: (event) => updateFilter('sourceId', event.target.value), children: [_jsx("option", { value: "", children: "Todas as origens" }), sources.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), _jsxs("select", { className: "form-control", value: filters.projectTypeId ?? '', onChange: (event) => updateFilter('projectTypeId', event.target.value), children: [_jsx("option", { value: "", children: "Todos os projetos" }), projectTypes.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), _jsxs("select", { className: "form-control", value: filters.partnerId ?? '', onChange: (event) => updateFilter('partnerId', event.target.value), children: [_jsx("option", { value: "", children: "Todos os parceiros comerciais" }), partners.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), _jsxs("select", { className: "form-control", value: filters.technicalPartnerId ?? '', onChange: (event) => updateFilter('technicalPartnerId', event.target.value), children: [_jsx("option", { value: "", children: "Todos os parceiros t\u00E9cnicos" }), partners.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), canViewAll && (_jsxs("select", { className: "form-control", value: filters.ownerId ?? '', onChange: (event) => updateFilter('ownerId', event.target.value), children: [_jsx("option", { value: "", children: "Todos os respons\u00E1veis" }), users.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })), activeFilterCount > 0 && (_jsx("button", { className: "h-10 justify-self-start whitespace-nowrap px-2 text-xs font-bold text-brand-purple", onClick: () => setFilters({}), children: "Limpar filtros" }))] }) }), error && (_jsxs("div", { className: "mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600", children: [_jsx("span", { children: error }), _jsx("button", { onClick: () => setError(null), children: _jsx(Icon, { name: "x", className: "h-4 w-4" }) })] })), isLoading ? (_jsx("div", { className: "card flex h-72 items-center justify-center text-sm text-slate-400", children: "Carregando seu funil comercial\u2026" })) : stages.length === 0 ? (_jsxs("div", { className: "card p-12 text-center", children: [_jsx(Icon, { name: "settings", className: "mx-auto h-9 w-9 text-slate-300" }), _jsx("p", { className: "mt-3 font-semibold text-slate-700", children: "O funil ainda n\u00E3o possui etapas" }), _jsx("button", { className: "btn-primary mt-5", onClick: () => navigate('/settings/stages'), children: "Configurar etapas" })] })) : (_jsx("div", { ref: kanbanScrollRef, className: "-mx-4 overflow-x-auto px-4 pb-5 md:-mx-8 md:px-8", children: _jsx("div", { className: "flex min-w-max items-start gap-4", children: visibleStages.map((stage) => {
                        const columnLeads = grouped.get(stage.id) ?? [];
                        const columnValue = columnLeads.reduce((sum, lead) => sum + Number(lead.estimatedValue ?? 0), 0);
                        return (_jsxs("section", { className: `w-[calc(100vw-3rem)] rounded-2xl border bg-slate-100/70 p-3 transition sm:w-[310px] ${dragOverStageId === stage.id ? 'border-brand-purple bg-purple-50 ring-4 ring-purple-100' : 'border-slate-200/80'}`, onDragOver: (event) => {
                                if (canEdit) {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                    setDragOverStageId(stage.id);
                                }
                            }, onDragLeave: (event) => {
                                if (!event.currentTarget.contains(event.relatedTarget))
                                    setDragOverStageId(null);
                            }, onDrop: (event) => onDrop(event, stage), children: [_jsxs("header", { className: "mb-3 px-1 pb-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "h-3 w-3 rounded-full shadow-sm", style: { backgroundColor: stage.color } }), _jsx("h2", { className: "text-sm font-bold text-slate-800", children: stage.name }), _jsx("span", { className: "rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm", children: columnLeads.length })] }), _jsx("button", { className: "icon-button !h-7 !w-7", onClick: () => navigate('/leads/novo'), title: "Adicionar", children: _jsx(Icon, { name: "plus", className: "h-4 w-4" }) })] }), _jsx("p", { className: "mt-2 text-xs font-semibold text-slate-400", children: money(columnValue) })] }), _jsxs("div", { className: "flex min-h-[120px] flex-col gap-3", children: [columnLeads.map((lead) => (_jsxs("article", { draggable: canEdit && !isMoving, onDragStart: (event) => {
                                                setDraggedId(lead.id);
                                                event.dataTransfer.setData('text/lead-id', lead.id);
                                                event.dataTransfer.effectAllowed = 'move';
                                            }, onDragEnd: () => {
                                                setDraggedId(null);
                                                setDragOverStageId(null);
                                            }, onClick: () => openLeadAfterClick(lead.id), onDoubleClick: (event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                if (cardClickTimerRef.current) {
                                                    window.clearTimeout(cardClickTimerRef.current);
                                                    cardClickTimerRef.current = null;
                                                }
                                                void markAsMandatory(lead);
                                            }, title: canEdit && !isMandatoryPriority(lead)
                                                ? 'Duplo clique para marcar como prioridade Mandatória'
                                                : undefined, className: `group cursor-pointer rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isMandatoryPriority(lead)
                                                ? 'border-rose-200 bg-rose-50 shadow-rose-200/30 hover:border-rose-300 hover:bg-rose-100/70'
                                                : 'border-amber-200/80 bg-amber-50 shadow-amber-200/30 hover:border-amber-300 hover:bg-amber-100/70'} ${draggedId === lead.id ? 'opacity-40' : ''}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h3", { className: "line-clamp-2 text-sm font-bold leading-5 text-slate-800 group-hover:text-brand-purple", children: lead.name }), _jsx("p", { className: "mt-1 line-clamp-1 text-xs text-slate-400", children: [lead.businessCode, lead.companyName || 'Empresa não informada']
                                                                        .filter(Boolean)
                                                                        .join(' · ') })] }), lead.priority && (_jsx("span", { className: "mt-1 h-2.5 w-2.5 shrink-0 rounded-full", style: { backgroundColor: lead.priority.color }, title: lead.priority.name }))] }), _jsx("div", { className: `my-3 h-px ${isMandatoryPriority(lead) ? 'bg-rose-200/70' : 'bg-amber-200/60'}` }), _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-semibold text-slate-700", children: formatDate(lead.stageEnteredAt || lead.createdAt) }), lead.estimatedValue !== null && (_jsx("p", { className: "mt-0.5 text-[10px] text-slate-400", children: money(lead.estimatedValue) }))] }), _jsx("span", { className: "text-[10px] font-semibold text-slate-400", children: lead.projectTypes.length
                                                                ? lead.projectTypes
                                                                    .map(({ projectType }) => projectType.name)
                                                                    .join(', ')
                                                                : 'Sem categoria' })] }), _jsxs("div", { className: "mt-3 flex items-end justify-between gap-3", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-0", children: [lead.assignees.slice(0, 4).map(({ user: responsible }, index) => responsible.avatarUrl ? (_jsx("img", { src: avatarUrl(responsible.id, responsible.avatarUrl), alt: responsible.name, title: responsible.name, className: `h-7 w-7 rounded-full border-2 border-white object-cover ${index ? '-ml-1.5' : ''}` }, responsible.id)) : (_jsx("span", { title: responsible.name, className: `flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-blue/10 text-[9px] font-bold text-brand-blue ${index ? '-ml-1.5' : ''}`, children: responsible.name
                                                                        .split(' ')
                                                                        .slice(0, 2)
                                                                        .map((part) => part[0])
                                                                        .join('')
                                                                        .toUpperCase() }, responsible.id))), _jsx("span", { className: "ml-1.5 max-w-[105px] truncate text-[11px] font-medium text-slate-500", children: lead.assignees.map((assignment) => assignment.user.name).join(', ') })] }), _jsxs("p", { className: "max-w-[115px] text-right text-[10px] leading-4 text-slate-400", children: [_jsx("span", { className: "block text-[9px] font-bold uppercase tracking-wide text-slate-300", children: "Origem" }), lead.source?.name ?? 'Não informada', lead.partner ? ` · Comercial: ${lead.partner.name}` : ''] })] })] }, lead.id))), columnLeads.length === 0 && (_jsx("div", { className: "flex min-h-[110px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/50 px-5 text-center text-xs leading-5 text-slate-400", children: "Arraste uma oportunidade para esta etapa" }))] })] }, stage.id));
                    }) }) })), _jsx(FixedHorizontalScrollbar, { targetRef: kanbanScrollRef }), pendingMove && (_jsx("div", { className: "mobile-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm", children: _jsxs("form", { onSubmit: (event) => {
                        event.preventDefault();
                        if (actionDescription.trim() &&
                            (!pendingMove.stage.isLostStage || lossReason.trim())) {
                            void persistMove(pendingMove.lead, pendingMove.stage);
                        }
                    }, className: "mobile-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl", children: [_jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-brand-purple", children: _jsx(Icon, { name: "edit", className: "h-5 w-5" }) }), _jsx("h2", { className: "mt-4 font-heading text-xl font-bold text-slate-900", children: "Registrar movimenta\u00E7\u00E3o" }), _jsxs("p", { className: "mt-2 text-sm leading-6 text-slate-500", children: ["Registre a a\u00E7\u00E3o para mover", ' ', _jsx("strong", { className: "text-slate-700", children: pendingMove.lead.name }), " para", ' ', pendingMove.stage.name, "."] }), _jsx("label", { className: "form-label mt-5", children: "A\u00E7\u00E3o realizada *" }), _jsx("textarea", { autoFocus: true, required: true, className: "form-control", rows: 3, value: actionDescription, onChange: (event) => setActionDescription(event.target.value), placeholder: "Ex.: reuni\u00E3o realizada, proposta apresentada..." }), pendingMove.stage.isLostStage && (_jsxs(_Fragment, { children: [_jsx("label", { className: "form-label mt-4", children: "Motivo da perda *" }), _jsx("textarea", { required: true, className: "form-control", rows: 2, value: lossReason, onChange: (event) => setLossReason(event.target.value) })] })), _jsx("label", { className: "form-label mt-4", children: "Respons\u00E1veis" }), _jsx("div", { className: "grid max-h-36 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2", children: moveUserOptions.map((responsible) => (_jsxs("label", { className: "flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50", children: [_jsx("input", { type: "checkbox", checked: moveOwnerIds.includes(responsible.id), onChange: (event) => setMoveOwnerIds((ids) => event.target.checked
                                            ? [...ids, responsible.id]
                                            : ids.filter((id) => id !== responsible.id)) }), responsible.name] }, responsible.id))) }), _jsxs("label", { className: "mt-4 flex items-center gap-2 text-sm font-semibold", children: [_jsx("input", { type: "checkbox", checked: createTask, onChange: (event) => setCreateTask(event.target.checked) }), "Cadastrar tarefa para esta a\u00E7\u00E3o"] }), createTask && (_jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Prazo *" }), _jsx(DateInput, { required: true, className: "form-control", value: taskDueDate, onValueChange: (value) => setTaskDueDate(value ?? '') })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Prioridade *" }), _jsxs("select", { className: "form-control", value: taskPriority, onChange: (event) => setTaskPriority(event.target.value), children: [_jsx("option", { value: "LOW", children: "Baixa" }), _jsx("option", { value: "MEDIUM", children: "M\u00E9dia" }), _jsx("option", { value: "HIGH", children: "Alta" }), _jsx("option", { value: "URGENT", children: "Urgente" })] })] })] })), _jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: () => setPendingMove(null), children: "Cancelar" }), _jsx("button", { type: "submit", disabled: isMoving ||
                                        !actionDescription.trim() ||
                                        moveOwnerIds.length === 0 ||
                                        (pendingMove.stage.isLostStage && !lossReason.trim()), className: "btn-primary", children: "Confirmar movimenta\u00E7\u00E3o" })] })] }) }))] }));
}
