const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { generateKeyPairSync, createVerify } = require('node:crypto');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEY = {
  client_email: 'crm@projeto.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};

// Servidor falso do Google: token OAuth e criação de evento.
const received = { tokens: [], events: [] };
let server;
let client;

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/token') {
        const assertion = new URLSearchParams(raw).get('assertion');
        const [header, claims, signature] = assertion.split('.');
        const valid = createVerify('RSA-SHA256')
          .update(`${header}.${claims}`)
          .verify(publicKey, Buffer.from(signature, 'base64url'));
        const payload = JSON.parse(Buffer.from(claims, 'base64url').toString());
        received.tokens.push({ valid, payload });
        if (payload.sub === 'bloqueado@multicortex.ai') {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: 'unauthorized_client', error_description: 'Client is unauthorized' }));
        }
        return res.end(JSON.stringify({ access_token: `token-${payload.sub}` }));
      }
      if (req.url.startsWith('/calendar/calendars/primary/events')) {
        received.events.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(raw) });
        return res.end(JSON.stringify({
          id: 'evt1',
          htmlLink: 'https://calendar.google.com/event?eid=evt1',
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
        }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.GOOGLE_OAUTH_TOKEN_URL = `${base}/token`;
  process.env.GOOGLE_CALENDAR_API_URL = `${base}/calendar`;
  client = require('../dist/src/calendar/google-calendar.client');
});

after(() => server.close());

test('valida o JSON da chave da conta de serviço', () => {
  const json = JSON.stringify({ type: 'service_account', ...KEY });
  assert.equal(client.parseServiceAccountKey(json).client_email, KEY.client_email);
  assert.throws(() => client.parseServiceAccountKey('não é json'), /JSON válido/);
  assert.throws(() => client.parseServiceAccountKey('{"type":"authorized_user"}'), /service_account/);
});

test('organizador: usuário do domínio usa a própria agenda; demais, a padrão', () => {
  const fallback = 'multicortex@multicortex.ai';
  assert.equal(client.pickOrganizer('Tiago@Multicortex.ai', 'multicortex.ai', fallback), 'tiago@multicortex.ai');
  assert.equal(client.pickOrganizer('sdr@terceira.com.br', 'multicortex.ai', fallback), fallback);
  assert.equal(client.pickOrganizer('x@fake-multicortex.ai', '@multicortex.ai', fallback), fallback);
});

test('token: JWT assinado, escopo calendar.events e usuário representado', async () => {
  const token = await client.fetchAccessToken(KEY, 'tiago@multicortex.ai');
  assert.equal(token, 'token-tiago@multicortex.ai');
  const { valid, payload } = received.tokens.at(-1);
  assert.equal(valid, true, 'assinatura RS256 confere com a chave pública');
  assert.equal(payload.iss, KEY.client_email);
  assert.equal(payload.sub, 'tiago@multicortex.ai');
  assert.equal(payload.scope, 'https://www.googleapis.com/auth/calendar.events');
  assert.equal(payload.exp - payload.iat, 3600);
});

test('delegação não autorizada vira mensagem clara', async () => {
  await assert.rejects(
    client.fetchAccessToken(KEY, 'bloqueado@multicortex.ai'),
    (error) => error instanceof client.GoogleCalendarError && /delegação em todo o domínio/.test(error.message),
  );
});

test('evento com Google Meet, convidados e envio de convites', async () => {
  const startAt = new Date('2026-10-21T17:00:00Z');
  const event = await client.insertCalendarEvent('token-x', {
    title: 'Reunião Multicortex — ACME',
    description: 'Diagnóstico',
    startAt,
    endAt: new Date(startAt.getTime() + 3600000),
    attendees: ['contato@acme.com', 'tiago@multicortex.ai'],
    withMeet: true,
  });
  assert.deepEqual(event, {
    id: 'evt1',
    htmlLink: 'https://calendar.google.com/event?eid=evt1',
    meetLink: 'https://meet.google.com/abc-defg-hij',
  });
  const sent = received.events.at(-1);
  assert.match(sent.url, /conferenceDataVersion=1/);
  assert.match(sent.url, /sendUpdates=all/);
  assert.equal(sent.auth, 'Bearer token-x');
  assert.equal(sent.body.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
  assert.deepEqual(sent.body.attendees, [{ email: 'contato@acme.com' }, { email: 'tiago@multicortex.ai' }]);
  assert.equal(sent.body.start.timeZone, 'America/Sao_Paulo');
  assert.equal(sent.body.start.dateTime, '2026-10-21T17:00:00.000Z');
});

test('sem Google Meet não pede sala de conferência', () => {
  const body = client.buildEventBody({
    title: 'Presencial', startAt: new Date(), endAt: new Date(), attendees: [], withMeet: false,
  });
  assert.equal('conferenceData' in body, false);
});
