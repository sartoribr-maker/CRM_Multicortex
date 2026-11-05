import { apiFetch, apiJson } from './api';
import type {
  Task,
  TaskAttachment,
  TaskFilters,
  TaskHistoryEntry,
  TaskListResponse,
  TaskPayload,
  TaskStatus,
} from '../types/tasks';

const ACTIVE_CONTENT_TYPES = new Set(['text/html', 'image/svg+xml']);

function qs(filters: TaskFilters) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
  return p.size ? `?${p}` : '';
}
export const tasksApi = {
  list: (filters: TaskFilters = {}) => apiJson<TaskListResponse>(`/tasks${qs(filters)}`),
  summary: (filters: TaskFilters = {}) =>
    apiJson<Record<TaskStatus, number>>(
      `/tasks/summary${qs({ ...filters, status: undefined, page: undefined, pageSize: undefined })}`,
    ),
  get: (id: string) => apiJson<Task>(`/tasks/${id}`),
  create: (payload: TaskPayload) =>
    apiJson<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<TaskPayload>) =>
    apiJson<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  complete: (id: string, reason: string) =>
    apiJson<Task>(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify({ reason }) }),
  sendReminder: (id: string) =>
    apiJson<{ success: boolean }>(`/tasks/${id}/reminder`, { method: 'POST' }),
  extendDeadline: (id: string, dueDate: string, reason: string) =>
    apiJson<Task>(`/tasks/${id}/extend-deadline`, {
      method: 'POST',
      body: JSON.stringify({ dueDate, reason }),
    }),
  transfer: (id: string, assigneeId: string, reason: string) =>
    apiJson<Task>(`/tasks/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ assigneeId, reason }),
    }),
  history: (id: string) => apiJson<TaskHistoryEntry[]>(`/tasks/${id}/history`),
  archive: (id: string) =>
    apiJson<{ success: boolean }>(`/tasks/${id}/archive`, { method: 'POST' }),
  remove: (id: string) => apiJson<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  listAttachments: (taskId: string) => apiJson<TaskAttachment[]>(`/tasks/${taskId}/attachments`),
  uploadAttachment: async (taskId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiFetch(`/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}) as { message?: string });
      throw new Error(body.message ?? `Erro ${response.status}`);
    }
    return response.json() as Promise<TaskAttachment>;
  },
  downloadAttachment: async (taskId: string, attachmentId: string, fileName: string) => {
    const response = await apiFetch(`/tasks/${taskId}/attachments/${attachmentId}/download`);
    if (!response.ok) throw new Error(`Erro ao baixar anexo (${response.status})`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  viewAttachment: async (taskId: string, attachmentId: string) => {
    const previewWindow = window.open('', '_blank');
    const response = await apiFetch(`/tasks/${taskId}/attachments/${attachmentId}/download`);
    if (!response.ok) {
      previewWindow?.close();
      throw new Error(`Erro ao visualizar anexo (${response.status})`);
    }
    const blob = await response.blob();
    // HTML e SVG podem conter scripts: um blob: aberto direto rodaria na origem do CRM,
    // com acesso à sessão. Eles são exibidos em iframe sandbox (origem opaca).
    if (ACTIVE_CONTENT_TYPES.has(blob.type.split(';')[0].trim().toLowerCase())) {
      const content = await blob.text();
      if (!previewWindow) throw new Error('O navegador bloqueou a janela de visualização.');
      previewWindow.opener = null;
      const doc = previewWindow.document;
      doc.open();
      doc.write(
        '<!doctype html><meta charset="utf-8"><title>Anexo</title>' +
          '<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>',
      );
      doc.close();
      const frame = doc.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
      frame.srcdoc = content;
      doc.body.appendChild(frame);
      return;
    }
    const url = URL.createObjectURL(blob);
    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  removeAttachment: (taskId: string, attachmentId: string) =>
    apiJson<{ success: boolean }>(`/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
};
