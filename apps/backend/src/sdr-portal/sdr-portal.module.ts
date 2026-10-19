import { Module } from '@nestjs/common';
import { SdrPortalController } from './sdr-portal.controller';
import { SdrPortalSettingsController } from './sdr-portal-settings.controller';
import { SdrPortalSettingsService } from './sdr-portal-settings.service';
import { SdrSummaryService } from './sdr-summary.service';

@Module({
  controllers: [SdrPortalController, SdrPortalSettingsController],
  providers: [SdrPortalSettingsService, SdrSummaryService],
  exports: [SdrPortalSettingsService],
})
export class SdrPortalModule {}
