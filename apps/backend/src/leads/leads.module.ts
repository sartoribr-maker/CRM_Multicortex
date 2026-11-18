import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadActivityService } from './lead-activity.service';
import { PmoIntegrationKeyGuard, PmoLeadsController } from './pmo-leads.controller';
import { SdrPortalModule } from '../sdr-portal/sdr-portal.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [SdrPortalModule, CompaniesModule],
  controllers: [LeadsController, PmoLeadsController],
  providers: [LeadsService, LeadActivityService, PmoIntegrationKeyGuard],
  exports: [LeadActivityService, LeadsService],
})
export class LeadsModule {}
