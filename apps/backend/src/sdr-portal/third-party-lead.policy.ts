import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';

export interface SdrLeadPolicySettings {
  visibleStageIds: string[];
  allowedTargetStageIds: string[];
  hideFinancialValues: boolean;
}

/** Campos que o SDR pode enviar ao criar ou editar uma oportunidade. */
const PROSPECTING_FIELDS = [
  'line',
  'name',
  'companyName',
  'companyDocument',
  'companySegment',
  'contactName',
  'contactEmail',
  'contactPhone',
  'companyLocation',
  'companyLinkedinUrl',
  'companyWebsite',
  'companyPhone',
  'companySizeEstimate',
  'companyRevenue',
  'companyEmployeeCount',
  'contactPosition',
  'contactLinkedinUrl',
  'projectTypeId',
  'projectTypeIds',
  'priorityId',
  'description',
  'customFieldValues',
];

/** Campos da movimentação de etapa, permitidos apenas na edição. */
const MOVE_FIELDS = [
  'stageId',
  'actionDescription',
  'lossReason',
  'createTask',
  'taskDueDate',
  'taskPriority',
];

/** Editáveis pelo SDR somente quando os valores financeiros não estão ocultos. */
const FINANCIAL_INPUT_FIELDS = ['capexValue', 'opexValue', 'successProbability'];

/** Removidos das respostas da API quando os valores financeiros estão ocultos. */
const FINANCIAL_OUTPUT_FIELDS = [
  'capexValue',
  'opexValue',
  'estimatedValue',
  'technicalServiceValue',
  'successProbability',
];

export function isThirdParty(user: Pick<JwtPayload, 'portal'>): boolean {
  return user.portal === 'THIRD_PARTY';
}

export function assertThirdPartyLeadPayload(
  dto: object,
  mode: 'create' | 'update',
  settings: Pick<SdrLeadPolicySettings, 'hideFinancialValues'>,
): void {
  const allowed = new Set([
    ...PROSPECTING_FIELDS,
    ...(mode === 'update' ? MOVE_FIELDS : []),
    ...(settings.hideFinancialValues ? [] : FINANCIAL_INPUT_FIELDS),
  ]);
  const forbidden = Object.entries(dto)
    .filter(([key, value]) => value !== undefined && !allowed.has(key))
    .map(([key]) => key);
  if (forbidden.length > 0) {
    throw new ForbiddenException(`Campos não permitidos no Portal SDR: ${forbidden.join(', ')}.`);
  }
}

export function assertThirdPartyStageMove(
  targetStageId: string,
  settings: Pick<SdrLeadPolicySettings, 'allowedTargetStageIds'>,
): void {
  if (!settings.allowedTargetStageIds.includes(targetStageId)) {
    throw new ForbiddenException('Etapa de destino não permitida no Portal SDR.');
  }
}

function reducePartner(partner: unknown) {
  if (!partner || typeof partner !== 'object') return partner ?? null;
  const { id, name } = partner as { id: string; name: string };
  return { id, name };
}

/**
 * Prepara uma oportunidade para usuários THIRD_PARTY: parceiros sempre
 * reduzidos a id/nome e, se configurado, sem valores financeiros.
 */
export function sanitizeLeadForThirdParty<T extends object>(
  lead: T,
  settings: Pick<SdrLeadPolicySettings, 'hideFinancialValues'>,
): T {
  const result = { ...lead } as Record<string, unknown>;
  if ('partner' in result) result.partner = reducePartner(result.partner);
  if ('technicalPartner' in result) result.technicalPartner = reducePartner(result.technicalPartner);
  if (settings.hideFinancialValues) {
    for (const field of FINANCIAL_OUTPUT_FIELDS) delete result[field];
  }
  return result as T;
}
