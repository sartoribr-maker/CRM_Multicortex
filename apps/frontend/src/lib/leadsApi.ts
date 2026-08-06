import { apiFetch, apiJson } from './api';
import type {
  LeadActivity,
  LeadAttachment,
  LeadDetail,
  LeadListResponse,
  StageHistoryEntry,
} from '../types/leads';

export interface CustomFieldValueInput {
  customFieldId: string;
  value: unknown;
}

export interface LeadFormPayload {
  name: string;
  companyName?: string;
  companyDocument?: string;
  companySegment?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  projectTypeId?: string;
  stageId?: string;
  priorityId?: string;
  dealSizeId?: string;
  sourceId?: string;
  successProbability?: number;
  estimatedValue?: number;
  periodicity?: string;
  expectedCloseDate?: string;
  ownerId?: string;
  description?: string;
  lossReason?: string;
  customFieldValues?: CustomFieldValueInput[];
}

export interface LeadListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  ownerId?: string;
  stageId?: string;
  priorityId?: string;
  dealSizeId?: string;
  sourceId?: string;
  projectTypeId?: string;
  status?: string;
}

function toQueryString(filters: LeadListFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const leadsApi = {
  list: (filters: LeadListFilters = {}) =>
    apiJson<LeadListResponse>(`/leads${toQueryString(filters)}`),

  get: (id: string) => apiJson<LeadDetail>(`/leads/${id}`),

  create: (payload: LeadFormPayload) =>
    apiJson<LeadDetail>('/leads', { method: 'POST', body: JSON.stringify(payload) }),

  update: (id: string, payload: Partial<LeadFormPayload>) =>
    apiJson<LeadDetail>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  archive: (id: string) => apiJson<{ success: boolean }>(`/leads/${id}/archive`, { method: 'POST' }),

  listActivities: (id: string) => apiJson<LeadActivity[]>(`/leads/${id}/activities`),

  listStageHistory: (id: string) => apiJson<StageHistoryEntry[]>(`/leads/${id}/stage-history`),

  addComment: (id: string, message: string) =>
    apiJson<LeadActivity[]>(`/leads/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  listAttachments: (leadId: string) => apiJson<LeadAttachment[]>(`/leads/${leadId}/attachments`),

  uploadAttachment: async (leadId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiFetch(`/leads/${leadId}/attachments`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}) as { message?: string });
      throw new Error(body.message ?? `Erro ${response.status}`);
    }
    return response.json() as Promise<LeadAttachment>;
  },

  downloadAttachment: async (leadId: string, attachmentId: string, fileName: string) => {
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

  removeAttachment: (leadId: string, attachmentId: string) =>
    apiJson<{ success: boolean }>(`/leads/${leadId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
};
