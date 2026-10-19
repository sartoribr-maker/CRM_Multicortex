import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadActivityService } from './lead-activity.service';
import { SdrPortalModule } from '../sdr-portal/sdr-portal.module';

@Module({
  imports: [SdrPortalModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadActivityService],
  exports: [LeadActivityService, LeadsService],
})
export class LeadsModule {}
