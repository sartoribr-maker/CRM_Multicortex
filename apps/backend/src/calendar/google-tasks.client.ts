import { GoogleCalendarError, MEETING_TIME_ZONE } from './google-calendar.client';

/** Escopo do Google Tasks; precisa estar na delegação em todo o domínio da conta de serviço. */
export const GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

// URL substituível apenas para testes automatizados.
const TASKS_API_URL = process.env.GOOGLE_TASKS_API_URL ?? 'https://tasks.googleapis.com/tasks/v1';
/** Lista padrão do usuário ("Minhas tarefas"). */
const DEFAULT_LIST = '@default';

export interface GoogleTaskInput {
  title: string;
  description?: string | null;
  /** Prazo da tarefa; o Google Tasks guarda só a data (local de São Paulo). Sem prazo: `null`. */
  dueDate: Date | null;
  done: boolean;
  crmUrl?: string | null;
  /** Linhas extras nas notas (prioridade, oportunidade, projeto...). */
  details?: string[];
}

/** Data (AAAA-MM-DD) do instante no fuso de São Paulo. */
export function localDateInTimeZone(value: Date, timeZone = MEETING_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function buildGoogleTaskBody(input: GoogleTaskInput) {
  const details = input.details?.filter(Boolean).join('\n');
  const notes = [
    input.description?.trim(),
    details,
    input.crmUrl ? `Tarefa no CRM: ${input.crmUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    title: input.title,
    notes,
    // O Google descarta o horário: a meia-noite UTC preserva a data local.
    due: input.dueDate ? `${localDateInTimeZone(input.dueDate)}T00:00:00.000Z` : null,
    status: input.done ? 'completed' : 'needsAction',
    // Reabrir no Google exige limpar a data de conclusão.
    ...(input.done ? {} : { completed: null }),
  };
}

export interface SavedGoogleTask {
  id: string;
  webViewLink: string | null;
}

interface GoogleTaskResponse {
  id?: string;
  webViewLink?: string;
  deleted?: boolean;
  status?: 'needsAction' | 'completed';
  error?: { message?: string };
}

async function tasksRequest(
  accessToken: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  taskId?: string,
  payload?: unknown,
) {
  const path = `/lists/${encodeURIComponent(DEFAULT_LIST)}/tasks${taskId ? `/${encodeURIComponent(taskId)}` : ''}`;
  const response = await fetch(`${TASKS_API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const body = (await response.json().catch(() => ({}))) as GoogleTaskResponse;
  return { response, body };
}

function failure(action: string, status: number, body: GoogleTaskResponse) {
  return new GoogleCalendarError(
    `O Google Tasks recusou ${action} (${status}${body.error?.message ? `: ${body.error.message}` : ''}).`,
    status,
  );
}

/**
 * Cria a tarefa em "Minhas tarefas" ou, com `googleTaskId`, atualiza a existente.
 * Se ela foi excluída no Google (404/410 ou marcada como excluída), cria outra.
 */
export async function saveGoogleTask(
  accessToken: string,
  input: GoogleTaskInput,
  googleTaskId?: string | null,
): Promise<SavedGoogleTask> {
  const payload = buildGoogleTaskBody(input);
  if (googleTaskId) {
    const { response, body } = await tasksRequest(accessToken, 'PATCH', googleTaskId, payload);
    if (response.ok && body.id && !body.deleted) {
      return { id: body.id, webViewLink: body.webViewLink ?? null };
    }
    if (response.ok && body.deleted) {
      // Excluída pelo usuário no Google: não ressuscita, cria uma nova.
    } else if (response.status !== 404 && response.status !== 410) {
      throw failure('a atualização da tarefa', response.status, body);
    }
  }
  const { response, body } = await tasksRequest(accessToken, 'POST', undefined, payload);
  if (!response.ok || !body.id) throw failure('a tarefa', response.status, body);
  return { id: body.id, webViewLink: body.webViewLink ?? null };
}

/** Remove a tarefa do Google; já removida (404/410) conta como sucesso. */
export async function deleteGoogleTask(accessToken: string, googleTaskId: string): Promise<void> {
  const { response, body } = await tasksRequest(accessToken, 'DELETE', googleTaskId);
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw failure('a exclusão da tarefa', response.status, body);
  }
}

/** Situação da tarefa no Google, para refletir no CRM o que o usuário fez por lá. */
export type GoogleTaskState = 'open' | 'completed' | 'deleted';

/** Lê a tarefa; excluída (404/410 ou marcada como excluída) volta como `deleted`. */
export async function getGoogleTaskState(
  accessToken: string,
  googleTaskId: string,
): Promise<GoogleTaskState> {
  const { response, body } = await tasksRequest(accessToken, 'GET', googleTaskId);
  if (response.status === 404 || response.status === 410) return 'deleted';
  if (!response.ok) throw failure('a leitura da tarefa', response.status, body);
  if (body.deleted) return 'deleted';
  return body.status === 'completed' ? 'completed' : 'open';
}
