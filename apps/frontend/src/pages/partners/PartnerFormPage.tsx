import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { PhoneInput } from '../../components/MaskedInputs';
import { partnersApi } from '../../lib/partnersApi';
import { PARTNER_TYPE_LABELS, type PartnerPayload, type PartnerType } from '../../types/partners';

export default function PartnerFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState<PartnerPayload>({
    name: '',
    type: 'REFERRAL',
    status: 'ACTIVE',
  });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    partnersApi
      .get(id)
      .then((item) =>
        setForm({
          name: item.name,
          legalName: item.legalName ?? undefined,
          type: item.type,
          document: item.document ?? undefined,
          contactName: item.contactName ?? undefined,
          email: item.email ?? undefined,
          phone: item.phone ?? undefined,
          website: item.website ?? undefined,
          commissionPercentage:
            item.commissionPercentage === null ? undefined : Number(item.commissionPercentage),
          status: item.status,
          notes: item.notes ?? undefined,
        }),
      )
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar parceiro.'))
      .finally(() => setLoading(false));
  }, [id]);
  function field<K extends keyof PartnerPayload>(key: K, value: PartnerPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = editing ? await partnersApi.update(id!, form) : await partnersApi.create(form);
      navigate(`/partners/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar parceiro.');
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg text-sm text-slate-400">
        Carregando…
      </div>
    );
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          eyebrow="Rede de parceiros"
          title={editing ? 'Editar parceiro' : 'Novo parceiro'}
          description="Mantenha os dados comerciais, contatos e condições da parceria atualizados."
          actions={
            <button
              className="btn-secondary"
              onClick={() => navigate(editing ? `/partners/${id}` : '/partners')}
            >
              <Icon name="x" className="h-4 w-4" />
              Cancelar
            </button>
          }
        />
        <form onSubmit={submit} className="flex flex-col gap-5">
          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading font-bold text-slate-800">Identificação</h2>
              <p className="mt-1 text-xs text-slate-400">
                Dados cadastrais e classificação do parceiro.
              </p>
            </div>
            <div className="form-section-body">
              <div>
                <label className="form-label">Nome fantasia *</label>
                <input
                  required
                  className="form-control"
                  value={form.name}
                  onChange={(e) => field('name', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Razão social</label>
                <input
                  className="form-control"
                  value={form.legalName ?? ''}
                  onChange={(e) => field('legalName', e.target.value || undefined)}
                />
              </div>
              <div>
                <label className="form-label">Tipo de parceria *</label>
                <select
                  required
                  className="form-control"
                  value={form.type}
                  onChange={(e) => field('type', e.target.value as PartnerType)}
                >
                  {Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">CNPJ/CPF</label>
                <input
                  className="form-control"
                  value={form.document ?? ''}
                  onChange={(e) => field('document', e.target.value || undefined)}
                />
              </div>
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading font-bold text-slate-800">Contato</h2>
              <p className="mt-1 text-xs text-slate-400">
                Pessoa e canais principais de relacionamento.
              </p>
            </div>
            <div className="form-section-body">
              <div>
                <label className="form-label">Pessoa de contato</label>
                <input
                  className="form-control"
                  value={form.contactName ?? ''}
                  onChange={(e) => field('contactName', e.target.value || undefined)}
                />
              </div>
              <div>
                <label className="form-label">E-mail</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email ?? ''}
                  onChange={(e) => field('email', e.target.value || undefined)}
                />
              </div>
              <div>
                <label className="form-label">Telefone</label>
                <PhoneInput
                  className="form-control"
                  value={form.phone}
                  onValueChange={(value) => field('phone', value || undefined)}
                />
              </div>
              <div>
                <label className="form-label">Website</label>
                <input
                  type="url"
                  placeholder="https://"
                  className="form-control"
                  value={form.website ?? ''}
                  onChange={(e) => field('website', e.target.value || undefined)}
                />
              </div>
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-header">
              <h2 className="font-heading font-bold text-slate-800">Condições comerciais</h2>
              <p className="mt-1 text-xs text-slate-400">
                Status, comissão padrão e observações internas.
              </p>
            </div>
            <div className="form-section-body">
              <div>
                <label className="form-label">Comissão padrão (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="form-control"
                  value={form.commissionPercentage ?? ''}
                  onChange={(e) =>
                    field(
                      'commissionPercentage',
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={form.status}
                  onChange={(e) => field('status', e.target.value as 'ACTIVE' | 'INACTIVE')}
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.notes ?? ''}
                  onChange={(e) => field('notes', e.target.value || undefined)}
                />
              </div>
            </div>
          </section>
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="sticky bottom-4 z-20 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
            <button type="button" className="btn-secondary" onClick={() => navigate('/partners')}>
              Cancelar
            </button>
            <button disabled={saving} className="btn-primary min-w-32">
              <Icon name="view" className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar parceiro'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
