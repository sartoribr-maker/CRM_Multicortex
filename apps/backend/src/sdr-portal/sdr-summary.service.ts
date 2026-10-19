import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SdrSummaryLeadsQueryDto, SdrSummaryQueryDto } from './dto/sdr-summary.query.dto';
import { SdrPortalSettingsService } from './sdr-portal-settings.service';
import { computeSdrSummary, resolvePeriod } from './sdr-summary';

const TASK_SELECT = {
  id: true,
  title: true,
  dueDate: true,
  status: true,
  priority: true,
  lead: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

@Injectable()
export class SdrSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SdrPortalSettingsService,
  ) {}

  /**
   * Indicadores do Dashboard SDR sobre os leads do parceiro comercial SDR,
   * opcionalmente filtrados por responsável. As tarefas são sempre do
   * usuário logado.
   */
  /** Período, configuração e escopo de leads comuns aos indicadores e às listas. */
  private async context(query: SdrSummaryQueryDto, now: Date) {
    const range = resolvePeriod(query.period, now, query.from, query.to);
    const settings = await this.settingsService.get();
    const sdrLeads: Prisma.LeadWhereInput = settings.sdrPartnerId
      ? { deletedAt: null, partnerId: settings.sdrPartnerId }
      : { id: { in: [] } };
    const scope: Prisma.LeadWhereInput = query.ownerId
      ? {
          ...sdrLeads,
          OR: [{ ownerId: query.ownerId }, { assignees: { some: { userId: query.ownerId } } }],
        }
      : sdrLeads;
    return { range, settings, sdrLeads, scope, inRange: { gte: range.start, lt: range.end } };
  }

  async summary(query: SdrSummaryQueryDto, user: JwtPayload, now = new Date()) {
    const { range, settings, sdrLeads, scope, inRange } = await this.context(query, now);
    const canViewTasks = user.permissions.includes(PERMISSIONS.TASKS_VIEW);
    const openTask: Prisma.TaskWhereInput = {
      deletedAt: null,
      status: { notIn: ['DONE', 'CANCELED'] },
      assignees: { some: { userId: user.sub } },
    };

    const [
      visibleStages,
      createdLeads,
      qualifications,
      disqualifications,
      activeLeads,
      stageDurations,
      overdueTasks,
      upcomingTasks,
      recentActivities,
      ownerRows,
    ] = await Promise.all([
      this.prisma.stage.findMany({
        where: { id: { in: settings.visibleStageIds }, deletedAt: null },
        select: { id: true, name: true, color: true, order: true },
        orderBy: { order: 'asc' },
      }),
      this.prisma.lead.findMany({
        where: { ...scope, createdAt: inRange },
        select: { id: true, createdAt: true, leadType: true },
      }),
      settings.qualifiedStageId
        ? this.prisma.stageHistoryEntry.findMany({
            where: { toStageId: settings.qualifiedStageId, createdAt: inRange, lead: scope },
            select: { leadId: true, createdAt: true, lead: { select: { leadType: true } } },
          })
        : Promise.resolve([]),
      this.prisma.stageHistoryEntry.findMany({
        where: { createdAt: inRange, toStage: { isLostStage: true }, lead: scope },
        select: { leadId: true, lead: { select: { lossReason: true, leadType: true } } },
      }),
      this.prisma.lead.findMany({
        where: { ...scope, status: 'OPEN', stageId: { in: settings.visibleStageIds } },
        select: {
          id: true,
          name: true,
          businessCode: true,
          companyName: true,
          leadType: true,
          stageId: true,
          stageEnteredAt: true,
          priority: { select: { id: true, name: true, color: true, order: true } },
        },
      }),
      this.prisma.stageHistoryEntry.findMany({
        where: {
          createdAt: inRange,
          fromStageId: { in: settings.visibleStageIds },
          timeInPreviousStageSeconds: { not: null },
          lead: scope,
        },
        select: { fromStageId: true, timeInPreviousStageSeconds: true },
      }),
      canViewTasks
        ? this.prisma.task.findMany({
            where: { ...openTask, dueDate: { lt: now } },
            select: TASK_SELECT,
            orderBy: { dueDate: 'asc' },
            take: 6,
          })
        : Promise.resolve([]),
      canViewTasks
        ? this.prisma.task.findMany({
            where: { ...openTask, dueDate: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) } },
            select: TASK_SELECT,
            orderBy: { dueDate: 'asc' },
            take: 6,
          })
        : Promise.resolve([]),
      this.prisma.leadActivity.findMany({
        where: { lead: scope },
        select: {
          id: true,
          type: true,
          message: true,
          createdAt: true,
          actorUser: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true, businessCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      // Responsáveis dos leads do parceiro SDR, para o filtro do dashboard.
      this.prisma.leadAssignee.findMany({
        where: { lead: sdrLeads },
        distinct: ['userId'],
        select: { user: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      ...computeSdrSummary({
        now,
        range,
        staleDays: settings.staleDays,
        visibleStages,
        createdLeads,
        qualifications: qualifications.map((entry) => ({
          leadId: entry.leadId,
          createdAt: entry.createdAt,
          leadType: entry.lead.leadType,
        })),
        disqualifications: disqualifications.map((entry) => ({
          leadId: entry.leadId,
          lossReason: entry.lead.lossReason,
          leadType: entry.lead.leadType,
        })),
        activeLeads,
        stageDurations: stageDurations.map((entry) => ({
          fromStageId: entry.fromStageId!,
          seconds: entry.timeInPreviousStageSeconds!,
        })),
      }),
      owners: ownerRows
        .map(({ user: owner }) => owner)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      tasks: { enabled: canViewTasks, overdue: overdueTasks, upcoming: upcomingTasks },
      recentActivities,
    };
  }

  /**
   * Leads que compõem um card do dashboard, com as mesmas regras do indicador.
   * Nenhum valor financeiro é selecionado.
   */
  async leads(query: SdrSummaryLeadsQueryDto, now = new Date()) {
    const { settings, scope, inRange } = await this.context(query, now);
    const typeFilter: Prisma.LeadWhereInput =
      query.leadType === undefined
        ? {}
        : { leadType: query.leadType === 'NONE' ? null : query.leadType };
    const where: Prisma.LeadWhereInput = { AND: [scope, typeFilter] };

    // Data e motivo do evento que coloca o lead no card (qualificação/perda).
    const events = new Map<string, { at: Date; reason: string | null }>();
    let leadWhere: Prisma.LeadWhereInput;
    if (query.metric === 'created') {
      leadWhere = { ...where, createdAt: inRange };
    } else if (query.metric === 'active') {
      leadWhere = { ...where, status: 'OPEN', stageId: { in: settings.visibleStageIds } };
    } else {
      const history =
        query.metric === 'qualified' && !settings.qualifiedStageId
          ? []
          : await this.prisma.stageHistoryEntry.findMany({
              where: {
                createdAt: inRange,
                lead: where,
                ...(query.metric === 'qualified'
                  ? { toStageId: settings.qualifiedStageId! }
                  : { toStage: { isLostStage: true } }),
              },
              select: { leadId: true, createdAt: true, reason: true },
              orderBy: { createdAt: 'asc' },
            });
      for (const entry of history) {
        if (!events.has(entry.leadId)) {
          events.set(entry.leadId, { at: entry.createdAt, reason: entry.reason });
        }
      }
      leadWhere = { id: { in: [...events.keys()] } };
    }

    const rows = await this.prisma.lead.findMany({
      where: leadWhere,
      select: {
        id: true,
        businessCode: true,
        name: true,
        companyName: true,
        contactName: true,
        leadType: true,
        status: true,
        lossReason: true,
        createdAt: true,
        stageEnteredAt: true,
        stage: { select: { id: true, name: true, color: true } },
        priority: { select: { id: true, name: true, color: true } },
        assignees: { select: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return rows
      .map(({ assignees, ...lead }) => {
        const event = events.get(lead.id);
        return {
          ...lead,
          responsibles: assignees.map(({ user }) => user.name),
          eventAt: event?.at ?? (query.metric === 'created' ? lead.createdAt : null),
          eventReason: event?.reason ?? null,
          daysInStage: Math.floor((now.getTime() - lead.stageEnteredAt.getTime()) / 86_400_000),
          // Só leads em etapas do portal podem ser abertos no Kanban SDR.
          openInPortal: settings.visibleStageIds.includes(lead.stage.id),
        };
      })
      .sort((a, b) =>
        query.metric === 'active'
          ? b.daysInStage - a.daysInStage
          : (b.eventAt?.getTime() ?? 0) - (a.eventAt?.getTime() ?? 0),
      );
  }

}
