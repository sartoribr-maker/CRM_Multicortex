import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { UpdateWhatsAppSettingsDto } from './dto/update-whatsapp-settings.dto';
import { WhatsAppSettingsService } from './whatsapp-settings.service';

@ApiTags('settings/whatsapp')
@Controller('whatsapp-settings')
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
export class WhatsAppSettingsController {
  constructor(private readonly settings: WhatsAppSettingsService) {}
  @Get() findOne() {
    return this.settings.getPublic();
  }
  @Put() update(@Body() dto: UpdateWhatsAppSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.settings.update(dto, user.sub);
  }
  @Post('test') async test() {
    return { success: true, recipient: await this.settings.sendTest() };
  }
}
