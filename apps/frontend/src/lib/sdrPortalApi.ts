import { apiJson } from './api';
import type {
  OutboundImportPayload,
  OutboundImportPreview,
  OutboundImportResult,
  SdrPeriod,
  SdrPortalConfig,
  SdrPortalSettings,
  SdrPortalSettingsPayload,
  SdrSummary,
  SdrSummaryLead,
  SdrSummaryMetric,
} from '../types/sdrPortal';

export const sdrPortalApi = {
  config: () => apiJson<SdrPortalConfig>('/portal/sdr/config'),
  summary: (period: SdrPeriod, from?: string, to?: string, ownerId?: string) => {
    const params = new URLSearchParams({ period });
    if (ownerId) params.set('ownerId', ownerId);
    if (period === 'custom' && from && to) {
      params.set('from', from);
      params.set('to', to);
    }
    return apiJson<SdrSummary>(`/portal/sdr/summary?${params}`);
  },
  summaryLeads: (params: {
    metric: SdrSummaryMetric;
    leadType?: 'INBOUND' | 'OUTBOUND';
    period: SdrPeriod;
    from?: string;
    to?: string;
    ownerId?: string;
  }) => {
    const query = new URLSearchParams({ metric: params.metric, period: params.period });
    if (params.leadType) query.set('leadType', params.leadType);
    if (params.ownerId) query.set('ownerId', params.ownerId);
    if (params.period === 'custom' && params.from && params.to) {
      query.set('from', params.from);
      query.set('to', params.to);
    }
    return apiJson<SdrSummaryLead[]>(`/portal/sdr/summary/leads?${query}`);
  },
  previewOutboundImport: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return apiJson<OutboundImportPreview>('/portal/sdr/imports/outbound/preview', {
      method: 'POST',
      body,
    });
  },
  importOutbound: (file: File, payload: OutboundImportPayload) => {
    const body = new FormData();
    body.append('file', file);
    for (const [field, value] of Object.entries(payload)) body.append(field, JSON.stringify(value));
    return apiJson<OutboundImportResult>('/portal/sdr/imports/outbound', { method: 'POST', body });
  },
  getSettings: () => apiJson<SdrPortalSettings>('/sdr-portal-settings'),
  updateSettings: (payload: SdrPortalSettingsPayload) =>
    apiJson<SdrPortalSettings>('/sdr-portal-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
