import { MonitoringService } from './monitoring.service';
import { MonitoringSettingsController } from './monitoring-settings.controller';
import { Global, Module } from '@nestjs/common';
import { EmailNotificationsService } from './email-notifications.service';
import { EmailSettingsService } from './email-settings.service';
import { EmailSettingsController } from './email-settings.controller';

@Global()
@Module({
  controllers: [EmailSettingsController, MonitoringSettingsController],
  providers: [EmailNotificationsService, EmailSettingsService, MonitoringService],
  exports: [EmailNotificationsService, EmailSettingsService],
})
export class EmailNotificationsModule {}
