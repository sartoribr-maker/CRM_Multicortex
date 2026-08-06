import { FormEvent, ReactNode, useEffect, useState } from 'react';

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

const inputClass =
  'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCreate() {
    setDraft(emptyDraft);
    setEditingId('new');
  }

  function startEdit(item: T) {
    setDraft(item);
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
        await api.create(draft);
      } else if (editingId) {
        await api.update(editingId, draft);
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
          <button
            onClick={startCreate}
            className="whitespace-nowrap rounded-card bg-brand-purple px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
          >
            + Nova {itemNoun}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {editingId !== null && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-3 rounded-card border border-surface-muted p-4"
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
            <button
              type="submit"
              className="rounded-card bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-card border border-surface-muted px-4 py-2 text-sm text-ink hover:bg-surface-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-ink/60">Carregando…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-surface-muted last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{item.name}</td>
                  <td className="py-2 pr-3 text-ink/70">{item.description}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => startEdit(item)}
                      className="mr-3 text-sm text-brand-blue hover:text-brand-blue-dark"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleArchive(item.id)}
                      className="text-sm text-danger hover:text-danger/80"
                    >
                      Arquivar
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
