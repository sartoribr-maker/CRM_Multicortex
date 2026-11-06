const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Servidor falso da API do Google Tasks.
const requests = [];
let server;
let client;

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      requests.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : null });
      const id = decodeURIComponent((req.url.split('/lists/%40default/tasks')[1] ?? '').replace(/^\//, ''));
      if (id === 'sumiu') {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: { message: 'Not Found' } }));
      }
      if (req.method === 'DELETE') {
        res.statusCode = 204;
        return res.end();
      }
      const taskId = id || 'novo';
      res.end(JSON.stringify({
        id: taskId,
        deleted: id === 'excluida',
        webViewLink: `https://tasks.google.com/task/${taskId}`,
      }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.GOOGLE_TASKS_API_URL = `http://127.0.0.1:${server.address().port}/tasks/v1`;
  client = require('../dist/src/calendar/google-tasks.client');
});

after(() => server.close());

const TASK = {
  title: 'Enviar proposta',
  description: 'Proposta revisada',
  // 23h30 em São Paulo do dia 06/11 (02h30 UTC do dia 07).
  dueDate: new Date('2026-11-07T02:30:00Z'),
  done: false,
  crmUrl: 'https://crm.multicortex.ai/tasks/t1',
};

test('cria em "Minhas tarefas" com o prazo na data de São Paulo', async () => {
  const saved = await client.saveGoogleTask('tk', TASK);
  assert.deepEqual(saved, { id: 'novo', webViewLink: 'https://tasks.google.com/task/novo' });
  const req = requests.at(-1);
  assert.equal(req.method, 'POST');
  assert.match(req.url, /\/tasks\/v1\/lists\/%40default\/tasks$/);
  assert.equal(req.body.due, '2026-11-06T00:00:00.000Z');
  assert.equal(req.body.status, 'needsAction');
  assert.equal(req.body.completed, null);
  assert.match(req.body.notes, /Tarefa no CRM: https:\/\/crm\.multicortex\.ai\/tasks\/t1/);
});

test('tarefa existente é atualizada e marcada como concluída', async () => {
  const saved = await client.saveGoogleTask('tk', { ...TASK, done: true }, 'g42');
  assert.equal(saved.id, 'g42');
  const req = requests.at(-1);
  assert.equal(req.method, 'PATCH');
  assert.match(req.url, /\/lists\/%40default\/tasks\/g42$/);
  assert.equal(req.body.status, 'completed');
  assert.equal('completed' in req.body, false);
});

test('tarefa apagada ou excluída no Google é recriada', async () => {
  for (const id of ['sumiu', 'excluida']) {
    const start = requests.length;
    const saved = await client.saveGoogleTask('tk', TASK, id);
    assert.equal(saved.id, 'novo');
    assert.deepEqual(requests.slice(start).map((r) => r.method), ['PATCH', 'POST']);
  }
});

test('exclusão aceita tarefa já removida', async () => {
  await client.deleteGoogleTask('tk', 'g42');
  assert.equal(requests.at(-1).method, 'DELETE');
  await client.deleteGoogleTask('tk', 'sumiu');
});
