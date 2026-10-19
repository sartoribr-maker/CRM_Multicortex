import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { GoogleCalendarSettingsController } from './google-calendar-settings.controller';
import { GoogleCalendarSettingsService } from './google-calendar-settings.service';
import { LeadMeetingsController } from './lead-meetings.controller';
import { LeadMeetingsService } from './lead-meetings.service';

@Module({
  imports: [LeadsModule],
  controllers: [GoogleCalendarSettingsController, LeadMeetingsController],
  providers: [GoogleCalendarSettingsService, LeadMeetingsService],
})
export class CalendarModule {}
