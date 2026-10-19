import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGoogleCalendarSettingsDto } from './dto/update-google-calendar-settings.dto';
import {
  checkCalendarAccess,
  fetchAccessToken,
  GoogleCalendarError,
  parseServiceAccountKey,
  type ServiceAccountKey,
} from './google-calendar.client';

const SETTINGS_ID = 'default';

@Injectable()
export class GoogleCalendarSettingsService {
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret =
      config.get<string>('GOOGLE_CALENDAR_ENCRYPTION_KEY') ?? config.get<string>('JWT_SECRET');
    if (!secret)
      throw new Error('Defina GOOGLE_CALENDAR_ENCRYPTION_KEY ou JWT_SECRET para criptografar a chave.');
    this.key = createHash('sha256').update(secret).digest();
  }

  async getPublic() {
    const { serviceAccountKeyEncrypted, ...settings } = await this.ensureSettings();
    return { ...settings, hasServiceAccountKey: Boolean(serviceAccountKeyEncrypted) };
  }

  async update(dto: UpdateGoogleCalendarSettingsDto, actorUserId: string) {
    const current = await this.ensureSettings();
    let parsedKey: ServiceAccountKey | null = null;
    if (dto.serviceAccountKey?.trim()) {
      try {
        parsedKey = parseServiceAccountKey(dto.serviceAccountKey.trim());
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }
    }
    if (dto.enabled && !parsedKey && !current.serviceAccountKeyEncrypted) {
      throw new BadRequestException('Informe a chave da conta de serviço para ativar a integração.');
    }
    if (
      dto.meetingStageId &&
      !(await this.prisma.stage.findFirst({ where: { id: dto.meetingStageId, deletedAt: null } }))
    ) {
      throw new BadRequestException('Etapa de reunião não encontrada ou arquivada.');
    }
    await this.prisma.googleCalendarSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        enabled: dto.enabled,
        workspaceDomain: dto.workspaceDomain.trim().toLowerCase().replace(/^@/, ''),
        fallbackOrganizerEmail: dto.fallbackOrganizerEmail.trim().toLowerCase(),
        meetingStageId: dto.meetingStageId ?? null,
        defaultDurationMinutes: dto.defaultDurationMinutes,
        ...(parsedKey
          ? {
              serviceAccountEmail: parsedKey.client_email,
              serviceAccountKeyEncrypted: this.encrypt(JSON.stringify(parsedKey)),
            }
          : {}),
        updatedBy: actorUserId,
      },
    });
    return this.getPublic();
  }

  /** Configuração em uso; null quando a integração está desativada ou sem chave. */
  async getRuntime() {
    const settings = await this.ensureSettings();
    if (!settings.enabled || !settings.serviceAccountKeyEncrypted) return null;
    return {
      settings,
      key: JSON.parse(this.decrypt(settings.serviceAccountKeyEncrypted)) as ServiceAccountKey,
    };
  }

  async test() {
    const settings = await this.ensureSettings();
    if (!settings.serviceAccountKeyEncrypted) {
      throw new BadRequestException('Salve a chave da conta de serviço antes de testar.');
    }
    const key = JSON.parse(this.decrypt(settings.serviceAccountKeyEncrypted)) as ServiceAccountKey;
    try {
      const token = await fetchAccessToken(key, settings.fallbackOrganizerEmail);
      const calendar = await checkCalendarAccess(token);
      return {
        message: `Conexão validada com a agenda de ${settings.fallbackOrganizerEmail} (${calendar}).`,
      };
    } catch (error) {
      if (error instanceof GoogleCalendarError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }

  ensureSettings() {
    return this.prisma.googleCalendarSettings.upsert({
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
