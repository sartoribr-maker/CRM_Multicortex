import type { CustomFieldType } from './settings';

export type LeadStatus = 'OPEN' | 'WON' | 'LOST';
export type LeadPeriodicity = 'PONTUAL' | 'MENSAL' | 'TRIMESTRAL' | 'ANUAL' | 'RECORRENTE';
export type LeadLine = 'ENTERPRISE' | 'PRIVACY' | 'MIX';
export type LeadType = 'INBOUND' | 'OUTBOUND';

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  INBOUND: 'Inbound',
  OUTBOUND: 'Outbound',
};

export const LEAD_LINE_LABELS: Record<LeadLine, string> = {
  ENTERPRISE: 'Enterprise',
  PRIVACY: 'Privacy',
  MIX: 'Mix',
};

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
  businessCode: string | null;
  line: LeadLine | null;
  leadType?: LeadType | null;
  name: string;
  companyName: string | null;
  contactName: string | null;
  contactEmail?: string | null;
  contactPhone: string | null;
  successProbability: number | null;
  capexValue: string | number | null;
  opexValue: string | number | null;
  estimatedValue: string | number | null;
  status: LeadStatus;
  stage: RefColorName & { isWonStage: boolean; isLostStage: boolean };
  priority: RefColorName | null;
  dealSize: RefColorName | null;
  source: RefName | null;
  projectType: RefName | null;
  projectTypes: Array<{ projectType: RefName }>;
  partner: RefName | null;
  technicalPartner: RefName | null;
  technicalServiceValue: string | number | null;
  owner: { id: string; name: string; email: string; avatarUrl: string | null };
  assignees: Array<{
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }>;
  stageEnteredAt: string;
  createdAt: string;
  updatedAt: string;
  /** Próxima reunião agendada ainda não encerrada (no máximo uma). */
  meetings?: LeadMeetingSummary[];
}

export interface LeadMeetingSummary {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  meetLink: string | null;
  htmlLink: string | null;
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
  | 'CREATED'
  | 'FIELD_UPDATED'
  | 'STAGE_CHANGED'
  | 'COMMENT'
  | 'ATTACHMENT_ADDED'
  | 'MEETING_SCHEDULED';

export const LEAD_ACTIVITY_LABELS: Record<LeadActivityType, string> = {
  CREATED: 'Criação',
  FIELD_UPDATED: 'Edição',
  STAGE_CHANGED: 'Mudança de etapa',
  COMMENT: 'Comentário',
  ATTACHMENT_ADDED: 'Anexo',
  MEETING_SCHEDULED: 'Reunião agendada',
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
