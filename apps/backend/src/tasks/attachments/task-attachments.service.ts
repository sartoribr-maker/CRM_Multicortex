import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../storage/storage-provider.interface';
import { TasksService } from '../tasks.service';

@Injectable()
export class TaskAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(taskId: string, file: Express.Multer.File, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    const { storageKey, sizeBytes } = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    return this.prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes,
        storageKey,
        uploadedByUserId: user.sub,
      },
    });
  }

  async list(taskId: string, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    return this.prisma.taskAttachment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForDownload(taskId: string, attachmentId: string, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');
    return { attachment, stream: await this.storage.getStream(attachment.storageKey) };
  }

  async remove(taskId: string, attachmentId: string, user: JwtPayload) {
    await this.tasksService.findOne(taskId, user);
    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');
    await this.prisma.taskAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
  }
}
