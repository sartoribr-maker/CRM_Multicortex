import { apiFetch, apiJson } from './api';
function qs(filters) {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
    return p.size ? `?${p}` : '';
}
export const tasksApi = {
    list: (filters = {}) => apiJson(`/tasks${qs(filters)}`),
    get: (id) => apiJson(`/tasks/${id}`),
    create: (payload) => apiJson('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => apiJson(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    complete: (id) => apiJson(`/tasks/${id}/complete`, { method: 'POST' }),
    extendDeadline: (id, dueDate, reason) => apiJson(`/tasks/${id}/extend-deadline`, {
        method: 'POST',
        body: JSON.stringify({ dueDate, reason }),
    }),
    transfer: (id, assigneeId, reason) => apiJson(`/tasks/${id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ assigneeId, reason }),
    }),
    history: (id) => apiJson(`/tasks/${id}/history`),
    archive: (id) => apiJson(`/tasks/${id}/archive`, { method: 'POST' }),
    remove: (id) => apiJson(`/tasks/${id}`, { method: 'DELETE' }),
    listAttachments: (taskId) => apiJson(`/tasks/${taskId}/attachments`),
    uploadAttachment: async (taskId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiFetch(`/tasks/${taskId}/attachments`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message ?? `Erro ${response.status}`);
        }
        return response.json();
    },
    downloadAttachment: async (taskId, attachmentId, fileName) => {
        const response = await apiFetch(`/tasks/${taskId}/attachments/${attachmentId}/download`);
        if (!response.ok)
            throw new Error(`Erro ao baixar anexo (${response.status})`);
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    },
    viewAttachment: async (taskId, attachmentId) => {
        const previewWindow = window.open('', '_blank');
        const response = await apiFetch(`/tasks/${taskId}/attachments/${attachmentId}/download`);
        if (!response.ok) {
            previewWindow?.close();
            throw new Error(`Erro ao visualizar anexo (${response.status})`);
        }
        const url = URL.createObjectURL(await response.blob());
        if (previewWindow) {
            previewWindow.location.href = url;
        }
        else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    removeAttachment: (taskId, attachmentId) => apiJson(`/tasks/${taskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
    }),
};
