import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { UpdateMonitoringSettingsDto } from './dto/update-monitoring-settings.dto';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring-settings')
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
export class MonitoringSettingsController {
  constructor(private readonly service: MonitoringService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Get('users')
  users() {
    return this.service.users();
  }

  @Put()
  update(@Body() dto: UpdateMonitoringSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(dto, user.sub);
  }
}
