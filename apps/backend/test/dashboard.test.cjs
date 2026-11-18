const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DashboardService } = require('../dist/src/dashboard/dashboard.service');

test('atenção imediata exclui ganho, perdido e em espera/pausado', async () => {
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
      lead('paused', 'Em espera/Pausado', 500),
      lead('pausedAccent', 'Em espera/Pausada', 600),
      lead('normal', 'Proposta', 50, 'Normal'),
    ] },
    stage: { findMany: async () => [] },
  }, {
    // Tarefas moram no PMO (integração): o gateway devolve as páginas no formato do CRM.
    list: async () => ({ items: [], total: 0, page: 1, pageSize: 6, totalPages: 0 }),
  });
  const result = await service.summary({ sub: 'owner', email: 'owner@x.com', name: 'Owner', permissions: ['leads.view.mandatory'] });
  assert.equal(result.metrics.pipelineValue, 1250);
  assert.deepEqual(result.mandatoryLeads.map(lead => lead.id), ['active']);
});

test('tarefas do dashboard vêm do PMO: atrasadas e próximas por prazo, só as minhas sem visão total', async () => {
  const calls = [];
  const service = new DashboardService({
    lead: { findMany: async () => [] },
    stage: { findMany: async () => [] },
    priority: { findMany: async () => [] },
  }, {
    list: async (filters, actor) => {
      calls.push({ filters, actor });
      return { items: [{ id: filters.overdue ? 'atrasada' : 'proxima' }], total: filters.overdue ? 3 : 1, page: 1, pageSize: 6, totalPages: 1 };
    },
  });
  const result = await service.summary({ sub: 'u', email: 'u@x.com', name: 'U', permissions: ['leads.view.mandatory'] });
  assert.equal(result.metrics.overdueTasks, 3);
  assert.deepEqual(result.overdueTasks.map(t => t.id), ['atrasada']);
  assert.deepEqual(result.upcomingTasks.map(t => t.id), ['proxima']);
  assert.deepEqual(calls[0].actor, { email: 'u@x.com', name: 'U', seeAll: false });
  assert.equal(calls[0].filters.mine, true);
  assert.equal(calls[0].filters.sortBy, 'dueDate');
  assert.equal(calls[1].filters.open, true);
  assert.match(calls[1].filters.dueFrom, /^\d{4}-\d{2}-\d{2}$/);
});
