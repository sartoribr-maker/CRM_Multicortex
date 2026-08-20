import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { brazilianDateToIso, formatDate, isoToBrazilianDate } from '../../lib/formatters';
import { tasksApi } from '../../lib/tasksApi';
import { useAuthStore } from '../../store/useAuthStore';
import { usersApi } from '../../lib/usersApi';
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, } from '../../types/tasks';
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function TaskDetailPage() {
    const { id } = useParams();
    const nav = useNavigate();
    const user = useAuthStore((s) => s.user);
    const canCreate = user?.permissions.includes('tasks.create') ?? false;
    const canEdit = user?.permissions.includes('tasks.edit') ?? false;
    const canDelete = user?.permissions.includes('tasks.delete') ?? false;
    const isAdministrator = user?.role.name.trim().toLocaleLowerCase('pt-BR') === 'administrador';
    const [task, setTask] = useState(null);
    const [error, setError] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [history, setHistory] = useState([]);
    const [users, setUsers] = useState([]);
    useEffect(() => {
        if (id)
            tasksApi
                .get(id)
                .then(setTask)
                .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar tarefa.'));
    }, [id]);
    useEffect(() => {
        if (id) {
            tasksApi.listAttachments(id).then(setAttachments).catch(() => undefined);
            tasksApi.history(id).then(setHistory).catch(() => undefined);
        }
        if (isAdministrator)
            usersApi.list().then(setUsers).catch(() => undefined);
    }, [id, isAdministrator]);
    async function upload(event) {
        if (!id)
            return;
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (!files.length)
            return;
        const oversized = files.find((file) => file.size > 15 * 1024 * 1024);
        if (oversized) {
            setError(`O arquivo ${oversized.name} excede o limite de 15 MB.`);
            return;
        }
        setUploading(true);
        setError(null);
        try {
            const uploaded = await Promise.all(files.map((file) => tasksApi.uploadAttachment(id, file)));
            setAttachments((current) => [...uploaded, ...current]);
        }
        catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Erro ao enviar anexo.');
        }
        finally {
            setUploading(false);
        }
    }
    async function removeAttachment(attachment) {
        if (!id || !window.confirm(`Remover o anexo ${attachment.fileName}?`))
            return;
        await tasksApi.removeAttachment(id, attachment.id);
        setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    }
    async function viewAttachment(attachment) {
        if (!id)
            return;
        try {
            await tasksApi.viewAttachment(id, attachment.id);
        }
        catch (viewError) {
            setError(viewError instanceof Error ? viewError.message : 'Erro ao visualizar anexo.');
        }
    }
    async function extendDeadline() {
        if (!task)
            return;
        const nextDate = new Date(task.dueDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const dueDate = window.prompt('Informe o novo prazo (DD/MM/AAAA):', isoToBrazilianDate(nextDate.toISOString()));
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
            setTask(updated);
            setHistory(await tasksApi.history(task.id));
        }
        catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Erro ao prorrogar prazo.');
        }
    }
    async function transfer() {
        if (!task)
            return;
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
            const updated = await tasksApi.transfer(task.id, newAssignee.id, reason.trim());
            setTask(updated);
            setHistory(await tasksApi.history(task.id));
        }
        catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Erro ao transferir tarefa.');
        }
    }
    async function complete() {
        if (task)
            setTask(await tasksApi.complete(task.id));
    }
    async function archive() {
        if (task && window.confirm('Arquivar esta tarefa?')) {
            await tasksApi.archive(task.id);
            nav('/tasks');
        }
    }
    async function remove() {
        if (!task)
            return;
        const confirmation = window.prompt(`Esta exclusão é definitiva. Para confirmar, digite o título da tarefa:\n\n${task.title}`);
        if (confirmation !== task.title) {
            if (confirmation !== null)
                window.alert('O título informado não corresponde à tarefa.');
            return;
        }
        await tasksApi.remove(task.id);
        nav('/tasks');
    }
    if (error)
        return (_jsx(AppShell, { children: _jsx("p", { className: "bg-red-50 p-4 text-red-600", children: error }) }));
    if (!task)
        return _jsx("div", { className: "flex min-h-screen items-center justify-center", children: "Carregando\u2026" });
    const late = !['DONE', 'CANCELED'].includes(task.status) && new Date(task.dueDate) < new Date();
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto max-w-5xl", children: [_jsx(PageHeader, { eyebrow: "Detalhes da tarefa", title: task.title, description: `Criada por ${task.createdByUser.name}`, actions: _jsxs(_Fragment, { children: [_jsxs("button", { className: "btn-secondary", onClick: () => nav('/tasks'), children: [_jsx(Icon, { name: "arrow-left", className: "h-4 w-4" }), "Voltar"] }), canCreate && (_jsxs("button", { className: "btn-secondary", onClick: () => nav('/tasks/nova'), children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Nova tarefa"] })), canEdit && (_jsxs("button", { className: "btn-primary", onClick: () => nav(`/tasks/${task.id}/editar`), children: [_jsx(Icon, { name: "edit", className: "h-4 w-4" }), "Editar"] })), canDelete && (_jsxs(_Fragment, { children: [_jsxs("button", { className: "btn-secondary", onClick: archive, children: [_jsx(Icon, { name: "archive", className: "h-4 w-4" }), "Arquivar"] }), _jsxs("button", { className: "btn-danger", onClick: remove, children: [_jsx(Icon, { name: "trash", className: "h-4 w-4" }), "Excluir"] })] }))] }) }), _jsxs("div", { className: "grid gap-5 lg:grid-cols-[1fr_300px]", children: [_jsxs("section", { className: "card p-6", children: [_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("span", { className: `rounded-lg px-3 py-1 text-xs font-bold ${TASK_PRIORITY_COLORS[task.priority]}`, children: TASK_PRIORITY_LABELS[task.priority] }), _jsx("span", { className: "rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600", children: TASK_STATUS_LABELS[task.status] }), late && (_jsx("span", { className: "rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-600", children: "Atrasada" }))] }), task.description ? (_jsx("p", { className: "mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600", children: task.description })) : (_jsx("p", { className: "mt-6 text-sm text-slate-400", children: "Sem descri\u00E7\u00E3o." })), _jsxs("dl", { className: "mt-8 grid gap-6 border-t border-slate-100 pt-6 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-xs text-slate-400", children: "Prazo" }), _jsx("dd", { className: `mt-1 font-semibold ${late ? 'text-red-600' : 'text-slate-700'}`, children: formatDate(task.dueDate) })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-slate-400", children: "Respons\u00E1veis" }), _jsx("dd", { className: "mt-1 font-semibold text-slate-700", children: task.assignees.map(({ user }) => user.name).join(', ') })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-slate-400", children: "Oportunidade" }), _jsx("dd", { className: "mt-1", children: task.lead ? (_jsx("button", { className: "font-semibold text-brand-blue hover:underline", onClick: () => nav(`/leads/${task.lead.id}`), children: task.lead.name })) : ('—') })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-xs text-slate-400", children: "Conclu\u00EDda em" }), _jsx("dd", { className: "mt-1 font-semibold text-slate-700", children: formatDate(task.completedAt) })] })] })] }), _jsxs("aside", { className: "card h-fit p-5", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: "Pr\u00F3xima a\u00E7\u00E3o" }), task.status !== 'DONE' && canEdit ? (_jsxs(_Fragment, { children: [_jsxs("button", { className: "btn-primary mt-4 w-full", onClick: complete, children: [_jsx(Icon, { name: "view", className: "h-4 w-4" }), "Marcar como conclu\u00EDda"] }), _jsx("button", { className: "btn-secondary mt-3 w-full", onClick: extendDeadline, children: "Prorrogar prazo" }), isAdministrator && (_jsx("button", { className: "btn-secondary mt-3 w-full", onClick: transfer, children: "Transferir tarefa" }))] })) : (_jsx("div", { className: "mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-600", children: "Tarefa conclu\u00EDda" })), task.lead && (_jsx("button", { className: "btn-secondary mt-3 w-full", onClick: () => nav(`/leads/${task.lead.id}`), children: "Abrir oportunidade" }))] })] }), _jsxs("section", { className: "card mt-5 overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 px-5 py-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Anexos" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Documentos e arquivos relacionados \u00E0 tarefa" })] }), canEdit && (_jsxs("label", { className: "btn-secondary cursor-pointer", children: [_jsx(Icon, { name: "upload", className: "h-4 w-4" }), uploading ? 'Enviando…' : 'Adicionar arquivos', _jsx("input", { type: "file", multiple: true, className: "hidden", accept: ".doc,.docx,.xls,.xlsx,.pdf,image/*,.txt,.zip", disabled: uploading, onChange: upload })] }))] }), attachments.length ? (_jsx("ul", { className: "divide-y divide-slate-100", children: attachments.map((attachment) => (_jsxs("li", { className: "flex items-center justify-between gap-3 px-5 py-4", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx(Icon, { name: "file", className: "h-5 w-5 shrink-0 text-brand-purple" }), _jsxs("div", { className: "min-w-0", children: [_jsx("button", { className: "block max-w-full truncate text-left text-sm font-semibold text-brand-blue hover:underline", title: "Clique para visualizar", onClick: () => viewAttachment(attachment), children: attachment.fileName }), _jsx("p", { className: "text-xs text-slate-400", children: formatBytes(attachment.sizeBytes) })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "btn-secondary", onClick: () => viewAttachment(attachment), children: "Visualizar" }), _jsx("button", { className: "btn-secondary", onClick: () => tasksApi.downloadAttachment(task.id, attachment.id, attachment.fileName), children: "Baixar" }), canEdit && (_jsx("button", { className: "btn-danger", onClick: () => removeAttachment(attachment), children: "Remover" }))] })] }, attachment.id))) })) : (_jsx("p", { className: "p-8 text-center text-sm text-slate-400", children: "Nenhum arquivo anexado." }))] }), _jsxs("section", { className: "card mt-5 overflow-hidden", children: [_jsx("div", { className: "border-b border-slate-100 px-5 py-4", children: _jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Hist\u00F3rico de prorroga\u00E7\u00F5es e transfer\u00EAncias" }) }), history.length ? (_jsx("ul", { className: "divide-y divide-slate-100", children: history.map((entry) => (_jsxs("li", { className: "px-5 py-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-bold text-slate-700", children: entry.type === 'DEADLINE_EXTENDED' ? 'Prazo prorrogado' : 'Tarefa transferida' }), _jsxs("p", { className: "text-xs text-slate-400", children: [formatDate(entry.createdAt), " \u00B7 ", entry.actorUser.name] })] }), _jsx("p", { className: "mt-2 text-sm text-slate-600", children: entry.type === 'DEADLINE_EXTENDED'
                                            ? `${formatDate(entry.metadata.previousDueDate)} → ${formatDate(entry.metadata.newDueDate)}`
                                            : `${entry.metadata.previousAssignees?.map((item) => item.name).join(', ')} → ${entry.metadata.newAssignee?.name}` }), _jsxs("p", { className: "mt-1 text-sm text-slate-500", children: ["Justificativa: ", entry.reason] })] }, entry.id))) })) : (_jsx("p", { className: "p-8 text-center text-sm text-slate-400", children: "Nenhuma prorroga\u00E7\u00E3o ou transfer\u00EAncia registrada." }))] })] }) }));
}
