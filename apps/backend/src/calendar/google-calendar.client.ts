import { createSign, randomUUID } from 'node:crypto';

/** Escopo exigido na delegação em todo o domínio do Google Workspace. */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// URLs substituíveis apenas para testes automatizados.
const TOKEN_URL = process.env.GOOGLE_OAUTH_TOKEN_URL ?? 'https://oauth2.googleapis.com/token';
const CALENDAR_API_URL =
  process.env.GOOGLE_CALENDAR_API_URL ?? 'https://www.googleapis.com/calendar/v3';

export const MEETING_TIME_ZONE = 'America/Sao_Paulo';

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export class GoogleCalendarError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Valida o JSON da chave da conta de serviço baixado do Google Cloud. */
export function parseServiceAccountKey(json: string): ServiceAccountKey {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new GoogleCalendarError('A chave informada não é um JSON válido.');
  }
  if (
    data.type !== 'service_account' ||
    typeof data.client_email !== 'string' ||
    typeof data.private_key !== 'string' ||
    !data.private_key.includes('PRIVATE KEY')
  ) {
    throw new GoogleCalendarError(
      'Informe o arquivo JSON da chave de uma conta de serviço (type "service_account").',
    );
  }
  return { client_email: data.client_email, private_key: data.private_key };
}

/**
 * Agenda em que o evento será criado: a do próprio usuário quando ele é do
 * domínio do Workspace; senão, a do organizador padrão.
 */
export function pickOrganizer(userEmail: string, workspaceDomain: string, fallback: string): string {
  const domain = workspaceDomain.trim().toLowerCase().replace(/^@/, '');
  const email = userEmail.trim().toLowerCase();
  return domain && email.endsWith(`@${domain}`) ? email : fallback.trim().toLowerCase();
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/** JWT assinado (RS256) que a conta de serviço troca por um token de acesso do usuário `subject`. */
export function createServiceAccountAssertion(
  key: ServiceAccountKey,
  subject: string,
  now = new Date(),
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      sub: subject,
      scope: GOOGLE_CALENDAR_SCOPE,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key);
  return `${header}.${claims}.${base64url(signature)}`;
}

export async function fetchAccessToken(key: ServiceAccountKey, subject: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createServiceAccountAssertion(key, subject),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    const reason = [body.error, body.error_description].filter(Boolean).join(': ');
    throw new GoogleCalendarError(
      body.error === 'unauthorized_client'
        ? `O Google não autorizou a conta de serviço a acessar a agenda de ${subject}. ` +
            `Confira a delegação em todo o domínio e o escopo ${GOOGLE_CALENDAR_SCOPE}.`
        : body.error === 'invalid_grant'
          ? `O Google recusou o acesso à agenda de ${subject} (${reason}). ` +
            'Confira se o e-mail existe no Google Workspace.'
          : `Falha ao autenticar no Google (${response.status}${reason ? `: ${reason}` : ''}).`,
      response.status,
    );
  }
  return body.access_token;
}

export interface MeetingEventInput {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  attendees: string[];
  withMeet: boolean;
}

export function buildEventBody(input: MeetingEventInput) {
  return {
    summary: input.title,
    ...(input.description ? { description: input.description } : {}),
    start: { dateTime: input.startAt.toISOString(), timeZone: MEETING_TIME_ZONE },
    end: { dateTime: input.endAt.toISOString(), timeZone: MEETING_TIME_ZONE },
    attendees: input.attendees.map((email) => ({ email })),
    ...(input.withMeet
      ? {
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }
      : {}),
  };
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink: string | null;
  meetLink: string | null;
}

/** Cria o evento na agenda principal do organizador e envia os convites aos convidados. */
export async function insertCalendarEvent(
  accessToken: string,
  input: MeetingEventInput,
): Promise<CreatedCalendarEvent> {
  const response = await fetch(
    `${CALENDAR_API_URL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEventBody(input)),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
    error?: { message?: string };
  };
  if (!response.ok || !body.id) {
    throw new GoogleCalendarError(
      `O Google Agenda recusou o evento (${response.status}${body.error?.message ? `: ${body.error.message}` : ''}).`,
      response.status,
    );
  }
  const videoEntry = body.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video',
  );
  return {
    id: body.id,
    htmlLink: body.htmlLink ?? null,
    meetLink: body.hangoutLink ?? videoEntry?.uri ?? null,
  };
}

/**
 * Verifica as credenciais listando um evento da agenda principal do organizador
 * (operação permitida pelo escopo calendar.events).
 */
export async function checkCalendarAccess(accessToken: string): Promise<string> {
  const response = await fetch(`${CALENDAR_API_URL}/calendars/primary/events?maxResults=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    summary?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new GoogleCalendarError(
      `O Google Agenda recusou a consulta (${response.status}${body.error?.message ? `: ${body.error.message}` : ''}).`,
      response.status,
    );
  }
  return body.summary ?? 'agenda principal';
}
