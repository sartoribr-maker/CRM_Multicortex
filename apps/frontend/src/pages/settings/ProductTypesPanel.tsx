import { FormEvent, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { formatCurrency } from '../../lib/formatters';
import { projectTypesApi, servicesApi } from '../../lib/settingsApi';
import type { ProjectType, ServiceCatalogItem } from '../../types/settings';
import { SERVICE_UNIT_LABELS } from './ServicesPanel';

type Draft = { name: string; description: string; serviceIds: string[] };
const emptyDraft: Draft = { name: '', description: '', serviceIds: [] };

export function ProductTypesPanel() {
  const [items, setItems] = useState<ProjectType[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [types, catalog] = await Promise.all([projectTypesApi.list(), servicesApi.list()]);
      setItems(types);
      setServices(catalog);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tipos de produto.');
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  function edit(item: ProjectType) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      description: item.description ?? '',
      serviceIds: item.services.map(({ service }) => service.id),
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (editingId === 'new') await projectTypesApi.create(draft);
      else if (editingId) await projectTypesApi.update(editingId, draft);
      setEditingId(null);
      setDraft(emptyDraft);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tipo de produto.');
    }
  }
  async function archive(id: string) {
    if (!window.confirm('Arquivar este tipo de produto?')) return;
    try {
      await projectTypesApi.archive(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao arquivar.');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-brand-purple-dark">
            Tipos de Produto
          </h2>
          <p className="text-sm text-ink/70">
            Produtos comercializados e serviços embarcados em cada um.
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
            Novo tipo
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
          <div className="md:col-span-2">
            <label className="form-label">Serviços embarcados</label>
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2 hover:bg-purple-50"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.serviceIds.includes(service.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          serviceIds: e.target.checked
                            ? [...draft.serviceIds, service.id]
                            : draft.serviceIds.filter((id) => id !== service.id),
                        })
                      }
                    />
                    {service.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatCurrency(service.price)}/{SERVICE_UNIT_LABELS[service.billingUnit]}
                  </span>
                </label>
              ))}
              {!services.length && (
                <p className="text-sm text-slate-500">
                  Cadastre serviços antes de montar o produto.
                </p>
              )}
            </div>
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
              <th>Tipo de produto</th>
              <th>Descrição</th>
              <th>Serviços embarcados</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="font-semibold text-slate-800">{item.name}</td>
                <td>{item.description || '—'}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.services.map(({ service }) => (
                      <span
                        key={service.id}
                        className="rounded-full bg-purple-50 px-2 py-1 text-xs text-brand-purple-dark"
                      >
                        {service.name}
                      </span>
                    ))}
                    {!item.services.length && '—'}
                  </div>
                </td>
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
                <td colSpan={4} className="text-center text-sm text-slate-500">
                  Nenhum tipo de produto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
