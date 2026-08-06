import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadsService } from '../leads.service';
import { LeadActivityService } from '../lead-activity.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../storage/storage-provider.interface';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly leadActivityService: LeadActivityService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async upload(leadId: string, file: Express.Multer.File, currentUser: JwtPayload) {
    await this.leadsService.ensureVisible(leadId, currentUser);

    const { storageKey, sizeBytes } = await this.storageProvider.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        leadId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes,
        storageKey,
        uploadedByUserId: currentUser.sub,
      },
    });

    await this.leadActivityService.record({
      leadId,
      type: 'ATTACHMENT_ADDED',
      message: `Anexo adicionado: ${file.originalname}.`,
      actorUserId: currentUser.sub,
    });

    return attachment;
  }

  async list(leadId: string, currentUser: JwtPayload) {
    await this.leadsService.ensureVisible(leadId, currentUser);
    return this.prisma.attachment.findMany({
      where: { leadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForDownload(leadId: string, attachmentId: string, currentUser: JwtPayload) {
    await this.leadsService.ensureVisible(leadId, currentUser);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, leadId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    const stream = await this.storageProvider.getStream(attachment.storageKey);
    return { attachment, stream };
  }

  async remove(leadId: string, attachmentId: string, currentUser: JwtPayload) {
    await this.leadsService.ensureVisible(leadId, currentUser);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, leadId, deletedAt: null },
    });
    if (!attachment) {
      throw new NotFoundException('Anexo não encontrado.');
    }
    await this.prisma.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } });
  }
}
