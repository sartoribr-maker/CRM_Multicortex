import { apiAssetUrl, apiJson } from './api';
function query(filters) {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
    return p.size ? `?${p}` : '';
}
export const avatarUrl = (id, version) => apiAssetUrl(`/users/${id}/avatar${version ? `?v=${encodeURIComponent(version)}` : ''}`);
export const usersApi = {
    list: () => apiJson('/users?pageSize=100').then((r) => r.items),
    listPage: (filters = {}) => apiJson(`/users${query(filters)}`),
    get: (id) => apiJson(`/users/${id}`),
    create: (payload) => apiJson('/users', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) => apiJson(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    uploadAvatar: (id, file) => {
        const body = new FormData();
        body.append('file', file);
        return apiJson(`/users/${id}/avatar`, { method: 'POST', body });
    },
    deactivate: (id) => apiJson(`/users/${id}/deactivate`, { method: 'POST' }),
    reactivate: (id) => apiJson(`/users/${id}/reactivate`, { method: 'POST' }),
    resetPassword: (id, newPassword) => apiJson(`/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
    }),
    remove: (id) => apiJson(`/users/${id}`, { method: 'DELETE' }),
};
