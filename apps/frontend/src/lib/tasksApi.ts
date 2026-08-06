import { apiJson } from './api';
import type { Task, TaskFilters, TaskListResponse, TaskPayload } from '../types/tasks';
function qs(filters: TaskFilters) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
  return p.size ? `?${p}` : '';
}
export const tasksApi = {
  list: (filters: TaskFilters = {}) => apiJson<TaskListResponse>(`/tasks${qs(filters)}`),
  get: (id: string) => apiJson<Task>(`/tasks/${id}`),
  create: (payload: TaskPayload) =>
    apiJson<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<TaskPayload>) =>
    apiJson<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  complete: (id: string) => apiJson<Task>(`/tasks/${id}/complete`, { method: 'POST' }),
  archive: (id: string) =>
    apiJson<{ success: boolean }>(`/tasks/${id}/archive`, { method: 'POST' }),
};
