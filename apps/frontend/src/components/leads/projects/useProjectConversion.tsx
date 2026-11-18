import { useEffect, useState } from 'react';
import { leadsApi } from '../../../lib/leadsApi';
import {
  pmoApi,
  pmoNewProjectUrl,
  PROJECT_CONVERSION_ACTION,
  type PmoConfig,
  type PmoProjectDraft,
} from '../../../lib/pmoProjectApi';
import type { LeadListItem } from '../../../types/leads';
import type { Stage } from '../../../types/settings';
import { Icon } from '../../Icon';

/** Endereço do PMO (uma consulta por tela); `null` desliga a pergunta. */
export function usePmoConfig() {
  const [config, setConfig] = useState<PmoConfig | null>(null);
  useEffect(() => {
    pmoApi
      .config()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);
  return config?.enabled && config.url ? config.url : null;
}

/** Abre o formulário "Novo projeto" do PMO em outra aba (precisa ser chamado no clique). */
export function openPmoNewProject(pmoUrl: string, draft: PmoProjectDraft) {
  window.open(pmoNewProjectUrl(pmoUrl, draft), '_blank', 'noopener,noreferrer');
}

export function ConvertToProjectDialog({
  leadName,
  stageName,
  onConvert,
  onSkip,
  onCancel,
}: {
  leadName: string;
  stageName: string;
  onConvert: () => void;
  onSkip: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="mobile-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-project-title"
        className="mobile-modal-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Icon name="external" className="h-5 w-5" />
        </div>
        <h2
          id="convert-project-title"
          className="mt-4 font-heading text-xl font-bold text-slate-900"
        >
          Transformar em projeto?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          <strong className="text-slate-700">{leadName}</strong> está indo para {stageName}. Deseja
          transformar esta oportunidade em um projeto no Multicortex Projetos?
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          O cadastro do projeto abre em outra aba, já preenchido com os dados da oportunidade.
          Revise e complete antes de salvar.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onSkip}>
            Não
          </button>
          <button type="button" className="btn-primary" autoFocus onClick={onConvert}>
            Sim, criar projeto
          </button>
        </div>
      </div>
    </div>
  );
}

function draftFrom(lead: LeadListItem, description?: string | null): PmoProjectDraft {
  return {
    name: lead.name,
    businessCode: lead.businessCode,
    companyName: lead.companyName,
    contactName: lead.contactName,
    description,
    projectTypeNames: lead.projectTypes.map((p) => p.projectType.name),
  };
}

interface MoveRequest {
  lead: LeadListItem;
  stage: Stage;
  actionDescription?: string;
}

/**
 * Ao mover uma oportunidade para uma etapa de ganho (`isWonStage`), pergunta se ela deve virar um
 * projeto no PMO. "Sim" abre o cadastro do projeto e sugere a ação da movimentação; "Não" segue a
 * movimentação normal (ação/justificativa de costume).
 */
export function useProjectConversion({
  onProceed,
}: {
  onProceed: (lead: LeadListItem, stage: Stage, actionDescription?: string) => void;
}) {
  const pmoUrl = usePmoConfig();
  const [prompt, setPrompt] = useState<MoveRequest | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  function startMove(lead: LeadListItem, stage: Stage, actionDescription?: string) {
    if (!pmoUrl || !stage.isWonStage) {
      onProceed(lead, stage, actionDescription);
      return;
    }
    setDescription(null);
    setPrompt({ lead, stage, actionDescription });
    // A descrição não vem na listagem: busca enquanto a pessoa lê a pergunta.
    leadsApi
      .get(lead.id)
      .then((detail) => setDescription(detail.description))
      .catch(() => undefined);
  }

  const modals = prompt && pmoUrl && (
    <ConvertToProjectDialog
      leadName={prompt.lead.name}
      stageName={prompt.stage.name}
      onCancel={() => setPrompt(null)}
      onSkip={() => {
        setPrompt(null);
        onProceed(prompt.lead, prompt.stage, prompt.actionDescription);
      }}
      onConvert={() => {
        openPmoNewProject(pmoUrl, draftFrom(prompt.lead, description));
        setPrompt(null);
        onProceed(
          prompt.lead,
          prompt.stage,
          [prompt.actionDescription, PROJECT_CONVERSION_ACTION].filter(Boolean).join(' '),
        );
      }}
    />
  );

  return { startMove, modals };
}
