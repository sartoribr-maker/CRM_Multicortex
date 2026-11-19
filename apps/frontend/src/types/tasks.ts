export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  CANCELED: 'Cancelada',
};
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};
export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'bg-emerald-50 text-emerald-600',
  MEDIUM: 'bg-blue-50 text-blue-600',
  HIGH: 'bg-orange-50 text-orange-600',
  URGENT: 'bg-red-50 text-red-600',
};
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Tarefas criadas no PMO podem não ter prazo. */
  dueDate: string | null;
  completedAt: string | null;
  assigneeAssignedAt: string;
  /** `null` em tarefa do PMO sem responsável. Id `pmo:<e-mail>` = pessoa que só existe no PMO. */
  assignee: { id: string; name: string; email: string } | null;
  assignees: Array<{ user: { id: string; name: string; email: string } }>;
  createdByUser: { id: string; name: string } | null;
  /**
   * Usuários com a tarefa no próprio Google Tasks ("Minhas tarefas"). `auto`: pela integração do
   * cadastro do usuário ("Integrar Tarefas com Calendar do Google"), não pelo checkbox da tarefa.
   */
  googleTasks?: Array<{ userId: string; webViewLink: string | null; auto?: boolean }>;
  /** Resultado da sincronização com o Google Agenda nesta gravação. */
  googleCalendar?: { synced: boolean; message?: string; webViewLink?: string | null };
  lead: {
    id: string;
    name: string;
    companyName: string | null;
    stage: { id: string; name: string; color: string };
  } | null;
  createdAt: string;
  updatedAt: string;
  // Desde a integração as tarefas moram no Multicortex Projetos (PMO):
  /** Código no PMO (ex.: TAR00042). */
  code?: string;
  /** Plataforma onde a tarefa foi criada. */
  source?: 'PMO' | 'CRM';
  /** Projeto do PMO (tarefas de projeto seguem as regras do PMO). */
  project?: { id: string; code: string; name: string } | null;
  /** Link para abrir a tarefa no PMO. */
  pmoUrl?: string;
  /** O que o usuário pode fazer nesta tarefa (regras do PMO para tarefas de projeto). */
  permissions?: { canEdit: boolean; canEditLimited: boolean; canDelete: boolean };
}
export interface TaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate: string;
  leadId?: string;
  assigneeId?: string;
  assigneeIds?: string[];
  completionReason?: string;
  /** true vincula/atualiza no Google Tasks do usuário logado; false remove o vínculo. */
  syncGoogleCalendar?: boolean;
}
export interface TaskGoogleCalendarConfig {
  enabled: boolean;
  workspaceDomain: string;
  eligible: boolean;
}
export interface TaskAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}
export type TaskHistoryType = 'DEADLINE_EXTENDED' | 'TRANSFERRED' | 'COMPLETED';
export interface TaskHistoryEntry {
  id: string;
  type: TaskHistoryType;
  reason: string;
  metadata: {
    previousDueDate?: string;
    newDueDate?: string;
    previousAssignees?: Array<{ id: string; name: string }>;
    newAssignee?: { id: string; name: string };
    completedAt?: string;
  };
  actorUser: { id: string; name: string };
  createdAt: string;
}
export interface TaskFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  leadId?: string;
  overdue?: boolean;
  mine?: boolean;
}
export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
