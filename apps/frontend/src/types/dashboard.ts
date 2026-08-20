import type { TaskPriority } from './tasks';
export interface DashboardLead {
  id: string;
  businessCode: string | null;
  name: string;
  companyName: string | null;
  status: 'OPEN' | 'WON' | 'LOST';
  estimatedValue: string | number | null;
  updatedAt: string;
  stage: { id: string; name: string; color: string };
  priority: { id: string; name: string; color: string } | null;
  owner: { id: string; name: string };
}
export interface DashboardSummary {
  metrics: {
    totalLeads: number;
    openLeads: number;
    wonLeads: number;
    lostLeads: number;
    pipelineValue: number;
    wonValue: number;
    averageTicket: number;
    conversionRate: number;
    overdueTasks: number;
  };
  funnel: Array<{
    id: string;
    name: string;
    color: string;
    order: number;
    count: number;
    value: number;
  }>;
  recentLeads: DashboardLead[];
  mandatoryLeads: DashboardLead[];
  mandatoryPriorityId: string | null;
  overdueTasks: DashboardTask[];
  upcomingTasks: DashboardTask[];
  ownerPerformance: Array<{
    id: string;
    name: string;
    openCount: number;
    wonCount: number;
    wonValue: number;
    pipelineValue: number;
  }>;
  scope: 'TEAM' | 'PERSONAL';
}
export interface DashboardTask {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  assignee: { id: string; name: string };
  lead: { id: string; name: string } | null;
}
