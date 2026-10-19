import { apiJson } from './api';
import type {
  SdrPeriod,
  SdrPortalConfig,
  SdrPortalSettings,
  SdrPortalSettingsPayload,
  SdrSummary,
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
  getSettings: () => apiJson<SdrPortalSettings>('/sdr-portal-settings'),
  updateSettings: (payload: SdrPortalSettingsPayload) =>
    apiJson<SdrPortalSettings>('/sdr-portal-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
