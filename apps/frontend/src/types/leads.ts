import type { CustomFieldType } from './settings';

export type LeadStatus = 'OPEN' | 'WON' | 'LOST';
export type LeadPeriodicity = 'PONTUAL' | 'MENSAL' | 'TRIMESTRAL' | 'ANUAL' | 'RECORRENTE';

export const LEAD_PERIODICITY_LABELS: Record<LeadPeriodicity, string> = {
  PONTUAL: 'Pontual',
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
  RECORRENTE: 'Recorrente',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  OPEN: 'Aberto',
  WON: 'Ganho',
  LOST: 'Perdido',
};

interface RefColorName {
  id: string;
  name: string;
  color: string;
}

interface RefName {
  id: string;
  name: string;
}

export interface LeadListItem {
  id: string;
  name: string;
  companyName: string | null;
  estimatedValue: string | number | null;
  status: LeadStatus;
  stage: RefColorName & { isWonStage: boolean; isLostStage: boolean };
  priority: RefColorName | null;
  dealSize: RefColorName | null;
  source: RefName | null;
  projectType: RefName | null;
  partner: RefName | null;
  owner: { id: string; name: string; email: string; avatarUrl: string | null };
  assignees: Array<{
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }>;
  stageEnteredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldValueEntry {
  id: string;
  customFieldId: string;
  value: unknown;
  customField: {
    id: string;
    name: string;
    type: CustomFieldType;
    options: string[] | null;
  };
}

export interface LeadDetail extends LeadListItem {
  companyDocument: string | null;
  companySegment: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  successProbability: number | null;
  periodicity: LeadPeriodicity;
  expectedCloseDate: string | null;
  description: string | null;
  lossReason: string | null;
  stageEnteredAt: string;
  customFieldValues: CustomFieldValueEntry[];
}

export type LeadActivityType =
  'CREATED' | 'FIELD_UPDATED' | 'STAGE_CHANGED' | 'COMMENT' | 'ATTACHMENT_ADDED';

export const LEAD_ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  CREATED: 'Criação',
  FIELD_UPDATED: 'Edição',
  STAGE_CHANGED: 'Mudança de etapa',
  COMMENT: 'Comentário',
  ATTACHMENT_ADDED: 'Anexo',
};

export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  message: string;
  createdAt: string;
  actorUser: { id: string; name: string } | null;
}

export interface StageHistoryEntry {
  id: string;
  fromStage: { id: string; name: string } | null;
  toStage: { id: string; name: string };
  changedByUser: { id: string; name: string };
  timeInPreviousStageSeconds: number | null;
  reason: string | null;
  createdAt: string;
}

export interface LeadAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface LeadListResponse {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
