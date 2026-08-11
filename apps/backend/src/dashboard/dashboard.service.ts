import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(user: JwtPayload) {
    const allLeads = user.permissions.includes(PERMISSIONS.LEADS_VIEW_ALL);
    const allTasks = user.permissions.includes(PERMISSIONS.TASKS_VIEW_ALL);
    const leadWhere: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(allLeads
        ? {}
        : { OR: [{ ownerId: user.sub }, { assignees: { some: { userId: user.sub } } }] }),
    };
    const taskWhere: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(allTasks ? {} : { assignees: { some: { userId: user.sub } } }),
    };
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);
    const [leads, stages, overdueTasks, overdueTaskCount, upcomingTasks] = await Promise.all([
      this.prisma.lead.findMany({
        where: leadWhere,
        select: {
          id: true,
          name: true,
          companyName: true,
          status: true,
          estimatedValue: true,
          updatedAt: true,
          stageId: true,
          stage: { select: { id: true, name: true, color: true, order: true } },
          priority: { select: { id: true, name: true, color: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.stage.findMany({ where: { deletedAt: null }, orderBy: { order: 'asc' } }),
      this.prisma.task.findMany({
        where: { ...taskWhere, dueDate: { lt: now }, status: { notIn: ['DONE', 'CANCELED'] } },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          assignee: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
      this.prisma.task.count({
        where: { ...taskWhere, dueDate: { lt: now }, status: { notIn: ['DONE', 'CANCELED'] } },
      }),
      this.prisma.task.findMany({
        where: {
          ...taskWhere,
          dueDate: { gte: now, lte: nextWeek },
          status: { notIn: ['DONE', 'CANCELED'] },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          assignee: { select: { id: true, name: true } },
          lead: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
    ]);
    const value = (items: typeof leads) =>
      items.reduce((sum, item) => sum + Number(item.estimatedValue ?? 0), 0);
    const open = leads.filter((item) => item.status === 'OPEN');
    const won = leads.filter((item) => item.status === 'WON');
    const lost = leads.filter((item) => item.status === 'LOST');
    const funnel = stages.map((stage) => {
      const items = leads.filter((lead) => lead.stageId === stage.id);
      return {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        order: stage.order,
        count: items.length,
        value: value(items),
      };
    });
    const owners = new Map<
      string,
      {
        id: string;
        name: string;
        openCount: number;
        wonCount: number;
        wonValue: number;
        pipelineValue: number;
      }
    >();
    for (const lead of leads) {
      const current = owners.get(lead.owner.id) ?? {
        id: lead.owner.id,
        name: lead.owner.name,
        openCount: 0,
        wonCount: 0,
        wonValue: 0,
        pipelineValue: 0,
      };
      if (lead.status === 'OPEN') {
        current.openCount++;
        current.pipelineValue += Number(lead.estimatedValue ?? 0);
      }
      if (lead.status === 'WON') {
        current.wonCount++;
        current.wonValue += Number(lead.estimatedValue ?? 0);
      }
      owners.set(lead.owner.id, current);
    }
    const mandatoryLeads = leads.filter(
      (lead) =>
        lead.priority?.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase() === 'mandatoria',
    );
    return {
      metrics: {
        totalLeads: leads.length,
        openLeads: open.length,
        wonLeads: won.length,
        lostLeads: lost.length,
        pipelineValue: value(open),
        wonValue: value(won),
        averageTicket: open.length ? value(open) / open.length : 0,
        conversionRate:
          won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0,
        overdueTasks: overdueTaskCount,
      },
      funnel,
      recentLeads: leads.slice(0, 6),
      mandatoryLeads: mandatoryLeads.slice(0, 6),
      mandatoryPriorityId: mandatoryLeads[0]?.priority?.id ?? null,
      overdueTasks,
      upcomingTasks,
      ownerPerformance: allLeads
        ? [...owners.values()].sort((a, b) => b.wonValue - a.wonValue)
        : [],
      scope: allLeads ? 'TEAM' : 'PERSONAL',
    };
  }
}
