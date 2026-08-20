import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { partnersApi } from '../../lib/partnersApi';
import { formatCurrency, formatPhone } from '../../lib/formatters';
import { useAuthStore } from '../../store/useAuthStore';
import { PARTNER_STATUS_LABELS, PARTNER_TYPE_LABELS, } from '../../types/partners';
export default function PartnerDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const canEdit = user?.permissions.includes('partners.edit') ?? false;
    const canDelete = user?.permissions.includes('partners.delete') ?? false;
    const [partner, setPartner] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (id)
            partnersApi
                .get(id)
                .then(setPartner)
                .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar parceiro.'));
    }, [id]);
    async function toggleStatus() {
        if (!partner ||
            !window.confirm(`${partner.status === 'ACTIVE' ? 'Inativar' : 'Reativar'} este parceiro?`))
            return;
        const updated = partner.status === 'ACTIVE'
            ? await partnersApi.deactivate(partner.id)
            : await partnersApi.reactivate(partner.id);
        setPartner({ ...partner, ...updated });
    }
    async function remove() {
        if (!partner)
            return;
        const confirmation = window.prompt(`A exclusão é definitiva. As oportunidades vinculadas serão preservadas, mas ficarão sem este parceiro. Para confirmar, digite o nome do parceiro:\n\n${partner.name}`);
        if (confirmation !== partner.name) {
            if (confirmation !== null)
                window.alert('O nome informado não corresponde ao parceiro.');
            return;
        }
        try {
            await partnersApi.remove(partner.id);
            navigate('/partners');
        }
        catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : 'Erro ao excluir parceiro.');
        }
    }
    if (error)
        return (_jsx(AppShell, { children: _jsx("p", { className: "rounded-xl bg-red-50 p-4 text-red-600", children: error }) }));
    if (!partner)
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center text-sm text-slate-400", children: "Carregando\u2026" }));
    const Info = ({ label, value }) => (_jsxs("div", { children: [_jsx("dt", { className: "text-xs font-medium text-slate-400", children: label }), _jsx("dd", { className: "mt-1 text-sm font-semibold text-slate-700", children: value || '—' })] }));
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto max-w-6xl", children: [_jsx(PageHeader, { eyebrow: "Rede de parceiros", title: partner.name, description: partner.legalName ?? PARTNER_TYPE_LABELS[partner.type], actions: _jsxs(_Fragment, { children: [_jsxs("button", { className: "btn-secondary", onClick: () => navigate('/partners'), children: [_jsx(Icon, { name: "arrow-left", className: "h-4 w-4" }), "Voltar"] }), canEdit && (_jsxs("button", { className: "btn-primary", onClick: () => navigate(`/partners/${partner.id}/editar`), children: [_jsx(Icon, { name: "edit", className: "h-4 w-4" }), "Editar"] })), canDelete && (_jsxs(_Fragment, { children: [_jsxs("button", { className: "btn-secondary", onClick: toggleStatus, children: [_jsx(Icon, { name: "archive", className: "h-4 w-4" }), partner.status === 'ACTIVE' ? 'Inativar' : 'Reativar'] }), _jsxs("button", { className: "btn-danger", onClick: remove, children: [_jsx(Icon, { name: "trash", className: "h-4 w-4" }), "Excluir"] })] }))] }) }), _jsxs("div", { className: "grid gap-5 lg:grid-cols-[1fr_320px]", children: [_jsxs("div", { className: "space-y-5", children: [_jsxs("section", { className: "card p-6", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 pb-4", children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Dados do parceiro" }), _jsxs("span", { className: `inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${partner.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`, children: [_jsx("span", { className: `status-dot ${partner.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}` }), PARTNER_STATUS_LABELS[partner.status]] })] }), _jsxs("dl", { className: "mt-5 grid gap-6 sm:grid-cols-2", children: [_jsx(Info, { label: "Tipo", value: PARTNER_TYPE_LABELS[partner.type] }), _jsx(Info, { label: "Documento", value: partner.document }), _jsx(Info, { label: "Contato", value: partner.contactName }), _jsx(Info, { label: "E-mail", value: partner.email }), _jsx(Info, { label: "Telefone", value: formatPhone(partner.phone) }), _jsx(Info, { label: "Website", value: partner.website }), _jsx(Info, { label: "Comiss\u00E3o padr\u00E3o", value: partner.commissionPercentage === null
                                                        ? null
                                                        : `${Number(partner.commissionPercentage).toLocaleString('pt-BR')}%` })] }), partner.notes && (_jsxs("div", { className: "mt-6 rounded-xl bg-slate-50 p-4", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: "Observa\u00E7\u00F5es" }), _jsx("p", { className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600", children: partner.notes })] }))] }), _jsxs("section", { className: "card overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-slate-100 p-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Oportunidades indicadas" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Leads vinculados a este parceiro." })] }), _jsx("span", { className: "rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-brand-purple", children: partner._count.leads })] }), partner.leads.length ? (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Oportunidade" }), _jsx("th", { children: "Etapa" }), _jsx("th", { children: "Respons\u00E1vel" }), _jsx("th", { className: "text-right", children: "Valor" })] }) }), _jsx("tbody", { children: partner.leads.map((lead) => (_jsxs("tr", { className: "cursor-pointer", onClick: () => navigate(`/leads/${lead.id}`), children: [_jsx("td", { className: "font-semibold text-slate-800", children: lead.name }), _jsx("td", { children: _jsxs("span", { className: "inline-flex items-center gap-2 text-xs", children: [_jsx("span", { className: "status-dot", style: { backgroundColor: lead.stage.color } }), lead.stage.name] }) }), _jsx("td", { children: lead.owner.name }), _jsx("td", { className: "text-right font-semibold", children: formatCurrency(lead.estimatedValue) })] }, lead.id))) })] }) })) : (_jsx("p", { className: "p-10 text-center text-sm text-slate-400", children: "Nenhuma oportunidade vinculada." }))] })] }), _jsxs("aside", { className: "card h-fit p-5", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-slate-400", children: "Resumo da parceria" }), _jsxs("div", { className: "mt-5 rounded-2xl bg-gradient-to-br from-brand-purple-dark to-brand-purple p-5 text-white", children: [_jsx("p", { className: "text-sm text-white/60", children: "Oportunidades vinculadas" }), _jsx("p", { className: "mt-2 text-4xl font-bold", children: partner._count.leads })] }), _jsxs("button", { className: "btn-secondary mt-4 w-full", onClick: () => navigate(`/leads/novo`), children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), "Nova oportunidade"] })] })] })] }) }));
}
