import { apiJson } from './api';
import type {
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
  getSettings: () => apiJson<SdrPortalSettings>('/sdr-portal-settings'),
  updateSettings: (payload: SdrPortalSettingsPayload) =>
    apiJson<SdrPortalSettings>('/sdr-portal-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
