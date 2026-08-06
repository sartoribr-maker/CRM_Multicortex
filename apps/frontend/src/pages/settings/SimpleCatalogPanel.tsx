import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';

interface BaseCatalogItem {
  id: string;
  name: string;
  description: string | null;
  deletedAt: string | null;
}

interface SimpleCatalogApi<T extends BaseCatalogItem> {
  list: (includeArchived?: boolean) => Promise<T[]>;
  create: (payload: Partial<T>) => Promise<T>;
  update: (id: string, payload: Partial<T>) => Promise<T>;
  archive: (id: string) => Promise<T>;
}

interface SimpleCatalogPanelProps<T extends BaseCatalogItem> {
  title: string;
  description: string;
  itemNoun: string;
  api: SimpleCatalogApi<T>;
  emptyDraft: Partial<T>;
  renderExtraFormFields?: (draft: Partial<T>, setDraft: (patch: Partial<T>) => void) => ReactNode;
}

const inputClass = 'form-control';

export function SimpleCatalogPanel<T extends BaseCatalogItem>({
  title,
  description,
  itemNoun,
  api,
  emptyDraft,
  renderExtraFormFields,
}: SimpleCatalogPanelProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Partial<T>>(emptyDraft);

  function editablePayload(source: Partial<T>): Partial<T> {
    return Object.keys(emptyDraft).reduce<Partial<T>>((payload, key) => {
      const typedKey = key as keyof T;
      payload[typedKey] = source[typedKey];
      return payload;
    }, {});
  }

  async function refresh() {
    setIsLoading(true);
    try {
      setItems(await api.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function startCreate() {
    setDraft(emptyDraft);
    setEditingId('new');
  }

  function startEdit(item: T) {
    setDraft(editablePayload(item));
    setEditingId(item.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (editingId === 'new') {
        await api.create(editablePayload(draft));
      } else if (editingId) {
        await api.update(editingId, editablePayload(draft));
      }
      cancelEdit();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    }
  }

  async function handleArchive(id: string) {
    setError(null);
    try {
      await api.archive(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao arquivar.');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-brand-purple-dark">{title}</h2>
          <p className="text-sm text-ink/70">{description}</p>
        </div>
        {editingId === null && (
          <button onClick={startCreate} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Nova {itemNoun}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {editingId !== null && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 flex flex-col gap-4 rounded-2xl border border-brand-purple/15 bg-purple-50/30 p-5"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Nome</label>
            <input
              required
              className={inputClass}
              value={draft.name ?? ''}
              onChange={(e) => setDraft({ ...draft, name: e.target.value } as Partial<T>)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Descrição</label>
            <input
              className={inputClass}
              value={draft.description ?? ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value } as Partial<T>)}
            />
          </div>

          {renderExtraFormFields?.(draft, (patch) => setDraft({ ...draft, ...patch }))}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Salvar
            </button>
            <button type="button" onClick={cancelEdit} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        {isLoading ? (
          <p className="text-sm text-ink/60">Carregando…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-surface-muted last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{item.name}</td>
                  <td className="py-2 pr-3 text-ink/70">{item.description}</td>
                  <td className="py-2 text-right">
                    <button title="Editar" onClick={() => startEdit(item)} className="icon-button">
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      title="Arquivar"
                      onClick={() => handleArchive(item.id)}
                      className="icon-button hover:!bg-red-50 hover:!text-red-600"
                    >
                      <Icon name="archive" className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-sm text-ink/50">
                    Nenhum item cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
