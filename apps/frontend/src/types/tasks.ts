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
  dueDate: string;
  completedAt: string | null;
  assigneeAssignedAt: string;
  assignee: { id: string; name: string; email: string };
  assignees: Array<{ user: { id: string; name: string; email: string } }>;
  createdByUser: { id: string; name: string };
  lead: {
    id: string;
    name: string;
    companyName: string | null;
    stage: { id: string; name: string; color: string };
  } | null;
  createdAt: string;
  updatedAt: string;
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
}
export interface TaskAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}
export type TaskHistoryType = 'DEADLINE_EXTENDED' | 'TRANSFERRED';
export interface TaskHistoryEntry {
  id: string;
  type: TaskHistoryType;
  reason: string;
  metadata: {
    previousDueDate?: string;
    newDueDate?: string;
    previousAssignees?: Array<{ id: string; name: string }>;
    newAssignee?: { id: string; name: string };
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
