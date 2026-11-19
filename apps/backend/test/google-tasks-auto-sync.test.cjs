const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { generateKeyPairSync } = require('node:crypto');

// "Integrar Tarefas com Calendar do Google" (cadastro do usuário): ciclo completo com um Google
// falso (token + Tasks), um PMO falso e um Prisma em memória.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEY = {
  client_email: 'crm@projeto.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};

/** Tarefas em "Minhas tarefas" do Google, por id. */
const google = new Map();
const googleCalls = [];
let nextGoogleId = 1;
let server;
let HttpException;
let AutoSync;

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/token') return res.end(JSON.stringify({ access_token: 'tk', expires_in: 3600 }));
      const id = decodeURIComponent((req.url.split('/lists/%40default/tasks')[1] ?? '').replace(/^\//, ''));
      const body = raw ? JSON.parse(raw) : null;
      googleCalls.push({ method: req.method, id, body });
      if (req.method === 'POST') {
        const created = { id: `g${nextGoogleId++}`, ...body };
        google.set(created.id, created);
        return res.end(JSON.stringify(created));
      }
      const current = google.get(id);
      if (!current) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: { message: 'Not Found' } }));
      }
      if (req.method === 'DELETE') {
        google.delete(id);
        res.statusCode = 204;
        return res.end();
      }
      if (req.method === 'PATCH') Object.assign(current, body);
      res.end(JSON.stringify(current));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.GOOGLE_OAUTH_TOKEN_URL = `${base}/token`;
  process.env.GOOGLE_TASKS_API_URL = `${base}/tasks/v1`;
  ({ HttpException } = require('@nestjs/common'));
  ({ GoogleTasksAutoSyncService: AutoSync } = require('../dist/src/calendar/google-tasks-auto-sync.service'));
});

after(() => server.close());

// ------------------------------------------------------------------ fakes

const USER = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@multicortex.ai',
  status: 'ACTIVE',
  deletedAt: null,
  googleTasksAutoSync: true,
  role: { name: 'Comercial' },
};

function matches(row, where) {
  for (const [field, cond] of Object.entries(where ?? {})) {
    if (field === 'user') {
      if (cond.id?.in && !cond.id.in.includes(row.userId)) return false;
      continue;
    }
    if (cond && typeof cond === 'object') {
      if (cond.in && !cond.in.includes(row[field])) return false;
      if (cond.notIn && cond.notIn.includes(row[field])) return false;
    } else if (row[field] !== cond) return false;
  }
  return true;
}

function fakePrisma() {
  const links = [];
  let seq = 1;
  return {
    links,
    user: {
      findMany: async ({ where }) =>
        [USER].filter((u) => u.googleTasksAutoSync === where.googleTasksAutoSync && u.status === 'ACTIVE'),
    },
    taskGoogleTask: {
      findMany: async ({ where, include }) =>
        links
          .filter((l) => matches(l, where))
          .map((l) => (include ? { ...l, user: USER } : { ...l })),
      upsert: async ({ where, create, update }) => {
        const key = where.taskId_userId;
        const found = links.find((l) => l.taskId === key.taskId && l.userId === key.userId);
        if (found) return Object.assign(found, update);
        const row = { id: `l${seq++}`, reminderEventId: null, ...create };
        links.push(row);
        return row;
      },
      update: async ({ where, data }) => Object.assign(links.find((l) => l.id === where.id), data),
      deleteMany: async ({ where }) => {
        const index = links.findIndex((l) => l.id === where.id);
        if (index >= 0) links.splice(index, 1);
      },
    },
  };
}

function crmTask(id, status, extra = {}) {
  return {
    id,
    code: `T-${id}`,
    title: `Tarefa ${id}`,
    description: null,
    status,
    priority: 'HIGH',
    dueDate: new Date('2026-11-25T15:00:00Z'),
    assignees: [{ user: { id: 'u1', name: 'Ana', email: 'ana@multicortex.ai' } }],
    createdByUser: { id: 'u2', name: 'Bruno' },
    lead: { id: 'l1', name: 'Oportunidade X', companyName: 'ACME', stage: { name: 'Proposta' } },
    project: null,
    deletedAt: null,
    ...extra,
  };
}

function fakePmo() {
  const tasks = new Map();
  const calls = [];
  return {
    tasks,
    calls,
    listAll: async (filters, actor) =>
      [...tasks.values()].filter(
        (t) =>
          t.status === filters.status &&
          t.assignees.some(({ user }) => user.email === actor.email),
      ),
    get: async (id) => {
      const task = tasks.get(id);
      if (!task) throw new HttpException('Tarefa não encontrada.', 404);
      return task;
    },
    complete: async (id, reason) => {
      calls.push({ op: 'complete', id, reason });
      tasks.get(id).status = 'DONE';
    },
    update: async (id, input) => {
      calls.push({ op: 'update', id, input });
      Object.assign(tasks.get(id), input);
    },
  };
}

function setup() {
  const prisma = fakePrisma();
  const pmo = fakePmo();
  const audits = [];
  const settings = {
    getRuntime: async () => ({ settings: { workspaceDomain: 'multicortex.ai' }, key: KEY }),
  };
  const config = { get: (_name, fallback) => (_name === 'FRONTEND_URL' ? 'https://crm.multicortex.ai' : fallback) };
  const service = new AutoSync(prisma, settings, pmo, { record: async (a) => audits.push(a) }, config);
  return { prisma, pmo, audits, service };
}

function googleTaskFor(prisma, taskId) {
  const link = prisma.links.find((l) => l.taskId === taskId);
  return link ? google.get(link.googleTaskId) : undefined;
}

// ------------------------------------------------------------------ testes

test('tarefa "Em andamento" vai para o Google com os campos do CRM, e só é reenviada se mudar', async () => {
  const { prisma, pmo, service } = setup();
  pmo.tasks.set('a', crmTask('a', 'IN_PROGRESS', { description: 'Revisar escopo' }));
  pmo.tasks.set('b', crmTask('b', 'TODO'));

  await service.syncAll();
  assert.equal(prisma.links.length, 1);
  const created = googleTaskFor(prisma, 'a');
  assert.equal(created.title, '[T-a] Tarefa a');
  assert.equal(created.status, 'needsAction');
  assert.equal(created.due, '2026-11-25T00:00:00.000Z');
  assert.match(created.notes, /^Revisar escopo/);
  assert.match(created.notes, /Prioridade: Alta/);
  assert.match(created.notes, /Oportunidade: Oportunidade X – ACME/);
  assert.match(created.notes, /Tarefa no CRM: https:\/\/crm\.multicortex\.ai\/tasks\/a/);
  assert.equal(prisma.links[0].auto, true);
  assert.equal(prisma.links[0].crmStatus, 'IN_PROGRESS');

  const before = googleCalls.filter((c) => c.method !== 'GET').length;
  await service.syncAll();
  assert.equal(googleCalls.filter((c) => c.method !== 'GET').length, before, 'sem alteração, sem escrita');

  pmo.tasks.get('a').title = 'Tarefa a revisada';
  await service.syncAll();
  assert.equal(googleTaskFor(prisma, 'a').title, '[T-a] Tarefa a revisada');
  assert.equal(googleCalls.at(-1).method, 'PATCH');
});

test('CRM → Google: concluída marca como feita; "A Fazer"/"Cancelada"/fora da responsabilidade apaga', async () => {
  const { prisma, pmo, service } = setup();
  for (const id of ['c1', 'c2', 'c3', 'c4']) pmo.tasks.set(id, crmTask(id, 'IN_PROGRESS'));
  await service.syncAll();
  const ids = Object.fromEntries(prisma.links.map((l) => [l.taskId, l.googleTaskId]));

  pmo.tasks.get('c1').status = 'DONE';
  pmo.tasks.get('c2').status = 'TODO';
  pmo.tasks.get('c3').status = 'CANCELED';
  pmo.tasks.get('c4').assignees = [{ user: { id: 'u9', name: 'Outro', email: 'outro@multicortex.ai' } }];
  await service.syncAll();

  assert.equal(google.get(ids.c1).status, 'completed');
  assert.equal(google.has(ids.c2), false);
  assert.equal(google.has(ids.c3), false);
  assert.equal(google.has(ids.c4), false);
  assert.equal(prisma.links.length, 0);
});

test('Google → CRM: concluir no Google conclui; excluir no Google cancela', async () => {
  const { prisma, pmo, audits, service } = setup();
  pmo.tasks.set('d1', crmTask('d1', 'IN_PROGRESS'));
  pmo.tasks.set('d2', crmTask('d2', 'IN_PROGRESS'));
  await service.syncAll();

  googleTaskFor(prisma, 'd1').status = 'completed';
  google.delete(prisma.links.find((l) => l.taskId === 'd2').googleTaskId);
  await service.syncAll();

  assert.equal(pmo.tasks.get('d1').status, 'DONE');
  assert.match(pmo.calls.find((c) => c.op === 'complete').reason, /Google/);
  assert.equal(pmo.tasks.get('d2').status, 'CANCELED');
  assert.equal(prisma.links.length, 0, 'não recria nem acompanha mais');
  assert.deepEqual(audits.map((a) => a.action).sort(), ['TASK_COMPLETED', 'TASK_UPDATED']);
});

test('se o CRM mudou antes, a regra do CRM prevalece sobre a exclusão no Google', async () => {
  const { prisma, pmo, service } = setup();
  pmo.tasks.set('e1', crmTask('e1', 'IN_PROGRESS'));
  await service.syncAll();
  google.delete(prisma.links[0].googleTaskId);
  pmo.tasks.get('e1').status = 'TODO';
  await service.syncAll();
  assert.equal(pmo.tasks.get('e1').status, 'TODO');
  assert.equal(pmo.calls.length, 0);
  assert.equal(prisma.links.length, 0);
});

test('desmarcar a opção no cadastro tira do Google as tarefas criadas pela integração', async () => {
  const { prisma, pmo, service } = setup();
  pmo.tasks.set('f1', crmTask('f1', 'IN_PROGRESS'));
  await service.syncAll();
  const googleId = prisma.links[0].googleTaskId;
  USER.googleTasksAutoSync = false;
  try {
    await service.syncAll();
  } finally {
    USER.googleTasksAutoSync = true;
  }
  assert.equal(google.has(googleId), false);
  assert.equal(prisma.links.length, 0);
});

test('vínculo manual de tarefa em andamento é assumido; conclusão feita antes no Google vale', async () => {
  const { prisma, pmo, service } = setup();
  pmo.tasks.set('g1', crmTask('g1', 'IN_PROGRESS'));
  pmo.tasks.set('g2', crmTask('g2', 'IN_PROGRESS'));
  pmo.tasks.set('g3', crmTask('g3', 'TODO'));
  google.set('manual1', { id: 'manual1', title: 'Manual 1', status: 'completed' });
  google.set('manual2', { id: 'manual2', title: 'Manual 2', status: 'needsAction' });
  google.set('manual3', { id: 'manual3', title: 'Manual 3', status: 'needsAction' });
  for (const [taskId, googleTaskId] of [['g1', 'manual1'], ['g2', 'manual2'], ['g3', 'manual3']]) {
    prisma.links.push({
      id: `m-${taskId}`,
      taskId,
      userId: 'u1',
      googleEmail: 'ana@multicortex.ai',
      googleTaskId,
      reminderEventId: null,
      auto: false,
      crmStatus: null,
      syncedHash: null,
    });
  }
  await service.syncAll();

  // Concluída no Google antes: conclui no CRM e não é reaberta no Google.
  assert.equal(pmo.tasks.get('g1').status, 'DONE');
  assert.equal(google.get('manual1').status, 'completed');
  // Aberta: passa a ser da integração e recebe os campos do CRM na mesma tarefa do Google.
  const g2 = prisma.links.find((l) => l.taskId === 'g2');
  assert.equal(g2.auto, true);
  assert.equal(g2.googleTaskId, 'manual2');
  assert.equal(google.get('manual2').title, '[T-g2] Tarefa g2');
  // Fora de "Em andamento": o vínculo manual continua manual e intocado.
  const g3 = prisma.links.find((l) => l.taskId === 'g3');
  assert.equal(g3.auto, false);
  assert.equal(google.get('manual3').title, 'Manual 3');
});
