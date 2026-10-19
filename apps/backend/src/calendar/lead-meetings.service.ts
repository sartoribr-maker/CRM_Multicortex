import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { LeadActivityService } from '../leads/lead-activity.service';
import { LeadsService } from '../leads/leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadMeetingDto } from './dto/create-lead-meeting.dto';
import { GoogleCalendarSettingsService } from './google-calendar-settings.service';
import { AvailabilityQueryDto } from './dto/availability.query.dto';
import {
  fetchAccessToken,
  GOOGLE_FREEBUSY_SCOPE,
  GoogleCalendarError,
  insertCalendarEvent,
  MEETING_TIME_ZONE,
  pickOrganizer,
  queryFreeBusy,
} from './google-calendar.client';

const MAX_DURATION_MS = 12 * 3_600_000;
const MAX_AVAILABILITY_RANGE_MS = 45 * 86_400_000;

@Injectable()
export class LeadMeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GoogleCalendarSettingsService,
    private readonly leads: LeadsService,
    private readonly activities: LeadActivityService,
  ) {}

  /** O que o frontend precisa para oferecer o agendamento ao mover um lead. */
  async config() {
    const settings = await this.settings.ensureSettings();
    return {
      enabled: settings.enabled && Boolean(settings.serviceAccountKeyEncrypted),
      meetingStageId: settings.meetingStageId,
      defaultDurationMinutes: settings.defaultDurationMinutes,
      workspaceDomain: settings.workspaceDomain,
    };
  }

  /**
   * Horários ocupados das agendas do domínio do Workspace. Apenas os
   * intervalos são devolvidos; os compromissos nunca chegam ao CRM.
   */
  async availability(query: AvailabilityQueryDto, user: JwtPayload) {
    const runtime = await this.settings.getRuntime();
    if (!runtime) {
      throw new ServiceUnavailableException(
        'A integração com o Google Agenda não está configurada. Contate o administrador.',
      );
    }
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from || to.getTime() - from.getTime() > MAX_AVAILABILITY_RANGE_MS) {
      throw new BadRequestException('Período de disponibilidade inválido (máximo de 45 dias).');
    }
    const domain = runtime.settings.workspaceDomain;
    const emails = [...new Set(query.emails)].filter((email) => email.endsWith(`@${domain}`));
    if (!emails.length) return { timeZone: MEETING_TIME_ZONE, calendars: [] };

    try {
      const token = await fetchAccessToken(
        runtime.key,
        pickOrganizer(user.email, domain, runtime.settings.fallbackOrganizerEmail),
        GOOGLE_FREEBUSY_SCOPE,
      );
      return {
        timeZone: MEETING_TIME_ZONE,
        calendars: await queryFreeBusy(token, emails, from, to),
      };
    } catch (error) {
      if (error instanceof GoogleCalendarError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }

  /** Usuários ativos do CRM sugeridos como convidados. */
  attendeeSuggestions(search: string) {
    const term = search.trim();
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { name: true, email: true },
      orderBy: { name: 'asc' },
      take: 8,
    });
  }

  async list(leadId: string, user: JwtPayload) {
    await this.leads.ensureVisible(leadId, user);
    return this.prisma.leadMeeting.findMany({
      where: { leadId },
      include: { createdByUser: { select: { id: true, name: true } } },
      orderBy: { startAt: 'desc' },
    });
  }

  async create(leadId: string, dto: CreateLeadMeetingDto, user: JwtPayload) {
    await this.leads.ensureVisible(leadId, user);
    const runtime = await this.settings.getRuntime();
    if (!runtime) {
      throw new ServiceUnavailableException(
        'A integração com o Google Agenda não está configurada. Contate o administrador.',
      );
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (startAt.getTime() < Date.now() - 5 * 60_000) {
      throw new BadRequestException('A reunião precisa começar no futuro.');
    }
    if (endAt <= startAt || endAt.getTime() - startAt.getTime() > MAX_DURATION_MS) {
      throw new BadRequestException('O término deve ser depois do início, em até 12 horas.');
    }

    const organizerEmail = pickOrganizer(
      user.email,
      runtime.settings.workspaceDomain,
      runtime.settings.fallbackOrganizerEmail,
    );
    // Quem agenda pela agenda padrão entra como convidado para receber a reunião.
    const attendees = [
      ...new Set(
        [...dto.attendees, ...(organizerEmail === user.email.toLowerCase() ? [] : [user.email])]
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email && email !== organizerEmail),
      ),
    ];

    let event;
    try {
      const token = await fetchAccessToken(runtime.key, organizerEmail);
      event = await insertCalendarEvent(token, {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startAt,
        endAt,
        attendees,
        withMeet: dto.withMeet,
      });
    } catch (error) {
      if (error instanceof GoogleCalendarError) throw new ServiceUnavailableException(error.message);
      throw error;
    }

    const meeting = await this.prisma.leadMeeting.create({
      data: {
        leadId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startAt,
        endAt,
        attendees,
        withMeet: dto.withMeet,
        organizerEmail,
        googleEventId: event.id,
        htmlLink: event.htmlLink,
        meetLink: event.meetLink,
        createdByUserId: user.sub,
      },
    });
    const when = startAt.toLocaleString('pt-BR', {
      timeZone: MEETING_TIME_ZONE,
      dateStyle: 'short',
      timeStyle: 'short',
    });
    await this.activities.record({
      leadId,
      type: 'MEETING_SCHEDULED',
      message: `Reunião "${meeting.title}" agendada para ${when}${meeting.meetLink ? ' (Google Meet)' : ''}. Convidados: ${attendees.join(', ') || 'nenhum'}.`,
      actorUserId: user.sub,
      metadata: { meetingId: meeting.id, meetLink: meeting.meetLink },
    });
    return meeting;
  }
}
