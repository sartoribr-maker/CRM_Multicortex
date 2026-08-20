import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { PhoneInput } from '../../components/MaskedInputs';
import { partnersApi } from '../../lib/partnersApi';
import { PARTNER_TYPE_LABELS } from '../../types/partners';
export default function PartnerFormPage() {
    const { id } = useParams();
    const editing = Boolean(id);
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: '',
        type: 'REFERRAL',
        status: 'ACTIVE',
    });
    const [loading, setLoading] = useState(editing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!id)
            return;
        partnersApi
            .get(id)
            .then((item) => setForm({
            name: item.name,
            legalName: item.legalName ?? undefined,
            type: item.type,
            document: item.document ?? undefined,
            contactName: item.contactName ?? undefined,
            email: item.email ?? undefined,
            phone: item.phone ?? undefined,
            website: item.website ?? undefined,
            commissionPercentage: item.commissionPercentage === null ? undefined : Number(item.commissionPercentage),
            status: item.status,
            notes: item.notes ?? undefined,
        }))
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar parceiro.'))
            .finally(() => setLoading(false));
    }, [id]);
    function field(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }
    async function submit(event) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const result = editing ? await partnersApi.update(id, form) : await partnersApi.create(form);
            navigate(`/partners/${result.id}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar parceiro.');
        }
        finally {
            setSaving(false);
        }
    }
    if (loading)
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-app-bg text-sm text-slate-400", children: "Carregando\u2026" }));
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto max-w-5xl", children: [_jsx(PageHeader, { eyebrow: "Rede de parceiros", title: editing ? 'Editar parceiro' : 'Novo parceiro', description: "Mantenha os dados comerciais, contatos e condi\u00E7\u00F5es da parceria atualizados.", actions: _jsxs("button", { className: "btn-secondary", onClick: () => navigate(editing ? `/partners/${id}` : '/partners'), children: [_jsx(Icon, { name: "x", className: "h-4 w-4" }), "Cancelar"] }) }), _jsxs("form", { onSubmit: submit, className: "flex flex-col gap-5", children: [_jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Identifica\u00E7\u00E3o" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Dados cadastrais e classifica\u00E7\u00E3o do parceiro." })] }), _jsxs("div", { className: "form-section-body", children: [_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Nome fantasia *" }), _jsx("input", { required: true, className: "form-control", value: form.name, onChange: (e) => field('name', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Raz\u00E3o social" }), _jsx("input", { className: "form-control", value: form.legalName ?? '', onChange: (e) => field('legalName', e.target.value || undefined) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Tipo de parceria *" }), _jsx("select", { required: true, className: "form-control", value: form.type, onChange: (e) => field('type', e.target.value), children: Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value))) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "CNPJ/CPF" }), _jsx("input", { className: "form-control", value: form.document ?? '', onChange: (e) => field('document', e.target.value || undefined) })] })] })] }), _jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Contato" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Pessoa e canais principais de relacionamento." })] }), _jsxs("div", { className: "form-section-body", children: [_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Pessoa de contato" }), _jsx("input", { className: "form-control", value: form.contactName ?? '', onChange: (e) => field('contactName', e.target.value || undefined) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "E-mail" }), _jsx("input", { type: "email", className: "form-control", value: form.email ?? '', onChange: (e) => field('email', e.target.value || undefined) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Telefone" }), _jsx(PhoneInput, { className: "form-control", value: form.phone, onValueChange: (value) => field('phone', value || undefined) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Website" }), _jsx("input", { type: "url", placeholder: "https://", className: "form-control", value: form.website ?? '', onChange: (e) => field('website', e.target.value || undefined) })] })] })] }), _jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading font-bold text-slate-800", children: "Condi\u00E7\u00F5es comerciais" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Status, comiss\u00E3o padr\u00E3o e observa\u00E7\u00F5es internas." })] }), _jsxs("div", { className: "form-section-body", children: [_jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Comiss\u00E3o padr\u00E3o (%)" }), _jsx("input", { type: "number", min: "0", max: "100", step: "0.01", className: "form-control", value: form.commissionPercentage ?? '', onChange: (e) => field('commissionPercentage', e.target.value ? Number(e.target.value) : undefined) })] }), _jsxs("div", { children: [_jsx("label", { className: "form-label", children: "Status" }), _jsxs("select", { className: "form-control", value: form.status, onChange: (e) => field('status', e.target.value), children: [_jsx("option", { value: "ACTIVE", children: "Ativo" }), _jsx("option", { value: "INACTIVE", children: "Inativo" })] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "form-label", children: "Observa\u00E7\u00F5es" }), _jsx("textarea", { className: "form-control", rows: 4, value: form.notes ?? '', onChange: (e) => field('notes', e.target.value || undefined) })] })] })] }), error && (_jsx("p", { className: "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600", children: error })), _jsxs("div", { className: "sticky bottom-4 z-20 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: () => navigate('/partners'), children: "Cancelar" }), _jsxs("button", { disabled: saving, className: "btn-primary min-w-32", children: [_jsx(Icon, { name: "view", className: "h-4 w-4" }), saving ? 'Salvando…' : 'Salvar parceiro'] })] })] })] }) }));
}
