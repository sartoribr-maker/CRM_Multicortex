import { apiJson } from './api';
function query(filters) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== '' && params.set(key, String(value))); return params.size ? `?${params}` : ''; }
export const partnersApi = {
    list: (filters = {}) => apiJson(`/partners${query(filters)}`),
    options: () => apiJson('/partners?pageSize=100&status=ACTIVE').then((response) => response.items),
    get: (id) => apiJson(`/partners/${id}`),
    create: (payload) => apiJson('/partners', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => apiJson(`/partners/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deactivate: (id) => apiJson(`/partners/${id}/deactivate`, { method: 'POST' }),
    reactivate: (id) => apiJson(`/partners/${id}/reactivate`, { method: 'POST' }),
    remove: (id) => apiJson(`/partners/${id}`, { method: 'DELETE' }),
};
