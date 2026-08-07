import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { EmailNotificationsService } from './email-notifications.service';
import { EmailSettingsService } from './email-settings.service';

@ApiTags('settings/email')
@Controller('email-settings')
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
export class EmailSettingsController {
  constructor(
    private readonly settings: EmailSettingsService,
    private readonly notifications: EmailNotificationsService,
  ) {}

  @Get()
  findOne() {
    return this.settings.getPublic();
  }

  @Put()
  update(@Body() dto: UpdateEmailSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.settings.update(dto, user.sub);
  }

  @Post('test')
  async test(@CurrentUser() user: JwtPayload) {
    await this.notifications.sendTest(user.email, user.name);
    return { success: true, recipient: user.email };
  }
}
