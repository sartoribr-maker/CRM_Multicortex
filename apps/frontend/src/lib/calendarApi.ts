import { apiJson } from './api';
import type { LeadMeetingSummary } from '../types/leads';

export interface CalendarConfig {
  enabled: boolean;
  meetingStageId: string | null;
  defaultDurationMinutes: number;
}

export interface AttendeeSuggestion {
  name: string;
  email: string;
}

export interface CreateMeetingPayload {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  attendees: string[];
  withMeet: boolean;
}

export interface GoogleCalendarSettings {
  enabled: boolean;
  workspaceDomain: string;
  fallbackOrganizerEmail: string;
  serviceAccountEmail: string | null;
  hasServiceAccountKey: boolean;
  meetingStageId: string | null;
  defaultDurationMinutes: number;
}

export interface GoogleCalendarSettingsPayload {
  enabled: boolean;
  workspaceDomain: string;
  fallbackOrganizerEmail: string;
  serviceAccountKey?: string;
  meetingStageId: string | null;
  defaultDurationMinutes: number;
}

export const calendarApi = {
  config: () => apiJson<CalendarConfig>('/calendar/config'),
  attendeeSuggestions: (search: string) =>
    apiJson<AttendeeSuggestion[]>(
      `/calendar/attendee-suggestions?search=${encodeURIComponent(search)}`,
    ),
  createMeeting: (leadId: string, payload: CreateMeetingPayload) =>
    apiJson<LeadMeetingSummary>(`/leads/${leadId}/meetings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSettings: () => apiJson<GoogleCalendarSettings>('/google-calendar-settings'),
  updateSettings: (payload: GoogleCalendarSettingsPayload) =>
    apiJson<GoogleCalendarSettings>('/google-calendar-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  testSettings: () =>
    apiJson<{ message: string }>('/google-calendar-settings/test', { method: 'POST' }),
};
