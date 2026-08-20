import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { partnersApi } from '../../lib/partnersApi';
import { formatPhone } from '../../lib/formatters';
import { useAuthStore } from '../../store/useAuthStore';
import { PARTNER_STATUS_LABELS, PARTNER_TYPE_LABELS, } from '../../types/partners';
export default function PartnersListPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const canCreate = user?.permissions.includes('partners.create') ?? false;
    const canEdit = user?.permissions.includes('partners.edit') ?? false;
    const canDelete = user?.permissions.includes('partners.delete') ?? false;
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ page: 1, pageSize: 20 });
    const [sort, setSort] = useState({
        key: 'name',
        direction: 'asc',
    });
    useEffect(() => {
        setLoading(true);
        partnersApi
            .list(filters)
            .then((response) => {
            setItems(response.items);
            setTotal(response.total);
        })
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar parceiros.'))
            .finally(() => setLoading(false));
    }, [filters]);
    const sorted = useMemo(() => [...items].sort((a, b) => {
        const values = {
            name: [a.name, b.name],
            type: [PARTNER_TYPE_LABELS[a.type], PARTNER_TYPE_LABELS[b.type]],
            contactName: [a.contactName ?? '', b.contactName ?? ''],
            leads: [a._count.leads, b._count.leads],
            status: [a.status, b.status],
        }[sort.key];
        const result = typeof values[0] === 'number'
            ? values[0] - values[1]
            : String(values[0]).localeCompare(String(values[1]), 'pt-BR');
        return sort.direction === 'asc' ? result : -result;
    }), [items, sort]);
    function update(patch) {
        setFilters((current) => ({ ...current, ...patch, page: 1 }));
    }
    function toggle(key) {
        setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    }
    async function remove(partner) {
        const confirmation = window.prompt(`A exclusão é definitiva. As oportunidades vinculadas serão preservadas, mas ficarão sem este parceiro. Para confirmar, digite o nome do parceiro:\n\n${partner.name}`);
        if (confirmation !== partner.name) {
            if (confirmation !== null)
                window.alert('O nome informado não corresponde ao parceiro.');
            return;
        }
        try {
            await partnersApi.remove(partner.id);
            setItems((current) => current.filter((item) => item.id !== partner.id));
            setTotal((current) => Math.max(0, current - 1));
        }
        catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : 'Erro ao excluir parceiro.');
        }
    }
    const Header = ({ field, children }) => (_jsxs("button", { onClick: () => toggle(field), className: "inline-flex items-center gap-1.5 hover:text-brand-purple", children: [children, _jsx(Icon, { name: "sort", className: `h-3.5 w-3.5 ${sort.key === field ? 'text-brand-purple' : 'text-slate-300'}` })] }));
    return (_jsxs(AppShell, { children: [_jsx(PageHeader, { eyebrow: "Relacionamentos", title: "Parceiros", description: `${total} parceiro${total === 1 ? '' : 's'} cadastrado${total === 1 ? '' : 's'} na rede comercial.`, actions: canCreate && (_jsxs("button", { className: "btn-primary", onClick: () => navigate('/partners/novo'), children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Novo parceiro"] })) }), _jsx("div", { className: "filter-panel", children: _jsxs("div", { className: "grid gap-3 md:grid-cols-[1fr_220px_180px]", children: [_jsxs("div", { className: "relative", children: [_jsx(Icon, { name: "search", className: "absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" }), _jsx("input", { className: "form-control pl-10", placeholder: "Buscar por nome, documento ou contato...", value: filters.search ?? '', onChange: (e) => update({ search: e.target.value || undefined }) })] }), _jsxs("select", { className: "form-control", value: filters.type ?? '', onChange: (e) => update({ type: (e.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Todos os tipos" }), Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value)))] }), _jsxs("select", { className: "form-control", value: filters.status ?? '', onChange: (e) => update({ status: (e.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Todos os status" }), _jsx("option", { value: "ACTIVE", children: "Ativos" }), _jsx("option", { value: "INACTIVE", children: "Inativos" })] })] }) }), error && (_jsx("p", { className: "mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600", children: error })), _jsx("div", { className: "table-shell overflow-x-auto", children: loading ? (_jsx("p", { className: "p-12 text-center text-sm text-slate-400", children: "Carregando parceiros\u2026" })) : (_jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: _jsx(Header, { field: "name", children: "Parceiro" }) }), _jsx("th", { children: _jsx(Header, { field: "type", children: "Tipo" }) }), _jsx("th", { children: _jsx(Header, { field: "contactName", children: "Contato" }) }), _jsx("th", { children: _jsx(Header, { field: "leads", children: "Oportunidades" }) }), _jsx("th", { children: "Comiss\u00E3o" }), _jsx("th", { children: _jsx(Header, { field: "status", children: "Status" }) }), _jsx("th", { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsxs("tbody", { children: [sorted.map((partner) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("button", { onClick: () => navigate(`/partners/${partner.id}`), className: "text-left", children: [_jsx("p", { className: "font-semibold text-slate-800 hover:text-brand-purple", children: partner.name }), _jsx("p", { className: "mt-0.5 text-xs text-slate-400", children: partner.document || partner.legalName || 'Documento não informado' })] }) }), _jsx("td", { children: _jsx("span", { className: "rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-purple", children: PARTNER_TYPE_LABELS[partner.type] }) }), _jsxs("td", { children: [_jsx("p", { className: "font-medium text-slate-700", children: partner.contactName || '—' }), _jsx("p", { className: "text-xs text-slate-400", children: partner.email || formatPhone(partner.phone) })] }), _jsx("td", { children: _jsx("button", { className: "rounded-lg px-2 py-1 font-bold text-brand-blue hover:bg-blue-50 hover:underline", title: `Listar oportunidades de ${partner.name}`, onClick: () => navigate(`/leads?partnerId=${partner.id}`), children: partner._count.leads }) }), _jsx("td", { children: partner.commissionPercentage !== null
                                                ? `${Number(partner.commissionPercentage).toLocaleString('pt-BR')}%`
                                                : '—' }), _jsx("td", { children: _jsxs("span", { className: `inline-flex items-center gap-2 text-xs font-semibold ${partner.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`, children: [_jsx("span", { className: `status-dot ${partner.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}` }), PARTNER_STATUS_LABELS[partner.status]] }) }), _jsx("td", { children: _jsxs("div", { className: "flex justify-end gap-1", children: [_jsx("button", { className: "icon-button", title: "Visualizar", onClick: () => navigate(`/partners/${partner.id}`), children: _jsx(Icon, { name: "view", className: "h-4 w-4" }) }), canEdit && (_jsx("button", { className: "icon-button", title: "Editar", onClick: () => navigate(`/partners/${partner.id}/editar`), children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) })), canDelete && (_jsx("button", { className: "icon-button hover:!text-red-600", title: "Excluir definitivamente", onClick: () => remove(partner), children: _jsx(Icon, { name: "trash", className: "h-4 w-4" }) }))] }) })] }, partner.id))), sorted.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "py-14 text-center", children: "Nenhum parceiro encontrado." }) }))] })] })) })] }));
}
