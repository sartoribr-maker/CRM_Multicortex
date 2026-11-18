import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../auth/constants/permissions';
import { assertCanDeleteRecord } from '../auth/delete-ownership';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { GoogleTasksService } from '../calendar/google-tasks.service';
import { hiddenMandatoryLeadIds } from '../leads/mandatory-priority';
import { EmailNotificationsService } from '../notifications/email-notifications.service';
import type { PmoActor } from '../pmo/pmo-client.service';
import { PmoTasksGateway } from '../pmo/pmo-tasks.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ExtendTaskDeadlineDto } from './dto/extend-task-deadline.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { TransferTaskDto } from './dto/transfer-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export type CrmTask = Awaited<ReturnType<PmoTasksGateway['adapt']>>[number];

/**
 * Tarefas do CRM. Desde a integração (2026-11-17) elas moram na base do Multicortex Projetos (PMO)
 * e são lidas/gravadas pela API de integração; as regras do CRM continuam aqui (visibilidade,
 * atribuição, justificativa ao concluir, e-mails, Google Agenda e auditoria).
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly emailNotifications: EmailNotificationsService,
    private readonly calendar: GoogleTasksService,
    private readonly pmo: PmoTasksGateway,
  ) {}

  googleCalendarConfig(user: JwtPayload) {
    return this.calendar.config(user);
  }

  private canViewAll(user: JwtPayload) {
    return user.roleName.trim().toLocaleLowerCase('pt-BR') === 'administrador';
  }

  /** Quem age no PMO: a pessoa pelo e-mail, com a visão total se o CRM a dá. */
  actor(user: JwtPayload, seeAll = this.canViewAll(user)): PmoActor {
    return { email: user.email, name: user.name, seeAll };
  }

  /** Leads Mandatórios ficam ocultos (com suas tarefas) para quem não os vê. */
  hiddenLeadIds(user: JwtPayload): Promise<string[] | undefined> {
    return hiddenMandatoryLeadIds(this.prisma, user);
  }

  private async filters(query: ListTasksQueryDto, user: JwtPayload) {
    const all = this.canViewAll(user);
    return {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      priority: query.priority,
      leadId: query.leadId,
      mine: query.mine || undefined,
      // Filtrar por responsável só faz sentido para quem vê todas.
      assigneeUserId: all && !query.mine ? query.assigneeId : undefined,
      overdue: query.overdue,
      hiddenLeadIds: await this.hiddenLeadIds(user),
    };
  }

  async findAll(query: ListTasksQueryDto, user: JwtPayload) {
    return this.pmo.list(await this.filters(query, user), this.actor(user));
  }

  /** Quantidade de tarefas por status, com os mesmos filtros da lista exceto o de status. */
  async statusSummary(query: ListTasksQueryDto, user: JwtPayload) {
    return this.pmo.summary(await this.filters(query, user), this.actor(user));
  }

  async findOne(id: string, user: JwtPayload): Promise<CrmTask> {
    const task = await this.pmo.get(id, this.actor(user));
    const hidden = await this.hiddenLeadIds(user);
    if (task.deletedAt || (task.leadId && hidden?.includes(task.leadId)))
      throw new NotFoundException('Tarefa não encontrada.');
    return task;
  }

  private emailData(task: CrmTask) {
    if (!task.assignee || !task.dueDate) return null;
    return {
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      assignees: task.assignees.map(({ user: assignee }) => assignee),
      leadName: task.lead?.name,
      description: task.description,
      createdByName: task.createdByUser?.name,
      leadCompanyName: task.lead?.companyName,
      leadStageName: task.lead?.stage?.name,
    };
  }

  /** Tarefa sem prazo (criada no PMO) não vai para o Google Agenda. */
  private googleTask(task: CrmTask) {
    return task.dueDate ? { ...task, dueDate: task.dueDate } : null;
  }

  /** Aplica o checkbox "Vincular com o Google Agenda" e propaga a alteração aos demais vínculos. */
  private async syncCalendar(
    task: CrmTask,
    syncGoogleCalendar: boolean | undefined,
    user: JwtPayload,
  ) {
    const forGoogle = this.googleTask(task);
    if (!forGoogle) return task;
    const googleCalendar =
      syncGoogleCalendar === true
        ? await this.calendar.link(forGoogle, user)
        : syncGoogleCalendar === false
          ? await this.calendar.unlink(task.id, user)
          : undefined;
    await this.calendar.refresh(forGoogle, syncGoogleCalendar === undefined ? undefined : user.sub);
    if (!googleCalendar) return task;
    // O vínculo com o Google mudou: relê para devolver `googleTasks` atualizado.
    const refreshed = await this.pmo.get(task.id, this.actor(user)).catch(() => task);
    return { ...refreshed, googleCalendar };
  }

  async sendReminder(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    const data = this.emailData(task);
    if (!data) throw new BadRequestException('Esta tarefa não tem responsável ou prazo.');
    await this.emailNotifications.taskReminder(data);
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
    if (assigneeIds.some((id) => id !== user.sub) && !this.canViewAll(user))
      throw new ForbiddenException('Você não pode atribuir tarefas a outro usuário.');
    if (dto.status === 'DONE' && !dto.completionReason?.trim()) {
      throw new BadRequestException('Informe a justificativa obrigatória ao concluir a tarefa.');
    }
    if (dto.syncGoogleCalendar) await this.calendar.assertCanLink(user);
    const task = await this.pmo.create(
      {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate,
        leadId: dto.leadId,
        assigneeIds,
        completionReason: dto.completionReason?.trim(),
      },
      this.actor(user),
    );
    await this.audit.record({
      action: 'TASK_CREATED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: task.id,
    });
    const data = this.emailData(task);
    if (data) await this.emailNotifications.taskCreated(data);
    return this.syncCalendar(task, dto.syncGoogleCalendar || undefined, user);
  }

  /** Criação a partir da movimentação de um lead (etapa), com os e-mails de sempre. */
  async createForLeadMove(
    input: {
      title: string;
      description: string;
      priority: CreateTaskDto['priority'];
      dueDate: string;
      leadId: string;
      assigneeId: string;
    },
    user: JwtPayload,
  ) {
    const task = await this.pmo.create(
      {
        title: input.title,
        description: input.description,
        status: 'TODO',
        priority: input.priority,
        dueDate: input.dueDate,
        leadId: input.leadId,
        assigneeIds: [input.assigneeId],
      },
      // Quem move o lead cria a tarefa para o responsável do lead.
      this.actor(user, true),
    );
    const data = this.emailData(task);
    if (data) await this.emailNotifications.taskCreated({ ...data, createdByName: user.name });
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
    const transitioningToDone = existing.status !== 'DONE' && dto.status === 'DONE';
    if (transitioningToDone && !dto.completionReason?.trim()) {
      throw new BadRequestException('Informe a justificativa obrigatória ao concluir a tarefa.');
    }
    if (dto.syncGoogleCalendar) await this.calendar.assertCanLink(user);
    const task = await this.pmo.update(
      id,
      {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate,
        leadId: dto.leadId,
        assigneeIds: requestedAssigneeIds,
        completionReason: transitioningToDone ? dto.completionReason!.trim() : undefined,
      },
      this.actor(user),
    );
    await this.audit.record({
      action: dto.status === 'DONE' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
    });
    const data = this.emailData(task);
    if (data) await this.emailNotifications.taskUpdated(data);
    return this.syncCalendar(task, dto.syncGoogleCalendar, user);
  }

  async complete(id: string, dto: CompleteTaskDto, user: JwtPayload) {
    const existing = await this.findOne(id, user);
    if (existing.status === 'DONE') {
      throw new BadRequestException('Esta tarefa já está concluída.');
    }
    const task = await this.pmo.complete(id, dto.reason.trim(), this.actor(user));
    await this.audit.record({
      action: 'TASK_COMPLETED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
      metadata: { reason: dto.reason },
    });
    const data = this.emailData(task);
    if (data) await this.emailNotifications.taskUpdated(data);
    const forGoogle = this.googleTask(task);
    if (forGoogle) await this.calendar.refresh(forGoogle);
    return task;
  }

  async archive(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    assertCanDeleteRecord(user, PERMISSIONS.TASKS_DELETE, task.createdByUserId);
    await this.pmo.archive(id, this.actor(user));
    await this.calendar.removeAll(id);
    await this.audit.record({
      action: 'TASK_ARCHIVED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
    });
  }

  async remove(id: string, user: JwtPayload) {
    const task = await this.findOne(id, user);
    assertCanDeleteRecord(user, PERMISSIONS.TASKS_DELETE, task.createdByUserId);
    await this.calendar.removeAll(id);
    await this.pmo.remove(id, this.actor(user));
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
    if (existing.dueDate && newDueDate.getTime() <= existing.dueDate.getTime()) {
      throw new BadRequestException('A nova data deve ser posterior ao prazo atual.');
    }
    const task = await this.pmo.extendDeadline(
      id,
      dto.dueDate,
      dto.reason.trim(),
      this.actor(user),
    );
    await this.audit.record({
      action: 'TASK_DEADLINE_EXTENDED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
      metadata: { reason: dto.reason },
    });
    const forGoogle = this.googleTask(task);
    if (forGoogle) await this.calendar.refresh(forGoogle);
    return task;
  }

  async transfer(id: string, dto: TransferTaskDto, user: JwtPayload) {
    await this.findOne(id, user);
    const task = await this.pmo.transfer(id, dto.assigneeId, dto.reason.trim(), this.actor(user));
    await this.audit.record({
      action: 'TASK_TRANSFERRED',
      actorUserId: user.sub,
      targetType: 'Task',
      targetId: id,
      metadata: { reason: dto.reason, newAssigneeId: dto.assigneeId },
    });
    return task;
  }

  async history(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.pmo.history(id, this.actor(user));
  }
}
