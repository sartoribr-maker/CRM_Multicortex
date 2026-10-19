import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { UpdateGoogleCalendarSettingsDto } from './dto/update-google-calendar-settings.dto';
import { GoogleCalendarSettingsService } from './google-calendar-settings.service';

@ApiTags('settings/google-calendar')
@Controller('google-calendar-settings')
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
export class GoogleCalendarSettingsController {
  constructor(private readonly service: GoogleCalendarSettingsService) {}

  @Get()
  get() {
    return this.service.getPublic();
  }

  @Put()
  update(@Body() dto: UpdateGoogleCalendarSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(dto, user.sub);
  }

  @Post('test')
  test() {
    return this.service.test();
  }
}
