import {
  BadRequestException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailNotificationsService } from './email-notifications.service';
import { EmailSettingsService } from './email-settings.service';
import { UpdateMonitoringSettingsDto } from './dto/update-monitoring-settings.dto';

const DAY = 86_400_000;
// Brasília (UTC−03:00), independentemente do fuso do servidor.
export function firstMonitoringRun(startTime: string, now: Date): Date {
  const date = new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  const result = new Date(`${date}T${startTime}:00-03:00`);
  if (result <= now) result.setTime(result.getTime() + DAY);
  return result;
}

@Injectable()
export class MonitoringService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailNotificationsService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), 30_000);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  get() {
    return this.prisma.monitoringSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  users() {
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(dto: UpdateMonitoringSettingsDto, actor: string) {
    if (dto.enabled && !dto.monitorUserId)
      throw new BadRequestException('Selecione o usuário de monitoramento.');
    if (
      dto.monitorUserId &&
      !(await this.prisma.user.findFirst({
        where: { id: dto.monitorUserId, status: 'ACTIVE', deletedAt: null },
      }))
    )
      throw new BadRequestException('Selecione um usuário ativo.');
    if (dto.enabled && !(await this.emailSettings.getRuntimeConfig())) {
      throw new BadRequestException(
        'Configure e ative o envio de e-mail antes de ativar o monitoramento.',
      );
    }
    const current = await this.get();
    const reschedule =
      !current.enabled ||
      dto.startTime !== current.startTime ||
      dto.intervalDays !== current.intervalDays;
    return this.prisma.monitoringSettings.update({
      where: { id: 'default' },
      data: {
        ...dto,
        updatedBy: actor,
        nextRunAt: dto.enabled
          ? reschedule
            ? firstMonitoringRun(dto.startTime, new Date())
            : current.nextRunAt
          : null,
      },
    });
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const settings = await this.get();
      if (!settings.enabled || !settings.nextRunAt || settings.nextRunAt > now) return;
      const period = settings.intervalDays * DAY;
      const nextRunAt = new Date(
        settings.nextRunAt.getTime() +
          (Math.floor((now.getTime() - settings.nextRunAt.getTime()) / period) + 1) * period,
      );
      // Compare-and-swap evita o mesmo disparo em instâncias concorrentes.
      const claim = await this.prisma.monitoringSettings.updateMany({
        where: {
          id: settings.id,
          enabled: true,
          nextRunAt: settings.nextRunAt,
          updatedAt: settings.updatedAt,
        },
        data: { nextRunAt, lastRunAt: now, lastError: null },
      });
      if (!claim.count) return;
      try {
        const results = await Promise.allSettled([
          this.sendReports(settings.monitorUserId, now),
          this.sendPendingTaskReports(),
        ]);
        const failure = results.find((result) => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      } catch (error) {
        await this.prisma.monitoringSettings.update({
          where: { id: settings.id },
          data: {
            lastError:
              'Falha no envio dos relatórios. Verifique o SMTP e os usuários ativos. Consulte os logs do servidor.',
          },
        });
        throw error;
      }
    } catch (error) {
      this.logger.error('Falha no monitoramento de tarefas/leads.', error);
    } finally {
      this.running = false;
    }
  }

  async sendPendingTaskReports() {
    const tasks = await this.prisma.task.findMany({
      where: { deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] } },
      include: { assignee: true, assignees: { include: { user: true } }, lead: true },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });
    const recipients = new Map<
      string,
      { user: (typeof tasks)[number]['assignee']; tasks: typeof tasks }
    >();
    for (const task of tasks) {
      const owners = task.assignees.length
        ? task.assignees.map((item) => item.user)
        : [task.assignee];
      for (const user of new Map(owners.map((owner) => [owner.id, owner])).values()) {
        if (user.status !== 'ACTIVE' || user.deletedAt) continue;
        if (!recipients.has(user.id)) recipients.set(user.id, { user, tasks: [] });
        recipients.get(user.id)!.tasks.push(task);
      }
    }
    const results = await Promise.allSettled(
      [...recipients.values()].map(({ user, tasks: items }) =>
        this.email.monitoringReport(
          user,
          'Tarefas a fazer e em andamento',
          items.map((task) => ({
            id: task.id,
            title: task.title,
            detail: `Status: ${task.status === 'TODO' ? 'A Fazer' : 'Em andamento'} | Prazo: ${task.dueDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${task.lead ? ` | Oportunidade: ${task.lead.name}` : ''}`,
          })),
          'tasks',
        ),
      ),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }

  async sendReports(monitorUserId: string | null, now: Date) {
    const recipients = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        OR: [{ isCollector: true }, ...(monitorUserId ? [{ id: monitorUserId }] : [])],
      },
      select: { id: true, name: true, email: true },
    });
    if (!recipients.some((user) => user.id === monitorUserId))
      throw new Error('Usuário de monitoramento inativo ou excluído.');
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        dueDate: { lt: now },
        status: { notIn: ['DONE', 'CANCELED'] },
      },
      include: { assignee: true, assignees: { include: { user: true } }, lead: true },
      orderBy: { dueDate: 'asc' },
    });
    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        stage: {
          deletedAt: null,
          OR: [
            { name: { equals: 'Backlog', mode: 'insensitive' } },
            { name: { equals: 'Leads', mode: 'insensitive' } },
          ],
        },
      },
      include: { stage: true },
      orderBy: { stageEnteredAt: 'asc' },
    });
    const deliveries: Promise<void>[] = [];
    const taskRecipients = new Map(recipients.map((user) => [user.id, { user, tasks }]));
    for (const task of tasks) {
      const owners = task.assignees.length
        ? task.assignees.map((item) => item.user)
        : [task.assignee];
      for (const user of owners) {
        if (
          user.status !== 'ACTIVE' ||
          user.deletedAt ||
          recipients.some((item) => item.id === user.id)
        )
          continue;
        if (!taskRecipients.has(user.id)) taskRecipients.set(user.id, { user, tasks: [] });
        taskRecipients.get(user.id)!.tasks.push(task);
      }
    }
    for (const { user, tasks: items } of taskRecipients.values()) {
      if (!items.length) continue;
      deliveries.push(
        this.email.monitoringReport(
          user,
          'Tarefas em atraso',
          items.map((task) => ({
            id: task.id,
            title: task.title,
            detail: `Prazo: ${task.dueDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} | Responsáveis: ${(task.assignees.length ? task.assignees.map((item) => item.user.name) : [task.assignee.name]).join(', ')}${task.lead ? ` | Oportunidade: ${task.lead.name}` : ''}`,
          })),
          'tasks',
        ),
      );
    }
    if (leads.length)
      for (const user of recipients) {
        deliveries.push(
          this.email.monitoringReport(
            user,
            'Oportunidades em Backlog ou Leads',
            leads.map((lead) => ({
              id: lead.id,
              title: lead.name,
              detail: `Etapa: ${lead.stage.name}${lead.companyName ? ` | Empresa: ${lead.companyName}` : ''}`,
            })),
            'leads',
          ),
        );
      }
    const results = await Promise.allSettled(deliveries);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
}
