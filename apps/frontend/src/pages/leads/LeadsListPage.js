import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { FixedHorizontalScrollbar } from '../../components/FixedHorizontalScrollbar';
import { Icon } from '../../components/Icon';
import { leadsApi } from '../../lib/leadsApi';
import { formatCurrency, formatPhone } from '../../lib/formatters';
import { partnersApi } from '../../lib/partnersApi';
import { stagesApi, prioritiesApi, dealSizesApi, sourcesApi, projectTypesApi, } from '../../lib/settingsApi';
import { avatarUrl, usersApi } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { LEAD_LINE_LABELS } from '../../types/leads';
function daysSince(value) {
    return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}
function isMandatoryPriority(lead) {
    return (lead.priority?.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() === 'mandatoria');
}
export default function LeadsListPage() {
    const user = useAuthStore((s) => s.user);
    const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
    const canCreate = user?.permissions.includes('leads.create') ?? false;
    const canEdit = user?.permissions.includes('leads.edit') ?? false;
    const canDelete = user?.permissions.includes('leads.delete') ?? false;
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const tableScrollRef = useRef(null);
    const leadClickTimerRef = useRef(null);
    const [leads, setLeads] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        page: 1,
        pageSize: 20,
        stageId: searchParams.get('stageId') || undefined,
        priorityId: searchParams.get('priorityId') || undefined,
        partnerId: searchParams.get('partnerId') || undefined,
        technicalPartnerId: searchParams.get('technicalPartnerId') || undefined,
    });
    const [showFilters, setShowFilters] = useState(true);
    const [sort, setSort] = useState({
        key: 'name',
        direction: 'asc',
    });
    const [stages, setStages] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [dealSizes, setDealSizes] = useState([]);
    const [sources, setSources] = useState([]);
    const [projectTypes, setProjectTypes] = useState([]);
    const [users, setUsers] = useState([]);
    const [partners, setPartners] = useState([]);
    useEffect(() => {
        Promise.all([
            stagesApi.list(),
            prioritiesApi.list(),
            dealSizesApi.list(),
            sourcesApi.list(),
            projectTypesApi.list(),
            canViewAll ? usersApi.list() : Promise.resolve([]),
            partnersApi.options(),
        ]).then(([a, b, c, d, e, f, g]) => {
            setStages(a);
            setPriorities(b);
            setDealSizes(c);
            setSources(d);
            setProjectTypes(e);
            setUsers(f);
            setPartners(g);
        });
    }, [canViewAll]);
    useEffect(() => {
        setIsLoading(true);
        setError(null);
        leadsApi
            .list(filters)
            .then((res) => {
            setLeads(res.items);
            setTotal(res.total);
        })
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar leads.'))
            .finally(() => setIsLoading(false));
    }, [filters]);
    function updateFilter(patch) {
        setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
    }
    function toggleSort(key) {
        setSort((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    }
    async function removeLead(lead) {
        const confirmation = window.prompt(`Exclusão definitiva. Digite o nome da oportunidade para confirmar:\n\n${lead.name}`);
        if (confirmation !== lead.name) {
            if (confirmation !== null)
                window.alert('O nome informado não corresponde à oportunidade.');
            return;
        }
        try {
            await leadsApi.remove(lead.id);
            setLeads((items) => items.filter((item) => item.id !== lead.id));
            setTotal((value) => Math.max(0, value - 1));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível excluir a oportunidade.');
        }
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
    function openLeadAfterClick(leadId) {
        if (leadClickTimerRef.current)
            window.clearTimeout(leadClickTimerRef.current);
        leadClickTimerRef.current = window.setTimeout(() => navigate(`/leads/${leadId}`, {
            state: { returnTo: `${location.pathname}${location.search}` },
        }), 250);
    }
    const sortedLeads = useMemo(() => [...leads].sort((a, b) => {
        const values = {
            name: [a.name, b.name],
            stage: [a.stage.name, b.stage.name],
            priority: [a.priority?.name ?? '', b.priority?.name ?? ''],
            estimatedValue: [Number(a.estimatedValue ?? 0), Number(b.estimatedValue ?? 0)],
            owner: [
                a.assignees.map((item) => item.user.name).join(','),
                b.assignees.map((item) => item.user.name).join(','),
            ],
            partner: [a.partner?.name ?? '', b.partner?.name ?? ''],
            technicalPartner: [a.technicalPartner?.name ?? '', b.technicalPartner?.name ?? ''],
            dealSize: [a.dealSize?.name ?? '', b.dealSize?.name ?? ''],
            successProbability: [a.successProbability ?? -1, b.successProbability ?? -1],
            stageEnteredAt: [a.stageEnteredAt, b.stageEnteredAt],
            contactName: [a.contactName ?? '', b.contactName ?? ''],
            contactPhone: [a.contactPhone ?? '', b.contactPhone ?? ''],
        };
        const [av, bv] = values[sort.key];
        const result = typeof av === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), 'pt-BR');
        return sort.direction === 'asc' ? result : -result;
    }), [leads, sort]);
    const activeFilters = Object.entries(filters).filter(([key, value]) => !['page', 'pageSize'].includes(key) && value).length;
    const SortHeader = ({ label, field }) => (_jsxs("button", { onClick: () => toggleSort(field), className: "inline-flex items-center gap-1.5 hover:text-brand-purple", children: [label, _jsx(Icon, { name: "sort", className: `h-3.5 w-3.5 ${sort.key === field ? 'text-brand-purple' : 'text-slate-300'}` })] }));
    return (_jsxs(AppShell, { children: [_jsx(PageHeader, { eyebrow: "Comercial", title: "Leads e oportunidades", description: `${total} registro${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'} no funil comercial.`, actions: _jsxs(_Fragment, { children: [_jsxs("button", { className: "btn-secondary", onClick: () => navigate('/leads/kanban'), children: [_jsx(Icon, { name: "dashboard", className: "h-4 w-4" }), "Ver Kanban"] }), canCreate && (_jsxs("button", { className: "btn-primary", onClick: () => navigate('/leads/novo'), children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Novo lead"] }))] }) }), _jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("button", { onClick: () => setShowFilters(!showFilters), className: "btn-secondary", children: [_jsx(Icon, { name: "filter", className: "h-4 w-4" }), "Filtros", ' ', activeFilters > 0 && (_jsx("span", { className: "rounded-full bg-brand-purple px-2 py-0.5 text-[10px] text-white", children: activeFilters }))] }), activeFilters > 0 && (_jsx("button", { className: "text-xs font-semibold text-brand-purple hover:underline", onClick: () => setFilters({ page: 1, pageSize: 20 }), children: "Limpar filtros" }))] }), showFilters && (_jsx("div", { className: "filter-panel", children: _jsxs("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: [_jsxs("label", { className: "relative sm:col-span-2", children: [_jsx(Icon, { name: "search", className: "absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" }), _jsx("input", { className: "form-control pl-10", placeholder: "Buscar por lead, empresa ou contato...", value: filters.search ?? '', onChange: (e) => updateFilter({ search: e.target.value || undefined }) })] }), _jsxs("select", { className: "form-control", value: filters.line ?? '', onChange: (e) => updateFilter({ line: (e.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Todas as linhas" }), Object.entries(LEAD_LINE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value)))] }), [
                            [stages, 'stageId', 'Todas as etapas'],
                            [priorities, 'priorityId', 'Todas as prioridades'],
                            [dealSizes, 'dealSizeId', 'Todos os portes'],
                            [sources, 'sourceId', 'Todas as origens'],
                            [projectTypes, 'projectTypeId', 'Todos os projetos'],
                        ].map(([items, key, placeholder]) => (_jsxs("select", { className: "form-control", value: filters[key] ?? '', onChange: (e) => updateFilter({ [key]: e.target.value || undefined }), children: [_jsx("option", { value: "", children: String(placeholder) }), items.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }, String(key)))), _jsxs("select", { className: "form-control", value: filters.partnerId ?? '', onChange: (e) => updateFilter({ partnerId: e.target.value || undefined }), children: [_jsx("option", { value: "", children: "Todos os parceiros comerciais" }), partners.map((partner) => (_jsx("option", { value: partner.id, children: partner.name }, partner.id)))] }), _jsxs("select", { className: "form-control", value: filters.technicalPartnerId ?? '', onChange: (e) => updateFilter({ technicalPartnerId: e.target.value || undefined }), children: [_jsx("option", { value: "", children: "Todos os parceiros t\u00E9cnicos" }), partners.map((partner) => (_jsx("option", { value: partner.id, children: partner.name }, partner.id)))] }), canViewAll && (_jsxs("select", { className: "form-control", value: filters.ownerId ?? '', onChange: (e) => updateFilter({ ownerId: e.target.value || undefined }), children: [_jsx("option", { value: "", children: "Todos os respons\u00E1veis" }), users.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }))] }) })), error && (_jsx("div", { className: "mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600", children: error })), _jsx("div", { ref: tableScrollRef, className: "table-shell overflow-x-auto", children: isLoading ? (_jsx("div", { className: "p-12 text-center text-sm text-slate-400", children: "Carregando oportunidades\u2026" })) : (_jsxs("table", { className: "data-table min-w-[3060px]", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "min-w-[220px]", children: _jsx(SortHeader, { label: "Etapa", field: "stage" }) }), _jsx("th", { className: "min-w-[420px]", children: _jsx(SortHeader, { label: "Oportunidade", field: "name" }) }), _jsx("th", { className: "min-w-[140px]", children: _jsx(SortHeader, { label: "Prioridade", field: "priority" }) }), _jsx("th", { className: "min-w-[300px]", children: _jsx(SortHeader, { label: "Respons\u00E1vel", field: "owner" }) }), _jsx("th", { className: "min-w-[280px]", children: _jsx(SortHeader, { label: "Parceiro comercial", field: "partner" }) }), _jsx("th", { className: "min-w-[280px]", children: _jsx(SortHeader, { label: "Parceiro t\u00E9cnico", field: "technicalPartner" }) }), _jsx("th", { className: "min-w-[180px]", children: _jsx(SortHeader, { label: "Porte neg\u00F3cio", field: "dealSize" }) }), _jsx("th", { className: "min-w-[260px]", children: _jsx(SortHeader, { label: "Probabilidade de sucesso (%)", field: "successProbability" }) }), _jsx("th", { className: "min-w-[190px]", children: _jsx(SortHeader, { label: "Valor estimado", field: "estimatedValue" }) }), _jsx("th", { className: "min-w-[180px]", children: _jsx(SortHeader, { label: "Tempo na etapa", field: "stageEnteredAt" }) }), _jsx("th", { className: "min-w-[240px]", children: _jsx(SortHeader, { label: "Contato", field: "contactName" }) }), _jsx("th", { className: "min-w-[200px]", children: _jsx(SortHeader, { label: "Telefone contato", field: "contactPhone" }) }), _jsx("th", { className: "min-w-[120px] text-right", children: "A\u00E7\u00F5es" })] }) }), _jsxs("tbody", { children: [sortedLeads.map((lead) => (_jsxs("tr", { className: isMandatoryPriority(lead) ? 'mandatory-lead-row' : '', onDoubleClick: (event) => {
                                        if (event.target.closest('button'))
                                            return;
                                        void markAsMandatory(lead);
                                    }, title: canEdit && !isMandatoryPriority(lead)
                                        ? 'Duplo clique para marcar como prioridade Mandatória'
                                        : undefined, children: [_jsx("td", { className: "whitespace-nowrap", children: _jsxs("span", { className: "inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700", children: [_jsx("span", { className: "status-dot", style: { backgroundColor: lead.stage.color } }), lead.stage.name] }) }), _jsx("td", { children: _jsxs("button", { onClick: () => openLeadAfterClick(lead.id), onDoubleClick: (event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    if (leadClickTimerRef.current) {
                                                        window.clearTimeout(leadClickTimerRef.current);
                                                        leadClickTimerRef.current = null;
                                                    }
                                                    void markAsMandatory(lead);
                                                }, className: "text-left", children: [_jsx("p", { className: "font-semibold text-slate-800 hover:text-brand-purple", children: lead.name }), _jsx("p", { className: "mt-0.5 text-xs text-slate-400", children: [lead.businessCode, lead.companyName || 'Sem empresa informada']
                                                            .filter(Boolean)
                                                            .join(' · ') })] }) }), _jsx("td", { className: "whitespace-nowrap", children: lead.priority ? (_jsxs("span", { className: "inline-flex items-center gap-2 text-xs font-medium", children: [_jsx("span", { className: "status-dot", style: { backgroundColor: lead.priority.color } }), lead.priority.name] })) : ('—') }), _jsx("td", { children: _jsxs("div", { className: "flex items-center", children: [lead.assignees.slice(0, 4).map(({ user: responsible }, index) => responsible.avatarUrl ? (_jsx("img", { src: avatarUrl(responsible.id, responsible.avatarUrl), alt: responsible.name, title: responsible.name, className: `h-8 w-8 rounded-full border-2 border-white object-cover ${index ? '-ml-1.5' : ''}` }, responsible.id)) : (_jsx("span", { title: responsible.name, className: `flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-blue/10 text-[9px] font-bold text-brand-blue ${index ? '-ml-1.5' : ''}`, children: responsible.name.slice(0, 2).toUpperCase() }, responsible.id))), _jsx("span", { className: "ml-2 max-w-48 truncate", children: lead.assignees.map((item) => item.user.name).join(', ') })] }) }), _jsx("td", { children: lead.partner?.name ?? '—' }), _jsx("td", { children: lead.technicalPartner?.name ?? '—' }), _jsx("td", { className: "whitespace-nowrap", children: lead.dealSize?.name ?? '—' }), _jsx("td", { className: "whitespace-nowrap font-semibold text-slate-700", children: lead.successProbability === null ? '—' : `${lead.successProbability}%` }), _jsx("td", { className: "whitespace-nowrap font-semibold text-slate-700", children: formatCurrency(lead.estimatedValue) }), _jsxs("td", { className: "whitespace-nowrap", children: [daysSince(lead.stageEnteredAt), " dias"] }), _jsx("td", { children: lead.contactName ?? '—' }), _jsx("td", { className: "whitespace-nowrap", children: formatPhone(lead.contactPhone) }), _jsx("td", { children: _jsxs("div", { className: "flex justify-end gap-1", children: [_jsx("button", { className: "icon-button", title: "Visualizar", onClick: () => navigate(`/leads/${lead.id}`, {
                                                            state: { returnTo: `${location.pathname}${location.search}` },
                                                        }), children: _jsx(Icon, { name: "view", className: "h-4 w-4" }) }), canEdit && (_jsx("button", { className: "icon-button", title: "Editar", onClick: () => navigate(`/leads/${lead.id}/editar`), children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) })), canDelete && (_jsx("button", { className: "icon-button hover:!text-red-600", title: "Excluir definitivamente", onClick: () => void removeLead(lead), children: _jsx(Icon, { name: "trash", className: "h-4 w-4" }) }))] }) })] }, lead.id))), sortedLeads.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 13, children: _jsxs("div", { className: "py-10 text-center", children: [_jsx(Icon, { name: "search", className: "mx-auto h-8 w-8 text-slate-300" }), _jsx("p", { className: "mt-2 font-medium text-slate-600", children: "Nenhum lead encontrado" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Tente ajustar os filtros da pesquisa." })] }) }) }))] })] })) }), _jsx(FixedHorizontalScrollbar, { targetRef: tableScrollRef }), total > 20 && (_jsxs("div", { className: "mt-4 flex items-center justify-between text-sm text-slate-500", children: [_jsxs("span", { children: ["P\u00E1gina ", filters.page ?? 1] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { className: "btn-secondary !h-9 !px-3", disabled: (filters.page ?? 1) <= 1, onClick: () => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 })), children: [_jsx(Icon, { name: "chevron-left", className: "h-4 w-4" }), "Anterior"] }), _jsxs("button", { className: "btn-secondary !h-9 !px-3", disabled: (filters.page ?? 1) * 20 >= total, onClick: () => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 })), children: ["Pr\u00F3xima", _jsx(Icon, { name: "chevron-right", className: "h-4 w-4" })] })] })] }))] }));
}
