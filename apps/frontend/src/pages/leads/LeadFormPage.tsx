import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import type { Partner } from '../../types/partners';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomFieldsFormSection } from '../../components/CustomFieldsFormSection';
import { CurrencyInput, DateInput, PhoneInput } from '../../components/MaskedInputs';
import { LEAD_PERIODICITY_LABELS, type LeadPeriodicity } from '../../types/leads';
import type { DealSize, Priority, ProjectType, Segment, Source, Stage } from '../../types/settings';

const inputClass = 'form-control';
const labelClass = 'form-label';

export default function LeadFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canViewAll = user?.permissions.includes('leads.view.all') ?? false;

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
          projectTypeId: lead.projectType?.id,
          stageId: lead.stage.id,
          priorityId: lead.priority?.id,
          dealSizeId: lead.dealSize?.id,
          sourceId: lead.source?.id,
          partnerId: lead.partner?.id,
          successProbability: lead.successProbability ?? undefined,
          estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : undefined,
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

  const selectedSource = sources.find((source) => source.id === form.sourceId);
  const isPartnerSource = selectedSource?.name.trim().toLocaleLowerCase('pt-BR') === 'parceiro';
  const isStageChanging = isEditing && Boolean(form.stageId && form.stageId !== initialStageId);

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
      navigate(`/leads/${lead.id}`);
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
              onClick={() => navigate(isEditing ? `/leads/${id}` : '/leads')}
              className="btn-secondary"
            >
              <Icon name="x" className="h-4 w-4" />
              Cancelar
            </button>
          }
        />
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <section className="form-section">
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
                <input
                  className={inputClass}
                  value={form.companyName ?? ''}
                  onChange={(e) => updateField('companyName', e.target.value)}
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
                <label className={labelClass}>Segmento</label>
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

          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading text-base font-bold text-slate-800">Contato</h2>
              <p className="mt-1 text-xs text-slate-400">
                Dados da pessoa responsável pelo contato comercial.
              </p>
            </div>
            <div className="form-section-body lg:grid-cols-3">
              <div>
                <label className={labelClass}>Nome</label>
                <input
                  className={inputClass}
                  value={form.contactName ?? ''}
                  onChange={(e) => updateField('contactName', e.target.value)}
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
                  onChange={(e) => {
                    const sourceId = e.target.value || undefined;
                    updateField('sourceId', sourceId);
                    const source = sources.find((item) => item.id === sourceId);
                    if (source?.name.trim().toLocaleLowerCase('pt-BR') !== 'parceiro') {
                      updateField('partnerId', undefined);
                    }
                  }}
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
                <label className={labelClass}>Tipo de projeto</label>
                <select
                  className={inputClass}
                  value={form.projectTypeId ?? ''}
                  onChange={(e) => updateField('projectTypeId', e.target.value || undefined)}
                >
                  <option value="">—</option>
                  {projectTypes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Parceiro indicador</label>
                <select
                  disabled={!isPartnerSource}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                  value={form.partnerId ?? ''}
                  onChange={(e) => updateField('partnerId', e.target.value || undefined)}
                >
                  <option value="">
                    {isPartnerSource ? 'Selecione o parceiro…' : 'Disponível para origem Parceiro'}
                  </option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
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
              <h2 className="font-heading text-base font-bold text-slate-800">
                Informações do negócio
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Valores, estimativas e detalhes para apoiar a negociação.
              </p>
            </div>
            <div className="form-section-body lg:grid-cols-3">
              <div>
                <label className={labelClass}>Valor estimado (R$)</label>
                <CurrencyInput
                  className={inputClass}
                  value={form.estimatedValue}
                  onValueChange={(value) => updateField('estimatedValue', value)}
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
              onClick={() => navigate(isEditing ? `/leads/${id}` : '/leads')}
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
      </div>
    </AppShell>
  );
}
