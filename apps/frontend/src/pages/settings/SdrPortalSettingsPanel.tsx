import { useEffect, useState, type FormEvent } from 'react';
import { sdrPortalApi } from '../../lib/sdrPortalApi';
import { sourcesApi, stagesApi } from '../../lib/settingsApi';
import type { SdrPortalSettingsPayload } from '../../types/sdrPortal';
import type { Source, Stage } from '../../types/settings';

function StageChecklist({
  stages,
  selected,
  onChange,
}: {
  stages: Stage[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="grid gap-1 rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
      {stages.map((stage) => (
        <label
          key={stage.id}
          className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-purple-50"
        >
          <input
            type="checkbox"
            checked={selected.includes(stage.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, stage.id]
                  : selected.filter((id) => id !== stage.id),
              )
            }
          />
          <span className="status-dot" style={{ backgroundColor: stage.color }} />
          {stage.name}
          {stage.isLostStage && <span className="text-[10px] text-slate-400">(perda)</span>}
        </label>
      ))}
    </div>
  );
}

export function SdrPortalSettingsPanel() {
  const [settings, setSettings] = useState<SdrPortalSettingsPayload | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([sdrPortalApi.getSettings(), stagesApi.list(), sourcesApi.list()])
      .then(([data, stageData, sourceData]) => {
        const activeStageIds = new Set(stageData.map((stage) => stage.id));
        // Etapas arquivadas depois da configuração deixam de ser exibidas e salvas.
        setSettings({
          visibleStageIds: data.visibleStageIds.filter((id) => activeStageIds.has(id)),
          allowedTargetStageIds: data.allowedTargetStageIds.filter((id) => activeStageIds.has(id)),
          qualifiedStageId:
            data.qualifiedStageId && activeStageIds.has(data.qualifiedStageId)
              ? data.qualifiedStageId
              : null,
          defaultSourceId: data.defaultSourceId,
          hideFinancialValues: data.hideFinancialValues,
          staleDays: data.staleDays,
        });
        setStages([...stageData].sort((a, b) => a.order - b.order));
        setSources(sourceData);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar configuração.'),
      );
  }, []);

  function update<K extends keyof SdrPortalSettingsPayload>(
    key: K,
    value: SdrPortalSettingsPayload[K],
  ) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setMessage('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await sdrPortalApi.updateSettings(settings);
      setSettings({
        visibleStageIds: saved.visibleStageIds,
        allowedTargetStageIds: saved.allowedTargetStageIds,
        qualifiedStageId: saved.qualifiedStageId,
        defaultSourceId: saved.defaultSourceId,
        hideFinancialValues: saved.hideFinancialValues,
        staleDays: saved.staleDays,
      });
      setMessage('Configuração salva. Os SDRs veem as mudanças ao recarregar o portal.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-slate-400">{error || 'Carregando…'}</p>;
  }

  const allowedStages = stages.filter((stage) => settings.allowedTargetStageIds.includes(stage.id));

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <h3 className="font-heading font-bold text-slate-800">Colunas do Kanban do SDR</h3>
        <p className="mb-3 mt-1 text-xs text-slate-400">
          O SDR vê apenas as oportunidades sob sua responsabilidade nestas etapas.
        </p>
        <StageChecklist
          stages={stages}
          selected={settings.visibleStageIds}
          onChange={(ids) => update('visibleStageIds', ids)}
        />
      </div>

      <div>
        <h3 className="font-heading font-bold text-slate-800">Destinos permitidos</h3>
        <p className="mb-3 mt-1 text-xs text-slate-400">
          Etapas para as quais o SDR pode mover uma oportunidade, incluindo a passagem para o
          comercial e, se desejado, a etapa de perda (desqualificação).
        </p>
        <StageChecklist
          stages={stages}
          selected={settings.allowedTargetStageIds}
          onChange={(ids) => {
            update('allowedTargetStageIds', ids);
            if (settings.qualifiedStageId && !ids.includes(settings.qualifiedStageId)) {
              update('qualifiedStageId', null);
            }
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Etapa de lead qualificado / reunião agendada</label>
          <select
            className="form-control"
            value={settings.qualifiedStageId ?? ''}
            onChange={(event) => update('qualifiedStageId', event.target.value || null)}
          >
            <option value="">Não definida</option>
            {allowedStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Marco de conversão do SDR no dashboard. Precisa ser um destino permitido.
          </p>
        </div>
        <div>
          <label className="form-label">Origem dos leads criados pelo SDR</label>
          <select
            className="form-control"
            value={settings.defaultSourceId ?? ''}
            onChange={(event) => update('defaultSourceId', event.target.value || null)}
          >
            <option value="">Não definida</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">Sem origem, o SDR não consegue criar leads.</p>
        </div>
        <div>
          <label className="form-label">Dias sem movimentação para lead parado</label>
          <input
            type="number"
            min={1}
            max={365}
            required
            className="form-control"
            value={settings.staleDays}
            onChange={(event) => update('staleDays', Number(event.target.value))}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={settings.hideFinancialValues}
            onChange={(event) => update('hideFinancialValues', event.target.checked)}
          />
          Ocultar valores financeiros (CAPEX, OPEX, valor estimado e probabilidade)
        </label>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </form>
  );
}
