import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { leadsApi } from '../../lib/leadsApi';
import { stagesApi, prioritiesApi, dealSizesApi, sourcesApi, segmentsApi, projectTypesApi, } from '../../lib/settingsApi';
import { usersApi } from '../../lib/usersApi';
import { partnersApi } from '../../lib/partnersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomFieldsFormSection } from '../../components/CustomFieldsFormSection';
import { LeadAutocompleteInput } from '../../components/LeadAutocompleteInput';
import { CurrencyInput, DateInput, PhoneInput } from '../../components/MaskedInputs';
import { LEAD_LINE_LABELS, LEAD_PERIODICITY_LABELS, } from '../../types/leads';
import { formatCurrency } from '../../lib/formatters';
import { SERVICE_UNIT_LABELS } from '../settings/ServicesPanel';
const inputClass = 'form-control';
const labelClass = 'form-label';
const quickCreateConfig = {
    segment: {
        title: 'Novo segmento',
        label: 'Nome do segmento',
        placeholder: 'Ex.: Serviços financeiros',
    },
    commercialPartner: {
        title: 'Novo parceiro comercial',
        label: 'Nome do parceiro comercial',
        placeholder: 'Ex.: Empresa parceira',
        partnerType: 'CHANNEL',
    },
    technicalPartner: {
        title: 'Novo parceiro técnico',
        label: 'Nome do parceiro técnico',
        placeholder: 'Ex.: Integrador de tecnologia',
        partnerType: 'TECHNOLOGY',
    },
};
export default function LeadFormPage() {
    const { id } = useParams();
    const isEditing = Boolean(id);
    const navigate = useNavigate();
    const location = useLocation();
    const navigationState = location.state;
    const user = useAuthStore((s) => s.user);
    const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
    const canCreateSegments = user?.permissions.includes('settings.manage') ?? false;
    const canCreatePartners = user?.permissions.includes('partners.create') ?? false;
    const [stages, setStages] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [dealSizes, setDealSizes] = useState([]);
    const [sources, setSources] = useState([]);
    const [segments, setSegments] = useState([]);
    const [projectTypes, setProjectTypes] = useState([]);
    const [users, setUsers] = useState([]);
    const [partners, setPartners] = useState([]);
    const [form, setForm] = useState({ name: '' });
    const [customFieldValues, setCustomFieldValues] = useState([]);
    const [selectedStage, setSelectedStage] = useState(null);
    const [initialStageId, setInitialStageId] = useState(null);
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditing);
    const [quickCreateKind, setQuickCreateKind] = useState(null);
    const [quickCreateName, setQuickCreateName] = useState('');
    const [isQuickCreating, setIsQuickCreating] = useState(false);
    const [quickCreateError, setQuickCreateError] = useState(null);
    useEffect(() => {
        stagesApi.list().then(setStages);
        prioritiesApi.list().then(setPriorities);
        dealSizesApi.list().then(setDealSizes);
        sourcesApi.list().then(setSources);
        segmentsApi.list().then(setSegments);
        projectTypesApi.list().then(setProjectTypes);
        partnersApi
            .options()
            .then(setPartners)
            .catch(() => setPartners([]));
        if (canViewAll)
            usersApi.list().then(setUsers);
    }, []);
    useEffect(() => {
        if (!id)
            return;
        leadsApi
            .get(id)
            .then((lead) => {
            setForm({
                name: lead.name,
                line: lead.line ?? undefined,
                companyName: lead.companyName ?? undefined,
                companyDocument: lead.companyDocument ?? undefined,
                companySegment: lead.companySegment ?? undefined,
                contactName: lead.contactName ?? undefined,
                contactEmail: lead.contactEmail ?? undefined,
                contactPhone: lead.contactPhone ?? undefined,
                projectTypeIds: lead.projectTypes.map(({ projectType }) => projectType.id),
                stageId: lead.stage.id,
                priorityId: lead.priority?.id,
                dealSizeId: lead.dealSize?.id,
                sourceId: lead.source?.id,
                partnerId: lead.partner?.id,
                technicalPartnerId: lead.technicalPartner?.id,
                technicalServiceValue: lead.technicalServiceValue === null ? undefined : Number(lead.technicalServiceValue),
                successProbability: lead.successProbability ?? undefined,
                capexValue: lead.capexValue === null ? undefined : Number(lead.capexValue),
                opexValue: lead.opexValue === null ? undefined : Number(lead.opexValue),
                periodicity: lead.periodicity,
                expectedCloseDate: lead.expectedCloseDate?.slice(0, 10),
                ownerId: lead.owner.id,
                ownerIds: lead.assignees.map((assignment) => assignment.user.id),
                description: lead.description ?? undefined,
            });
            setInitialStageId(lead.stage.id);
            setCustomFieldValues(lead.customFieldValues.map((v) => ({ customFieldId: v.customFieldId, value: v.value })));
        })
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar lead.'))
            .finally(() => setIsLoading(false));
    }, [id]);
    useEffect(() => {
        const stage = stages.find((s) => s.id === form.stageId) ?? null;
        setSelectedStage(stage);
    }, [form.stageId, stages]);
    function updateField(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }
    function openQuickCreate(kind) {
        setQuickCreateKind(kind);
        setQuickCreateName('');
        setQuickCreateError(null);
    }
    function closeQuickCreate() {
        if (isQuickCreating)
            return;
        setQuickCreateKind(null);
        setQuickCreateName('');
        setQuickCreateError(null);
    }
    async function handleQuickCreate(event) {
        event.preventDefault();
        if (!quickCreateKind)
            return;
        const name = quickCreateName.trim();
        if (!name) {
            setQuickCreateError('Informe um nome para continuar.');
            return;
        }
        setIsQuickCreating(true);
        setQuickCreateError(null);
        try {
            if (quickCreateKind === 'segment') {
                const segment = await segmentsApi.create({ name });
                setSegments((current) => [...current, segment].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
                updateField('companySegment', segment.name);
            }
            else {
                const partner = await partnersApi.create({
                    name,
                    type: quickCreateConfig[quickCreateKind].partnerType,
                    status: 'ACTIVE',
                });
                setPartners((current) => [...current, partner].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
                updateField(quickCreateKind === 'commercialPartner' ? 'partnerId' : 'technicalPartnerId', partner.id);
            }
            setIsQuickCreating(false);
            closeQuickCreate();
        }
        catch (err) {
            setQuickCreateError(err instanceof Error ? err.message : 'Erro ao realizar o cadastro.');
        }
        finally {
            setIsQuickCreating(false);
        }
    }
    const isStageChanging = isEditing && Boolean(form.stageId && form.stageId !== initialStageId);
    const estimatedValue = form.capexValue === undefined && form.opexValue === undefined
        ? undefined
        : (form.capexValue ?? 0) + (form.opexValue ?? 0) * 12;
    const selectedProjectTypes = projectTypes.filter((item) => form.projectTypeIds?.includes(item.id));
    const selectedCommercialPartner = partners.find((partner) => partner.id === form.partnerId);
    const commercialCommissionPercentage = Number(selectedCommercialPartner?.commissionPercentage ?? 0);
    const commercialCommissionValue = (form.capexValue ?? 0) * (commercialCommissionPercentage / 100);
    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        if (selectedStage?.isLostStage && !form.lossReason) {
            setError('Informe o motivo da perda para mover o lead para esta etapa.');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = { ...form, customFieldValues };
            const lead = isEditing ? await leadsApi.update(id, payload) : await leadsApi.create(payload);
            navigate(`/leads/${lead.id}`, { state: navigationState });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar lead.');
        }
        finally {
            setIsSubmitting(false);
        }
    }
    if (isLoading) {
        return (_jsx("div", { className: "flex min-h-screen items-center justify-center bg-app-bg", children: _jsx("p", { className: "text-sm text-ink/60", children: "Carregando\u2026" }) }));
    }
    return (_jsx(AppShell, { children: _jsxs("div", { className: "mx-auto max-w-5xl", children: [_jsx(PageHeader, { eyebrow: "Leads e oportunidades", title: isEditing ? 'Editar oportunidade' : 'Nova oportunidade', description: "Preencha as informa\u00E7\u00F5es abaixo para manter o funil comercial organizado.", actions: _jsxs("button", { type: "button", onClick: () => navigate(isEditing ? `/leads/${id}` : '/leads', {
                            state: isEditing ? navigationState : undefined,
                        }), className: "btn-secondary", children: [_jsx(Icon, { name: "x", className: "h-4 w-4" }), "Cancelar"] }) }), _jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-5", children: [_jsxs("section", { className: "form-section form-section-autocomplete", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading text-base font-bold text-slate-800", children: "Dados gerais" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Identifica\u00E7\u00E3o principal da oportunidade e da empresa." })] }), _jsxs("div", { className: "form-section-body", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Linha *" }), _jsxs("select", { required: true, className: inputClass, value: form.line ?? '', onChange: (e) => updateField('line', e.target.value), children: [_jsx("option", { value: "", children: "Selecione\u2026" }), Object.entries(LEAD_LINE_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value)))] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelClass, children: "Nome do lead/oportunidade *" }), _jsx("input", { required: true, className: inputClass, value: form.name, onChange: (e) => updateField('name', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Empresa" }), _jsx(LeadAutocompleteInput, { type: "company", value: form.companyName ?? '', onChange: (value) => updateField('companyName', value), onSelect: (option) => setForm((current) => ({
                                                        ...current,
                                                        companyName: option.companyName ?? undefined,
                                                        companyDocument: option.companyDocument ?? undefined,
                                                    })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "CNPJ/CPF" }), _jsx("input", { className: inputClass, value: form.companyDocument ?? '', onChange: (e) => updateField('companyDocument', e.target.value) })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsxs("div", { className: "mb-1.5 flex items-center justify-between gap-3", children: [_jsx("label", { className: labelClass, children: "Segmento" }), canCreateSegments && (_jsxs("button", { type: "button", className: "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark", onClick: () => openQuickCreate('segment'), children: [_jsx(Icon, { name: "plus", className: "h-3.5 w-3.5" }), "Novo segmento"] }))] }), _jsxs("select", { className: inputClass, value: form.companySegment ?? '', onChange: (e) => updateField('companySegment', e.target.value), children: [_jsx("option", { value: "", children: "Selecione\u2026" }), segments.map((segment) => (_jsx("option", { value: segment.name, children: segment.name }, segment.id)))] })] })] })] }), _jsxs("section", { className: "form-section form-section-autocomplete", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading text-base font-bold text-slate-800", children: "Contato" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Dados da pessoa respons\u00E1vel pelo contato comercial." })] }), _jsxs("div", { className: "form-section-body lg:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Nome" }), _jsx(LeadAutocompleteInput, { type: "contact", value: form.contactName ?? '', onChange: (value) => updateField('contactName', value), onSelect: (option) => setForm((current) => ({
                                                        ...current,
                                                        contactName: option.contactName ?? undefined,
                                                        contactEmail: option.contactEmail ?? undefined,
                                                        contactPhone: option.contactPhone ?? undefined,
                                                    })) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "E-mail" }), _jsx("input", { type: "email", className: inputClass, value: form.contactEmail ?? '', onChange: (e) => updateField('contactEmail', e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Telefone" }), _jsx(PhoneInput, { className: inputClass, value: form.contactPhone ?? '', onValueChange: (value) => updateField('contactPhone', value || undefined) })] })] })] }), _jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading text-base font-bold text-slate-800", children: "Parceiro comercial" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Empresa parceira respons\u00E1vel pelo relacionamento comercial nesta oportunidade." })] }), _jsx("div", { className: "form-section-body", children: _jsxs("div", { className: "md:col-span-2", children: [_jsxs("div", { className: "mb-1.5 flex items-center justify-between gap-3", children: [_jsx("label", { className: labelClass, children: "Parceiro comercial" }), canCreatePartners && (_jsxs("button", { type: "button", className: "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark", onClick: () => openQuickCreate('commercialPartner'), children: [_jsx(Icon, { name: "plus", className: "h-3.5 w-3.5" }), "Novo parceiro comercial"] }))] }), _jsxs("select", { className: inputClass, value: form.partnerId ?? '', onChange: (event) => updateField('partnerId', event.target.value || null), children: [_jsx("option", { value: "", children: "Nenhum parceiro comercial" }), partners.map((partner) => (_jsx("option", { value: partner.id, children: partner.name }, partner.id)))] }), selectedCommercialPartner && (_jsxs("div", { className: "mt-4 grid gap-3 rounded-xl border border-brand-purple/20 bg-purple-50/50 p-4 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium text-slate-500", children: "Percentual da comiss\u00E3o padr\u00E3o" }), _jsx("p", { className: "mt-1 text-lg font-bold text-brand-purple-dark", children: selectedCommercialPartner.commissionPercentage === null
                                                                    ? 'Não cadastrado'
                                                                    : `${commercialCommissionPercentage.toLocaleString('pt-BR', {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2,
                                                                    })}%` })] }), _jsxs("div", { className: "sm:text-right", children: [_jsx("p", { className: "text-xs font-medium text-slate-500", children: "Comiss\u00E3o sobre o valor CAPEX" }), _jsx("p", { className: "mt-1 text-lg font-bold text-brand-purple-dark", children: formatCurrency(commercialCommissionValue) })] })] }))] }) })] }), _jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading text-base font-bold text-slate-800", children: "Classifica\u00E7\u00E3o" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Organiza\u00E7\u00E3o do lead no funil e na carteira comercial." })] }), _jsxs("div", { className: "form-section-body", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Etapa" }), _jsxs("select", { className: inputClass, value: form.stageId ?? '', onChange: (e) => updateField('stageId', e.target.value), children: [_jsx("option", { value: "", children: "Etapa inicial padr\u00E3o" }), stages.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Prioridade" }), _jsxs("select", { className: inputClass, value: form.priorityId ?? '', onChange: (e) => updateField('priorityId', e.target.value || undefined), children: [_jsx("option", { value: "", children: "\u2014" }), priorities.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Porte do neg\u00F3cio" }), _jsxs("select", { className: inputClass, value: form.dealSizeId ?? '', onChange: (e) => updateField('dealSizeId', e.target.value || undefined), children: [_jsx("option", { value: "", children: "\u2014" }), dealSizes.map((d) => (_jsx("option", { value: d.id, children: d.name }, d.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Origem" }), _jsxs("select", { className: inputClass, value: form.sourceId ?? '', onChange: (e) => updateField('sourceId', e.target.value || undefined), children: [_jsx("option", { value: "", children: "\u2014" }), sources.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Tipos de produto" }), _jsx("div", { className: "grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2", children: projectTypes.map((projectType) => {
                                                        const checked = form.projectTypeIds?.includes(projectType.id) ?? false;
                                                        return (_jsxs("label", { className: "flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (event) => updateField('projectTypeIds', event.target.checked
                                                                        ? [...(form.projectTypeIds ?? []), projectType.id]
                                                                        : (form.projectTypeIds ?? []).filter((id) => id !== projectType.id)) }), _jsx("span", { children: projectType.name })] }, projectType.id));
                                                    }) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Valor estimado dos produtos selecionados (unit\u00E1rio)" }), _jsx("div", { className: "min-h-[7.5rem] rounded-xl border border-brand-purple/20 bg-gradient-to-br from-purple-50 to-white p-4", children: selectedProjectTypes.length ? (_jsx("div", { className: "space-y-4", children: selectedProjectTypes.map((projectType) => {
                                                            const totals = projectType.services.reduce((result, { service }) => ({
                                                                ...result,
                                                                [service.billingUnit]: (result[service.billingUnit] ?? 0) + Number(service.price),
                                                            }), {});
                                                            return (_jsxs("div", { children: [_jsx("p", { className: "text-sm font-bold text-brand-purple-dark", children: projectType.name }), _jsx("div", { className: "mt-1 space-y-1", children: projectType.services.map(({ service }) => (_jsxs("div", { className: "flex justify-between gap-3 text-xs text-slate-500", children: [_jsx("span", { children: service.name }), _jsxs("span", { className: "whitespace-nowrap", children: [formatCurrency(service.price), "/", SERVICE_UNIT_LABELS[service.billingUnit]] })] }, service.id))) }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [Object.entries(totals).map(([unit, total]) => (_jsxs("span", { className: "rounded-full bg-brand-purple px-2.5 py-1 text-xs font-semibold text-white", children: [formatCurrency(total), "/", SERVICE_UNIT_LABELS[unit]] }, unit))), !projectType.services.length && (_jsx("span", { className: "text-xs text-slate-400", children: "Sem servi\u00E7os vinculados" }))] })] }, projectType.id));
                                                        }) })) : (_jsx("div", { className: "flex min-h-[5.5rem] items-center justify-center text-center text-sm text-slate-400", children: "Selecione um tipo de produto para visualizar os servi\u00E7os e valores." })) })] }), canViewAll && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelClass, children: "Respons\u00E1veis" }), _jsx("div", { className: "grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2", children: users.map((responsible) => {
                                                        const checked = form.ownerIds?.includes(responsible.id) ?? false;
                                                        return (_jsxs("label", { className: "flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50", children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (event) => updateField('ownerIds', event.target.checked
                                                                        ? [...(form.ownerIds ?? []), responsible.id]
                                                                        : (form.ownerIds ?? []).filter((id) => id !== responsible.id)) }), _jsx("span", { children: responsible.name })] }, responsible.id));
                                                    }) })] })), isStageChanging && (_jsxs("div", { className: "md:col-span-2 rounded-xl border border-brand-purple/20 bg-purple-50/50 p-4", children: [_jsx("label", { className: labelClass, children: "A\u00E7\u00E3o realizada nesta movimenta\u00E7\u00E3o *" }), _jsx("textarea", { required: true, className: inputClass, rows: 3, value: form.actionDescription ?? '', onChange: (event) => updateField('actionDescription', event.target.value) }), _jsxs("label", { className: "mt-3 flex items-center gap-2 text-sm font-medium", children: [_jsx("input", { type: "checkbox", checked: form.createTask ?? false, onChange: (event) => updateField('createTask', event.target.checked) }), "Criar uma tarefa para cada respons\u00E1vel"] }), form.createTask && (_jsxs("div", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Prazo *" }), _jsx(DateInput, { required: true, className: inputClass, value: form.taskDueDate, onValueChange: (value) => updateField('taskDueDate', value) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Prioridade *" }), _jsxs("select", { required: true, className: inputClass, value: form.taskPriority ?? 'MEDIUM', onChange: (event) => updateField('taskPriority', event.target.value), children: [_jsx("option", { value: "LOW", children: "Baixa" }), _jsx("option", { value: "MEDIUM", children: "M\u00E9dia" }), _jsx("option", { value: "HIGH", children: "Alta" }), _jsx("option", { value: "URGENT", children: "Urgente" })] })] })] }))] })), selectedStage?.isLostStage && (_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelClass, children: "Motivo da perda *" }), _jsx("input", { required: true, className: inputClass, value: form.lossReason ?? '', onChange: (e) => updateField('lossReason', e.target.value) })] }))] })] }), _jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading text-base font-bold text-slate-800", children: "Parceiro t\u00E9cnico" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Empresa parceira respons\u00E1vel pelo apoio t\u00E9cnico nesta oportunidade." })] }), _jsxs("div", { className: "form-section-body", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsxs("div", { className: "mb-1.5 flex items-center justify-between gap-3", children: [_jsx("label", { className: labelClass, children: "Parceiro t\u00E9cnico" }), canCreatePartners && (_jsxs("button", { type: "button", className: "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark", onClick: () => openQuickCreate('technicalPartner'), children: [_jsx(Icon, { name: "plus", className: "h-3.5 w-3.5" }), "Novo parceiro t\u00E9cnico"] }))] }), _jsxs("select", { className: inputClass, value: form.technicalPartnerId ?? '', onChange: (event) => updateField('technicalPartnerId', event.target.value || null), children: [_jsx("option", { value: "", children: "Nenhum parceiro t\u00E9cnico" }), partners.map((partner) => (_jsx("option", { value: partner.id, children: partner.name }, partner.id)))] })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: labelClass, children: "Valor total do servi\u00E7o prestado (R$)" }), _jsx(CurrencyInput, { className: inputClass, value: form.technicalServiceValue, onValueChange: (value) => updateField('technicalServiceValue', value) })] })] })] }), _jsxs("section", { className: "form-section", children: [_jsxs("div", { className: "form-section-header", children: [_jsx("h2", { className: "font-heading text-base font-bold text-slate-800", children: "Informa\u00E7\u00F5es do neg\u00F3cio" }), _jsx("p", { className: "mt-1 text-xs text-slate-400", children: "Valores, estimativas e detalhes para apoiar a negocia\u00E7\u00E3o." })] }), _jsxs("div", { className: "form-section-body lg:grid-cols-3", children: [_jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Valor CAPEX (R$)" }), _jsx(CurrencyInput, { className: inputClass, value: form.capexValue, onValueChange: (value) => updateField('capexValue', value) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Valor OPEX mensal (R$)" }), _jsx(CurrencyInput, { className: inputClass, value: form.opexValue, onValueChange: (value) => updateField('opexValue', value) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Valor estimado (CAPEX + OPEX \u00D7 12)" }), _jsx(CurrencyInput, { className: `${inputClass} bg-slate-100`, value: estimatedValue, onValueChange: () => undefined, disabled: true })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Probabilidade de sucesso (%)" }), _jsx("input", { type: "number", min: 0, max: 100, className: inputClass, value: form.successProbability ?? '', onChange: (e) => updateField('successProbability', e.target.value === '' ? undefined : Number(e.target.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Periodicidade" }), _jsx("select", { className: inputClass, value: form.periodicity ?? 'PONTUAL', onChange: (e) => updateField('periodicity', e.target.value), children: Object.entries(LEAD_PERIODICITY_LABELS).map(([value, label]) => (_jsx("option", { value: value, children: label }, value))) })] }), _jsxs("div", { children: [_jsx("label", { className: labelClass, children: "Previs\u00E3o de fechamento" }), _jsx(DateInput, { className: inputClass, value: form.expectedCloseDate, onValueChange: (value) => updateField('expectedCloseDate', value) })] }), _jsxs("div", { className: "md:col-span-2 lg:col-span-3", children: [_jsx("label", { className: labelClass, children: "Descri\u00E7\u00E3o / notas" }), _jsx("textarea", { rows: 3, className: inputClass, value: form.description ?? '', onChange: (e) => updateField('description', e.target.value) })] })] })] }), _jsx(CustomFieldsFormSection, { values: customFieldValues, onChange: setCustomFieldValues }), error && (_jsx("p", { className: "rounded-card bg-danger/10 px-3 py-2 text-sm text-danger", children: error })), _jsxs("div", { className: "sticky bottom-4 z-20 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur", children: [_jsx("button", { type: "button", onClick: () => navigate(isEditing ? `/leads/${id}` : '/leads', {
                                        state: isEditing ? navigationState : undefined,
                                    }), className: "btn-secondary", children: "Cancelar" }), _jsxs("button", { type: "submit", disabled: isSubmitting, className: "btn-primary min-w-[130px]", children: [_jsx(Icon, { name: "view", className: "h-4 w-4" }), isSubmitting ? 'Salvando…' : 'Salvar'] })] })] }), quickCreateKind && (_jsx("div", { className: "mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm", role: "dialog", "aria-modal": "true", "aria-labelledby": "quick-create-title", onMouseDown: (event) => {
                        if (event.target === event.currentTarget)
                            closeQuickCreate();
                    }, children: _jsxs("form", { onSubmit: handleQuickCreate, className: "w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { id: "quick-create-title", className: "font-heading text-lg font-bold text-slate-800", children: quickCreateConfig[quickCreateKind].title }), _jsx("p", { className: "mt-1 text-sm text-slate-400", children: "O novo cadastro ser\u00E1 selecionado automaticamente nesta oportunidade." })] }), _jsx("button", { type: "button", className: "icon-button", onClick: closeQuickCreate, "aria-label": "Fechar", children: _jsx(Icon, { name: "x", className: "h-5 w-5" }) })] }), _jsxs("div", { className: "mt-5", children: [_jsxs("label", { className: labelClass, htmlFor: "quick-create-name", children: [quickCreateConfig[quickCreateKind].label, " *"] }), _jsx("input", { id: "quick-create-name", required: true, autoFocus: true, minLength: quickCreateKind === 'segment' ? 1 : 2, className: inputClass, placeholder: quickCreateConfig[quickCreateKind].placeholder, value: quickCreateName, onChange: (event) => setQuickCreateName(event.target.value) })] }), quickCreateError && (_jsx("p", { className: "mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600", children: quickCreateError })), _jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: closeQuickCreate, children: "Cancelar" }), _jsxs("button", { type: "submit", className: "btn-primary", disabled: isQuickCreating, children: [_jsx(Icon, { name: "plus", className: "h-4 w-4" }), isQuickCreating ? 'Cadastrando…' : 'Cadastrar e selecionar'] })] })] }) }))] }) }));
}
