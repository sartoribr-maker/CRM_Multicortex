import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { leadsApi, type CustomFieldValueInput, type LeadFormPayload } from '../../lib/leadsApi';
import { stagesApi, prioritiesApi, dealSizesApi, sourcesApi, projectTypesApi } from '../../lib/settingsApi';
import { usersApi, type UserOption } from '../../lib/usersApi';
import { useAuthStore } from '../../store/useAuthStore';
import { CustomFieldsFormSection } from '../../components/CustomFieldsFormSection';
import { LEAD_PERIODICITY_LABELS, type LeadPeriodicity } from '../../types/leads';
import type { DealSize, Priority, ProjectType, Source, Stage } from '../../types/settings';

const inputClass =
  'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';
const labelClass = 'mb-1 block text-sm font-medium text-ink';

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
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [form, setForm] = useState<LeadFormPayload>({ name: '' });
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValueInput[]>([]);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);

  useEffect(() => {
    stagesApi.list().then(setStages);
    prioritiesApi.list().then(setPriorities);
    dealSizesApi.list().then(setDealSizes);
    sourcesApi.list().then(setSources);
    projectTypesApi.list().then(setProjectTypes);
    if (canViewAll) usersApi.list().then(setUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          successProbability: lead.successProbability ?? undefined,
          estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : undefined,
          periodicity: lead.periodicity,
          expectedCloseDate: lead.expectedCloseDate?.slice(0, 10),
          ownerId: lead.owner.id,
          description: lead.description ?? undefined,
        });
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink/60">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="flex items-center justify-between bg-brand-purple-dark px-6 py-4 text-white">
        <img src={logo} alt="Multicortex" className="h-8" />
        <Link
          to={isEditing ? `/leads/${id}` : '/leads'}
          className="rounded-card border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
        >
          Cancelar
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-heading text-2xl font-bold text-brand-purple-dark">
          {isEditing ? 'Editar Lead' : 'Novo Lead'}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Dados gerais</h2>
            <div>
              <label className={labelClass}>Nome do lead/oportunidade *</label>
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div>
              <label className={labelClass}>Segmento</label>
              <input
                className={inputClass}
                value={form.companySegment ?? ''}
                onChange={(e) => updateField('companySegment', e.target.value)}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Contato</h2>
            <div className="grid grid-cols-3 gap-4">
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
                <input
                  className={inputClass}
                  value={form.contactPhone ?? ''}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Classificação</h2>
            <div className="grid grid-cols-2 gap-4">
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
              {canViewAll && (
                <div>
                  <label className={labelClass}>Responsável</label>
                  <select
                    className={inputClass}
                    value={form.ownerId ?? ''}
                    onChange={(e) => updateField('ownerId', e.target.value || undefined)}
                  >
                    <option value="">Eu mesmo</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedStage?.isLostStage && (
              <div>
                <label className={labelClass}>Motivo da perda *</label>
                <input
                  required
                  className={inputClass}
                  value={form.lossReason ?? ''}
                  onChange={(e) => updateField('lossReason', e.target.value)}
                />
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">Negócio</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Valor estimado (R$)</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.estimatedValue ?? ''}
                  onChange={(e) =>
                    updateField('estimatedValue', e.target.value === '' ? undefined : Number(e.target.value))
                  }
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
            </div>
            <div>
              <label className={labelClass}>Previsão de fechamento</label>
              <input
                type="date"
                className={inputClass}
                value={form.expectedCloseDate ?? ''}
                onChange={(e) => updateField('expectedCloseDate', e.target.value || undefined)}
              />
            </div>
            <div>
              <label className={labelClass}>Descrição / notas</label>
              <textarea
                rows={3}
                className={inputClass}
                value={form.description ?? ''}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>
          </section>

          <CustomFieldsFormSection values={customFieldValues} onChange={setCustomFieldValues} />

          {error && (
            <p className="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-card bg-brand-purple px-5 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
