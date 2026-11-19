import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { GoogleCalendarSettingsController } from './google-calendar-settings.controller';
import { GoogleCalendarSettingsService } from './google-calendar-settings.service';
import { LeadMeetingsController } from './lead-meetings.controller';
import { LeadMeetingsService } from './lead-meetings.service';
import { GoogleTasksService } from './google-tasks.service';
import { GoogleTasksAutoSyncService } from './google-tasks-auto-sync.service';

@Module({
  imports: [LeadsModule],
  controllers: [GoogleCalendarSettingsController, LeadMeetingsController],
  providers: [
    GoogleCalendarSettingsService,
    LeadMeetingsService,
    GoogleTasksService,
    GoogleTasksAutoSyncService,
  ],
  exports: [GoogleTasksService, GoogleTasksAutoSyncService],
})
export class CalendarModule {}
