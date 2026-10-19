import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { AllowThirdPartyPortal } from '../auth/decorators/allow-third-party-portal.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { SdrSummaryLeadsQueryDto, SdrSummaryQueryDto } from './dto/sdr-summary.query.dto';
import { SdrPortalSettingsService } from './sdr-portal-settings.service';
import { SdrSummaryService } from './sdr-summary.service';

@ApiTags('portal/sdr')
@Controller('portal/sdr')
@AllowThirdPartyPortal()
@RequirePermissions(PERMISSIONS.PORTAL_SDR_ACCESS)
export class SdrPortalController {
  constructor(
    private readonly settings: SdrPortalSettingsService,
    private readonly summaryService: SdrSummaryService,
  ) {}

  @Get('config')
  config() {
    return this.settings.getPortalConfig();
  }

  @Get('summary')
  summary(@Query() query: SdrSummaryQueryDto, @CurrentUser() user: JwtPayload) {
    return this.summaryService.summary(query, user);
  }

  /** Leads que compõem um card do dashboard. */
  @Get('summary/leads')
  summaryLeads(@Query() query: SdrSummaryLeadsQueryDto) {
    return this.summaryService.leads(query);
  }
}
