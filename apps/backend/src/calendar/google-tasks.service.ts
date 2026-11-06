import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TaskStatus } from '@prisma/client';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarSettingsService } from './google-calendar-settings.service';
import {
  deleteCalendarEvent,
  fetchAccessToken,
  GOOGLE_CALENDAR_SCOPE,
  GoogleCalendarError,
  saveTaskReminderEvent,
  type ServiceAccountKey,
} from './google-calendar.client';
import {
  deleteGoogleTask,
  GOOGLE_TASKS_SCOPE,
  localDateInTimeZone,
  saveGoogleTask,
} from './google-tasks.client';

/** Um único token cobre a tarefa (Tasks) e o lembrete das 10h (Agenda). */
const SYNC_SCOPES = `${GOOGLE_TASKS_SCOPE} ${GOOGLE_CALENDAR_SCOPE}`;

/** Falhas de rede também não podem derrubar a gravação da tarefa. */
function errorMessage(error: unknown) {
  if (error instanceof GoogleCalendarError) return error.message;
  return `falha de comunicação com o Google (${error instanceof Error ? error.message : String(error)})`;
}

export interface TaskForGoogle {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date;
  status: TaskStatus;
}

export interface GoogleTaskSyncResult {
  synced: boolean;
  message?: string;
  webViewLink?: string | null;
}

/**
 * Mantém a tarefa do CRM em "Minhas tarefas" (Google Tasks, exibido no Google
 * Agenda) de cada usuário que marcou "Vincular com o Google Agenda". A conta de
 * serviço age em nome do próprio usuário (delegação em todo o domínio), por isso
 * ele precisa ter e-mail do domínio do Workspace.
 */
@Injectable()
export class GoogleTasksService {
  private readonly logger = new Logger(GoogleTasksService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GoogleCalendarSettingsService,
    config: ConfigService,
  ) {
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
  }

  /** O que o formulário de tarefas precisa para exibir o checkbox. */
  async config(user: JwtPayload) {
    const settings = await this.settings.ensureSettings();
    const enabled = settings.enabled && Boolean(settings.serviceAccountKeyEncrypted);
    return {
      enabled,
      workspaceDomain: settings.workspaceDomain,
      eligible: enabled && this.isWorkspaceEmail(user.email, settings.workspaceDomain),
    };
  }

  /** Valida antes de gravar a tarefa, para não salvar algo que não poderá ser vinculado. */
  async assertCanLink(user: JwtPayload) {
    const runtime = await this.settings.getRuntime();
    if (!runtime) {
      throw new BadRequestException(
        'A integração com o Google Agenda não está configurada. Contate o administrador.',
      );
    }
    if (!this.isWorkspaceEmail(user.email, runtime.settings.workspaceDomain)) {
      throw new BadRequestException(
        `Para vincular com o Google Agenda, seu usuário precisa ter um e-mail @${runtime.settings.workspaceDomain}.`,
      );
    }
    return runtime;
  }

  /**
   * Cria ou atualiza a tarefa em "Minhas tarefas" do usuário e o evento-lembrete
   * das 10h. Nunca lança erro do Google: devolve um aviso.
   */
  async link(task: TaskForGoogle, user: JwtPayload): Promise<GoogleTaskSyncResult> {
    const runtime = await this.assertCanLink(user);
    const googleEmail = user.email.trim().toLowerCase();
    const existing = await this.prisma.taskGoogleTask.findUnique({
      where: { taskId_userId: { taskId: task.id, userId: user.sub } },
    });
    try {
      // Se o e-mail do usuário mudou, o que foi criado está na conta anterior: apaga lá.
      const sameAccount = existing?.googleEmail === googleEmail;
      if (existing && !sameAccount) await this.deleteQuietly(runtime.key, existing);
      const pushed = await this.push(runtime.key, task, googleEmail, sameAccount ? existing : null);
      const data = {
        googleEmail,
        googleTaskId: pushed.googleTaskId,
        webViewLink: pushed.webViewLink,
        reminderEventId: pushed.reminderEventId,
      };
      const stored = await this.prisma.taskGoogleTask.upsert({
        where: { taskId_userId: { taskId: task.id, userId: user.sub } },
        create: { taskId: task.id, userId: user.sub, ...data },
        update: data,
      });
      if (pushed.reminderError) {
        return {
          synced: false,
          webViewLink: stored.webViewLink,
          message: `A tarefa foi salva e vinculada ao Google Agenda, mas o lembrete das 10h não pôde ser criado: ${pushed.reminderError}`,
        };
      }
      return { synced: true, webViewLink: stored.webViewLink };
    } catch (error) {
      this.logger.warn(`Falha ao vincular a tarefa ${task.id} ao Google Tasks: ${errorMessage(error)}`);
      return {
        synced: false,
        message: `A tarefa foi salva, mas não foi possível atualizá-la no Google Agenda (Tarefas): ${errorMessage(error)}`,
      };
    }
  }

  /** Remove do Google a tarefa e o lembrete do usuário, e o vínculo. */
  async unlink(taskId: string, user: JwtPayload): Promise<GoogleTaskSyncResult> {
    const existing = await this.prisma.taskGoogleTask.findUnique({
      where: { taskId_userId: { taskId, userId: user.sub } },
    });
    if (!existing) return { synced: true };
    const runtime = await this.settings.getRuntime();
    let message: string | undefined;
    if (runtime) {
      const failure = await this.deleteQuietly(runtime.key, existing);
      if (failure)
        message = `O vínculo foi removido, mas a tarefa não pôde ser apagada do Google Agenda: ${failure}`;
    }
    await this.prisma.taskGoogleTask.delete({ where: { id: existing.id } });
    return { synced: !message, message };
  }

  /** Propaga alterações da tarefa para os vínculos de todos os usuários (melhor esforço). */
  async refresh(task: TaskForGoogle, exceptUserId?: string) {
    const links = await this.prisma.taskGoogleTask.findMany({
      where: { taskId: task.id, ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
    });
    if (!links.length) return;
    const runtime = await this.settings.getRuntime();
    if (!runtime) return;
    for (const link of links) {
      try {
        const pushed = await this.push(runtime.key, task, link.googleEmail, link);
        if (
          pushed.googleTaskId !== link.googleTaskId ||
          pushed.webViewLink !== link.webViewLink ||
          pushed.reminderEventId !== link.reminderEventId
        ) {
          await this.prisma.taskGoogleTask.update({
            where: { id: link.id },
            data: {
              googleTaskId: pushed.googleTaskId,
              webViewLink: pushed.webViewLink,
              reminderEventId: pushed.reminderEventId,
            },
          });
        }
      } catch (error) {
        this.logger.warn(
          `Falha ao atualizar a tarefa ${task.id} no Google de ${link.googleEmail}: ${errorMessage(error)}`,
        );
      }
    }
  }

  /** Apaga do Google as tarefas e os lembretes vinculados (arquivamento/exclusão). */
  async removeAll(taskId: string) {
    const links = await this.prisma.taskGoogleTask.findMany({ where: { taskId } });
    if (!links.length) return;
    const runtime = await this.settings.getRuntime();
    if (runtime) {
      for (const link of links) await this.deleteQuietly(runtime.key, link);
    }
    await this.prisma.taskGoogleTask.deleteMany({ where: { taskId } });
  }

  /**
   * Grava a tarefa no Google Tasks e mantém o lembrete das 10h: existe enquanto a
   * tarefa está aberta e é apagado ao concluir/cancelar, para não disparar à toa.
   * Falha só no lembrete não desfaz a tarefa: volta em `reminderError`.
   */
  private async push(
    key: ServiceAccountKey,
    task: TaskForGoogle,
    googleEmail: string,
    current: { googleTaskId: string; reminderEventId: string | null } | null,
  ) {
    const token = await fetchAccessToken(key, googleEmail, SYNC_SCOPES);
    const saved = await saveGoogleTask(token, this.googleInput(task), current?.googleTaskId);
    let reminderEventId = current?.reminderEventId ?? null;
    let reminderError: string | null = null;
    try {
      if (task.status === 'DONE' || task.status === 'CANCELED') {
        if (reminderEventId) await deleteCalendarEvent(token, reminderEventId);
        reminderEventId = null;
      } else {
        reminderEventId = await saveTaskReminderEvent(
          token,
          this.reminderInput(task),
          reminderEventId,
        );
      }
    } catch (error) {
      reminderError = errorMessage(error);
      this.logger.warn(
        `Falha no lembrete das 10h da tarefa ${task.id} (${googleEmail}): ${reminderError}`,
      );
    }
    return { googleTaskId: saved.id, webViewLink: saved.webViewLink, reminderEventId, reminderError };
  }

  private async deleteQuietly(
    key: ServiceAccountKey,
    link: { googleEmail: string; googleTaskId: string; reminderEventId: string | null },
  ): Promise<string | null> {
    try {
      const token = await fetchAccessToken(key, link.googleEmail, SYNC_SCOPES);
      await deleteGoogleTask(token, link.googleTaskId);
      if (link.reminderEventId) await deleteCalendarEvent(token, link.reminderEventId);
      return null;
    } catch (error) {
      this.logger.warn(
        `Falha ao apagar a tarefa ${link.googleTaskId} do Google de ${link.googleEmail}: ${errorMessage(error)}`,
      );
      return errorMessage(error);
    }
  }

  private googleInput(task: TaskForGoogle) {
    return {
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      done: task.status === 'DONE',
      crmUrl: this.crmUrl(task),
    };
  }

  private reminderInput(task: TaskForGoogle) {
    return {
      title: task.title,
      description: task.description,
      day: localDateInTimeZone(task.dueDate),
      crmUrl: this.crmUrl(task),
    };
  }

  private crmUrl(task: TaskForGoogle) {
    return `${this.frontendUrl}/tasks/${task.id}`;
  }

  private isWorkspaceEmail(email: string, workspaceDomain: string) {
    const domain = workspaceDomain.trim().toLowerCase().replace(/^@/, '');
    return Boolean(domain) && email.trim().toLowerCase().endsWith(`@${domain}`);
  }
}
