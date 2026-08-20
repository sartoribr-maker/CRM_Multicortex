import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
const inputClass = 'form-control';
export function SimpleCatalogPanel({ title, description, itemNoun, api, emptyDraft, renderExtraFormFields, }) {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(emptyDraft);
    function editablePayload(source) {
        return Object.keys(emptyDraft).reduce((payload, key) => {
            const typedKey = key;
            payload[typedKey] = source[typedKey];
            return payload;
        }, {});
    }
    async function refresh() {
        setIsLoading(true);
        try {
            setItems(await api.list());
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
        }
        finally {
            setIsLoading(false);
        }
    }
    useEffect(() => {
        refresh();
    }, []);
    function startCreate() {
        setDraft(emptyDraft);
        setEditingId('new');
    }
    function startEdit(item) {
        setDraft(editablePayload(item));
        setEditingId(item.id);
    }
    function cancelEdit() {
        setEditingId(null);
        setDraft(emptyDraft);
    }
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        try {
            if (editingId === 'new') {
                await api.create(editablePayload(draft));
            }
            else if (editingId) {
                await api.update(editingId, editablePayload(draft));
            }
            cancelEdit();
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar.');
        }
    }
    async function handleArchive(id) {
        setError(null);
        try {
            await api.archive(id);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao arquivar.');
        }
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-bold text-brand-purple-dark", children: title }), _jsx("p", { className: "text-sm text-ink/70", children: description })] }), editingId === null && (_jsxs("button", { onClick: startCreate, className: "btn-primary", children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Nova ", itemNoun] }))] }), error && (_jsx("p", { className: "mt-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), editingId !== null && (_jsxs("form", { onSubmit: handleSubmit, className: "mt-5 flex flex-col gap-4 rounded-2xl border border-brand-purple/15 bg-purple-50/30 p-5", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-medium text-ink", children: "Nome" }), _jsx("input", { required: true, className: inputClass, value: draft.name ?? '', onChange: (e) => setDraft({ ...draft, name: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-medium text-ink", children: "Descri\u00E7\u00E3o" }), _jsx("input", { className: inputClass, value: draft.description ?? '', onChange: (e) => setDraft({ ...draft, description: e.target.value }) })] }), renderExtraFormFields?.(draft, (patch) => setDraft({ ...draft, ...patch })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "btn-primary", children: "Salvar" }), _jsx("button", { type: "button", onClick: cancelEdit, className: "btn-secondary", children: "Cancelar" })] })] })), _jsx("div", { className: "mt-5 overflow-x-auto rounded-xl border border-slate-200", children: isLoading ? (_jsx("p", { className: "text-sm text-ink/60", children: "Carregando\u2026" })) : (_jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Nome" }), _jsx("th", { children: "Descri\u00E7\u00E3o" }), _jsx("th", { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsxs("tbody", { children: [items.map((item) => (_jsxs("tr", { className: "border-b border-surface-muted last:border-0", children: [_jsx("td", { className: "py-2 pr-3 font-medium text-ink", children: item.name }), _jsx("td", { className: "py-2 pr-3 text-ink/70", children: item.description }), _jsxs("td", { className: "py-2 text-right", children: [_jsx("button", { title: "Editar", onClick: () => startEdit(item), className: "icon-button", children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) }), _jsx("button", { title: "Arquivar", onClick: () => handleArchive(item.id), className: "icon-button hover:!bg-red-50 hover:!text-red-600", children: _jsx(Icon, { name: "archive", className: "h-4 w-4" }) })] })] }, item.id))), items.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 3, className: "py-4 text-center text-sm text-ink/50", children: "Nenhum item cadastrado ainda." }) }))] })] })) })] }));
}
