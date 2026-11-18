import { Global, Module } from '@nestjs/common';
import { PmoClientService } from './pmo-client.service';
import { PmoTasksGateway } from './pmo-tasks.gateway';

/**
 * Integração com o Multicortex Projetos (PMO): as tarefas moram na base do PMO (decisão de
 * 2026-11-17). Global porque tarefas, leads, dashboard, Portal SDR e monitoramento usam.
 */
@Global()
@Module({
  providers: [PmoClientService, PmoTasksGateway],
  exports: [PmoClientService, PmoTasksGateway],
})
export class PmoModule {}
