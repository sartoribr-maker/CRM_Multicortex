import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { ColorOrderedListPanel } from './ColorOrderedListPanel';
import { SimpleCatalogPanel } from './SimpleCatalogPanel';
import { CustomFieldsPanel } from './CustomFieldsPanel';
import { stagesApi, prioritiesApi, dealSizesApi, sourcesApi, projectTypesApi } from '../../lib/settingsApi';
import type { DealSize, Priority, ProjectType, Source, Stage } from '../../types/settings';

type TabKey = 'stages' | 'priorities' | 'dealSizes' | 'sources' | 'projectTypes' | 'customFields';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'stages', label: 'Etapas do Funil' },
  { key: 'priorities', label: 'Prioridades' },
  { key: 'dealSizes', label: 'Porte do Negócio' },
  { key: 'sources', label: 'Origem do Lead' },
  { key: 'projectTypes', label: 'Tipos de Projeto' },
  { key: 'customFields', label: 'Campos Customizados' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('stages');

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="flex items-center justify-between bg-brand-purple-dark px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Multicortex" className="h-8" />
        </div>
        <Link
          to="/"
          className="rounded-card border border-white/30 px-3 py-1.5 text-sm transition hover:bg-white/10"
        >
          Voltar
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-heading text-2xl font-bold text-brand-purple-dark">Configurações</h1>
        <p className="mt-1 text-sm text-ink/70">
          Gerencie as listas usadas pelo funil de vendas e pelo cadastro de leads.
        </p>

        <div className="mt-6 flex flex-wrap gap-1 border-b border-surface-muted">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-t-card px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-b-2 border-brand-purple text-brand-purple-dark'
                  : 'text-ink/60 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-card bg-surface p-6 shadow-sm">
          {activeTab === 'stages' && (
            <ColorOrderedListPanel<Stage>
              title="Etapas do Funil"
              description="Colunas do Kanban de vendas, na ordem em que aparecem."
              itemNoun="etapa"
              api={stagesApi}
              emptyDraft={{ name: '', color: '#74529F', isWonStage: false, isLostStage: false }}
              renderExtraFormFields={(draft, setDraft) => (
                <div className="flex gap-4 text-sm text-ink">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.isWonStage ?? false}
                      onChange={(e) => setDraft({ isWonStage: e.target.checked })}
                    />
                    Etapa de ganho
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.isLostStage ?? false}
                      onChange={(e) => setDraft({ isLostStage: e.target.checked })}
                    />
                    Etapa de perda
                  </label>
                </div>
              )}
              renderExtraColumns={(item) => (
                <>
                  {item.isWonStage && <span className="text-xs font-semibold text-success">GANHO</span>}
                  {item.isLostStage && <span className="text-xs font-semibold text-danger">PERDIDO</span>}
                </>
              )}
            />
          )}

          {activeTab === 'priorities' && (
            <ColorOrderedListPanel<Priority>
              title="Prioridades"
              description="Nível de urgência atribuído a cada oportunidade."
              itemNoun="prioridade"
              api={prioritiesApi}
              emptyDraft={{ name: '', color: '#EAC634' }}
            />
          )}

          {activeTab === 'dealSizes' && (
            <ColorOrderedListPanel<DealSize>
              title="Porte do Negócio"
              description="Faixas de valor estimado usadas para classificar oportunidades."
              itemNoun="porte"
              api={dealSizesApi}
              emptyDraft={{ name: '', color: '#4A80C0', minValue: null, maxValue: null }}
              renderExtraFormFields={(draft, setDraft) => (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-ink">Valor mínimo (R$)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
                      value={draft.minValue ?? ''}
                      onChange={(e) =>
                        setDraft({ minValue: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-ink">
                      Valor máximo (R$, opcional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
                      value={draft.maxValue ?? ''}
                      onChange={(e) =>
                        setDraft({ maxValue: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              )}
              renderExtraColumns={(item) => (
                <span className="text-xs text-ink/60">
                  {item.minValue !== null ? `R$ ${item.minValue}` : 'R$ 0'} —{' '}
                  {item.maxValue !== null ? `R$ ${item.maxValue}` : 'sem limite'}
                </span>
              )}
            />
          )}

          {activeTab === 'sources' && (
            <SimpleCatalogPanel<Source>
              title="Origem do Lead"
              description="De onde o lead veio (indicação, site, evento, etc.)."
              itemNoun="origem"
              api={sourcesApi}
              emptyDraft={{ name: '', description: '' }}
            />
          )}

          {activeTab === 'projectTypes' && (
            <SimpleCatalogPanel<ProjectType>
              title="Tipos de Projeto"
              description="Categorias de projeto/produto vendido."
              itemNoun="tipo de projeto"
              api={projectTypesApi}
              emptyDraft={{ name: '', description: '' }}
            />
          )}

          {activeTab === 'customFields' && <CustomFieldsPanel />}
        </div>
      </main>
    </div>
  );
}
