import { FormEvent, useEffect, useState } from 'react';
import { customFieldsApi } from '../../lib/settingsApi';
import { Icon } from '../../components/Icon';
import {
  CUSTOM_FIELD_TYPE_LABELS,
  type CustomField,
  type CustomFieldType,
} from '../../types/settings';

const inputClass = 'form-control';

const EMPTY_DRAFT: Partial<CustomField> = {
  name: '',
  type: 'TEXT',
  options: [],
  isRequired: false,
  showInForm: true,
  showInKanbanCard: false,
  showInFilters: false,
};

const SELECT_TYPES: CustomFieldType[] = ['SINGLE_SELECT', 'MULTI_SELECT'];

export function CustomFieldsPanel() {
  const [items, setItems] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Partial<CustomField>>(EMPTY_DRAFT);
  const [optionsText, setOptionsText] = useState('');

  async function refresh() {
    setIsLoading(true);
    try {
      setItems(await customFieldsApi.list());
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
    setDraft(EMPTY_DRAFT);
    setOptionsText('');
    setEditingId('new');
  }

  function startEdit(item: CustomField) {
    setDraft({
      name: item.name,
      type: item.type,
      options: item.options,
      isRequired: item.isRequired,
      showInForm: item.showInForm,
      showInKanbanCard: item.showInKanbanCard,
      showInFilters: item.showInFilters,
    });
    setOptionsText((item.options ?? []).join(', '));
    setEditingId(item.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setOptionsText('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const payload: Partial<CustomField> = {
      name: draft.name,
      type: draft.type,
      isRequired: draft.isRequired,
      showInForm: draft.showInForm,
      showInKanbanCard: draft.showInKanbanCard,
      showInFilters: draft.showInFilters,
      options: SELECT_TYPES.includes(draft.type as CustomFieldType)
        ? optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined,
    };

    try {
      if (editingId === 'new') {
        await customFieldsApi.create(payload);
      } else if (editingId) {
        await customFieldsApi.update(editingId, payload);
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
      await customFieldsApi.archive(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao arquivar.');
    }
  }

  const isSelectType = SELECT_TYPES.includes(draft.type as CustomFieldType);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-brand-purple-dark">
            Campos Customizados
          </h2>
          <p className="text-sm text-ink/70">
            Campos extras exibidos no cadastro de Leads (a partir da Fase 3).
          </p>
        </div>
        {editingId === null && (
          <button onClick={startCreate} className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Novo campo
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
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Tipo</label>
              <select
                className={inputClass}
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as CustomFieldType })}
              >
                {Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isSelectType && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                Opções (separadas por vírgula)
              </label>
              <input
                required
                className={inputClass}
                placeholder="Ex.: Varejo, Indústria, Serviços"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-ink">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isRequired ?? false}
                onChange={(e) => setDraft({ ...draft, isRequired: e.target.checked })}
              />
              Obrigatório
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showInForm ?? true}
                onChange={(e) => setDraft({ ...draft, showInForm: e.target.checked })}
              />
              Exibir no formulário
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showInKanbanCard ?? false}
                onChange={(e) => setDraft({ ...draft, showInKanbanCard: e.target.checked })}
              />
              Exibir no card do Kanban
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showInFilters ?? false}
                onChange={(e) => setDraft({ ...draft, showInFilters: e.target.checked })}
              />
              Exibir nos filtros
            </label>
          </div>

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
                <th>Tipo</th>
                <th>Exibição</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-surface-muted last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{item.name}</td>
                  <td className="py-2 pr-3 text-ink/70">{CUSTOM_FIELD_TYPE_LABELS[item.type]}</td>
                  <td className="py-2 pr-3 text-ink/70">
                    {item.isRequired && <span className="mr-2">Obrigatório</span>}
                    {item.showInKanbanCard && <span className="mr-2">No Kanban</span>}
                    {item.showInFilters && <span>Nos filtros</span>}
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
                  <td colSpan={4} className="py-4 text-center text-sm text-ink/50">
                    Nenhum campo customizado cadastrado ainda.
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
