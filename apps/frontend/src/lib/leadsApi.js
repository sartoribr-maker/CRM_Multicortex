import { apiFetch, apiJson } from './api';
function toQueryString(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '')
            params.set(key, String(value));
    });
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}
export const leadsApi = {
    autocomplete: (type, search) => apiJson(`/leads/autocomplete?type=${type}&search=${encodeURIComponent(search)}`),
    list: (filters = {}) => apiJson(`/leads${toQueryString(filters)}`),
    get: (id) => apiJson(`/leads/${id}`),
    create: (payload) => apiJson('/leads', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => apiJson(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    archive: (id) => apiJson(`/leads/${id}/archive`, { method: 'POST' }),
    remove: (id) => apiJson(`/leads/${id}`, { method: 'DELETE' }),
    listActivities: (id) => apiJson(`/leads/${id}/activities`),
    listStageHistory: (id) => apiJson(`/leads/${id}/stage-history`),
    addComment: (id, message) => apiJson(`/leads/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message }),
    }),
    listAttachments: (leadId) => apiJson(`/leads/${leadId}/attachments`),
    uploadAttachment: async (leadId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiFetch(`/leads/${leadId}/attachments`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message ?? `Erro ${response.status}`);
        }
        return response.json();
    },
    downloadAttachment: async (leadId, attachmentId, fileName) => {
        const response = await apiFetch(`/leads/${leadId}/attachments/${attachmentId}/download`);
        if (!response.ok) {
            throw new Error(`Erro ao baixar anexo (${response.status})`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    },
    removeAttachment: (leadId, attachmentId) => apiJson(`/leads/${leadId}/attachments/${attachmentId}`, {
        method: 'DELETE',
    }),
};
