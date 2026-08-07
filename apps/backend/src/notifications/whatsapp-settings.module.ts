import { Module } from '@nestjs/common';
import { WhatsAppSettingsController } from './whatsapp-settings.controller';
import { WhatsAppSettingsService } from './whatsapp-settings.service';

@Module({ controllers: [WhatsAppSettingsController], providers: [WhatsAppSettingsService] })
export class WhatsAppSettingsModule {}
