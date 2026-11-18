import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permissions';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

/**
 * Endereço público do Multicortex Projetos (PMO), usado pelo navegador para abrir o cadastro de
 * projeto quando uma oportunidade é ganha. Sem `PMO_URL`, a conversão em projeto fica desligada.
 */
@ApiTags('pmo')
@Controller('pmo')
export class PmoConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('config')
  @RequirePermissions(PERMISSIONS.LEADS_EDIT)
  @ApiOperation({ summary: 'Endereço do PMO para converter oportunidade ganha em projeto' })
  getConfig() {
    const url = this.config.get<string>('PMO_URL')?.trim().replace(/\/$/, '') || null;
    return { enabled: !!url, url };
  }
}
