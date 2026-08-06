import { apiJson } from './api';
import type { Partner, PartnerDetail, PartnerFilters, PartnerListResponse, PartnerPayload } from '../types/partners';

function query(filters: PartnerFilters) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== '' && params.set(key, String(value))); return params.size ? `?${params}` : ''; }
export const partnersApi = {
  list: (filters: PartnerFilters = {}) => apiJson<PartnerListResponse>(`/partners${query(filters)}`),
  options: () => apiJson<PartnerListResponse>('/partners?pageSize=100&status=ACTIVE').then((response) => response.items),
  get: (id: string) => apiJson<PartnerDetail>(`/partners/${id}`),
  create: (payload: PartnerPayload) => apiJson<Partner>('/partners', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<PartnerPayload>) => apiJson<Partner>(`/partners/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deactivate: (id: string) => apiJson<Partner>(`/partners/${id}/deactivate`, { method: 'POST' }),
  reactivate: (id: string) => apiJson<Partner>(`/partners/${id}/reactivate`, { method: 'POST' }),
};
