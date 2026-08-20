import { apiJson } from './api';
function makeCrud(basePath) {
    return {
        list: (includeArchived = false) => apiJson(`${basePath}${includeArchived ? '?includeArchived=true' : ''}`),
        create: (payload) => apiJson(basePath, { method: 'POST', body: JSON.stringify(payload) }),
        update: (id, payload) => apiJson(`${basePath}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
        archive: (id) => apiJson(`${basePath}/${id}/archive`, { method: 'POST' }),
    };
}
function withReorder(crud, basePath) {
    return {
        ...crud,
        reorder: (orderedIds) => apiJson(`${basePath}/reorder`, { method: 'PUT', body: JSON.stringify({ orderedIds }) }),
    };
}
export const stagesApi = withReorder(makeCrud('/stages'), '/stages');
export const prioritiesApi = withReorder(makeCrud('/priorities'), '/priorities');
export const dealSizesApi = makeCrud('/deal-sizes');
export const sourcesApi = makeCrud('/sources');
export const segmentsApi = makeCrud('/segments');
export const projectTypesApi = makeCrud('/project-types');
export const servicesApi = makeCrud('/services');
export const customFieldsApi = makeCrud('/custom-fields');
export const emailSettingsApi = {
    get: () => apiJson('/email-settings'),
    update: (payload) => apiJson('/email-settings', { method: 'PUT', body: JSON.stringify(payload) }),
    test: () => apiJson('/email-settings/test', { method: 'POST' }),
};
export const whatsappSettingsApi = {
    get: () => apiJson('/whatsapp-settings'),
    update: (payload) => apiJson('/whatsapp-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
    }),
    test: () => apiJson('/whatsapp-settings/test', { method: 'POST' }),
};
