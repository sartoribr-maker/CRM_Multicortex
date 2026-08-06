import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { DashboardService } from './dashboard.service';
@ApiTags('dashboard') @Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get('summary') @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  summary(@CurrentUser() user: JwtPayload) { return this.service.summary(user); }
}
