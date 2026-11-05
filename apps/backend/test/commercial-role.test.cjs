const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  mandatoryLeadFilter,
  mandatoryTaskFilter,
  isMandatoryPriorityName,
} = require('../dist/src/leads/mandatory-priority');
const { assertCanDeleteRecord } = require('../dist/src/auth/delete-ownership');
const { PermissionsGuard } = require('../dist/src/auth/guards/permissions.guard');
const { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY } = require('../dist/src/auth/decorators/require-permissions.decorator');

const prisma = {
  priority: {
    findMany: async () => [
      { id: 'p-mand', name: 'Mandatória' },
      { id: 'p-mand2', name: ' MANDATORIA ' },
      { id: 'p-alta', name: 'Alta' },
    ],
  },
};

test('reconhece a prioridade Mandatória sem acento e sem caixa', () => {
  assert.equal(isMandatoryPriorityName('Mandatória'), true);
  assert.equal(isMandatoryPriorityName('mandatoria'), true);
  assert.equal(isMandatoryPriorityName('Alta'), false);
  assert.equal(isMandatoryPriorityName(null), false);
});

test('sem leads.view.mandatory, leads e tarefas Mandatórios ficam ocultos', async () => {
  const user = { permissions: ['leads.view'] };
  assert.deepEqual(await mandatoryLeadFilter(prisma, user), {
    OR: [{ priorityId: null }, { priorityId: { notIn: ['p-mand', 'p-mand2'] } }],
  });
  assert.deepEqual(await mandatoryTaskFilter(prisma, user), {
    OR: [
      { leadId: null },
      { lead: { priorityId: null } },
      { lead: { priorityId: { notIn: ['p-mand', 'p-mand2'] } } },
    ],
  });
});

test('com leads.view.mandatory, nada é filtrado', async () => {
  const user = { permissions: ['leads.view', 'leads.view.mandatory'] };
  assert.deepEqual(await mandatoryLeadFilter(prisma, user), {});
  assert.deepEqual(await mandatoryTaskFilter(prisma, user), {});
});

test('delete.own só exclui o que o próprio usuário criou', () => {
  const own = { sub: 'u1', permissions: ['leads.delete.own'] };
  assert.doesNotThrow(() => assertCanDeleteRecord(own, 'leads.delete', 'u1'));
  assert.throws(() => assertCanDeleteRecord(own, 'leads.delete', 'u2'), /criados por você/);
  assert.throws(() => assertCanDeleteRecord(own, 'leads.delete', null), /criados por você/);
  const any = { sub: 'u1', permissions: ['leads.delete'] };
  assert.doesNotThrow(() => assertCanDeleteRecord(any, 'leads.delete', 'u2'));
});

test('guard aceita qualquer uma das permissões de exclusão', () => {
  const guardFor = (meta, permissions) => {
    const reflector = { getAllAndOverride: (key) => meta[key] };
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
    };
    return () => new PermissionsGuard(reflector).canActivate(context);
  };
  const meta = { [ANY_PERMISSIONS_KEY]: ['tasks.delete', 'tasks.delete.own'] };
  assert.equal(guardFor(meta, ['tasks.delete.own'])(), true);
  assert.equal(guardFor(meta, ['tasks.delete'])(), true);
  assert.throws(guardFor(meta, ['tasks.view']), /permissão/);
  assert.throws(
    guardFor({ ...meta, [PERMISSIONS_KEY]: ['tasks.view'] }, ['tasks.delete.own']),
    /permissão/,
  );
});
