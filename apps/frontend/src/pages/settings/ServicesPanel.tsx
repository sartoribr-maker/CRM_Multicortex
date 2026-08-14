import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { CurrencyInput } from '../../components/MaskedInputs';
import { formatCurrency } from '../../lib/formatters';
import { servicesApi } from '../../lib/settingsApi';
import type { ServiceBillingUnit, ServiceCatalogItem } from '../../types/settings';

export const SERVICE_UNIT_LABELS: Record<ServiceBillingUnit, string> = {
  MONTH: 'mês',
  HOUR: 'hora',
  ONE_TIME: 'único',
};

type Draft = { name: string; description: string; price?: number; billingUnit: ServiceBillingUnit };
const emptyDraft: Draft = { name: '', description: '', price: undefined, billingUnit: 'MONTH' };

export function ServicesPanel() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await servicesApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar serviços.');
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  function edit(item: ServiceCatalogItem) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      description: item.description ?? '',
      price: Number(item.price),
      billingUnit: item.billingUnit,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.price === undefined) return setError('Informe o valor do serviço.');
    setError(null);
    try {
      if (editingId === 'new') await servicesApi.create(draft);
      else if (editingId) await servicesApi.update(editingId, draft);
      setEditingId(null);
      setDraft(emptyDraft);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar serviço.');
    }
  }

  async function archive(id: string) {
    if (
      !window.confirm('Arquivar este serviço? Os tipos de produto existentes manterão o vínculo.')
    )
      return;
    try {
      await servicesApi.archive(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao arquivar serviço.');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-brand-purple-dark">Serviços</h2>
          <p className="text-sm text-ink/70">
            Catálogo de serviços, preços e unidades de cobrança.
          </p>
        </div>
        {!editingId && (
          <button
            className="btn-primary"
            onClick={() => {
              setEditingId('new');
              setDraft(emptyDraft);
            }}
          >
            <Icon name="plus" className="h-4 w-4" />
            Novo serviço
          </button>
        )}
      </div>
      {error && (
        <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      {editingId && (
        <form
          onSubmit={submit}
          className="mt-5 grid gap-4 rounded-2xl border border-brand-purple/15 bg-purple-50/30 p-5 md:grid-cols-2"
        >
          <div>
            <label className="form-label">Nome</label>
            <input
              required
              className="form-control"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Descrição</label>
            <input
              className="form-control"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Valor</label>
            <CurrencyInput
              required
              className="form-control"
              value={draft.price}
              onValueChange={(price) => setDraft({ ...draft, price })}
            />
          </div>
          <div>
            <label className="form-label">Unidade de cobrança</label>
            <select
              className="form-control"
              value={draft.billingUnit}
              onChange={(e) =>
                setDraft({ ...draft, billingUnit: e.target.value as ServiceBillingUnit })
              }
            >
              <option value="MONTH">Por mês</option>
              <option value="HOUR">Por hora</option>
              <option value="ONE_TIME">Valor único</option>
            </select>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button className="btn-primary">Salvar</button>
            <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Tipos de produto</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="font-semibold text-slate-800">{item.name}</td>
                <td>{item.description || '—'}</td>
                <td className="whitespace-nowrap">
                  {formatCurrency(item.price)}/{SERVICE_UNIT_LABELS[item.billingUnit]}
                </td>
                <td>{item._count?.projectTypes ?? 0}</td>
                <td className="text-right">
                  <button className="icon-button" title="Editar" onClick={() => edit(item)}>
                    <Icon name="edit" className="h-4 w-4" />
                  </button>
                  <button
                    className="icon-button hover:!bg-red-50 hover:!text-red-600"
                    title="Arquivar"
                    onClick={() => archive(item.id)}
                  >
                    <Icon name="archive" className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="text-center text-sm text-slate-500">
                  Nenhum serviço cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
