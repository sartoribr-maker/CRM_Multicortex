import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateWhatsAppSettingsDto } from './dto/update-whatsapp-settings.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class WhatsAppSettingsService {
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret =
      config.get<string>('WHATSAPP_ENCRYPTION_KEY') ?? config.get<string>('JWT_SECRET');
    if (!secret)
      throw new Error('Defina WHATSAPP_ENCRYPTION_KEY ou JWT_SECRET para criptografar o token.');
    this.key = createHash('sha256').update(secret).digest();
  }

  async getPublic() {
    const item = await this.ensureSettings();
    const { accessTokenEncrypted, ...publicSettings } = item;
    return { ...publicSettings, hasAccessToken: Boolean(accessTokenEncrypted) };
  }

  async update(dto: UpdateWhatsAppSettingsDto, actorUserId: string) {
    const current = await this.ensureSettings();
    await this.prisma.whatsAppSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        enabled: dto.enabled,
        apiVersion: dto.apiVersion.trim(),
        phoneNumberId: dto.phoneNumberId.trim(),
        businessAccountId: dto.businessAccountId.trim(),
        accessTokenEncrypted: dto.accessToken?.trim()
          ? this.encrypt(dto.accessToken.trim())
          : current.accessTokenEncrypted,
        languageCode: dto.languageCode.trim(),
        testTemplate: dto.testTemplate.trim(),
        leadCreatedTemplate: dto.leadCreatedTemplate.trim(),
        leadStageTemplate: dto.leadStageTemplate.trim(),
        taskCreatedTemplate: dto.taskCreatedTemplate.trim(),
        taskUpdatedTemplate: dto.taskUpdatedTemplate.trim(),
        testPhone: dto.testPhone.replace(/\D/g, ''),
        notifyLeadCreated: dto.notifyLeadCreated,
        notifyLeadStageChanged: dto.notifyLeadStageChanged,
        notifyTaskCreated: dto.notifyTaskCreated,
        notifyTaskUpdated: dto.notifyTaskUpdated,
        updatedBy: actorUserId,
      },
    });
    return this.getPublic();
  }

  async sendTest(): Promise<string> {
    const item = await this.ensureSettings();
    if (!item.enabled || !item.accessTokenEncrypted || !item.phoneNumberId || !item.testPhone) {
      throw new BadRequestException(
        'Ative a integração e informe token, Phone Number ID e telefone de teste.',
      );
    }
    const response = await fetch(
      `https://graph.facebook.com/${item.apiVersion}/${item.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.decrypt(item.accessTokenEncrypted)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: item.testPhone,
          type: 'template',
          template: { name: item.testTemplate, language: { code: item.languageCode } },
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new ServiceUnavailableException(`A Meta recusou o envio (${response.status}): ${body}`);
    }
    return item.testPhone;
  }

  private ensureSettings() {
    return this.prisma.whatsAppSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
  }

  private decrypt(value: string): string {
    const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
