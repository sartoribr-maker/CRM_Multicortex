const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MonitoringService, firstMonitoringRun } = require('../dist/src/notifications/monitoring.service');

const user = (id, extra = {}) => ({ id, name: id, email: `${id}@example.com`, status: 'ACTIVE', deletedAt: null, ...extra });
const monitor = user('monitor');
const collector = user('collector');
const owner = user('owner');
const other = user('other');
const task = (id, owners) => ({ id, title: id, dueDate: new Date('2026-09-20T12:00:00Z'), assignee: owners[0], assignees: owners.map(user => ({ user })), lead: null });

test('horário de Brasília, antes/depois do horário e virada de mês', () => {
  assert.equal(firstMonitoringRun('08:00', new Date('2026-09-28T10:59:00Z')).toISOString(), '2026-09-28T11:00:00.000Z');
  assert.equal(firstMonitoringRun('08:00', new Date('2026-09-28T11:00:00Z')).toISOString(), '2026-09-29T11:00:00.000Z');
  assert.equal(firstMonitoringRun('23:00', new Date('2026-10-01T01:00:00Z')).toISOString(), '2026-10-01T02:00:00.000Z');
});

test('relatórios separados, responsáveis restritos e cobrador sem duplicidade', async () => {
  const sent = [];
  const now = new Date('2026-09-28T12:00:00Z');
  const prisma = {
    user: { findMany: async () => [monitor, collector] },
    task: { findMany: async ({ where }) => {
      assert.deepEqual(where, { deletedAt: null, dueDate: { lt: now }, status: { notIn: ['DONE', 'CANCELED'] } });
      return [task('a', [owner, collector]), task('b', [other]), task('c', [user('inactive', { status: 'INACTIVE' })])];
    } },
    lead: { findMany: async ({ where }) => {
      assert.equal(where.deletedAt, null);
      assert.deepEqual(where.stage.OR.map(item => item.name.equals), ['Backlog', 'Leads']);
      return [{ id: 'lead', name: 'Lead', stage: { name: 'Leads' } }];
    } },
  };
  const service = new MonitoringService(prisma, { monitoringReport: async (recipient, title, items, kind) => sent.push({ id: recipient.id, items: items.map(item => item.id), kind }) }, {});
  await service.sendReports('monitor', now);
  assert.deepEqual(sent.filter(item => item.kind === 'tasks'), [
    { id: 'monitor', items: ['a', 'b', 'c'], kind: 'tasks' },
    { id: 'collector', items: ['a', 'b', 'c'], kind: 'tasks' },
    { id: 'owner', items: ['a'], kind: 'tasks' },
    { id: 'other', items: ['b'], kind: 'tasks' },
  ]);
  assert.deepEqual(sent.filter(item => item.kind === 'leads').map(item => item.id), ['monitor', 'collector']);
});

test('não envia relatórios vazios', async () => {
  const service = new MonitoringService({ user: { findMany: async () => [monitor] }, task: { findMany: async () => [] }, lead: { findMany: async () => [] } }, { monitoringReport: async () => assert.fail('Envio vazio') }, {});
  await service.sendReports('monitor', new Date());
});

test('agendamento persistido: recuperação após parada e exclusão concorrente', async () => {
  const settings = { id: 'default', enabled: true, nextRunAt: new Date('2026-09-20T11:00:00Z'), intervalDays: 7, monitorUserId: 'monitor', updatedAt: new Date() };
  let calls = 0;
  let claimed = false;
  const prisma = { monitoringSettings: {
    upsert: async () => settings,
    updateMany: async ({ data }) => {
      assert.equal(data.nextRunAt.toISOString(), '2026-10-04T11:00:00.000Z');
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    },
  } };
  const first = new MonitoringService(prisma, {}, {});
  const second = new MonitoringService(prisma, {}, {});
  first.sendReports = second.sendReports = async () => { calls++; };
  await Promise.all([first.tick(new Date('2026-09-28T12:00:00Z')), second.tick(new Date('2026-09-28T12:00:00Z'))]);
  assert.equal(calls, 1);
});

test('SMTP indisponível e monitor inativo impedem ativação', async () => {
  const dto = { enabled: true, monitorUserId: 'monitor', startTime: '08:00', intervalDays: 1 };
  const service = new MonitoringService({ user: { findFirst: async () => monitor } }, {}, { getRuntimeConfig: async () => null });
  await assert.rejects(service.update(dto, 'actor'), /Configure e ative/);
  const inactive = new MonitoringService({ user: { findFirst: async () => null } }, {}, {});
  await assert.rejects(inactive.update(dto, 'actor'), /usuário ativo/);
});

test('falha de envio fica registrada sem repetição imediata', async () => {
  let error;
  const service = new MonitoringService({ monitoringSettings: {
    upsert: async () => ({ id: 'default', enabled: true, nextRunAt: new Date('2026-09-28T11:00:00Z'), intervalDays: 1 }),
    updateMany: async () => ({ count: 1 }),
    update: async ({ data }) => { error = data.lastError; },
  } }, {}, {});
  service.logger.error = () => {};
  service.sendReports = async () => { throw new Error('SMTP falhou'); };
  await service.tick(new Date('2026-09-28T12:00:00Z'));
  assert.match(error, /Falha no envio/);
});
