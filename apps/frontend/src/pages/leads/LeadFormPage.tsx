import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { leadsApi, type CustomFieldValueInput, type LeadFormPayload } from '../../lib/leadsApi';
import {
  stagesApi,
  prioritiesApi,
  dealSizesApi,
  sourcesApi,
  segmentsApi,
  projectTypesApi,
} from '../../lib/settingsApi';
import { usersApi, type UserOption } from '../../lib/usersApi';
import { partnersApi } from '../../lib/partnersApi';
import type { Partner, PartnerType } from '../../types/partners';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomFieldsFormSection } from '../../components/CustomFieldsFormSection';
import { LeadAutocompleteInput } from '../../components/LeadAutocompleteInput';
import { CurrencyInput, DateInput, PhoneInput } from '../../components/MaskedInputs';
import { LEAD_PERIODICITY_LABELS, type LeadPeriodicity } from '../../types/leads';
import type { DealSize, Priority, ProjectType, Segment, Source, Stage } from '../../types/settings';
import { formatCurrency } from '../../lib/formatters';
import { SERVICE_UNIT_LABELS } from '../settings/ServicesPanel';

const inputClass = 'form-control';
const labelClass = 'form-label';

type QuickCreateKind = 'segment' | 'commercialPartner' | 'technicalPartner';

const quickCreateConfig: Record<
  QuickCreateKind,
  { title: string; label: string; placeholder: string; partnerType?: PartnerType }
> = {
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
  const navigationState = location.state as { returnTo?: string } | null;
  const user = useAuthStore((s) => s.user);
  const canViewAll = user?.permissions.includes('leads.view.all') ?? false;
  const canCreateSegments = user?.permissions.includes('settings.manage') ?? false;
  const canCreatePartners = user?.permissions.includes('partners.create') ?? false;

  const [stages, setStages] = useState<Stage[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [dealSizes, setDealSizes] = useState<DealSize[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [form, setForm] = useState<LeadFormPayload>({ name: '' });
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValueInput[]>([]);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [initialStageId, setInitialStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [quickCreateKind, setQuickCreateKind] = useState<QuickCreateKind | null>(null);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);

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
    if (canViewAll) usersApi.list().then(setUsers);
  }, []);

  useEffect(() => {
    if (!id) return;
    leadsApi
      .get(id)
      .then((lead) => {
        setForm({
          name: lead.name,
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
          technicalServiceValue:
            lead.technicalServiceValue === null
              ? undefined
              : Number(lead.technicalServiceValue),
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
        setCustomFieldValues(
          lead.customFieldValues.map((v) => ({ customFieldId: v.customFieldId, value: v.value })),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar lead.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    const stage = stages.find((s) => s.id === form.stageId) ?? null;
    setSelectedStage(stage);
  }, [form.stageId, stages]);

  function updateField<K extends keyof LeadFormPayload>(key: K, value: LeadFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openQuickCreate(kind: QuickCreateKind) {
    setQuickCreateKind(kind);
    setQuickCreateName('');
    setQuickCreateError(null);
  }

  function closeQuickCreate() {
    if (isQuickCreating) return;
    setQuickCreateKind(null);
    setQuickCreateName('');
    setQuickCreateError(null);
  }

  async function handleQuickCreate(event: FormEvent) {
    event.preventDefault();
    if (!quickCreateKind) return;

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
        setSegments((current) =>
          [...current, segment].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        );
        updateField('companySegment', segment.name);
      } else {
        const partner = await partnersApi.create({
          name,
          type: quickCreateConfig[quickCreateKind].partnerType,
          status: 'ACTIVE',
        });
        setPartners((current) =>
          [...current, partner].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        );
        updateField(
          quickCreateKind === 'commercialPartner' ? 'partnerId' : 'technicalPartnerId',
          partner.id,
        );
      }
      setIsQuickCreating(false);
      closeQuickCreate();
    } catch (err) {
      setQuickCreateError(err instanceof Error ? err.message : 'Erro ao realizar o cadastro.');
    } finally {
      setIsQuickCreating(false);
    }
  }

  const isStageChanging = isEditing && Boolean(form.stageId && form.stageId !== initialStageId);
  const estimatedValue =
    form.capexValue === undefined && form.opexValue === undefined
      ? undefined
      : (form.capexValue ?? 0) + (form.opexValue ?? 0) * 12;
  const selectedProjectTypes = projectTypes.filter((item) =>
    form.projectTypeIds?.includes(item.id),
  );
  const selectedCommercialPartner = partners.find((partner) => partner.id === form.partnerId);
  const commercialCommissionPercentage = Number(
    selectedCommercialPartner?.commissionPercentage ?? 0,
  );
  const commercialCommissionValue =
    (form.capexValue ?? 0) * (commercialCommissionPercentage / 100);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (selectedStage?.isLostStage && !form.lossReason) {
      setError('Informe o motivo da perda para mover o lead para esta etapa.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: LeadFormPayload = { ...form, customFieldValues };
      const lead = isEditing ? await leadsApi.update(id!, payload) : await leadsApi.create(payload);
      navigate(`/leads/${lead.id}`, { state: navigationState });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lead.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <p className="text-sm text-ink/60">Carregando…</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Leads e oportunidades"
          title={isEditing ? 'Editar oportunidade' : 'Nova oportunidade'}
          description="Preencha as informações abaixo para manter o funil comercial organizado."
          actions={
            <button
              type="button"
              onClick={() =>
                navigate(isEditing ? `/leads/${id}` : '/leads', {
                  state: isEditing ? navigationState : undefined,
                })
              }
              className="btn-secondary"
            >
              <Icon name="x" className="h-4 w-4" />
              Cancelar
            </button>
          }
        />
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <section className="form-section form-section-autocomplete">
            <div className="form-section-header">
              <h2 className="font-heading text-base font-bold text-slate-800">Dados gerais</h2>
              <p className="mt-1 text-xs text-slate-400">
                Identificação principal da oportunidade e da empresa.
              </p>
            </div>
            <div className="form-section-body">
              <div className="md:col-span-2">
                <label className={labelClass}>Nome do lead/oportunidade *</label>
                <input
                  required
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Empresa</label>
                <LeadAutocompleteInput
                  type="company"
                  value={form.companyName ?? ''}
                  onChange={(value) => updateField('companyName', value)}
                  onSelect={(option) =>
                    setForm((current) => ({
                      ...current,
                      companyName: option.companyName ?? undefined,
                      companyDocument: option.companyDocument ?? undefined,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>CNPJ/CPF</label>
                <input
                  className={inputClass}
                  value={form.companyDocument ?? ''}
                  onChange={(e) => updateField('companyDocument', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className={labelClass}>Segmento</label>
                  {canCreateSegments && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark"
                      onClick={() => openQuickCreate('segment')}
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                      Novo segmento
                    </button>
                  )}
                </div>
                <select
                  className={inputClass}
                  value={form.companySegment ?? ''}
                  onChange={(e) => updateField('companySegment', e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.name}>
                      {segment.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="form-section form-section-autocomplete">
            <div className="form-section-header">
              <h2 className="font-heading text-base font-bold text-slate-800">Contato</h2>
              <p className="mt-1 text-xs text-slate-400">
                Dados da pessoa responsável pelo contato comercial.
              </p>
            </div>
            <div className="form-section-body lg:grid-cols-3">
              <div>
                <label className={labelClass}>Nome</label>
                <LeadAutocompleteInput
                  type="contact"
                  value={form.contactName ?? ''}
                  onChange={(value) => updateField('contactName', value)}
                  onSelect={(option) =>
                    setForm((current) => ({
                      ...current,
                      contactName: option.contactName ?? undefined,
                      contactEmail: option.contactEmail ?? undefined,
                      contactPhone: option.contactPhone ?? undefined,
                    }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.contactEmail ?? ''}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Telefone</label>
                <PhoneInput
                  className={inputClass}
                  value={form.contactPhone ?? ''}
                  onValueChange={(value) => updateField('contactPhone', value || undefined)}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading text-base font-bold text-slate-800">
                Parceiro comercial
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Empresa parceira responsável pelo relacionamento comercial nesta oportunidade.
              </p>
            </div>
            <div className="form-section-body">
              <div className="md:col-span-2">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className={labelClass}>Parceiro comercial</label>
                  {canCreatePartners && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark"
                      onClick={() => openQuickCreate('commercialPartner')}
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                      Novo parceiro comercial
                    </button>
                  )}
                </div>
                <select
                  className={inputClass}
                  value={form.partnerId ?? ''}
                  onChange={(event) => updateField('partnerId', event.target.value || null)}
                >
                  <option value="">Nenhum parceiro comercial</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
                {selectedCommercialPartner && (
                  <div className="mt-4 grid gap-3 rounded-xl border border-brand-purple/20 bg-purple-50/50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Percentual da comissão padrão
                      </p>
                      <p className="mt-1 text-lg font-bold text-brand-purple-dark">
                        {selectedCommercialPartner.commissionPercentage === null
                          ? 'Não cadastrado'
                          : `${commercialCommissionPercentage.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}%`}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs font-medium text-slate-500">
                        Comissão sobre o valor CAPEX
                      </p>
                      <p className="mt-1 text-lg font-bold text-brand-purple-dark">
                        {formatCurrency(commercialCommissionValue)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading text-base font-bold text-slate-800">Classificação</h2>
              <p className="mt-1 text-xs text-slate-400">
                Organização do lead no funil e na carteira comercial.
              </p>
            </div>
            <div className="form-section-body">
              <div>
                <label className={labelClass}>Etapa</label>
                <select
                  className={inputClass}
                  value={form.stageId ?? ''}
                  onChange={(e) => updateField('stageId', e.target.value)}
                >
                  <option value="">Etapa inicial padrão</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Prioridade</label>
                <select
                  className={inputClass}
                  value={form.priorityId ?? ''}
                  onChange={(e) => updateField('priorityId', e.target.value || undefined)}
                >
                  <option value="">—</option>
                  {priorities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Porte do negócio</label>
                <select
                  className={inputClass}
                  value={form.dealSizeId ?? ''}
                  onChange={(e) => updateField('dealSizeId', e.target.value || undefined)}
                >
                  <option value="">—</option>
                  {dealSizes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Origem</label>
                <select
                  className={inputClass}
                  value={form.sourceId ?? ''}
                  onChange={(e) => updateField('sourceId', e.target.value || undefined)}
                >
                  <option value="">—</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipos de produto</label>
                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                  {projectTypes.map((projectType) => {
                    const checked = form.projectTypeIds?.includes(projectType.id) ?? false;
                    return (
                      <label
                        key={projectType.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            updateField(
                              'projectTypeIds',
                              event.target.checked
                                ? [...(form.projectTypeIds ?? []), projectType.id]
                                : (form.projectTypeIds ?? []).filter((id) => id !== projectType.id),
                            )
                          }
                        />
                        <span>{projectType.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Valor estimado dos produtos selecionados (unitário)
                </label>
                <div className="min-h-[7.5rem] rounded-xl border border-brand-purple/20 bg-gradient-to-br from-purple-50 to-white p-4">
                  {selectedProjectTypes.length ? (
                    <div className="space-y-4">
                      {selectedProjectTypes.map((projectType) => {
                        const totals = projectType.services.reduce<Record<string, number>>(
                          (result, { service }) => ({
                            ...result,
                            [service.billingUnit]:
                              (result[service.billingUnit] ?? 0) + Number(service.price),
                          }),
                          {},
                        );
                        return (
                          <div key={projectType.id}>
                            <p className="text-sm font-bold text-brand-purple-dark">
                              {projectType.name}
                            </p>
                            <div className="mt-1 space-y-1">
                              {projectType.services.map(({ service }) => (
                                <div
                                  key={service.id}
                                  className="flex justify-between gap-3 text-xs text-slate-500"
                                >
                                  <span>{service.name}</span>
                                  <span className="whitespace-nowrap">
                                    {formatCurrency(service.price)}/
                                    {SERVICE_UNIT_LABELS[service.billingUnit]}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(totals).map(([unit, total]) => (
                                <span
                                  key={unit}
                                  className="rounded-full bg-brand-purple px-2.5 py-1 text-xs font-semibold text-white"
                                >
                                  {formatCurrency(total)}/
                                  {SERVICE_UNIT_LABELS[unit as keyof typeof SERVICE_UNIT_LABELS]}
                                </span>
                              ))}
                              {!projectType.services.length && (
                                <span className="text-xs text-slate-400">
                                  Sem serviços vinculados
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-[5.5rem] items-center justify-center text-center text-sm text-slate-400">
                      Selecione um tipo de produto para visualizar os serviços e valores.
                    </div>
                  )}
                </div>
              </div>
              {canViewAll && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Responsáveis</label>
                  <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
                    {users.map((responsible) => {
                      const checked = form.ownerIds?.includes(responsible.id) ?? false;
                      return (
                        <label
                          key={responsible.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              updateField(
                                'ownerIds',
                                event.target.checked
                                  ? [...(form.ownerIds ?? []), responsible.id]
                                  : (form.ownerIds ?? []).filter((id) => id !== responsible.id),
                              )
                            }
                          />
                          <span>{responsible.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {isStageChanging && (
                <div className="md:col-span-2 rounded-xl border border-brand-purple/20 bg-purple-50/50 p-4">
                  <label className={labelClass}>Ação realizada nesta movimentação *</label>
                  <textarea
                    required
                    className={inputClass}
                    rows={3}
                    value={form.actionDescription ?? ''}
                    onChange={(event) => updateField('actionDescription', event.target.value)}
                  />
                  <label className="mt-3 flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.createTask ?? false}
                      onChange={(event) => updateField('createTask', event.target.checked)}
                    />
                    Criar uma tarefa para cada responsável
                  </label>
                  {form.createTask && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Prazo *</label>
                        <DateInput
                          required
                          className={inputClass}
                          value={form.taskDueDate}
                          onValueChange={(value) => updateField('taskDueDate', value)}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Prioridade *</label>
                        <select
                          required
                          className={inputClass}
                          value={form.taskPriority ?? 'MEDIUM'}
                          onChange={(event) =>
                            updateField(
                              'taskPriority',
                              event.target.value as LeadFormPayload['taskPriority'],
                            )
                          }
                        >
                          <option value="LOW">Baixa</option>
                          <option value="MEDIUM">Média</option>
                          <option value="HIGH">Alta</option>
                          <option value="URGENT">Urgente</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedStage?.isLostStage && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Motivo da perda *</label>
                  <input
                    required
                    className={inputClass}
                    value={form.lossReason ?? ''}
                    onChange={(e) => updateField('lossReason', e.target.value)}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading text-base font-bold text-slate-800">Parceiro técnico</h2>
              <p className="mt-1 text-xs text-slate-400">
                Empresa parceira responsável pelo apoio técnico nesta oportunidade.
              </p>
            </div>
            <div className="form-section-body">
              <div className="md:col-span-2">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className={labelClass}>Parceiro técnico</label>
                  {canCreatePartners && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark"
                      onClick={() => openQuickCreate('technicalPartner')}
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                      Novo parceiro técnico
                    </button>
                  )}
                </div>
                <select
                  className={inputClass}
                  value={form.technicalPartnerId ?? ''}
                  onChange={(event) =>
                    updateField('technicalPartnerId', event.target.value || null)
                  }
                >
                  <option value="">Nenhum parceiro técnico</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Valor total do serviço prestado (R$)</label>
                <CurrencyInput
                  className={inputClass}
                  value={form.technicalServiceValue}
                  onValueChange={(value) => updateField('technicalServiceValue', value)}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading text-base font-bold text-slate-800">
                Informações do negócio
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Valores, estimativas e detalhes para apoiar a negociação.
              </p>
            </div>
            <div className="form-section-body lg:grid-cols-3">
              <div>
                <label className={labelClass}>Valor CAPEX (R$)</label>
                <CurrencyInput
                  className={inputClass}
                  value={form.capexValue}
                  onValueChange={(value) => updateField('capexValue', value)}
                />
              </div>
              <div>
                <label className={labelClass}>Valor OPEX mensal (R$)</label>
                <CurrencyInput
                  className={inputClass}
                  value={form.opexValue}
                  onValueChange={(value) => updateField('opexValue', value)}
                />
              </div>
              <div>
                <label className={labelClass}>Valor estimado (CAPEX + OPEX × 12)</label>
                <CurrencyInput
                  className={`${inputClass} bg-slate-100`}
                  value={estimatedValue}
                  onValueChange={() => undefined}
                  disabled
                />
              </div>
              <div>
                <label className={labelClass}>Probabilidade de sucesso (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={form.successProbability ?? ''}
                  onChange={(e) =>
                    updateField(
                      'successProbability',
                      e.target.value === '' ? undefined : Number(e.target.value),
                    )
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Periodicidade</label>
                <select
                  className={inputClass}
                  value={form.periodicity ?? 'PONTUAL'}
                  onChange={(e) => updateField('periodicity', e.target.value as LeadPeriodicity)}
                >
                  {Object.entries(LEAD_PERIODICITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Previsão de fechamento</label>
                <DateInput
                  className={inputClass}
                  value={form.expectedCloseDate}
                  onValueChange={(value) => updateField('expectedCloseDate', value)}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className={labelClass}>Descrição / notas</label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={form.description ?? ''}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>
            </div>
          </section>

          <CustomFieldsFormSection values={customFieldValues} onChange={setCustomFieldValues} />

          {error && (
            <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="sticky bottom-4 z-20 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
            <button
              type="button"
              onClick={() =>
                navigate(isEditing ? `/leads/${id}` : '/leads', {
                  state: isEditing ? navigationState : undefined,
                })
              }
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary min-w-[130px]">
              <Icon name="view" className="h-4 w-4" />
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
        {quickCreateKind && (
          <div
            className="mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-create-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeQuickCreate();
            }}
          >
            <form
              onSubmit={handleQuickCreate}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="quick-create-title"
                    className="font-heading text-lg font-bold text-slate-800"
                  >
                    {quickCreateConfig[quickCreateKind].title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    O novo cadastro será selecionado automaticamente nesta oportunidade.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeQuickCreate}
                  aria-label="Fechar"
                >
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-5">
                <label className={labelClass} htmlFor="quick-create-name">
                  {quickCreateConfig[quickCreateKind].label} *
                </label>
                <input
                  id="quick-create-name"
                  required
                  autoFocus
                  minLength={quickCreateKind === 'segment' ? 1 : 2}
                  className={inputClass}
                  placeholder={quickCreateConfig[quickCreateKind].placeholder}
                  value={quickCreateName}
                  onChange={(event) => setQuickCreateName(event.target.value)}
                />
              </div>
              {quickCreateError && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {quickCreateError}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={closeQuickCreate}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={isQuickCreating}>
                  <Icon name="plus" className="h-4 w-4" />
                  {isQuickCreating ? 'Cadastrando…' : 'Cadastrar e selecionar'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
