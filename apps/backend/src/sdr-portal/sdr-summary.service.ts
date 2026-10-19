import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SdrSummaryQueryDto } from './dto/sdr-summary.query.dto';
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

  /** Indicadores do Dashboard SDR, sempre no escopo do usuário logado. */
  async summary(query: SdrSummaryQueryDto, user: JwtPayload, now = new Date()) {
    const range = resolvePeriod(query.period, now, query.from, query.to);
    const settings = await this.settingsService.get();
    const scope: Prisma.LeadWhereInput = {
      deletedAt: null,
      OR: [{ ownerId: user.sub }, { assignees: { some: { userId: user.sub } } }],
    };
    const inRange = { gte: range.start, lt: range.end };
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
    ] = await Promise.all([
      this.prisma.stage.findMany({
        where: { id: { in: settings.visibleStageIds }, deletedAt: null },
        select: { id: true, name: true, color: true, order: true },
        orderBy: { order: 'asc' },
      }),
      this.prisma.lead.findMany({
        where: { deletedAt: null, createdBy: user.sub, createdAt: inRange },
        select: { id: true, createdAt: true },
      }),
      settings.qualifiedStageId
        ? this.prisma.stageHistoryEntry.findMany({
            where: {
              toStageId: settings.qualifiedStageId,
              changedByUserId: user.sub,
              createdAt: inRange,
              lead: { deletedAt: null },
            },
            select: { leadId: true, createdAt: true },
          })
        : Promise.resolve([]),
      this.prisma.stageHistoryEntry.findMany({
        where: {
          changedByUserId: user.sub,
          createdAt: inRange,
          toStage: { isLostStage: true },
          lead: { deletedAt: null },
        },
        select: { leadId: true, lead: { select: { lossReason: true } } },
      }),
      this.prisma.lead.findMany({
        where: { ...scope, status: 'OPEN', stageId: { in: settings.visibleStageIds } },
        select: {
          id: true,
          name: true,
          businessCode: true,
          companyName: true,
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
    ]);

    return {
      ...computeSdrSummary({
        now,
        range,
        staleDays: settings.staleDays,
        visibleStages,
        createdLeads,
        qualifications,
        disqualifications: disqualifications.map((entry) => ({
          leadId: entry.leadId,
          lossReason: entry.lead.lossReason,
        })),
        activeLeads,
        stageDurations: stageDurations.map((entry) => ({
          fromStageId: entry.fromStageId!,
          seconds: entry.timeInPreviousStageSeconds!,
        })),
      }),
      tasks: { enabled: canViewTasks, overdue: overdueTasks, upcoming: upcomingTasks },
      recentActivities,
    };
  }
}
