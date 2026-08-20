import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { formatCurrency } from '../../lib/formatters';
import { projectTypesApi, servicesApi } from '../../lib/settingsApi';
import { SERVICE_UNIT_LABELS } from './ServicesPanel';
const emptyDraft = { name: '', description: '', serviceIds: [] };
export function ProductTypesPanel() {
    const [items, setItems] = useState([]);
    const [services, setServices] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(emptyDraft);
    const [error, setError] = useState(null);
    async function refresh() {
        try {
            const [types, catalog] = await Promise.all([projectTypesApi.list(), servicesApi.list()]);
            setItems(types);
            setServices(catalog);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar tipos de produto.');
        }
    }
    useEffect(() => {
        refresh();
    }, []);
    function edit(item) {
        setEditingId(item.id);
        setDraft({
            name: item.name,
            description: item.description ?? '',
            serviceIds: item.services.map(({ service }) => service.id),
        });
    }
    async function submit(event) {
        event.preventDefault();
        setError(null);
        try {
            if (editingId === 'new')
                await projectTypesApi.create(draft);
            else if (editingId)
                await projectTypesApi.update(editingId, draft);
            setEditingId(null);
            setDraft(emptyDraft);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar tipo de produto.');
        }
    }
    async function archive(id) {
        if (!window.confirm('Arquivar este tipo de produto?'))
            return;
        try {
            await projectTypesApi.archive(id);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao arquivar.');
        }
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-bold text-brand-purple-dark", children: "Tipos de Produto" }), _jsx("p", { className: "text-sm text-ink/70", children: "Produtos comercializados e servi\u00E7os embarcados em cada um." })] }), !editingId && (_jsxs("button", { className: "btn-primary", onClick: () => {
                            setEditingId('new');
                            setDraft(emptyDraft);
                        }, children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Novo tipo"] }))] }), error && (_jsx("p", { className: "mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), editingId && (_jsxs("form", { onSubmit: submit, className: "mt-5 grid gap-4 rounded-2xl border border-brand-purple/15 bg-purple-50/30 p-5 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Nome" }), _jsx("input", { required: true, className: "form-control", value: draft.name, onChange: (e) => setDraft({ ...draft, name: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Descri\u00E7\u00E3o" }), _jsx("input", { className: "form-control", value: draft.description, onChange: (e) => setDraft({ ...draft, description: e.target.value }) })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "form-label", children: "Servi\u00E7os embarcados" }), _jsxs("div", { className: "grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2", children: [services.map((service) => (_jsxs("label", { className: "flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2 hover:bg-purple-50", children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: draft.serviceIds.includes(service.id), onChange: (e) => setDraft({
                                                            ...draft,
                                                            serviceIds: e.target.checked
                                                                ? [...draft.serviceIds, service.id]
                                                                : draft.serviceIds.filter((id) => id !== service.id),
                                                        }) }), service.name] }), _jsxs("span", { className: "text-xs text-slate-500", children: [formatCurrency(service.price), "/", SERVICE_UNIT_LABELS[service.billingUnit]] })] }, service.id))), !services.length && (_jsx("p", { className: "text-sm text-slate-500", children: "Cadastre servi\u00E7os antes de montar o produto." }))] })] }), _jsxs("div", { className: "flex gap-2 md:col-span-2", children: [_jsx("button", { className: "btn-primary", children: "Salvar" }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => setEditingId(null), children: "Cancelar" })] })] })), _jsx("div", { className: "mt-5 overflow-x-auto rounded-xl border border-slate-200", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Tipo de produto" }), _jsx("th", { children: "Descri\u00E7\u00E3o" }), _jsx("th", { children: "Servi\u00E7os embarcados" }), _jsx("th", { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsxs("tbody", { children: [items.map((item) => (_jsxs("tr", { children: [_jsx("td", { className: "font-semibold text-slate-800", children: item.name }), _jsx("td", { children: item.description || '—' }), _jsx("td", { children: _jsxs("div", { className: "flex flex-wrap gap-1", children: [item.services.map(({ service }) => (_jsx("span", { className: "rounded-full bg-purple-50 px-2 py-1 text-xs text-brand-purple-dark", children: service.name }, service.id))), !item.services.length && '—'] }) }), _jsxs("td", { className: "text-right", children: [_jsx("button", { className: "icon-button", title: "Editar", onClick: () => edit(item), children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) }), _jsx("button", { className: "icon-button hover:!bg-red-50 hover:!text-red-600", title: "Arquivar", onClick: () => archive(item.id), children: _jsx(Icon, { name: "archive", className: "h-4 w-4" }) })] })] }, item.id))), !items.length && (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "text-center text-sm text-slate-500", children: "Nenhum tipo de produto cadastrado." }) }))] })] }) })] }));
}
