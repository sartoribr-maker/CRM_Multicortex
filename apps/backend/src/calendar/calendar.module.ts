import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { GoogleCalendarSettingsController } from './google-calendar-settings.controller';
import { GoogleCalendarSettingsService } from './google-calendar-settings.service';
import { LeadMeetingsController } from './lead-meetings.controller';
import { LeadMeetingsService } from './lead-meetings.service';
import { GoogleTasksService } from './google-tasks.service';

@Module({
  imports: [LeadsModule],
  controllers: [GoogleCalendarSettingsController, LeadMeetingsController],
  providers: [GoogleCalendarSettingsService, LeadMeetingsService, GoogleTasksService],
  exports: [GoogleTasksService],
})
export class CalendarModule {}
