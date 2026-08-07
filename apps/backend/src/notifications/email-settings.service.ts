import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';

const SETTINGS_ID = 'default';

@Injectable()
export class EmailSettingsService {
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('EMAIL_ENCRYPTION_KEY') ?? config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('Defina EMAIL_ENCRYPTION_KEY ou JWT_SECRET para criptografar a senha SMTP.');
    this.key = createHash('sha256').update(secret).digest();
  }

  async getPublic() {
    const settings = await this.ensureSettings();
    return {
      enabled: settings.enabled,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      hasPassword: Boolean(settings.passwordEncrypted),
      updatedAt: settings.updatedAt,
    };
  }

  async update(dto: UpdateEmailSettingsDto, actorUserId: string) {
    const current = await this.ensureSettings();
    await this.prisma.emailSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        enabled: dto.enabled,
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        username: dto.username.trim(),
        fromEmail: dto.fromEmail.trim(),
        fromName: dto.fromName.trim(),
        passwordEncrypted: dto.password?.trim()
          ? this.encrypt(dto.password.trim())
          : current.passwordEncrypted,
        updatedBy: actorUserId,
      },
    });
    return this.getPublic();
  }

  async getRuntimeConfig() {
    const settings = await this.ensureSettings();
    if (!settings.enabled || !settings.passwordEncrypted) return null;
    return {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      password: this.decrypt(settings.passwordEncrypted),
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
    };
  }

  private ensureSettings() {
    return this.prisma.emailSettings.upsert({
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
