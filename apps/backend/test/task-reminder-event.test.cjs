const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Servidor falso da API do Google Agenda para o evento-lembrete das tarefas.
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
      const id = decodeURIComponent((req.url.split('/events')[1] ?? '').split('?')[0].replace(/^\//, ''));
      if (id === 'sumiu') {
        res.statusCode = 410;
        return res.end(JSON.stringify({ error: { message: 'Gone' } }));
      }
      if (req.method === 'DELETE') {
        res.statusCode = 204;
        return res.end();
      }
      res.end(JSON.stringify({ id: id || 'lembrete-novo' }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.GOOGLE_CALENDAR_API_URL = `http://127.0.0.1:${server.address().port}/calendar`;
  client = require('../dist/src/calendar/google-calendar.client');
});

after(() => server.close());

const INPUT = {
  title: 'Enviar proposta',
  description: 'Proposta revisada',
  day: '2026-11-09',
  crmUrl: 'https://crm.multicortex.ai/tasks/t1',
};

test('lembrete às 10h de São Paulo, com notificação no horário e sem convites', async () => {
  const id = await client.saveTaskReminderEvent('tk', INPUT);
  assert.equal(id, 'lembrete-novo');
  const req = requests.at(-1);
  assert.equal(req.method, 'POST');
  assert.match(req.url, /\/calendars\/primary\/events\?sendUpdates=none$/);
  assert.deepEqual(req.body.start, { dateTime: '2026-11-09T10:00:00', timeZone: 'America/Sao_Paulo' });
  assert.deepEqual(req.body.end, { dateTime: '2026-11-09T10:15:00', timeZone: 'America/Sao_Paulo' });
  assert.deepEqual(req.body.reminders, { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] });
  assert.equal(req.body.summary, '⏰ Enviar proposta');
  assert.equal(req.body.transparency, 'transparent');
  assert.equal('attendees' in req.body, false);
  assert.match(req.body.description, /Tarefa no CRM: https:\/\/crm\.multicortex\.ai\/tasks\/t1/);
});

test('lembrete existente é atualizado; se sumiu no Google, é recriado', async () => {
  assert.equal(await client.saveTaskReminderEvent('tk', INPUT, 'ev7'), 'ev7');
  assert.equal(requests.at(-1).method, 'PATCH');
  const start = requests.length;
  assert.equal(await client.saveTaskReminderEvent('tk', INPUT, 'sumiu'), 'lembrete-novo');
  assert.deepEqual(requests.slice(start).map((r) => r.method), ['PATCH', 'POST']);
});

test('exclusão do lembrete aceita evento já removido', async () => {
  await client.deleteCalendarEvent('tk', 'ev7');
  assert.equal(requests.at(-1).method, 'DELETE');
  await client.deleteCalendarEvent('tk', 'sumiu');
});
