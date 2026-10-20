import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { OutboundImportService } from './outbound-import/outbound-import.service';
import { SdrPortalController } from './sdr-portal.controller';
import { SdrPortalSettingsController } from './sdr-portal-settings.controller';
import { SdrPortalSettingsService } from './sdr-portal-settings.service';
import { SdrSummaryService } from './sdr-summary.service';

@Module({
  imports: [CompaniesModule],
  controllers: [SdrPortalController, SdrPortalSettingsController],
  providers: [SdrPortalSettingsService, SdrSummaryService, OutboundImportService],
  exports: [SdrPortalSettingsService],
})
export class SdrPortalModule {}
