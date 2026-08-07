import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { EmailNotificationsService } from '../notifications/email-notifications.service';

const INCLUDE = {
  assignee: { select: { id: true, name: true, email: true } },
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
    return this.canViewAll(user) ? {} : { assigneeId: user.sub };
  }

  async findAll(query: ListTasksQueryDto, user: JwtPayload) {
    const effectiveAssigneeId = query.mine ? user.sub : query.assigneeId;
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...this.visibility(user),
      ...(effectiveAssigneeId && this.canViewAll(user) ? { assigneeId: effectiveAssigneeId } : {}),
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
  async create(dto: CreateTaskDto, user: JwtPayload) {
    const assigneeId = dto.assigneeId ?? user.sub;
    if (assigneeId !== user.sub && !this.canViewAll(user))
      throw new ForbiddenException('Você não pode atribuir tarefas a outro usuário.');
    const task = await this.prisma.task.create({
      data: {
        ...dto,
        dueDate: new Date(dto.dueDate),
        assigneeId,
        createdByUserId: user.sub,
        completedAt: dto.status === 'DONE' ? new Date() : undefined,
      },
      include: INCLUDE,
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
    if (dto.assigneeId && dto.assigneeId !== user.sub && !this.canViewAll(user))
      throw new ForbiddenException('Você não pode reatribuir esta tarefa.');
    const completedAt = dto.status
      ? dto.status === 'DONE'
        ? (existing.completedAt ?? new Date())
        : null
      : undefined;
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt,
        assigneeAssignedAt:
          dto.assigneeId && dto.assigneeId !== existing.assignee.id ? new Date() : undefined,
      },
      include: INCLUDE,
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
}
