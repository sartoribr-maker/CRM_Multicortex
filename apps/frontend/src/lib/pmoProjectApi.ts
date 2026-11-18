import { apiJson } from './api';

export interface PmoConfig {
  enabled: boolean;
  url: string | null;
}

/** Dados da oportunidade aproveitados no cadastro do projeto no PMO. */
export interface PmoProjectDraft {
  name: string;
  businessCode?: string | null;
  companyName?: string | null;
  contactName?: string | null;
  description?: string | null;
  projectTypeNames?: string[];
}

export const pmoApi = {
  config: () => apiJson<PmoConfig>('/pmo/config'),
};

/** Dia de hoje em Brasília (AAAA-MM-DD). */
function todayInBrasilia() {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Link do formulário "Novo projeto" do PMO, preenchido com os dados da oportunidade.
 * O PMO lê os parâmetros só como valores iniciais: o usuário revisa e completa antes de salvar.
 */
export function pmoNewProjectUrl(baseUrl: string, lead: PmoProjectDraft): string {
  const origin = [lead.businessCode, lead.companyName].filter(Boolean).join(' · ');
  const objective = [
    `Projeto originado da oportunidade ${origin || lead.name} ganha no CRM.`,
    lead.description?.trim(),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 2000);
  const sponsor = [lead.contactName, lead.companyName].filter(Boolean).join(' — ').slice(0, 120);
  const params = new URLSearchParams({
    origem: 'crm',
    name: lead.name.slice(0, 160),
    objective,
    plannedStart: todayInBrasilia(),
  });
  if (sponsor) params.set('sponsor', sponsor);
  if (lead.projectTypeNames?.length) {
    params.set('scope', `Tipos de projeto (CRM): ${lead.projectTypeNames.join(', ')}.`);
  }
  if (lead.businessCode) params.set('crmLead', lead.businessCode);
  return `${baseUrl.replace(/\/$/, '')}/projects/novo?${params}`;
}

/** Ação sugerida na movimentação quando a pessoa decide criar o projeto. */
export const PROJECT_CONVERSION_ACTION =
  'Oportunidade ganha e encaminhada para cadastro como projeto no Multicortex Projetos.';
