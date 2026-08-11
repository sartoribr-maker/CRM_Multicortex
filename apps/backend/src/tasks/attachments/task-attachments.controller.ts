import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { PERMISSIONS } from '../../auth/constants/permissions';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../../leads/attachments/attachments.constants';
import { TaskAttachmentsService } from './task-attachments.service';

@ApiTags('tasks/attachments')
@Controller('tasks/:taskId/attachments')
export class TaskAttachmentsController {
  constructor(private readonly service: TaskAttachmentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TASKS_EDIT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException('Tipo de arquivo não permitido.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.service.upload(taskId, file, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TASKS_VIEW)
  list(@Param('taskId', ParseUUIDPipe) taskId: string, @CurrentUser() user: JwtPayload) {
    return this.service.list(taskId, user);
  }

  @Get(':attachmentId/download')
  @RequirePermissions(PERMISSIONS.TASKS_VIEW)
  async download(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { attachment, stream } = await this.service.getForDownload(taskId, attachmentId, user);
    response.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':attachmentId')
  @RequirePermissions(PERMISSIONS.TASKS_EDIT)
  async remove(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.service.remove(taskId, attachmentId, user);
    return { success: true };
  }
}
