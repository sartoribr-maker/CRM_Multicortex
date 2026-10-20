import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { ImportServicesDto } from './dto/import-services.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { buildPricingTemplate } from './import/pricing-sheet.parser';
import { ServicesImportService } from './import/services-import.service';
import { ServicesService } from './services.service';

const PRICING_UPLOAD = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    // O conteúdo é validado na leitura; o tipo MIME varia entre navegadores.
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      callback(new BadRequestException('Envie uma planilha Excel no formato .xlsx.'), false);
      return;
    }
    callback(null, true);
  },
};

function requireFile(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException('Selecione a planilha de precificação.');
  return file;
}

@ApiTags('settings/services')
@Controller('services')
export class ServicesController {
  constructor(
    private readonly service: ServicesService,
    private readonly imports: ServicesImportService,
  ) {}
  @Get() findAll(@Query() query: ListSettingsQueryDto) {
    return this.service.findAll(query);
  }
  /** Planilha modelo no formato aceito pela importação. */
  @Get('import/template')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async template(@Res() res: Response) {
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('modelo-precificacao-servicos.xlsx')
      .send(await buildPricingTemplate());
  }

  /** Lê a planilha de precificação e mostra os serviços que serão criados ou atualizados. */
  @Post('import/preview')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @UseInterceptors(FileInterceptor('file', PRICING_UPLOAD))
  previewImport(@UploadedFile() file: Express.Multer.File, @Body() dto: ImportServicesDto) {
    return this.imports.preview(requireFile(file), dto.productName);
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @UseInterceptors(FileInterceptor('file', PRICING_UPLOAD))
  import(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportServicesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.imports.import(requireFile(file), dto, user.sub);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.archive(id, user.sub);
  }
}
