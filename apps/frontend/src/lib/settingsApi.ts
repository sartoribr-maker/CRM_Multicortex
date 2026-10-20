import { apiFetch, apiJson } from './api';
import type {
  CustomField,
  DealSize,
  Priority,
  ProjectType,
  PricingImportOptions,
  PricingImportPreview,
  ServiceCatalogItem,
  Segment,
  Source,
  Stage,
  EmailSettings,
  EmailSettingsPayload,
  WhatsAppSettings,
  WhatsAppSettingsPayload,
} from '../types/settings';

function makeCrud<T>(basePath: string) {
  return {
    list: (includeArchived = false) =>
      apiJson<T[]>(`${basePath}${includeArchived ? '?includeArchived=true' : ''}`),
    create: (payload: Partial<T>) =>
      apiJson<T>(basePath, { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<T>) =>
      apiJson<T>(`${basePath}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    archive: (id: string) => apiJson<T>(`${basePath}/${id}/archive`, { method: 'POST' }),
  };
}

function withReorder<T>(crud: ReturnType<typeof makeCrud<T>>, basePath: string) {
  return {
    ...crud,
    reorder: (orderedIds: string[]) =>
      apiJson<T[]>(`${basePath}/reorder`, { method: 'PUT', body: JSON.stringify({ orderedIds }) }),
  };
}

export const stagesApi = withReorder(makeCrud<Stage>('/stages'), '/stages');
export const prioritiesApi = withReorder(makeCrud<Priority>('/priorities'), '/priorities');
export const dealSizesApi = makeCrud<DealSize>('/deal-sizes');
export const sourcesApi = makeCrud<Source>('/sources');
export const segmentsApi = makeCrud<Segment>('/segments');
export const projectTypesApi = makeCrud<ProjectType>('/project-types');
function pricingForm(file: File, options: PricingImportOptions = {}) {
  const body = new FormData();
  body.append('file', file);
  if (options.productName) body.append('productName', options.productName);
  if (options.projectTypeId) body.append('projectTypeId', options.projectTypeId);
  return body;
}

export const servicesApi = {
  ...makeCrud<ServiceCatalogItem>('/services'),
  previewImport: (file: File, options?: PricingImportOptions) =>
    apiJson<PricingImportPreview>('/services/import/preview', {
      method: 'POST',
      body: pricingForm(file, options),
    }),
  import: (file: File, options: PricingImportOptions) =>
    apiJson<{ created: number; updated: number; linked: number }>('/services/import', {
      method: 'POST',
      body: pricingForm(file, options),
    }),
  downloadTemplate: async () => {
    const response = await apiFetch('/services/import/template');
    if (!response.ok) throw new Error(`Erro ao baixar o modelo (${response.status})`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo-precificacao-servicos.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
export const customFieldsApi = makeCrud<CustomField>('/custom-fields');
export const emailSettingsApi = {
  get: () => apiJson<EmailSettings>('/email-settings'),
  update: (payload: EmailSettingsPayload) =>
    apiJson<EmailSettings>('/email-settings', { method: 'PUT', body: JSON.stringify(payload) }),
  test: () =>
    apiJson<{ success: boolean; recipient: string }>('/email-settings/test', { method: 'POST' }),
};
export const whatsappSettingsApi = {
  get: () => apiJson<WhatsAppSettings>('/whatsapp-settings'),
  update: (payload: WhatsAppSettingsPayload) =>
    apiJson<WhatsAppSettings>('/whatsapp-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  test: () =>
    apiJson<{ success: boolean; recipient: string }>('/whatsapp-settings/test', { method: 'POST' }),
};
