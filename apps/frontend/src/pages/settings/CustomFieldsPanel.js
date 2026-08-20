import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { customFieldsApi } from '../../lib/settingsApi';
import { Icon } from '../../components/Icon';
import { CUSTOM_FIELD_TYPE_LABELS, } from '../../types/settings';
const inputClass = 'form-control';
const EMPTY_DRAFT = {
    name: '',
    type: 'TEXT',
    options: [],
    isRequired: false,
    showInForm: true,
    showInKanbanCard: false,
    showInFilters: false,
};
const SELECT_TYPES = ['SINGLE_SELECT', 'MULTI_SELECT'];
export function CustomFieldsPanel() {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const [optionsText, setOptionsText] = useState('');
    async function refresh() {
        setIsLoading(true);
        try {
            setItems(await customFieldsApi.list());
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
        setDraft(EMPTY_DRAFT);
        setOptionsText('');
        setEditingId('new');
    }
    function startEdit(item) {
        setDraft({
            name: item.name,
            type: item.type,
            options: item.options,
            isRequired: item.isRequired,
            showInForm: item.showInForm,
            showInKanbanCard: item.showInKanbanCard,
            showInFilters: item.showInFilters,
        });
        setOptionsText((item.options ?? []).join(', '));
        setEditingId(item.id);
    }
    function cancelEdit() {
        setEditingId(null);
        setDraft(EMPTY_DRAFT);
        setOptionsText('');
    }
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        const payload = {
            name: draft.name,
            type: draft.type,
            isRequired: draft.isRequired,
            showInForm: draft.showInForm,
            showInKanbanCard: draft.showInKanbanCard,
            showInFilters: draft.showInFilters,
            options: SELECT_TYPES.includes(draft.type)
                ? optionsText
                    .split(',')
                    .map((o) => o.trim())
                    .filter(Boolean)
                : undefined,
        };
        try {
            if (editingId === 'new') {
                await customFieldsApi.create(payload);
            }
            else if (editingId) {
                await customFieldsApi.update(editingId, payload);
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
            await customFieldsApi.archive(id);
            await refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao arquivar.');
        }
    }
    const isSelectType = SELECT_TYPES.includes(draft.type);
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-bold text-brand-purple-dark", children: "Campos Customizados" }), _jsx("p", { className: "text-sm text-ink/70", children: "Campos extras exibidos no cadastro de Leads (a partir da Fase 3)." })] }), editingId === null && (_jsxs("button", { onClick: startCreate, className: "btn-primary", children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Novo campo"] }))] }), error && (_jsx("p", { className: "mt-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), editingId !== null && (_jsxs("form", { onSubmit: handleSubmit, className: "mt-5 flex flex-col gap-4 rounded-2xl border border-brand-purple/15 bg-purple-50/30 p-5", children: [_jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "flex-1", children: [_jsx("label", { className: "mb-1 block text-sm font-medium text-ink", children: "Nome" }), _jsx("input", { required: true, className: inputClass, value: draft.name ?? '', onChange: (e) => setDraft({ ...draft, name: e.target.value }) })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-medium text-ink", children: "Tipo" }), _jsx("select", { className: inputClass, value: draft.type, onChange: (e) => setDraft({ ...draft, type: e.target.value }), children: Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value))) })] })] }), isSelectType && (_jsxs("div", { children: [_jsx("label", { className: "mb-1 block text-sm font-medium text-ink", children: "Op\u00E7\u00F5es (separadas por v\u00EDrgula)" }), _jsx("input", { required: true, className: inputClass, placeholder: "Ex.: Varejo, Ind\u00FAstria, Servi\u00E7os", value: optionsText, onChange: (e) => setOptionsText(e.target.value) })] })), _jsxs("div", { className: "flex flex-wrap gap-4 text-sm text-ink", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: draft.isRequired ?? false, onChange: (e) => setDraft({ ...draft, isRequired: e.target.checked }) }), "Obrigat\u00F3rio"] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: draft.showInForm ?? true, onChange: (e) => setDraft({ ...draft, showInForm: e.target.checked }) }), "Exibir no formul\u00E1rio"] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: draft.showInKanbanCard ?? false, onChange: (e) => setDraft({ ...draft, showInKanbanCard: e.target.checked }) }), "Exibir no card do Kanban"] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: draft.showInFilters ?? false, onChange: (e) => setDraft({ ...draft, showInFilters: e.target.checked }) }), "Exibir nos filtros"] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "btn-primary", children: "Salvar" }), _jsx("button", { type: "button", onClick: cancelEdit, className: "btn-secondary", children: "Cancelar" })] })] })), _jsx("div", { className: "mt-5 overflow-x-auto rounded-xl border border-slate-200", children: isLoading ? (_jsx("p", { className: "text-sm text-ink/60", children: "Carregando\u2026" })) : (_jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Nome" }), _jsx("th", { children: "Tipo" }), _jsx("th", { children: "Exibi\u00E7\u00E3o" }), _jsx("th", { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsxs("tbody", { children: [items.map((item) => (_jsxs("tr", { className: "border-b border-surface-muted last:border-0", children: [_jsx("td", { className: "py-2 pr-3 font-medium text-ink", children: item.name }), _jsx("td", { className: "py-2 pr-3 text-ink/70", children: CUSTOM_FIELD_TYPE_LABELS[item.type] }), _jsxs("td", { className: "py-2 pr-3 text-ink/70", children: [item.isRequired && _jsx("span", { className: "mr-2", children: "Obrigat\u00F3rio" }), item.showInKanbanCard && _jsx("span", { className: "mr-2", children: "No Kanban" }), item.showInFilters && _jsx("span", { children: "Nos filtros" })] }), _jsxs("td", { className: "py-2 text-right", children: [_jsx("button", { title: "Editar", onClick: () => startEdit(item), className: "icon-button", children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) }), _jsx("button", { title: "Arquivar", onClick: () => handleArchive(item.id), className: "icon-button hover:!bg-red-50 hover:!text-red-600", children: _jsx(Icon, { name: "archive", className: "h-4 w-4" }) })] })] }, item.id))), items.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "py-4 text-center text-sm text-ink/50", children: "Nenhum campo customizado cadastrado ainda." }) }))] })] })) })] }));
}
