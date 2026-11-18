import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';
import { Readable as NodeReadable } from 'stream';

/** Quem age na chamada ao PMO: a pessoa é identificada pelo e-mail (vínculo entre as plataformas). */
export interface PmoActor {
  email: string;
  name: string;
  /** Vê todas as tarefas do CRM (regra de visibilidade de tarefas do CRM). */
  seeAll?: boolean;
}

interface RequestOptions {
  actor?: PmoActor;
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
  body?: unknown;
  form?: FormData;
}

/**
 * Cliente da API de integração do PMO, onde as tarefas moram (base única). Chave compartilhada em
 * `PMO_INTEGRATION_KEY`; endereço em `PMO_API_URL` (rede interna). Os erros do PMO voltam com o
 * mesmo status e a mesma mensagem em português.
 */
@Injectable()
export class PmoClientService {
  private readonly logger = new Logger(PmoClientService.name);

  constructor(private readonly config: ConfigService) {}

  private settings() {
    const url = this.config.get<string>('PMO_API_URL')?.replace(/\/$/, '');
    const key = this.config.get<string>('PMO_INTEGRATION_KEY');
    if (!url || !key) {
      throw new ServiceUnavailableException(
        'As tarefas ficam no Multicortex Projetos e a integração não está configurada (PMO_API_URL/PMO_INTEGRATION_KEY).',
      );
    }
    return { url, key };
  }

  private async send(method: string, path: string, options: RequestOptions = {}) {
    const { url, key } = this.settings();
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(options.query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      query.set(name, Array.isArray(value) ? value.join(',') : String(value));
    }
    const headers: Record<string, string> = {
      'X-Integration-Key': key,
      Accept: 'application/json',
    };
    if (options.actor) {
      headers['X-Acting-User-Email'] = options.actor.email;
      headers['X-Acting-User-Name'] = encodeURIComponent(options.actor.name);
      if (options.actor.seeAll) headers['X-Crm-See-All'] = 'true';
    }
    let body: BodyInit | undefined;
    if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    let response: Response;
    try {
      response = await fetch(`${url}/integration/crm${path}${query.size ? `?${query}` : ''}`, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      this.logger.error(`PMO indisponível (${method} ${path}): ${String(error)}`);
      throw new BadGatewayException(
        'Não foi possível falar com o Multicortex Projetos (tarefas). Tente novamente em instantes.',
      );
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const message = Array.isArray(payload.message)
        ? payload.message.join(' ')
        : (payload.message ?? `Erro ${response.status} no Multicortex Projetos.`);
      if (response.status === 401 || response.status >= 500) {
        this.logger.error(`PMO respondeu ${response.status} em ${method} ${path}: ${message}`);
      }
      throw new HttpException(
        response.status === 401 ? 'Integração com o Multicortex Projetos recusada.' : message,
        response.status === 401 ? 502 : response.status,
      );
    }
    return response;
  }

  async json<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send(method, path, options);
    return (await response.json()) as T;
  }

  /** Download: devolve o fluxo do arquivo e os cabeçalhos do PMO. */
  async stream(path: string, actor: PmoActor) {
    const response = await this.send('GET', path, { actor });
    if (!response.body) throw new BadGatewayException('Arquivo vazio no Multicortex Projetos.');
    return {
      stream: NodeReadable.fromWeb(response.body as never) as Readable,
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
      disposition: response.headers.get('content-disposition'),
    };
  }
}
