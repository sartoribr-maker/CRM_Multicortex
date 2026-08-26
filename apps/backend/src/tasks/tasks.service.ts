import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { EmailNotificationsService } from '../notifications/email-notifications.service';
import { ExtendTaskDeadlineDto } from './dto/extend-task-deadline.dto';
import { TransferTaskDto } from './dto/transfer-task.dto';

const INCLUDE = {
  assignee: { select: { id: true, name: true, email: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { assignedAt: 'asc' },
  },
  createdByUser: { select: { id: true, name: true } },
  lead: {
    select: {
      id: true,
      name: true,
      companyName: true,
      stage: { select: { id: true, name: true, color: true } },
    },
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly emailNotifications: EmailNotificationsService,
  ) {}
  private canViewAll(user: JwtPayload) {
    return user.roleName.trim().toLocaleLowerCase('pt-BR') === 'administrador';
  }
  private visibility(user: JwtPayload): Prisma.TaskWhereInput {
    return this.canViewAll(user) ? {} : { assignees: { some: { userId: user.sub } } };
  }

  async findAll(query: ListTasksQueryDto, user: JwtPayload) {
    const effectiveAssigneeId = query.mine ? user.sub : query.assigneeId;
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...this.visibility(user),
      ...(effectiveAssigneeId && this.canViewAll(user)
        ? { assignees: { some: { userId: effectiveAssigneeId } } }
        : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.overdue
        ? { dueDate: { lt: new Date() }, status: { notIn: ['DONE', 'CANCELED'] } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { lead: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
  async findOne(id: string, user: JwtPayload) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null, ...this.visibility(user) },
      include: INCLUDE,
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    return task;
  }
  async sendReminder(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    await this.emailNotifications.taskReminder({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      assignees: task.assignees.map(({ user: assignee }) => assignee),
      leadName: task.lead?.name,
      description: task.description,
      createdByName: task.createdByUser.name,
      leadCompanyName: task.lead?.companyName,
      leadStageName: task.lead?.stage.name,
    });
    await this.audit.record({
      action: 'TASK_REMINDER_SENT',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: task.id,
    });
    return { success: true };
  }
  async create(dto: CreateTaskDto, user: JwtPayload) {
    const assigneeIds = [
      ...new Set(dto.assigneeIds?.length ? dto.assigneeIds : [dto.assigneeId ?? user.sub]),
    ];
    const assigneeId = assigneeIds[0];
    if (assigneeIds.some((id) => id !== user.sub) && !this.canViewAll(user))
      throw new ForbiddenException('Você não pode atribuir tarefas a outro usuário.');
    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: dto.title,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          dueDate: new Date(dto.dueDate),
          leadId: dto.leadId,
          assigneeId,
          createdByUserId: user.sub,
          completedAt: dto.status === 'DONE' ? new Date() : undefined,
        },
      });
      await tx.taskAssignee.createMany({
        data: assigneeIds.map((userId) => ({ taskId: created.id, userId, assignedBy: user.sub })),
      });
      return tx.task.findUniqueOrThrow({ where: { id: created.id }, include: INCLUDE });
    });
    await this.audit.record({
      action: 'TASK_CREATED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: task.id,
    });
    await this.emailNotifications.taskCreated({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      assignees: task.assignees.map(({ user: assignee }) => assignee),
      leadName: task.lead?.name,
      description: task.description,
      createdByName: task.createdByUser.name,
      leadCompanyName: task.lead?.companyName,
      leadStageName: task.lead?.stage.name,
    });
    return task;
  }
  async update(id: string, dto: UpdateTaskDto, user: JwtPayload) {
    const existing = await this.findOne(id, user);
    const requestedAssigneeIds = dto.assigneeIds?.length
      ? [...new Set(dto.assigneeIds)]
      : dto.assigneeId
        ? [dto.assigneeId]
        : undefined;
    if (
      requestedAssigneeIds?.some((assigneeId) => assigneeId !== user.sub) &&
      !this.canViewAll(user)
    )
      throw new ForbiddenException('Você não pode reatribuir esta tarefa.');
    const completedAt = dto.status
      ? dto.status === 'DONE'
        ? (existing.completedAt ?? new Date())
        : null
      : undefined;
    const task = await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          leadId: dto.leadId,
          completedAt,
          assigneeId: requestedAssigneeIds?.[0],
          assigneeAssignedAt:
            requestedAssigneeIds?.[0] && requestedAssigneeIds[0] !== existing.assignee.id
              ? new Date()
              : undefined,
        },
      });
      if (requestedAssigneeIds) {
        await tx.taskAssignee.deleteMany({ where: { taskId: id } });
        await tx.taskAssignee.createMany({
          data: requestedAssigneeIds.map((userId) => ({
            taskId: id,
            userId,
            assignedBy: user.sub,
          })),
        });
      }
      return tx.task.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
    await this.audit.record({
      action: dto.status === 'DONE' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
    });
    await this.emailNotifications.taskUpdated({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      assignees: task.assignees.map(({ user: assignee }) => assignee),
      leadName: task.lead?.name,
      description: task.description,
      createdByName: task.createdByUser.name,
      leadCompanyName: task.lead?.companyName,
      leadStageName: task.lead?.stage.name,
    });
    return task;
  }
  async archive(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    await this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      action: 'TASK_ARCHIVED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
    });
  }

  async remove(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    await this.prisma.task.delete({ where: { id } });
    await this.audit.record({
      action: 'TASK_DELETED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
      metadata: { title: task.title },
    });
  }

  async extendDeadline(id: string, dto: ExtendTaskDeadlineDto, user: JwtPayload) {
    const existing = await this.findOne(id, user);
    const newDueDate = new Date(dto.dueDate);
    if (newDueDate.getTime() <= existing.dueDate.getTime()) {
      throw new BadRequestException('A nova data deve ser posterior ao prazo atual.');
    }
    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: { dueDate: newDueDate },
        include: INCLUDE,
      });
      await tx.taskHistoryEntry.create({
        data: {
          taskId: id,
          type: 'DEADLINE_EXTENDED',
          reason: dto.reason.trim(),
          actorUserId: user.sub,
          metadata: {
            previousDueDate: existing.dueDate.toISOString(),
            newDueDate: newDueDate.toISOString(),
          },
        },
      });
      return updated;
    });
    await this.audit.record({
      action: 'TASK_DEADLINE_EXTENDED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
      metadata: { reason: dto.reason },
    });
    return task;
  }

  async transfer(id: string, dto: TransferTaskDto, user: JwtPayload) {
    const existing = await this.findOne(id, user);
    const newAssignee = await this.prisma.user.findFirst({
      where: { id: dto.assigneeId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    if (!newAssignee) throw new BadRequestException('Responsável de destino não encontrado.');
    const previousAssignees = existing.assignees.map(({ user: assignee }) => ({
      id: assignee.id,
      name: assignee.name,
    }));
    if (previousAssignees.length === 1 && previousAssignees[0].id === newAssignee.id) {
      throw new BadRequestException('A tarefa já está atribuída a este responsável.');
    }
    const task = await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: { assigneeId: newAssignee.id, assigneeAssignedAt: new Date() },
      });
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      await tx.taskAssignee.create({
        data: { taskId: id, userId: newAssignee.id, assignedBy: user.sub },
      });
      await tx.taskHistoryEntry.create({
        data: {
          taskId: id,
          type: 'TRANSFERRED',
          reason: dto.reason.trim(),
          actorUserId: user.sub,
          metadata: { previousAssignees, newAssignee },
        },
      });
      return tx.task.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
    await this.audit.record({
      action: 'TASK_TRANSFERRED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
      metadata: { reason: dto.reason, newAssigneeId: newAssignee.id },
    });
    return task;
  }

  async history(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.taskHistoryEntry.findMany({
      where: { taskId: id },
      include: { actorUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
