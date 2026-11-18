import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import { PmoTasksGateway } from '../../pmo/pmo-tasks.gateway';
import { TasksService } from '../tasks.service';

/** Anexos de tarefas: ficam no storage do PMO (base única), com a visibilidade da tarefa no CRM. */
@Injectable()
export class TaskAttachmentsService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly pmo: PmoTasksGateway,
  ) {}

  async upload(taskId: string, file: Express.Multer.File, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    return this.pmo.uploadAttachment(taskId, file, this.tasksService.actor(user));
  }

  async list(taskId: string, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    return this.pmo.listAttachments(taskId, this.tasksService.actor(user));
  }

  async getForDownload(taskId: string, attachmentId: string, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    return this.pmo.downloadAttachment(taskId, attachmentId, this.tasksService.actor(user));
  }

  async remove(taskId: string, attachmentId: string, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    await this.pmo.removeAttachment(taskId, attachmentId, this.tasksService.actor(user));
  }
}
