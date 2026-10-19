import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadActivityService } from './lead-activity.service';
import { SdrPortalModule } from '../sdr-portal/sdr-portal.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [SdrPortalModule, CompaniesModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadActivityService],
  exports: [LeadActivityService, LeadsService],
})
export class LeadsModule {}
