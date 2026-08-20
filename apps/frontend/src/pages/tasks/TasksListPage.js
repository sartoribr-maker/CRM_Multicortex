import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { tasksApi } from '../../lib/tasksApi';
import { brazilianDateToIso, formatDate, isoToBrazilianDate } from '../../lib/formatters';
import { usersApi } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, } from '../../types/tasks';
function deadlineState(dueDate) {
    const deadline = new Date(dueDate);
    const today = new Date();
    deadline.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (deadline < today)
        return 'overdue';
    if (deadline.getTime() === today.getTime())
        return 'today';
    return 'upcoming';
}
const DEADLINE_TEXT_COLORS = {
    overdue: 'text-red-600',
    today: 'text-amber-500',
    upcoming: 'text-emerald-600',
};
export default function TasksListPage() {
    const nav = useNavigate();
    const [searchParams] = useSearchParams();
    const user = useAuthStore((s) => s.user);
    const isAdministrator = user?.role.name.trim().toLocaleLowerCase('pt-BR') === 'administrador';
    const canCreate = user?.permissions.includes('tasks.create') ?? false;
    const canEdit = user?.permissions.includes('tasks.edit') ?? false;
    const canDelete = user?.permissions.includes('tasks.delete') ?? false;
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        page: 1,
        pageSize: 20,
        mine: true,
        overdue: searchParams.get('overdue') === 'true' || undefined,
    });
    const [sort, setSort] = useState({
        key: 'dueDate',
        dir: 'asc',
    });
    useEffect(() => {
        if (isAdministrator)
            usersApi.list().then(setUsers);
    }, [isAdministrator]);
    useEffect(() => {
        setLoading(true);
        tasksApi
            .list(filters)
            .then((r) => {
            setItems(r.items);
            setTotal(r.total);
        })
            .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar tarefas.'))
            .finally(() => setLoading(false));
    }, [filters]);
    const sorted = useMemo(() => [...items].sort((a, b) => {
        const v = {
            title: [a.title, b.title],
            dueDate: [a.dueDate, b.dueDate],
            priority: [a.priority, b.priority],
            status: [a.status, b.status],
            assignee: [
                a.assignees.map(({ user }) => user.name).join(', '),
                b.assignees.map(({ user }) => user.name).join(', '),
            ],
        }[sort.key];
        const r = String(v[0]).localeCompare(String(v[1]), 'pt-BR');
        return sort.dir === 'asc' ? r : -r;
    }), [items, sort]);
    function upd(p) {
        setFilters((c) => ({ ...c, ...p, page: 1 }));
    }
    function toggle(key) {
        setSort((c) => ({ key, dir: c.key === key && c.dir === 'asc' ? 'desc' : 'asc' }));
    }
    const H = ({ f, c }) => (_jsxs("button", { className: "inline-flex items-center gap-1", onClick: () => toggle(f), children: [c, _jsx(Icon, { name: "sort", className: `h-3.5 w-3.5 ${sort.key === f ? 'text-brand-purple' : 'text-slate-300'}` })] }));
    const overdue = (t) => !['DONE', 'CANCELED'].includes(t.status) && deadlineState(t.dueDate) === 'overdue';
    const assignedDays = (task) => {
        const assignedAt = new Date(task.assigneeAssignedAt);
        const elapsed = Date.now() - assignedAt.getTime();
        return Math.max(0, Math.floor(elapsed / 86400000));
    };
    async function complete(t) {
        try {
            const u = await tasksApi.complete(t.id);
            setItems((c) => c.map((i) => (i.id === t.id ? u : i)));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao concluir.');
        }
    }
    async function extendDeadline(task) {
        const current = new Date(task.dueDate);
        current.setDate(current.getDate() + 1);
        const suggestedDate = isoToBrazilianDate(current.toISOString());
        const dueDate = window.prompt('Informe o novo prazo (DD/MM/AAAA):', suggestedDate);
        if (!dueDate)
            return;
        const isoDate = brazilianDateToIso(dueDate.trim());
        if (!isoDate) {
            setError('Informe uma data válida no formato DD/MM/AAAA.');
            return;
        }
        const reason = window.prompt('Informe a justificativa obrigatória para a prorrogação:');
        if (!reason?.trim())
            return;
        try {
            const updated = await tasksApi.extendDeadline(task.id, new Date(`${isoDate}T12:00:00`).toISOString(), reason.trim());
            setItems((currentItems) => currentItems.map((item) => (item.id === task.id ? updated : item)));
        }
        catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Erro ao prorrogar prazo.');
        }
    }
    async function transfer(task) {
        const options = users.filter((candidate) => !task.assignees.some(({ user: assignee }) => assignee.id === candidate.id));
        if (!options.length) {
            setError('Nenhum outro responsável está disponível para transferência.');
            return;
        }
        const choice = window.prompt(`Escolha o novo responsável pelo número:\n\n${options.map((candidate, index) => `${index + 1}. ${candidate.name}`).join('\n')}`);
        if (!choice)
            return;
        const newAssignee = options[Number(choice) - 1];
        if (!newAssignee) {
            setError('Responsável inválido.');
            return;
        }
        const reason = window.prompt('Informe a justificativa obrigatória para a transferência:');
        if (!reason?.trim())
            return;
        try {
            await tasksApi.transfer(task.id, newAssignee.id, reason.trim());
            setFilters((current) => ({ ...current }));
        }
        catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Erro ao transferir tarefa.');
        }
    }
    async function remove(t) {
        const confirmation = window.prompt(`Exclusão definitiva. Digite o título da tarefa para confirmar:\n\n${t.title}`);
        if (confirmation !== t.title) {
            if (confirmation !== null)
                window.alert('O título informado não corresponde à tarefa.');
            return;
        }
        try {
            await tasksApi.remove(t.id);
            setItems((current) => current.filter((item) => item.id !== t.id));
            setTotal((current) => Math.max(0, current - 1));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao excluir a tarefa.');
        }
    }
    return (_jsxs(AppShell, { children: [_jsx(PageHeader, { eyebrow: "Produtividade", title: "Tarefas", description: `${total} tarefa${total === 1 ? '' : 's'} encontrada${total === 1 ? '' : 's'} na sua agenda.`, actions: canCreate && (_jsxs("button", { className: "btn-primary", onClick: () => nav('/tasks/nova'), children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Nova tarefa"] })) }), _jsx("div", { className: "filter-panel", children: _jsxs("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-6", children: [_jsxs("div", { className: "relative xl:col-span-2", children: [_jsx(Icon, { name: "search", className: "absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" }), _jsx("input", { className: "form-control pl-10", placeholder: "Buscar tarefa ou oportunidade...", value: filters.search ?? '', onChange: (e) => upd({ search: e.target.value || undefined }) })] }), _jsxs("select", { className: "form-control", value: filters.status ?? '', onChange: (e) => upd({ status: (e.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Todos os status" }), Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (_jsx("option", { value: v, children: l }, v)))] }), _jsxs("select", { className: "form-control", value: filters.priority ?? '', onChange: (e) => upd({ priority: (e.target.value || undefined) }), children: [_jsx("option", { value: "", children: "Todas as prioridades" }), Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (_jsx("option", { value: v, children: l }, v)))] }), isAdministrator ? (_jsxs("select", { className: "form-control", value: filters.assigneeId ?? '', onChange: (e) => upd({ assigneeId: e.target.value || undefined, mine: undefined }), children: [_jsx("option", { value: "", children: "Toda a equipe" }), users.map((u) => (_jsx("option", { value: u.id, children: u.name }, u.id)))] })) : (_jsx("button", { className: `btn-secondary ${filters.overdue ? '!border-red-200 !bg-red-50 !text-red-600' : ''}`, onClick: () => upd({ overdue: filters.overdue ? undefined : true }), children: "Somente atrasadas" })), isAdministrator && (_jsxs("label", { className: `flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${filters.mine ? 'border-brand-purple bg-purple-50 text-brand-purple' : 'border-slate-200 bg-white text-slate-600'}`, children: [_jsx("input", { type: "checkbox", checked: filters.mine ?? false, onChange: (event) => upd({ mine: event.target.checked || undefined, assigneeId: undefined }) }), "Minhas tarefas"] }))] }) }), error && _jsx("p", { className: "mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600", children: error }), _jsx("div", { className: "table-shell overflow-x-auto", children: loading ? (_jsx("p", { className: "p-12 text-center text-sm text-slate-400", children: "Carregando tarefas\u2026" })) : (_jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: _jsx(H, { f: "title", c: "Tarefa" }) }), _jsx("th", { children: _jsx(H, { f: "dueDate", c: "Prazo" }) }), _jsx("th", { children: _jsx(H, { f: "priority", c: "Prioridade" }) }), _jsx("th", { children: _jsx(H, { f: "status", c: "Status" }) }), _jsx("th", { children: _jsx(H, { f: "assignee", c: "Respons\u00E1vel" }) }), _jsx("th", { children: "Dias atribu\u00EDda" }), _jsx("th", { children: "Oportunidade" }), _jsx("th", { className: "text-right", children: "A\u00E7\u00F5es" })] }) }), _jsxs("tbody", { children: [sorted.map((t) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("button", { className: "text-left font-semibold text-slate-800 hover:text-brand-purple", onClick: () => nav(`/tasks/${t.id}`), children: t.title }) }), _jsxs("td", { children: [_jsx("span", { className: `font-bold ${DEADLINE_TEXT_COLORS[deadlineState(t.dueDate)]}`, children: formatDate(t.dueDate) }), overdue(t) && (_jsx("p", { className: "text-[10px] font-bold uppercase text-red-500", children: "Atrasada" }))] }), _jsx("td", { children: _jsx("span", { className: `rounded-lg px-2.5 py-1 text-xs font-bold ${TASK_PRIORITY_COLORS[t.priority]}`, children: TASK_PRIORITY_LABELS[t.priority] }) }), _jsx("td", { children: TASK_STATUS_LABELS[t.status] }), _jsx("td", { children: t.assignees.map(({ user }) => user.name).join(', ') }), _jsx("td", { children: _jsxs("span", { className: "whitespace-nowrap font-semibold text-slate-600", children: [assignedDays(t), " ", assignedDays(t) === 1 ? 'dia' : 'dias'] }) }), _jsx("td", { children: t.lead ? (_jsx("button", { className: "text-xs font-semibold text-brand-blue hover:underline", onClick: () => nav(`/leads/${t.lead.id}`), children: t.lead.name })) : ('—') }), _jsx("td", { children: _jsxs("div", { className: "flex justify-end gap-1", children: [canEdit && t.status !== 'DONE' && (_jsx("button", { className: "icon-button hover:!text-emerald-600", title: "Concluir", onClick: () => complete(t), children: _jsx(Icon, { name: "view", className: "h-4 w-4" }) })), canEdit && t.status !== 'DONE' && (_jsx("button", { title: "Prorrogar prazo", className: "icon-button", onClick: () => extendDeadline(t), children: "\u23F1" })), canEdit && isAdministrator && t.status !== 'DONE' && (_jsx("button", { title: "Transferir tarefa", className: "icon-button", onClick: () => transfer(t), children: "\u21C4" })), _jsx("button", { className: "icon-button", title: "Ver", onClick: () => nav(`/tasks/${t.id}`), children: _jsx(Icon, { name: "external", className: "h-4 w-4" }) }), canEdit && (_jsx("button", { className: "icon-button", title: "Editar", onClick: () => nav(`/tasks/${t.id}/editar`), children: _jsx(Icon, { name: "edit", className: "h-4 w-4" }) })), canDelete && (_jsx("button", { className: "icon-button hover:!text-red-600", title: "Excluir definitivamente", onClick: () => void remove(t), children: _jsx(Icon, { name: "trash", className: "h-4 w-4" }) }))] }) })] }, t.id))), !sorted.length && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "py-14 text-center", children: "Nenhuma tarefa encontrada." }) }))] })] })) })] }));
}
