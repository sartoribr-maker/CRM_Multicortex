import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TaskPriority, TaskStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PmoClientService, type PmoActor } from './pmo-client.service';

/** Pessoa como o PMO devolve (vínculo pelo e-mail). */
interface PmoPerson {
  email: string;
  name: string;
}

/** Tarefa no formato da API de integração do PMO. */
export interface PmoTask {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  stage: { name: string; color: string };
  priority: TaskPriority;
  priorityName: string;
  dueDate: string | null;
  startDate: string | null;
  progress: number;
  isBlocked: boolean;
  completedAt: string | null;
  source: 'PMO' | 'CRM';
  lead: { id: string; name: string | null } | null;
  project: { id: string; code: string; name: string } | null;
  assignee: PmoPerson | null;
  assignees: PmoPerson[];
  createdBy: PmoPerson | null;
  permissions: { canEdit: boolean; canEditLimited: boolean; canDelete: boolean };
  pmoUrl: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

interface PmoPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Usuário do CRM (ou, se a pessoa só existe no PMO, um marcador com id `pmo:<e-mail>`). */
export interface CrmTaskUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  deletedAt: Date | null;
}

/** Filtros que o CRM usa nas listagens (pessoas por id do CRM). */
export interface CrmTaskFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  leadId?: string;
  assigneeUserId?: string;
  mine?: boolean;
  overdue?: boolean;
  open?: boolean;
  dueFrom?: string;
  dueTo?: string;
  hiddenLeadIds?: string[];
  sortBy?: 'status' | 'dueDate';
}

export interface CrmTaskWrite {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** Instante (como o CRM sempre enviou) ou data. */
  dueDate?: string;
  leadId?: string | null;
  /** Ids de usuários do CRM; o primeiro é o responsável principal. */
  assigneeIds?: string[];
  completionReason?: string;
}

const DAY = 86_400_000;

/** Prazo do PMO (dia) → instante do CRM: meio-dia em Brasília, como o formulário do CRM grava. */
export function pmoDayToCrm(day: string | null): Date | null {
  return day ? new Date(`${day}T15:00:00.000Z`) : null;
}

/** Dia de hoje em Brasília (YYYY-MM-DD). */
export function brasiliaDay(now = new Date(), plusDays = 0): string {
  return new Date(now.getTime() - 3 * 3_600_000 + plusDays * DAY).toISOString().slice(0, 10);
}

/**
 * Tarefas do CRM sobre a base única do PMO. Traduz ids de usuários do CRM ↔ e-mails e devolve as
 * tarefas no mesmo formato que o CRM sempre usou (telas, e-mails e Google Agenda continuam iguais),
 * com o que é do PMO a mais: código, projeto, origem, permissões e link para abrir no PMO.
 */
@Injectable()
export class PmoTasksGateway {
  constructor(
    private readonly pmo: PmoClientService,
    private readonly prisma: PrismaService,
  ) {}

  // ------------------------------------------------------------------ tradução

  private async usersByEmail(emails: string[]) {
    const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
    const rows = unique.length
      ? await this.prisma.user.findMany({
          where: { email: { in: unique, mode: 'insensitive' } },
          select: { id: true, name: true, email: true, status: true, deletedAt: true },
        })
      : [];
    return new Map(rows.map((u) => [u.email.toLowerCase(), u]));
  }

  /** Pessoas do CRM por id → como o PMO as identifica. */
  async peopleFor(userIds: string[]): Promise<Array<PmoPerson & { active: boolean }>> {
    const unique = [...new Set(userIds)];
    const rows = await this.prisma.user.findMany({
      where: { id: { in: unique }, deletedAt: null },
      select: { id: true, name: true, email: true, status: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('Responsável não encontrado.');
    }
    return unique.map((id) => {
      const user = rows.find((r) => r.id === id)!;
      return { email: user.email, name: user.name, active: user.status === 'ACTIVE' };
    });
  }

  async adapt(tasks: PmoTask[]) {
    const emails = tasks.flatMap((t) => [
      ...t.assignees.map((a) => a.email),
      ...(t.createdBy ? [t.createdBy.email] : []),
    ]);
    const leadIds = [...new Set(tasks.map((t) => t.lead?.id).filter((id): id is string => !!id))];
    const taskIds = tasks.map((t) => t.id);
    const [users, leads, google] = await Promise.all([
      this.usersByEmail(emails),
      this.prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: {
          id: true,
          name: true,
          companyName: true,
          stage: { select: { id: true, name: true, color: true } },
        },
      }),
      this.prisma.taskGoogleTask.findMany({
        where: { taskId: { in: taskIds } },
        select: { taskId: true, userId: true, webViewLink: true, auto: true },
      }),
    ]);
    const person = (p: PmoPerson): CrmTaskUser =>
      users.get(p.email.toLowerCase()) ?? {
        id: `pmo:${p.email.toLowerCase()}`,
        name: p.name,
        email: p.email,
        status: 'ACTIVE',
        deletedAt: null,
      };
    return tasks.map((t) => {
      const assignees = t.assignees.map(person);
      const assignee = assignees[0] ?? null;
      const createdBy = t.createdBy ? person(t.createdBy) : null;
      const lead = t.lead ? (leads.find((l) => l.id === t.lead!.id) ?? null) : null;
      return {
        id: t.id,
        code: t.code,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: pmoDayToCrm(t.dueDate),
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
        assigneeId: assignee?.id ?? null,
        assignee,
        assigneeAssignedAt: new Date(t.updatedAt),
        assignees: assignees.map((user) => ({ user })),
        createdByUserId: createdBy?.id ?? null,
        createdByUser: createdBy ? { id: createdBy.id, name: createdBy.name } : null,
        leadId: t.lead?.id ?? null,
        lead:
          lead ??
          (t.lead
            ? { id: t.lead.id, name: t.lead.name ?? 'Lead', companyName: null, stage: null }
            : null),
        googleTasks: google
          .filter((g) => g.taskId === t.id)
          .map((g) => ({ userId: g.userId, webViewLink: g.webViewLink, auto: g.auto })),
        // Do PMO:
        source: t.source,
        project: t.project,
        stageName: t.stage.name,
        progress: t.progress,
        isBlocked: t.isBlocked,
        permissions: t.permissions,
        pmoUrl: t.pmoUrl,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
        deletedAt: t.archivedAt ? new Date(t.archivedAt) : null,
      };
    });
  }

  private async one(task: PmoTask) {
    return (await this.adapt([task]))[0];
  }

  private async query(filters: CrmTaskFilters) {
    let assigneeEmail: string | undefined;
    if (filters.assigneeUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: filters.assigneeUserId },
        select: { email: true },
      });
      assigneeEmail = user?.email ?? 'ninguem@invalido.local';
    }
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search,
      status: filters.status,
      priority: filters.priority,
      leadId: filters.leadId,
      assigneeEmail,
      mine: filters.mine,
      overdue: filters.overdue,
      open: filters.open,
      dueFrom: filters.dueFrom,
      dueTo: filters.dueTo,
      hiddenLeadIds: filters.hiddenLeadIds,
      sortBy: filters.sortBy,
    };
  }

  private async leadName(leadId: string | null | undefined) {
    if (!leadId) return null;
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { name: true },
    });
    return lead?.name ?? null;
  }

  // ------------------------------------------------------------------ leitura

  async list(filters: CrmTaskFilters, actor: PmoActor) {
    const page = await this.pmo.json<PmoPage<PmoTask>>('GET', '/tasks', {
      actor,
      query: await this.query(filters),
    });
    return { ...page, items: await this.adapt(page.items) };
  }

  async summary(filters: CrmTaskFilters, actor: PmoActor) {
    return this.pmo.json<Record<TaskStatus, number>>('GET', '/tasks/summary', {
      actor,
      query: await this.query({ ...filters, status: undefined }),
    });
  }

  /** Todas as páginas (para relatórios do CRM). */
  async listAll(filters: CrmTaskFilters, actor: PmoActor | null) {
    const items: Awaited<ReturnType<PmoTasksGateway['adapt']>> = [];
    for (let page = 1; ; page++) {
      const query = await this.query({ ...filters, page, pageSize: 500 });
      const result = actor
        ? await this.pmo.json<PmoPage<PmoTask>>('GET', '/tasks', { actor, query })
        : await this.pmo.json<PmoPage<PmoTask>>('GET', '/system/tasks', { query });
      items.push(...(await this.adapt(result.items)));
      if (page >= result.totalPages) break;
    }
    return items;
  }

  async get(id: string, actor: PmoActor) {
    return this.one(await this.pmo.json<PmoTask>('GET', `/tasks/${id}`, { actor }));
  }

  async history(id: string, actor: PmoActor) {
    const rows = await this.pmo.json<
      Array<{
        id: string;
        type: string;
        reason: string;
        metadata: Record<string, unknown>;
        actor: PmoPerson;
        createdAt: string;
      }>
    >('GET', `/tasks/${id}/history`, { actor });
    const emails = rows.flatMap((r) => {
      const meta = r.metadata as {
        previousAssignees?: PmoPerson[];
        newAssignee?: PmoPerson;
      };
      return [
        r.actor.email,
        ...(meta.previousAssignees ?? []).map((p) => p.email),
        ...(meta.newAssignee ? [meta.newAssignee.email] : []),
      ];
    });
    const users = await this.usersByEmail(emails);
    const ref = (p: PmoPerson) => {
      const u = users.get(p.email.toLowerCase());
      return { id: u?.id ?? `pmo:${p.email}`, name: u?.name ?? p.name };
    };
    return rows.map((r) => {
      const meta = r.metadata as {
        previousAssignees?: PmoPerson[];
        newAssignee?: PmoPerson;
        previousDueDate?: string | null;
        newDueDate?: string;
        completedAt?: string;
      };
      return {
        id: r.id,
        type: r.type,
        reason: r.reason,
        metadata: {
          ...meta,
          previousDueDate: meta.previousDueDate
            ? pmoDayToCrm(meta.previousDueDate)?.toISOString()
            : undefined,
          newDueDate: meta.newDueDate ? pmoDayToCrm(meta.newDueDate)?.toISOString() : undefined,
          previousAssignees: meta.previousAssignees?.map(ref),
          newAssignee: meta.newAssignee ? ref(meta.newAssignee) : undefined,
        },
        actorUser: ref(r.actor),
        createdAt: r.createdAt,
      };
    });
  }

  // ------------------------------------------------------------------ escrita

  async create(
    input: CrmTaskWrite & { title: string; dueDate: string; assigneeIds: string[] },
    actor: PmoActor,
  ) {
    const task = await this.pmo.json<PmoTask>('POST', '/tasks', {
      actor,
      body: {
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        leadId: input.leadId ?? undefined,
        leadName: (await this.leadName(input.leadId)) ?? undefined,
        assignees: await this.peopleFor(input.assigneeIds),
        completionReason: input.completionReason,
      },
    });
    return this.one(task);
  }

  async update(id: string, input: CrmTaskWrite, actor: PmoActor) {
    const body: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate,
      completionReason: input.completionReason,
    };
    if (input.leadId !== undefined) {
      body.leadId = input.leadId;
      body.leadName = await this.leadName(input.leadId);
    }
    if (input.assigneeIds) body.assignees = await this.peopleFor(input.assigneeIds);
    return this.one(await this.pmo.json<PmoTask>('PATCH', `/tasks/${id}`, { actor, body }));
  }

  async complete(id: string, reason: string, actor: PmoActor) {
    return this.one(
      await this.pmo.json<PmoTask>('POST', `/tasks/${id}/complete`, { actor, body: { reason } }),
    );
  }

  async extendDeadline(id: string, dueDate: string, reason: string, actor: PmoActor) {
    return this.one(
      await this.pmo.json<PmoTask>('POST', `/tasks/${id}/extend-deadline`, {
        actor,
        body: { dueDate, reason },
      }),
    );
  }

  async transfer(id: string, assigneeUserId: string, reason: string, actor: PmoActor) {
    const [assignee] = await this.peopleFor([assigneeUserId]);
    if (!assignee.active) {
      throw new BadRequestException('Responsável de destino não encontrado.');
    }
    return this.one(
      await this.pmo.json<PmoTask>('POST', `/tasks/${id}/transfer`, {
        actor,
        body: { assignee, reason },
      }),
    );
  }

  async archive(id: string, actor: PmoActor) {
    await this.pmo.json('POST', `/tasks/${id}/archive`, { actor });
  }

  async remove(id: string, actor: PmoActor) {
    await this.pmo.json('DELETE', `/tasks/${id}`, { actor });
  }

  // ------------------------------------------------------------------ anexos

  async listAttachments(taskId: string, actor: PmoActor) {
    const rows = await this.pmo.json<
      Array<{
        id: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        createdAt: string;
      }>
    >('GET', `/tasks/${taskId}/attachments`, { actor });
    return rows.map((a) => ({
      id: a.id,
      fileName: a.originalName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt,
    }));
  }

  async uploadAttachment(taskId: string, file: Express.Multer.File, actor: PmoActor) {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    await this.pmo.json('POST', `/tasks/${taskId}/attachments`, { actor, form });
    const list = await this.listAttachments(taskId, actor);
    return list[0];
  }

  /** Confere que o anexo é desta tarefa antes de baixar ou excluir. */
  private async assertAttachment(taskId: string, attachmentId: string, actor: PmoActor) {
    const list = await this.listAttachments(taskId, actor);
    const found = list.find((a) => a.id === attachmentId);
    if (!found) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    return found;
  }

  async downloadAttachment(taskId: string, attachmentId: string, actor: PmoActor) {
    const attachment = await this.assertAttachment(taskId, attachmentId, actor);
    const file = await this.pmo.stream(`/attachments/${attachmentId}/download`, actor);
    return { attachment, stream: file.stream };
  }

  async removeAttachment(taskId: string, attachmentId: string, actor: PmoActor) {
    await this.assertAttachment(taskId, attachmentId, actor);
    await this.pmo.json('DELETE', `/attachments/${attachmentId}`, { actor });
  }

  // ------------------------------------------------------------------ leads

  renameLead(leadId: string, name: string) {
    return this.pmo.json('PUT', `/leads/${leadId}`, { body: { name } });
  }

  unlinkLead(leadId: string) {
    return this.pmo.json('DELETE', `/leads/${leadId}`);
  }
}
