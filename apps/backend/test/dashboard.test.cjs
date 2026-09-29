const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DashboardService } = require('../dist/src/dashboard/dashboard.service');

test('pipeline e atenção imediata excluem ganho e perdido mesmo com status OPEN', async () => {
  const lead = (id, stage, amount, priority = 'Mandatória') => ({
    id, status: 'OPEN', estimatedValue: amount,
    stage: { name: stage }, priority: { id: priority, name: priority },
    owner: { id: 'owner', name: 'Responsável' },
  });
  const service = new DashboardService({
    lead: { findMany: async () => [
      lead('active', 'Leads', 100),
      lead('won', 'Ganho (Projeto ativo)', 200),
      lead('lost', 'Perdido', 300),
      lead('case', ' PERDIDO ', 400),
      lead('normal', 'Proposta', 50, 'Normal'),
    ] },
    stage: { findMany: async () => [] },
    task: { findMany: async () => [], count: async () => 0 },
  });
  const result = await service.summary({ sub: 'owner', permissions: [] });
  assert.equal(result.metrics.pipelineValue, 150);
  assert.deepEqual(result.mandatoryLeads.map(lead => lead.id), ['active']);
});
