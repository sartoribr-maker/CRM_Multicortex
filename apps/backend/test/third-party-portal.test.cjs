const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Reflector } = require('@nestjs/core');
const { ForbiddenException } = require('@nestjs/common');
const { ThirdPartyPortalGuard } = require('../dist/src/auth/guards/third-party-portal.guard');
const { LeadsController } = require('../dist/src/leads/leads.controller');
const { AttachmentsController } = require('../dist/src/leads/attachments/attachments.controller');
const { TasksController } = require('../dist/src/tasks/tasks.controller');
const { UsersController } = require('../dist/src/users/users.controller');
const { DashboardController } = require('../dist/src/dashboard/dashboard.controller');
const { StagesController } = require('../dist/src/settings/stages/stages.controller');
const { AuthController } = require('../dist/src/auth/auth.controller');
const { SdrPortalController } = require('../dist/src/sdr-portal/sdr-portal.controller');
const { SdrPortalSettingsController } = require('../dist/src/sdr-portal/sdr-portal-settings.controller');

const SDR = { sub: 'sdr', portal: 'THIRD_PARTY', permissions: [] };

function setup() {
  const records = [];
  const guard = new ThirdPartyPortalGuard(new Reflector(), {
    record: async (entry) => records.push(entry),
  });
  const run = (user, controller, handler) =>
    guard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({ user, method: 'GET', originalUrl: `/api/v1/${handler}` }),
      }),
      getHandler: () => controller.prototype[handler],
      getClass: () => controller,
    });
  return { run, records };
}

test('rotas fora da lista liberada respondem 403 ao THIRD_PARTY e são auditadas', async () => {
  const { run, records } = setup();
  const denied = [
    [LeadsController, 'remove'],
    [LeadsController, 'archive'],
    [AttachmentsController, 'remove'],
    [TasksController, 'update'],
    [TasksController, 'transfer'],
    [TasksController, 'create'],
    [UsersController, 'findAll'],
    [DashboardController, 'summary'],
    [StagesController, 'create'],
    [SdrPortalSettingsController, 'update'],
  ];
  for (const [controller, handler] of denied) {
    await assert.rejects(run(SDR, controller, handler), ForbiddenException, `${controller.name}.${handler}`);
  }
  assert.equal(records.length, denied.length);
  assert.equal(records[0].action, 'THIRD_PARTY_PORTAL_ACCESS_DENIED');
  assert.equal(records[0].actorUserId, 'sdr');
});

test('rotas liberadas passam para o THIRD_PARTY', async () => {
  const { run, records } = setup();
  const allowed = [
    [LeadsController, 'findAll'],
    [LeadsController, 'findOne'],
    [LeadsController, 'create'],
    [LeadsController, 'update'],
    [LeadsController, 'addComment'],
    [AttachmentsController, 'upload'],
    [AttachmentsController, 'download'],
    [TasksController, 'findAll'],
    [TasksController, 'complete'],
    [StagesController, 'findAll'],
    [AuthController, 'me'],
    [SdrPortalController, 'summary'],
    [SdrPortalController, 'config'],
  ];
  for (const [controller, handler] of allowed) {
    assert.equal(await run(SDR, controller, handler), true, `${controller.name}.${handler}`);
  }
  assert.equal(records.length, 0);
});

test('usuários internos, tokens antigos e rotas públicas não são afetados', async () => {
  const { run } = setup();
  assert.equal(await run({ sub: 'a', portal: 'INTERNAL' }, UsersController, 'findAll'), true);
  assert.equal(await run({ sub: 'a' }, LeadsController, 'remove'), true);
  assert.equal(await run(undefined, AuthController, 'login'), true);
});
