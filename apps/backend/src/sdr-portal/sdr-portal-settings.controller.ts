import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { UpdateSdrPortalSettingsDto } from './dto/update-sdr-portal-settings.dto';
import { SdrPortalSettingsService } from './sdr-portal-settings.service';

@ApiTags('settings/sdr-portal')
@Controller('sdr-portal-settings')
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
export class SdrPortalSettingsController {
  constructor(private readonly service: SdrPortalSettingsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  update(@Body() dto: UpdateSdrPortalSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(dto, user.sub);
  }
}
