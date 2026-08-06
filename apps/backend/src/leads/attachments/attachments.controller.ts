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
import { AttachmentsService } from './attachments.service';
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from './attachments.constants';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';

@ApiTags('leads/attachments')
@Controller('leads/:leadId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LEADS_EDIT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException('Tipo de arquivo não permitido.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.attachmentsService.upload(leadId, file, currentUser);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  list(@Param('leadId', ParseUUIDPipe) leadId: string, @CurrentUser() currentUser: JwtPayload) {
    return this.attachmentsService.list(leadId, currentUser);
  }

  @Get(':attachmentId/download')
  @RequirePermissions(PERMISSIONS.LEADS_VIEW)
  async download(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() currentUser: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { attachment, stream } = await this.attachmentsService.getForDownload(
      leadId,
      attachmentId,
      currentUser,
    );
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':attachmentId')
  @RequirePermissions(PERMISSIONS.LEADS_EDIT)
  async remove(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    await this.attachmentsService.remove(leadId, attachmentId, currentUser);
    return { success: true };
  }
}
