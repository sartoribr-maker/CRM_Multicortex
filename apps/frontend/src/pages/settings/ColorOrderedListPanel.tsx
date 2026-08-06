import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';

interface BaseColorItem {
  id: string;
  name: string;
  color: string;
  order: number;
  deletedAt: string | null;
}

interface ColorOrderedApi<T extends BaseColorItem> {
  list: (includeArchived?: boolean) => Promise<T[]>;
  create: (payload: Partial<T>) => Promise<T>;
  update: (id: string, payload: Partial<T>) => Promise<T>;
  archive: (id: string) => Promise<T>;
  reorder?: (orderedIds: string[]) => Promise<T[]>;
}

interface ColorOrderedListPanelProps<T extends BaseColorItem> {
  title: string;
  description: string;
  itemNoun: string;
  api: ColorOrderedApi<T>;
  emptyDraft: Partial<T>;
  renderExtraFormFields?: (draft: Partial<T>, setDraft: (patch: Partial<T>) => void) => ReactNode;
  renderExtraColumns?: (item: T) => ReactNode;
}

const inputClass = 'form-control';

export function ColorOrderedListPanel<T extends BaseColorItem>({
  title,
  description,
  itemNoun,
  api,
  emptyDraft,
  renderExtraFormFields,
  renderExtraColumns,
}: ColorOrderedListPanelProps<T>) {
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
      const data = await api.list();
      setItems(data);
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

  async function handleMove(index: number, direction: -1 | 1) {
    if (!api.reorder) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const reordered = [...items];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setItems(reordered);

    try {
      await api.reorder(reordered.map((item) => item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reordenar.');
      await refresh();
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
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-ink">Nome</label>
              <input
                required
                className={inputClass}
                value={draft.name ?? ''}
                onChange={(e) => setDraft({ ...draft, name: e.target.value } as Partial<T>)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Cor</label>
              <input
                type="color"
                required
                className="h-[38px] w-14 rounded-card border border-surface-muted"
                value={draft.color ?? '#74529F'}
                onChange={(e) => setDraft({ ...draft, color: e.target.value } as Partial<T>)}
              />
            </div>
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
                <th>Cor</th>
                <th>Nome</th>
                {renderExtraColumns && <th>Classificação</th>}
                <th className="text-right">Ordem</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-surface-muted last:border-0">
                  <td className="py-2 pr-3">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </td>
                  <td className="py-2 pr-3 font-medium text-ink">{item.name}</td>
                  {renderExtraColumns && <td className="py-2 pr-3">{renderExtraColumns(item)}</td>}
                  <td className="py-2 pr-3 text-right">
                    {api.reorder && (
                      <>
                        <button
                          onClick={() => handleMove(index, -1)}
                          disabled={index === 0}
                          className="px-1 text-ink/60 hover:text-ink disabled:opacity-30"
                          aria-label="Mover para cima"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMove(index, 1)}
                          disabled={index === items.length - 1}
                          className="px-1 text-ink/60 hover:text-ink disabled:opacity-30"
                          aria-label="Mover para baixo"
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </td>
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
                  <td colSpan={5} className="py-4 text-center text-sm text-ink/50">
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
