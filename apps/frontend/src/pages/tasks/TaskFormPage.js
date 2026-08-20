import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { DateInput } from '../../components/MaskedInputs';
import { leadsApi } from '../../lib/leadsApi';
import { tasksApi } from '../../lib/tasksApi';
import { usersApi } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, } from '../../types/tasks';
function localDate(value) {
    const offset = value.getTimezoneOffset() * 60000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}
export default function TaskFormPage() {
    const { id } = useParams();
    const editing = Boolean(id);
    const [params] = useSearchParams();
    const nav = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isAdministrator = user?.role.name.trim().toLocaleLowerCase('pt-BR') === 'administrador';
    const [form, setForm] = useState({
        title: '',
        dueDate: localDate(new Date(Date.now() + 86400000)),
        priority: 'MEDIUM',
        status: 'TODO',
        leadId: params.get('leadId') ?? undefined,
    });
    const [users, setUsers] = useState([]);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(editing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [files, setFiles] = useState([]);
    useEffect(() => {
        leadsApi.list({ pageSize: 100 }).then((r) => setLeads(r.items));
        if (isAdministrator)
            usersApi.list().then(setUsers);
    }, [isAdministrator]);
    useEffect(() => {
        if (!id)
            return;
        tasksApi
            .get(id)
            .then((t) => setForm({
            title: t.title,
            description: t.description ?? undefined,
            status: t.status,
            priority: t.priority,
            dueDate: localDate(new Date(t.dueDate)),
            leadId: t.lead?.id,
            assigneeIds: t.assignees.map(({ user: assignee }) => assignee.id),
        }))
            .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
            .finally(() => setLoading(false));
    }, [id]);
    function field(k, v) {
        setForm((c) => ({ ...c, [k]: v }));
    }
    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const payload = { ...form, dueDate: new Date(`${form.dueDate}T12:00:00`).toISOString() };
            const r = editing ? await tasksApi.update(id, payload) : await tasksApi.create(payload);
            await Promise.all(files.map((file) => tasksApi.uploadAttachment(r.id, file)));
            nav(`/tasks/${r.id}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar tarefa.');
        }
        finally {
            setSaving(false);
        }
    }
    function selectFiles(event) {
        const selected = Array.from(event.target.files ?? []);
        const oversized = selected.find((file) => file.size > 15 * 1024 * 1024);
        if (oversized) {
            setError(`O arquivo ${oversized.name} excede o limite de 15 MB.`);
            event.target.value = '';
            return;
        }
        setFiles((current) => [...current, ...selected]);
        event.target.value = '';
    }
    if (loading)
        return _jsx("div", { className: "flex min-h-screen items-center justify-center", children: "Carregando\u2026" });
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto max-w-4xl", children: [_jsx(PageHeader, { eyebrow: "Agenda comercial", title: editing ? 'Editar tarefa' : 'Nova tarefa', description: "Organize o pr\u00F3ximo passo, respons\u00E1vel e prazo da atividade.", actions: _jsxs("button", { className: "btn-secondary", onClick: () => nav('/tasks'), children: [_jsx(Icon, { name: "x", className: "h-4 w-4" }), "Cancelar"] }) }), _jsxs("form", { onSubmit: submit, className: "space-y-5", children: [_jsxs("section", { className: "form-section", children: [_jsx("div", { className: "form-section-header", children: _jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Informa\u00E7\u00F5es da tarefa" }) }), _jsxs("div", { className: "form-section-body", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "form-label", children: "T\u00EDtulo *" }), _jsx("input", { required: true, className: "form-control", value: form.title, onChange: (e) => field('title', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Prazo *" }), _jsx(DateInput, { required: true, className: "form-control", value: form.dueDate, onValueChange: (value) => field('dueDate', value ?? '') })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Prioridade" }), _jsx("select", { className: "form-control", value: form.priority, onChange: (e) => field('priority', e.target.value), children: Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (_jsx("option", { value: v, children: l }, v))) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Status" }), _jsx("select", { className: "form-control", value: form.status, onChange: (e) => field('status', e.target.value), children: Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (_jsx("option", { value: v, children: l }, v))) })] }), isAdministrator && (_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Respons\u00E1veis *" }), _jsx("div", { className: "grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2", children: users.map((responsible) => {
                                                        const checked = form.assigneeIds?.includes(responsible.id) ?? false;
                                                        return (_jsxs("label", { className: "flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (event) => field('assigneeIds', event.target.checked
                                                                        ? [...(form.assigneeIds ?? []), responsible.id]
                                                                        : (form.assigneeIds ?? []).filter((id) => id !== responsible.id)) }), _jsx("span", { children: responsible.name })] }, responsible.id));
                                                    }) })] })), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "form-label", children: "Oportunidade relacionada" }), _jsxs("select", { className: "form-control", value: form.leadId ?? '', onChange: (e) => field('leadId', e.target.value || undefined), children: [_jsx("option", { value: "", children: "Sem oportunidade vinculada" }), leads.map((l) => (_jsxs("option", { value: l.id, children: [l.name, l.companyName ? ` · ${l.companyName}` : ''] }, l.id)))] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "form-label", children: "Descri\u00E7\u00E3o" }), _jsx("textarea", { className: "form-control", rows: 5, value: form.description ?? '', onChange: (e) => field('description', e.target.value || undefined) })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "form-label", children: "Anexos" }), _jsxs("label", { className: "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-purple/40 bg-purple-50/40 px-4 py-5 text-sm font-semibold text-brand-purple hover:bg-purple-50", children: [_jsx(Icon, { name: "upload", className: "h-4 w-4" }), "Selecionar arquivos", _jsx("input", { type: "file", multiple: true, className: "hidden", accept: ".doc,.docx,.xls,.xlsx,.pdf,image/*,.txt,.zip", onChange: selectFiles })] }), _jsx("p", { className: "mt-2 text-xs text-slate-400", children: "DOC, DOCX, PDF, XLS, XLSX, imagens, TXT ou ZIP \u2014 at\u00E9 15 MB por arquivo." }), files.length > 0 && (_jsx("ul", { className: "mt-3 space-y-2", children: files.map((file, index) => (_jsxs("li", { className: "flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm", children: [_jsx("span", { className: "truncate", children: file.name }), _jsx("button", { type: "button", className: "ml-3 text-red-500 hover:text-red-700", onClick: () => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)), children: "Remover" })] }, `${file.name}-${index}`))) }))] })] })] }), error && _jsx("p", { className: "rounded-xl bg-red-50 p-3 text-sm text-red-600", children: error }), _jsxs("div", { className: "sticky bottom-4 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: () => nav('/tasks'), children: "Cancelar" }), _jsxs("button", { disabled: saving, className: "btn-primary", children: [_jsx(Icon, { name: "view", className: "h-4 w-4" }), saving ? 'Salvando…' : 'Salvar tarefa'] })] })] })] }) }));
}
