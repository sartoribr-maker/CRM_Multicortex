import {
  BadRequestException,
  Body,
  ForbiddenException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { ADMIN_ROLE_NAME } from '../auth/constants/roles';
import { AllowThirdPartyPortal } from '../auth/decorators/allow-third-party-portal.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { SdrSummaryLeadsQueryDto, SdrSummaryQueryDto } from './dto/sdr-summary.query.dto';
import { OutboundImportDto } from './dto/outbound-import.dto';
import { OutboundImportService } from './outbound-import/outbound-import.service';
import { SdrPortalSettingsService } from './sdr-portal-settings.service';
import { SdrSummaryService } from './sdr-summary.service';

const SPREADSHEET_UPLOAD = {
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

/** A importação Outbound é restrita ao perfil Administrador. */
function requireAdmin(user: JwtPayload): void {
  if (user.roleName !== ADMIN_ROLE_NAME) {
    throw new ForbiddenException('Importação disponível apenas para o perfil Administrador.');
  }
}

function requireFile(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException('Selecione a planilha a importar.');
  return file;
}

@ApiTags('portal/sdr')
@Controller('portal/sdr')
@AllowThirdPartyPortal()
@RequirePermissions(PERMISSIONS.PORTAL_SDR_ACCESS)
export class SdrPortalController {
  constructor(
    private readonly settings: SdrPortalSettingsService,
    private readonly summaryService: SdrSummaryService,
    private readonly outboundImport: OutboundImportService,
  ) {}

  @Get('config')
  config() {
    return this.settings.getPortalConfig();
  }

  @Get('summary')
  summary(@Query() query: SdrSummaryQueryDto, @CurrentUser() user: JwtPayload) {
    return this.summaryService.summary(query, user);
  }

  /** Leads que compõem um card do dashboard. */
  @Get('summary/leads')
  summaryLeads(@Query() query: SdrSummaryLeadsQueryDto) {
    return this.summaryService.leads(query);
  }

  /** Lê a planilha e devolve os registros com a marcação inicial (blacklist). */
  @Post('imports/outbound/preview')
  @RequirePermissions(PERMISSIONS.PORTAL_SDR_ACCESS, PERMISSIONS.LEADS_CREATE)
  @UseInterceptors(FileInterceptor('file', SPREADSHEET_UPLOAD))
  previewOutboundImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    requireAdmin(user);
    return this.outboundImport.preview(requireFile(file));
  }

  /** Cria as oportunidades marcadas e envia todos os registros à blacklist. */
  @Post('imports/outbound')
  @RequirePermissions(PERMISSIONS.PORTAL_SDR_ACCESS, PERMISSIONS.LEADS_CREATE)
  @UseInterceptors(FileInterceptor('file', SPREADSHEET_UPLOAD))
  importOutbound(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: OutboundImportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    requireAdmin(user);
    return this.outboundImport.import(requireFile(file), dto, user);
  }
}
