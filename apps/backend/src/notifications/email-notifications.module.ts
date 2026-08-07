import { Global, Module } from '@nestjs/common';
import { EmailNotificationsService } from './email-notifications.service';
import { EmailSettingsService } from './email-settings.service';
import { EmailSettingsController } from './email-settings.controller';

@Global()
@Module({
  controllers: [EmailSettingsController],
  providers: [EmailNotificationsService, EmailSettingsService],
  exports: [EmailNotificationsService, EmailSettingsService],
})
export class EmailNotificationsModule {}
