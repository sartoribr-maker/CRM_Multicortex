import type { LeadActivityType, LeadType } from './leads';
import type { Stage } from './settings';
import type { TaskPriority, TaskStatus } from './tasks';

export type SdrPeriod = 'today' | 'week' | 'month' | 'custom';

export interface SdrPortalConfig {
  visibleStages: Stage[];
  allowedTargetStages: Stage[];
  qualifiedStageId: string | null;
  defaultSourceId: string | null;
  sdrPartnerId: string | null;
  hideFinancialValues: boolean;
  staleDays: number;
}

export interface SdrPortalSettings {
  visibleStageIds: string[];
  allowedTargetStageIds: string[];
  qualifiedStageId: string | null;
  defaultSourceId: string | null;
  sdrPartnerId: string | null;
  hideFinancialValues: boolean;
  staleDays: number;
  updatedAt: string;
}

export type SdrPortalSettingsPayload = Omit<SdrPortalSettings, 'updatedAt'>;

interface SummaryStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface SdrAttentionLead {
  id: string;
  name: string;
  businessCode: string | null;
  companyName: string | null;
  stageId: string;
  stageEnteredAt: string;
  daysInStage: number;
  priority: { id: string; name: string; color: string; order: number } | null;
}

export interface SdrTask {
  id: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  priority: TaskPriority;
  lead: { id: string; name: string } | null;
}

export interface SdrSummary {
  period: { start: string; end: string; granularity: 'day' | 'week' };
  metrics: {
    created: number;
    qualified: number;
    qualificationRate: number | null;
    disqualified: number;
    activePortfolio: number;
    stale: number;
    staleDays: number;
  };
  /** Indicadores separados por tipo de lead (null = sem tipo). */
  byLeadType: Array<{
    leadType: LeadType | null;
    created: number;
    qualified: number;
    qualificationRate: number | null;
    disqualified: number;
    active: number;
    stale: number;
  }>;
  lossReasons: Array<{ reason: string; count: number }>;
  funnel: Array<SummaryStage & { count: number }>;
  averageDaysPerStage: Array<SummaryStage & { averageDays: number | null; samples: number }>;
  timeline: Array<{ start: string; label: string; created: number; qualified: number }>;
  attention: { stale: SdrAttentionLead[]; highPriority: SdrAttentionLead[] };
  /** Responsáveis dos leads do parceiro SDR (opções do filtro). */
  owners: Array<{ id: string; name: string }>;
  tasks: { enabled: boolean; overdue: SdrTask[]; upcoming: SdrTask[] };
  recentActivities: Array<{
    id: string;
    type: LeadActivityType;
    message: string;
    createdAt: string;
    actorUser: { id: string; name: string } | null;
    lead: { id: string; name: string; businessCode: string | null };
  }>;
}

export type SdrSummaryMetric = 'created' | 'qualified' | 'disqualified' | 'active';

/** Lead que compõe um card do dashboard (sem valores financeiros). */
export interface SdrSummaryLead {
  id: string;
  businessCode: string | null;
  name: string;
  companyName: string | null;
  contactName: string | null;
  leadType: LeadType | null;
  status: 'OPEN' | 'WON' | 'LOST';
  lossReason: string | null;
  createdAt: string;
  stageEnteredAt: string;
  stage: { id: string; name: string; color: string };
  priority: { id: string; name: string; color: string } | null;
  responsibles: string[];
  eventAt: string | null;
  eventReason: string | null;
  daysInStage: number;
  openInPortal: boolean;
}
