import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { CurrencyInput } from '../../components/MaskedInputs';
import { formatCurrency } from '../../lib/formatters';
import { servicesApi } from '../../lib/settingsApi';
export const SERVICE_UNIT_LABELS = {
    MONTH: 'mês',
    HOUR: 'hora',
    ONE_TIME: 'único',
};
const emptyDraft = { name: '', description: '', price: undefined, billingUnit: 'MONTH' };
export function ServicesPanel() {
    const [items, setItems] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(emptyDraft);
    const [error, setError] = useState(null);
    async function refresh() {
        try {
            setItems(await servicesApi.list());
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar serviços.');
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
            price: Number(item.price),
            billingUnit: item.billingUnit,
        });
    }
    async function submit(event) {
        event.preventDefault();
        if (draft.price === undefined)
            return setError('Informe o valor do serviço.');
        setError(null);
        try {
            if (editingId === 'new')
                await servicesApi.create(draft);
            else if (editingId)
                await servicesApi.update(editingId, draft);
            setEditingId(null);
            setDraft(emptyDraft);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar serviço.');
        }
    }
    async function archive(id) {
        if (!window.confirm('Arquivar este serviço? Os tipos de produto existentes manterão o vínculo.'))
            return;
        try {
            await servicesApi.archive(id);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao arquivar serviço.');
        }
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-bold text-brand-purple-dark", children: "Servi\u00E7os" }), _jsx("p", { className: "text-sm text-ink/70", children: "Cat\u00E1logo de servi\u00E7os, pre\u00E7os e unidades de cobran\u00E7a." })] }), !editingId && (_jsxs("button", { className: "btn-primary", onClick: () => {
                            setEditingId('new');
                            setDraft(emptyDraft);
                        }, children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Novo servi\u00E7o"] }))] }), error && (_jsx("p", { className: "mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), editingId && (_jsxs("form", { onSubmit: submit, className: "mt-5 grid gap-4 rounded-2xl border border-brand-purple/15 bg-purple-50/30 p-5 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Nome" }), _jsx("input", { required: true, className: "form-control", value: draft.name, onChange: (e) => setDraft({ ...draft, name: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Descri\u00E7\u00E3o" }), _jsx("input", { className: "form-control", value: draft.description, onChange: (e) => setDraft({ ...draft, description: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Valor" }), _jsx(CurrencyInput, { required: true, className: "form-control", value: draft.price, onValueChange: (price) => setDraft({ ...draft, price }) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Unidade de cobran\u00E7a" }), _jsxs("select", { className: "form-control", value: draft.billingUnit, onChange: (e) => setDraft({ ...draft, billingUnit: e.target.value }), children: [_jsx("option", { value: "MONTH", children: "Por m\u00EAs" }), _jsx("option", { value: "HOUR", children: "Por hora" }), _jsx("option", { value: "ONE_TIME", children: "Valor \u00FAnico" })] })] }), _jsxs("div", { className: "flex gap-2 md:col-span-2", children: [_jsx("button", { className: "btn-primary", children: "Salvar" }), _jsx("button", { type: "button", className: "btn-secondary", onClick: () => setEditingId(null), children: "Cancelar" })] })] })), _jsx("div", { className: "mt-5 overflow-x-auto rounded-xl border border-slate-200", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Servi\u00E7o" }), _jsx("th", { children: "Descri\u00E7\u00E3o" }), _jsx("th", { children: "Valor" }), _jsx("th", { children: "Tipos de produto" }), _jsx("th", { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsxs("tbody", { children: [items.map((item) => (_jsxs("tr", { children: [_jsx("td", { className: "font-semibold text-slate-800", children: item.name }), _jsx("td", { children: item.description || '—' }), _jsxs("td", { className: "whitespace-nowrap", children: [formatCurrency(item.price), "/", SERVICE_UNIT_LABELS[item.billingUnit]] }), _jsx("td", { children: item._count?.projectTypes ?? 0 }), _jsxs("td", { className: "text-right", children: [_jsx("button", { className: "icon-button", title: "Editar", onClick: () => edit(item), children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) }), _jsx("button", { className: "icon-button hover:!bg-red-50 hover:!text-red-600", title: "Arquivar", onClick: () => archive(item.id), children: _jsx(Icon, { name: "archive", className: "h-4 w-4" }) })] })] }, item.id))), !items.length && (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "text-center text-sm text-slate-500", children: "Nenhum servi\u00E7o cadastrado." }) }))] })] }) })] }));
}
