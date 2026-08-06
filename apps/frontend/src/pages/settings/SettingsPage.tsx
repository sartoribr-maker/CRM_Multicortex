import { AppShell, PageHeader } from '../../components/AppShell';
import { ColorOrderedListPanel } from './ColorOrderedListPanel';
import { SimpleCatalogPanel } from './SimpleCatalogPanel';
import { CustomFieldsPanel } from './CustomFieldsPanel';
import {
  stagesApi,
  prioritiesApi,
  dealSizesApi,
  sourcesApi,
  segmentsApi,
  projectTypesApi,
} from '../../lib/settingsApi';
import type { DealSize, Priority, ProjectType, Segment, Source, Stage } from '../../types/settings';

export type SettingsSection =
  'stages' | 'priorities' | 'dealSizes' | 'sources' | 'segments' | 'projectTypes' | 'customFields';

const SECTIONS: Record<SettingsSection, { title: string; description: string }> = {
  stages: {
    title: 'Etapas do Funil',
    description: 'Configure as colunas e regras de fechamento do pipeline comercial.',
  },
  priorities: {
    title: 'Prioridades',
    description: 'Configure os níveis de urgência das oportunidades.',
  },
  dealSizes: {
    title: 'Portes do Negócio',
    description: 'Configure as faixas de valor usadas na classificação comercial.',
  },
  sources: {
    title: 'Origens do Lead',
    description: 'Configure os canais de entrada das oportunidades.',
  },
  segments: {
    title: 'Segmentos de Mercado',
    description: 'Mantenha as opções disponíveis no cadastro de empresas e oportunidades.',
  },
  projectTypes: {
    title: 'Tipos de Projeto',
    description: 'Configure as categorias de produtos e projetos vendidos.',
  },
  customFields: {
    title: 'Campos Personalizados',
    description: 'Configure informações adicionais para o cadastro de leads.',
  },
};

export default function SettingsPage({ section }: { section: SettingsSection }) {
  const page = SECTIONS[section];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageHeader eyebrow="Configurações" title={page.title} description={page.description} />

        <div className="card p-5 md:p-7">
          {section === 'stages' && (
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
                  {item.isWonStage && (
                    <span className="text-xs font-semibold text-success">GANHO</span>
                  )}
                  {item.isLostStage && (
                    <span className="text-xs font-semibold text-danger">PERDIDO</span>
                  )}
                </>
              )}
            />
          )}

          {section === 'priorities' && (
            <ColorOrderedListPanel<Priority>
              title="Prioridades"
              description="Nível de urgência atribuído a cada oportunidade."
              itemNoun="prioridade"
              api={prioritiesApi}
              emptyDraft={{ name: '', color: '#EAC634' }}
            />
          )}

          {section === 'dealSizes' && (
            <ColorOrderedListPanel<DealSize>
              title="Porte do Negócio"
              description="Faixas de valor estimado usadas para classificar oportunidades."
              itemNoun="porte"
              api={dealSizesApi}
              emptyDraft={{ name: '', color: '#4A80C0', minValue: null, maxValue: null }}
              renderExtraFormFields={(draft, setDraft) => (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-ink">
                      Valor mínimo (R$)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
                      value={draft.minValue ?? ''}
                      onChange={(e) =>
                        setDraft({
                          minValue: e.target.value === '' ? null : Number(e.target.value),
                        })
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
                        setDraft({
                          maxValue: e.target.value === '' ? null : Number(e.target.value),
                        })
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

          {section === 'sources' && (
            <SimpleCatalogPanel<Source>
              title="Origem do Lead"
              description="De onde o lead veio (indicação, site, evento, etc.)."
              itemNoun="origem"
              api={sourcesApi}
              emptyDraft={{ name: '', description: '' }}
            />
          )}

          {section === 'segments' && (
            <SimpleCatalogPanel<Segment>
              title="Segmentos de Mercado"
              description="Principais setores de atuação dos clientes e prospects."
              itemNoun="segmento"
              api={segmentsApi}
              emptyDraft={{ name: '', description: '' }}
            />
          )}

          {section === 'projectTypes' && (
            <SimpleCatalogPanel<ProjectType>
              title="Tipos de Projeto"
              description="Categorias de projeto/produto vendido."
              itemNoun="tipo de projeto"
              api={projectTypesApi}
              emptyDraft={{ name: '', description: '' }}
            />
          )}

          {section === 'customFields' && <CustomFieldsPanel />}
        </div>
      </div>
    </AppShell>
  );
}
