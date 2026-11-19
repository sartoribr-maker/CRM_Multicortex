import {
  HttpException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TaskGoogleTask } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { PmoActor } from '../pmo/pmo-client.service';
import { PmoTasksGateway } from '../pmo/pmo-tasks.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarSettingsService } from './google-calendar-settings.service';
import {
  deleteCalendarEvent,
  fetchAccessToken,
  GOOGLE_CALENDAR_SCOPE,
  GoogleCalendarError,
  type ServiceAccountKey,
} from './google-calendar.client';
import {
  deleteGoogleTask,
  getGoogleTaskState,
  GOOGLE_TASKS_SCOPE,
  saveGoogleTask,
  type GoogleTaskInput,
} from './google-tasks.client';

/** Tasks e, para apagar o lembrete das 10h de um vínculo manual assumido, a Agenda. */
const SYNC_SCOPES = `${GOOGLE_TASKS_SCOPE} ${GOOGLE_CALENDAR_SCOPE}`;

type CrmTask = Awaited<ReturnType<PmoTasksGateway['adapt']>>[number];

interface SyncUser {
  id: string;
  name: string;
  email: string;
  roleName: string;
}

const PRIORITY_LABEL: Record<CrmTask['priority'], string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

/** Justificativa gravada no CRM/PMO quando a tarefa é concluída pelo Google. */
export const GOOGLE_COMPLETION_REASON = 'Concluída pelo usuário no Google Agenda (Tarefas).';

function errorMessage(error: unknown) {
  if (error instanceof GoogleCalendarError || error instanceof HttpException) return error.message;
  return error instanceof Error ? error.message : String(error);
}

/** A tarefa não existe mais para o usuário (arquivada, excluída ou ele saiu dela). */
function isGone(error: unknown) {
  return error instanceof HttpException && [403, 404].includes(error.getStatus());
}

/**
 * "Integrar Tarefas com Calendar do Google" (cadastro do usuário). Para cada usuário com a opção
 * marcada e e-mail do domínio do Workspace:
 *
 * - CRM → Google: toda tarefa "Em andamento" sob responsabilidade dele (responsável ou
 *   corresponsável) fica em "Minhas tarefas" do Google. Ao ir para "Concluída" é marcada como
 *   feita; ao voltar para "A Fazer", ser cancelada, arquivada ou sair da responsabilidade dele, é
 *   apagada do Google.
 * - Google → CRM: concluir a tarefa no Google conclui a do CRM; excluí-la cancela a do CRM.
 *
 * As tarefas moram no PMO e podem mudar lá sem passar pelo CRM, e o Google Tasks não avisa
 * alterações; por isso a sincronização roda periodicamente, além de ser disparada na hora quando a
 * tarefa é alterada pelo CRM.
 */
@Injectable()
export class GoogleTasksAutoSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GoogleTasksAutoSyncService.name);
  private readonly frontendUrl: string;
  private readonly intervalMs: number;
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  /** Usuários a sincronizar na próxima rodada (`null` = todos). */
  private pending: Set<string> | null = new Set();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GoogleCalendarSettingsService,
    private readonly pmo: PmoTasksGateway,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    const seconds = Number(config.get<string>('GOOGLE_TASKS_AUTO_SYNC_INTERVAL_SECONDS', '120'));
    this.intervalMs = Math.max(30, Number.isFinite(seconds) ? seconds : 120) * 1000;
  }

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => this.requestAll(), this.intervalMs);
    this.requestAll();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Sincroniza todos os usuários assim que possível. */
  requestAll() {
    this.pending = null;
    void this.drain();
  }

  /** Sincroniza estes usuários assim que possível (tarefa alterada pelo CRM). */
  requestUsers(userIds: Array<string | null | undefined>) {
    const ids = userIds.filter((id): id is string => !!id && !id.startsWith('pmo:'));
    if (!ids.length) return;
    if (this.pending) for (const id of ids) this.pending.add(id);
    void this.drain();
  }

  /** Usuários afetados por uma alteração da tarefa: responsáveis e quem já a tem no Google. */
  async requestForTask(taskId: string, assigneeIds: Array<string | null | undefined> = []) {
    const links = await this.prisma.taskGoogleTask.findMany({
      where: { taskId, auto: true },
      select: { userId: true },
    });
    this.requestUsers([...assigneeIds, ...links.map((link) => link.userId)]);
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending === null || this.pending.size) {
        const only = this.pending ? [...this.pending] : null;
        this.pending = new Set();
        await this.syncAll(only);
      }
    } catch (error) {
      this.logger.error(
        `Falha na sincronização automática com o Google Tasks: ${errorMessage(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Uma rodada: usuários com a opção marcada e limpeza de quem a desmarcou. */
  async syncAll(onlyUserIds: string[] | null = null) {
    const runtime = await this.settings.getRuntime();
    if (!runtime) return;
    const domain = runtime.settings.workspaceDomain.trim().toLowerCase().replace(/^@/, '');
    const scope = onlyUserIds ? { id: { in: onlyUserIds } } : {};

    // Quem desmarcou a opção, foi inativado/excluído ou mudou de e-mail: tira do Google o que a
    // integração criou (o que for refeito volta na sincronização abaixo).
    const stale = await this.prisma.taskGoogleTask.findMany({
      where: { auto: true, user: scope },
      include: {
        user: { select: { email: true, status: true, deletedAt: true, googleTasksAutoSync: true } },
      },
    });
    for (const link of stale) {
      const user = link.user;
      const keep =
        user.googleTasksAutoSync &&
        user.status === 'ACTIVE' &&
        !user.deletedAt &&
        user.email.trim().toLowerCase() === link.googleEmail;
      if (!keep) await this.dropLink(runtime.key, link, link.crmStatus === 'IN_PROGRESS');
    }

    const users = await this.prisma.user.findMany({
      where: { ...scope, googleTasksAutoSync: true, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, email: true, role: { select: { name: true } } },
    });
    for (const user of users) {
      if (!domain || !user.email.trim().toLowerCase().endsWith(`@${domain}`)) continue;
      try {
        await this.syncUser(runtime.key, {
          id: user.id,
          name: user.name,
          email: user.email.trim().toLowerCase(),
          roleName: user.role.name,
        });
      } catch (error) {
        this.logger.warn(
          `Falha ao sincronizar as tarefas de ${user.email} com o Google: ${errorMessage(error)}`,
        );
      }
    }
  }

  private actor(user: SyncUser): PmoActor {
    return {
      email: user.email,
      name: user.name,
      seeAll: user.roleName.trim().toLocaleLowerCase('pt-BR') === 'administrador',
    };
  }

  async syncUser(key: ServiceAccountKey, user: SyncUser) {
    const token = await fetchAccessToken(key, user.email, SYNC_SCOPES);
    const actor = this.actor(user);
    const tasks = await this.pmo.listAll({ mine: true, status: 'IN_PROGRESS' }, actor);

    // 0) Com a opção marcada, a integração assume os vínculos manuais ("Vincular com o Google
    // Agenda") das tarefas em andamento. Só marca o vínculo: o estado no Google é lido no passo 1
    // antes de qualquer envio, para não reabrir o que o usuário concluiu por lá.
    const manual = await this.prisma.taskGoogleTask.findMany({
      where: { userId: user.id, auto: false, taskId: { in: tasks.map((task) => task.id) } },
    });
    for (const link of manual) await this.adopt(token, link);

    // 1) Google → CRM: o que o usuário concluiu ou excluiu no Google.
    const open = await this.prisma.taskGoogleTask.findMany({
      where: { userId: user.id, auto: true, crmStatus: 'IN_PROGRESS' },
    });
    const resolved = new Set<string>();
    for (const link of open) {
      try {
        if (await this.pullFromGoogle(token, link, user, actor)) resolved.add(link.taskId);
      } catch (error) {
        this.logger.warn(
          `Falha ao refletir no CRM a tarefa ${link.taskId} do Google de ${user.email}: ${errorMessage(error)}`,
        );
      }
    }

    // 2) CRM → Google: tarefas "Em andamento" sob responsabilidade do usuário.
    const pending = tasks.filter((task) => !resolved.has(task.id));
    const links = new Map(
      (
        await this.prisma.taskGoogleTask.findMany({
          where: { userId: user.id, taskId: { in: pending.map((task) => task.id) } },
        })
      ).map((link) => [link.taskId, link]),
    );
    for (const task of pending) {
      const link = links.get(task.id);
      // Vínculo manual que não pôde ser assumido (falha no passo 0) fica para a próxima rodada.
      if (link && !link.auto) continue;
      try {
        await this.pushInProgress(token, task, user, link ?? null);
      } catch (error) {
        this.logger.warn(
          `Falha ao enviar a tarefa ${task.id} ao Google de ${user.email}: ${errorMessage(error)}`,
        );
      }
    }

    // 3) Saíram de "Em andamento" (ou da responsabilidade do usuário).
    const inProgress = new Set(pending.map((task) => task.id));
    const left = await this.prisma.taskGoogleTask.findMany({
      where: {
        userId: user.id,
        auto: true,
        crmStatus: 'IN_PROGRESS',
        taskId: { notIn: [...inProgress] },
      },
    });
    for (const link of left) {
      try {
        await this.settleLeft(token, link, actor);
      } catch (error) {
        this.logger.warn(
          `Falha ao atualizar no Google a tarefa ${link.taskId} de ${user.email}: ${errorMessage(error)}`,
        );
      }
    }
  }

  /** Vínculo manual vira automático; o lembrete das 10h (só do vínculo manual) é apagado. */
  private async adopt(token: string, link: TaskGoogleTask) {
    try {
      if (link.reminderEventId) await deleteCalendarEvent(token, link.reminderEventId);
      await this.prisma.taskGoogleTask.update({
        where: { id: link.id },
        data: { auto: true, crmStatus: 'IN_PROGRESS', syncedHash: null, reminderEventId: null },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao assumir o vínculo manual da tarefa ${link.taskId} (${link.googleEmail}): ${errorMessage(error)}`,
      );
    }
  }

  /** Devolve `true` quando a ação do Google foi aplicada no CRM (concluiu/cancelou). */
  private async pullFromGoogle(
    token: string,
    link: TaskGoogleTask,
    user: SyncUser,
    actor: PmoActor,
  ): Promise<boolean> {
    const state = await getGoogleTaskState(token, link.googleTaskId);
    if (state === 'open') return false;
    let task: CrmTask;
    try {
      task = await this.pmo.get(link.taskId, actor);
    } catch (error) {
      if (!isGone(error)) throw error;
      // A tarefa não existe mais para o usuário no CRM: só esquece o vínculo.
      await this.forget(link);
      return true;
    }
    // O CRM mudou a tarefa antes (ex.: voltou para "A Fazer"): o passo 3 aplica a regra do CRM.
    if (task.status !== 'IN_PROGRESS' || task.deletedAt) return false;

    if (state === 'completed') {
      await this.pmo.complete(link.taskId, GOOGLE_COMPLETION_REASON, actor);
      await this.forget(link);
      await this.audit.record({
        action: 'TASK_COMPLETED',
        actorUserId: user.id,
        targetType: 'Task',
        targetId: link.taskId,
        metadata: { reason: GOOGLE_COMPLETION_REASON, origin: 'google-tasks' },
      });
    } else {
      await this.pmo.update(link.taskId, { status: 'CANCELED' }, actor);
      await this.forget(link);
      await this.audit.record({
        action: 'TASK_UPDATED',
        actorUserId: user.id,
        targetType: 'Task',
        targetId: link.taskId,
        metadata: {
          status: 'CANCELED',
          reason: 'Excluída pelo usuário no Google Agenda (Tarefas).',
          origin: 'google-tasks',
        },
      });
    }
    return true;
  }

  private async pushInProgress(
    token: string,
    task: CrmTask,
    user: SyncUser,
    link: TaskGoogleTask | null,
  ) {
    const input = this.googleInput(task, false);
    const hash = this.hash(input);
    if (link && link.crmStatus === 'IN_PROGRESS' && link.syncedHash === hash) return;
    const saved = await saveGoogleTask(token, input, link?.googleTaskId);
    const data = {
      googleEmail: user.email,
      googleTaskId: saved.id,
      webViewLink: saved.webViewLink,
      auto: true,
      crmStatus: 'IN_PROGRESS' as const,
      syncedHash: hash,
    };
    await this.prisma.taskGoogleTask.upsert({
      where: { taskId_userId: { taskId: task.id, userId: user.id } },
      create: { taskId: task.id, userId: user.id, ...data },
      update: data,
    });
  }

  /** Tarefa que deixou de estar "Em andamento" para o usuário. */
  private async settleLeft(token: string, link: TaskGoogleTask, actor: PmoActor) {
    let task: CrmTask | null = null;
    try {
      task = await this.pmo.get(link.taskId, actor);
    } catch (error) {
      if (!isGone(error)) throw error;
    }
    if (task && !task.deletedAt && task.status === 'DONE') {
      // Concluída no CRM: marca como feita no Google e encerra o acompanhamento.
      await saveGoogleTask(token, this.googleInput(task, true), link.googleTaskId);
      await this.forget(link);
      return;
    }
    // "A Fazer", "Cancelada", arquivada, excluída ou de outro responsável: some do Google.
    await deleteGoogleTask(token, link.googleTaskId);
    await this.forget(link);
  }

  /** Apaga do Google (se pedido) e esquece o vínculo; falha no Google mantém o vínculo. */
  private async dropLink(key: ServiceAccountKey, link: TaskGoogleTask, deleteInGoogle: boolean) {
    try {
      if (deleteInGoogle) {
        const token = await fetchAccessToken(key, link.googleEmail, GOOGLE_TASKS_SCOPE);
        await deleteGoogleTask(token, link.googleTaskId);
      }
      await this.forget(link);
    } catch (error) {
      this.logger.warn(
        `Falha ao remover a tarefa ${link.googleTaskId} do Google de ${link.googleEmail}: ${errorMessage(error)}`,
      );
    }
  }

  private forget(link: TaskGoogleTask) {
    return this.prisma.taskGoogleTask.deleteMany({ where: { id: link.id } });
  }

  /** Campos do CRM que têm lugar na tarefa do Google: título, prazo, situação e notas. */
  googleInput(task: CrmTask, done: boolean): GoogleTaskInput {
    const lead = task.lead
      ? [task.lead.name, task.lead.companyName].filter(Boolean).join(' – ')
      : null;
    const people = task.assignees.map(({ user }) => user.name).join(', ');
    return {
      title: task.code ? `[${task.code}] ${task.title}` : task.title,
      description: task.description,
      dueDate: task.dueDate,
      done,
      crmUrl: `${this.frontendUrl}/tasks/${task.id}`,
      details: [
        `Prioridade: ${PRIORITY_LABEL[task.priority] ?? task.priority}`,
        lead ? `Oportunidade: ${lead}` : '',
        task.lead?.stage?.name ? `Etapa da oportunidade: ${task.lead.stage.name}` : '',
        task.project ? `Projeto: ${task.project.code} – ${task.project.name}` : '',
        people ? `Responsáveis: ${people}` : '',
        task.createdByUser?.name ? `Criada por: ${task.createdByUser.name}` : '',
      ],
    };
  }

  private hash(input: GoogleTaskInput) {
    return createHash('sha1')
      .update(JSON.stringify({ ...input, dueDate: input.dueDate?.toISOString() ?? null }))
      .digest('hex');
  }
}
