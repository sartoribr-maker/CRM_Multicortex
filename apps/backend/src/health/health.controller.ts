import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { ApiHealthResponse } from '@multicortex/shared';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOkResponse({ description: 'Status de disponibilidade da API' })
  check(): ApiHealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
