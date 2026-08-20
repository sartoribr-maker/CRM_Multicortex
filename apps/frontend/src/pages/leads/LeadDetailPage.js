import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { leadsApi } from '../../lib/leadsApi';
import { formatCurrency, formatDate, formatPhone } from '../../lib/formatters';
import { avatarUrl } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { LEAD_ACTIVITY_LABELS, LEAD_LINE_LABELS, LEAD_PERIODICITY_LABELS, LEAD_STATUS_LABELS, } from '../../types/leads';
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export default function LeadDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const requestedReturnTo = location.state?.returnTo;
    const returnTo = typeof requestedReturnTo === 'string' &&
        (requestedReturnTo === '/leads/kanban' ||
            requestedReturnTo === '/leads' ||
            requestedReturnTo.startsWith('/leads?'))
        ? requestedReturnTo
        : '/leads';
    const user = useAuthStore((s) => s.user);
    const canEdit = user?.permissions.includes('leads.edit') ?? false;
    const canCreate = user?.permissions.includes('leads.create') ?? false;
    const canDelete = user?.permissions.includes('leads.delete') ?? false;
    const canCreateTask = user?.permissions.includes('tasks.create') ?? false;
    const [lead, setLead] = useState(null);
    const [tab, setTab] = useState('overview');
    const [error, setError] = useState(null);
    function loadLead() {
        if (!id)
            return;
        leadsApi
            .get(id)
            .then(setLead)
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar lead.'));
    }
    useEffect(loadLead, [id]);
    async function handleArchive() {
        if (!id || !window.confirm('Arquivar este lead?'))
            return;
        await leadsApi.archive(id);
        navigate('/leads');
    }
    async function handleDelete() {
        if (!id || !lead)
            return;
        const confirmation = window.prompt(`Esta exclusão é definitiva e também removerá históricos e anexos. Para confirmar, digite o nome da oportunidade:\n\n${lead.name}`);
        if (confirmation !== lead.name) {
            if (confirmation !== null)
                window.alert('O nome informado não corresponde à oportunidade.');
            return;
        }
        await leadsApi.remove(id);
        navigate('/leads');
    }
    if (error) {
        return _jsx("p", { className: "p-8 text-center text-danger", children: error });
    }
    if (!lead) {
        return _jsx("p", { className: "p-8 text-center text-ink/60", children: "Carregando\u2026" });
    }
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto max-w-6xl", children: [_jsx(PageHeader, { eyebrow: "Detalhes da oportunidade", title: lead.name, description: [lead.businessCode, lead.companyName ?? 'Empresa não informada']
                        .filter(Boolean)
                        .join(' · '), actions: _jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => navigate(returnTo), className: "btn-secondary", children: [_jsx(Icon, { name: "arrow-left", className: "h-4 w-4" }), "Voltar"] }), canCreate && (_jsxs("button", { onClick: () => navigate('/leads/novo'), className: "btn-secondary", children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Novo lead"] })), canCreateTask && (_jsxs("button", { onClick: () => navigate(`/tasks/nova?leadId=${lead.id}`), className: "btn-secondary", children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Nova tarefa"] })), canEdit && (_jsxs("button", { onClick: () => navigate(`/leads/${lead.id}/editar`, { state: { returnTo } }), className: "btn-primary", children: [_jsx(Icon, { name: "edit", className: "h-4 w-4" }), "Editar"] })), canDelete && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: handleArchive, className: "btn-secondary", children: [_jsx(Icon, { name: "archive", className: "h-4 w-4" }), "Arquivar"] }), _jsxs("button", { onClick: handleDelete, className: "btn-danger", children: [_jsx(Icon, { name: "trash", className: "h-4 w-4" }), "Excluir"] })] }))] }) }), _jsxs("div", { className: "card flex flex-col justify-between gap-5 overflow-hidden p-5 sm:flex-row sm:items-center", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-11 w-1 rounded-full", style: { backgroundColor: lead.stage.color } }), _jsxs("div", { children: [_jsx("span", { className: "inline-block rounded-full px-3 py-1 text-xs font-semibold text-white", style: { backgroundColor: lead.stage.color }, children: lead.stage.name }), _jsxs("div", { className: "mt-2 flex items-center", children: [lead.assignees.slice(0, 5).map(({ user: responsible }, index) => responsible.avatarUrl ? (_jsx("img", { src: avatarUrl(responsible.id, responsible.avatarUrl), alt: responsible.name, title: responsible.name, className: `h-7 w-7 rounded-full border-2 border-white object-cover ${index ? '-ml-1.5' : ''}` }, responsible.id)) : (_jsx("span", { title: responsible.name, className: `flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-purple-100 text-[9px] font-bold text-brand-purple ${index ? '-ml-1.5' : ''}`, children: responsible.name.slice(0, 2).toUpperCase() }, responsible.id))), _jsx("span", { className: "ml-2 text-xs font-semibold text-slate-600", children: lead.assignees.map((item) => item.user.name).join(', ') })] })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs text-slate-400", children: "Valor estimado" }), _jsx("p", { className: "mt-1 text-xl font-bold text-slate-800", children: formatCurrency(lead.estimatedValue) })] })] }), _jsx("div", { className: "mt-6 flex gap-1 border-b border-slate-200", children: [
                        ['overview', 'Visão Geral'],
                        ['timeline', 'Linha do Tempo'],
                        ['attachments', 'Anexos'],
                    ].map(([key, label]) => (_jsx("button", { onClick: () => setTab(key), className: `rounded-t-card px-4 py-2 text-sm font-medium transition ${tab === key
                            ? 'border-b-2 border-brand-purple text-brand-purple-dark'
                            : 'text-ink/60 hover:text-ink'}`, children: label }, key))) }), _jsxs("div", { className: tab === 'overview' ? 'mt-5' : 'mt-5 card p-5 md:p-7', children: [tab === 'overview' && _jsx(OverviewTab, { lead: lead }), tab === 'timeline' && _jsx(TimelineTab, { leadId: lead.id, canComment: canEdit }), tab === 'attachments' && (_jsx(AttachmentsTab, { leadId: lead.id, canEdit: canEdit, onUploaded: loadLead }))] })] }) }));
}
function OverviewTab({ lead }) {
    const probability = lead.successProbability ?? 0;
    const statusTone = lead.status === 'WON'
        ? 'bg-emerald-50 text-emerald-700'
        : lead.status === 'LOST'
            ? 'bg-red-50 text-red-700'
            : 'bg-blue-50 text-blue-700';
    const Field = ({ label, value, accent, }) => (_jsxs("div", { className: "min-w-0", children: [_jsx("dt", { className: "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400", children: label }), _jsx("dd", { className: `mt-1 truncate text-sm ${accent ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`, children: value === null || value === undefined || value === '' ? 'Não informado' : value })] }));
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsxs("div", { className: "card p-5", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: "Status comercial" }), _jsx("span", { className: `mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusTone}`, children: LEAD_STATUS_LABELS[lead.status] })] }), _jsxs("div", { className: "card p-5", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: "Valor estimado" }), _jsx("p", { className: "mt-2 text-xl font-bold text-slate-900", children: formatCurrency(lead.estimatedValue) }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: LEAD_PERIODICITY_LABELS[lead.periodicity] })] }), _jsxs("div", { className: "card p-5", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: "CAPEX" }), _jsx("p", { className: "mt-2 text-xl font-bold text-slate-900", children: formatCurrency(lead.capexValue) }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Parcela \u00FAnica" })] }), _jsxs("div", { className: "card p-5", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: "OPEX" }), _jsx("p", { className: "mt-2 text-xl font-bold text-slate-900", children: formatCurrency(lead.opexValue) }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Valor mensal" })] }), _jsxs("div", { className: "card p-5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: "Probabilidade" }), _jsx("span", { className: "text-sm font-bold text-brand-purple", children: lead.successProbability === null ? '—' : `${probability}%` })] }), _jsx("div", { className: "mt-4 h-2 overflow-hidden rounded-full bg-slate-100", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-cyan", style: { width: `${probability}%` } }) })] }), _jsxs("div", { className: "card p-5", children: [_jsx("p", { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400", children: "Previs\u00E3o de fechamento" }), _jsx("p", { className: "mt-2 text-base font-bold text-slate-800", children: lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : 'Não definida' }), _jsxs("p", { className: "mt-1 text-xs text-slate-400", children: ["Cadastro em ", formatDate(lead.createdAt)] })] })] }), _jsxs("div", { className: "grid gap-5 lg:grid-cols-5", children: [_jsxs("section", { className: "card overflow-hidden lg:col-span-3", children: [_jsxs("div", { className: "border-b border-slate-100 px-5 py-4", children: [_jsx("h3", { className: "font-heading font-bold text-slate-800", children: "Empresa e classifica\u00E7\u00E3o" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Contexto comercial da oportunidade" })] }), _jsxs("dl", { className: "grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3", children: [_jsx(Field, { label: "ID da oportunidade", value: lead.businessCode, accent: true }), _jsx(Field, { label: "Linha", value: lead.line ? LEAD_LINE_LABELS[lead.line] : null }), _jsx(Field, { label: "Empresa", value: lead.companyName, accent: true }), _jsx(Field, { label: "Documento", value: lead.companyDocument }), _jsx(Field, { label: "Segmento", value: lead.companySegment }), _jsx(Field, { label: "Prioridade", value: lead.priority?.name }), _jsx(Field, { label: "Porte", value: lead.dealSize?.name }), _jsx(Field, { label: "Tipos de produto", value: lead.projectTypes.map(({ projectType }) => projectType.name).join(', ') }), _jsx(Field, { label: "Origem", value: lead.source?.name }), _jsx(Field, { label: "Parceiro comercial", value: lead.partner?.name }), _jsx(Field, { label: "Parceiro t\u00E9cnico", value: lead.technicalPartner?.name }), _jsx(Field, { label: "Valor do servi\u00E7o t\u00E9cnico", value: formatCurrency(lead.technicalServiceValue) }), _jsx(Field, { label: "Etapa atual", value: lead.stage.name, accent: true })] })] }), _jsxs("section", { className: "card overflow-hidden lg:col-span-2", children: [_jsxs("div", { className: "border-b border-slate-100 px-5 py-4", children: [_jsx("h3", { className: "font-heading font-bold text-slate-800", children: "Contato principal" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Pessoa respons\u00E1vel pelo contato comercial" })] }), _jsxs("dl", { className: "grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-1", children: [_jsx(Field, { label: "Nome", value: lead.contactName, accent: true }), _jsx(Field, { label: "E-mail", value: lead.contactEmail }), _jsx(Field, { label: "Telefone", value: formatPhone(lead.contactPhone) })] })] })] }), _jsxs("section", { className: "card overflow-hidden", children: [_jsx("div", { className: "border-b border-slate-100 px-5 py-4", children: _jsx("h3", { className: "font-heading font-bold text-slate-800", children: "Respons\u00E1veis pela oportunidade" }) }), _jsx("div", { className: "flex flex-wrap gap-3 p-5", children: lead.assignees.map(({ user: responsible }) => (_jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5", children: [responsible.avatarUrl ? (_jsx("img", { src: avatarUrl(responsible.id, responsible.avatarUrl), alt: responsible.name, className: "h-9 w-9 rounded-full object-cover" })) : (_jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-brand-purple", children: responsible.name.slice(0, 2).toUpperCase() })), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-700", children: responsible.name }), _jsx("p", { className: "text-[11px] text-slate-400", children: responsible.email })] })] }, responsible.id))) })] }), (lead.description || lead.lossReason || lead.customFieldValues.length > 0) && (_jsxs("div", { className: "grid gap-5 lg:grid-cols-2", children: [(lead.description || lead.lossReason) && (_jsxs("section", { className: "card p-5", children: [_jsx("h3", { className: "font-heading font-bold text-slate-800", children: "Observa\u00E7\u00F5es" }), lead.description && (_jsx("p", { className: "mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600", children: lead.description })), lead.lossReason && (_jsxs("div", { className: "mt-4 rounded-xl bg-red-50 p-3", children: [_jsx("p", { className: "text-[10px] font-bold uppercase text-red-500", children: "Motivo da perda" }), _jsx("p", { className: "mt-1 text-sm text-red-700", children: lead.lossReason })] }))] })), lead.customFieldValues.length > 0 && (_jsxs("section", { className: "card p-5", children: [_jsx("h3", { className: "font-heading font-bold text-slate-800", children: "Informa\u00E7\u00F5es personalizadas" }), _jsx("dl", { className: "mt-4 grid gap-4 sm:grid-cols-2", children: lead.customFieldValues.map((entry) => (_jsx(Field, { label: entry.customField.name, value: Array.isArray(entry.value) ? entry.value.join(', ') : String(entry.value) }, entry.id))) })] }))] }))] }));
}
function TimelineTab({ leadId, canComment }) {
    const [activities, setActivities] = useState([]);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    function refresh() {
        leadsApi.listActivities(leadId).then(setActivities);
    }
    useEffect(refresh, [leadId]);
    async function handleSubmit(event) {
        event.preventDefault();
        if (!comment.trim())
            return;
        setIsSubmitting(true);
        try {
            await leadsApi.addComment(leadId, comment.trim());
            setComment('');
            refresh();
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (_jsxs("div", { children: [canComment && (_jsxs("form", { onSubmit: handleSubmit, className: "mb-6 flex gap-2", children: [_jsx("input", { className: "flex-1 rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple", placeholder: "Adicionar um coment\u00E1rio\u2026", value: comment, onChange: (e) => setComment(e.target.value) }), _jsx("button", { type: "submit", disabled: isSubmitting, className: "rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-60", children: "Comentar" })] })), _jsxs("ul", { className: "flex flex-col gap-3", children: [activities.map((activity) => (_jsxs("li", { className: "rounded-card border border-surface-muted p-3 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium text-brand-purple-dark", children: LEAD_ACTIVITY_LABELS[activity.type] }), _jsx("span", { className: "text-xs text-ink/50", children: formatDate(activity.createdAt) })] }), _jsx("p", { className: "mt-1 text-ink/80", children: activity.message }), activity.actorUser && (_jsxs("p", { className: "mt-1 text-xs text-ink/50", children: ["por ", activity.actorUser.name] }))] }, activity.id))), activities.length === 0 && _jsx("p", { className: "text-sm text-ink/50", children: "Nenhuma atividade ainda." })] })] }));
}
function AttachmentsTab({ leadId, canEdit, onUploaded, }) {
    const [attachments, setAttachments] = useState([]);
    const [error, setError] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    function refresh() {
        leadsApi.listAttachments(leadId).then(setAttachments);
    }
    useEffect(refresh, [leadId]);
    async function handleFileChange(event) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setError(null);
        setIsUploading(true);
        try {
            await leadsApi.uploadAttachment(leadId, file);
            refresh();
            onUploaded();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao enviar arquivo.');
        }
        finally {
            setIsUploading(false);
            event.target.value = '';
        }
    }
    async function handleRemove(attachmentId) {
        if (!window.confirm('Remover este anexo?'))
            return;
        await leadsApi.removeAttachment(leadId, attachmentId);
        refresh();
    }
    async function handleDownload(attachment) {
        await leadsApi.downloadAttachment(leadId, attachment.id, attachment.fileName);
    }
    return (_jsxs("div", { children: [canEdit && (_jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "inline-block cursor-pointer rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark", children: [isUploading ? 'Enviando…' : '+ Adicionar anexo', _jsx("input", { type: "file", className: "hidden", onChange: handleFileChange, disabled: isUploading })] }), _jsx("p", { className: "mt-1 text-xs text-ink/50", children: "M\u00E1ximo 15MB. Imagens, PDF, Office, texto ou zip." })] })), error && (_jsx("p", { className: "mb-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), _jsxs("ul", { className: "flex flex-col gap-2", children: [attachments.map((attachment) => (_jsxs("li", { className: "flex items-center justify-between rounded-card border border-surface-muted p-3 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-ink", children: attachment.fileName }), _jsxs("p", { className: "text-xs text-ink/50", children: [formatBytes(attachment.sizeBytes), " \u00B7 ", formatDate(attachment.createdAt)] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => handleDownload(attachment), className: "text-sm text-brand-blue hover:text-brand-blue-dark", children: "Baixar" }), canEdit && (_jsx("button", { onClick: () => handleRemove(attachment.id), className: "text-sm text-danger hover:text-danger/80", children: "Remover" }))] })] }, attachment.id))), attachments.length === 0 && _jsx("p", { className: "text-sm text-ink/50", children: "Nenhum anexo ainda." })] })] }));
}
