import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { EmailSettingsService } from './email-settings.service';

interface Recipient {
  name: string;
  email: string;
}

interface LeadEmailData {
  id: string;
  name: string;
  stageName: string;
  recipients: Recipient[];
  companyName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  priorityName?: string | null;
  dealSizeName?: string | null;
  sourceName?: string | null;
  partnerName?: string | null;
  projectTypeName?: string | null;
  successProbability?: number | null;
  estimatedValue?: string | number | null;
  expectedCloseDate?: Date | string | null;
  status?: string;
  description?: string | null;
  responsibleNames?: string[];
}

interface TaskEmailData {
  id: string;
  title: string;
  dueDate: Date;
  status: string;
  priority: string;
  assignee: Recipient;
  assignees?: Recipient[];
  leadName?: string | null;
  description?: string | null;
  createdByName?: string | null;
  leadCompanyName?: string | null;
  leadStageName?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Injectable()
export class EmailNotificationsService {
  private readonly logger = new Logger(EmailNotificationsService.name);
  private readonly frontendUrl: string;

  constructor(
    config: ConfigService,
    private readonly emailSettings: EmailSettingsService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5173').split(',')[0];
  }

  async sendTest(email: string, name: string): Promise<void> {
    await this.sendToEach(
      [{ email, name }],
      'Teste de e-mail — Multicortex CRM',
      this.template({
        title: 'Configuração validada',
        greeting: 'Este e-mail confirma que as notificações do Multicortex CRM estão funcionando.',
        rows: [['Destinatário', email]],
        link: this.frontendUrl,
        linkLabel: 'Abrir CRM',
      }),
      true,
    );
  }

  async leadCreated(data: LeadEmailData): Promise<void> {
    await this.sendToEach(
      data.recipients,
      `Nova oportunidade: ${data.name}`,
      this.template({
        title: 'Nova oportunidade atribuída',
        greeting: 'Uma nova oportunidade foi criada sob sua responsabilidade.',
        rows: this.leadRows(data),
        link: `${this.frontendUrl}/leads/${data.id}`,
        linkLabel: 'Abrir oportunidade',
      }),
    );
  }

  async leadStageChanged(data: LeadEmailData & { previousStageName: string }): Promise<void> {
    await this.sendToEach(
      data.recipients,
      `Mudança de etapa: ${data.name}`,
      this.template({
        title: 'Etapa da oportunidade alterada',
        greeting: 'Uma oportunidade sob sua responsabilidade mudou de etapa.',
        rows: [
          ['Oportunidade', data.name],
          ['Etapa anterior', data.previousStageName],
          ['Nova etapa', data.stageName],
          ...this.leadRows(data).filter(([label]) => !['Oportunidade', 'Etapa'].includes(label)),
        ],
        link: `${this.frontendUrl}/leads/${data.id}`,
        linkLabel: 'Abrir oportunidade',
      }),
    );
  }

  async taskCreated(data: TaskEmailData): Promise<void> {
    await this.taskNotification(
      data,
      'Nova tarefa atribuída',
      'Uma nova tarefa foi atribuída a você.',
    );
  }

  async taskUpdated(data: TaskEmailData): Promise<void> {
    await this.taskNotification(
      data,
      'Tarefa atualizada',
      'Uma tarefa sob sua responsabilidade foi alterada.',
    );
  }

  private async taskNotification(
    data: TaskEmailData,
    title: string,
    greeting: string,
  ): Promise<void> {
    await this.sendToEach(
      data.assignees?.length ? data.assignees : [data.assignee],
      `${title}: ${data.title}`,
      this.template({
        title,
        greeting,
        rows: [
          ['Tarefa', data.title],
          ...(data.description
            ? ([['Descrição', data.description]] as Array<[string, string]>)
            : []),
          ['Responsáveis', (data.assignees?.length ? data.assignees : [data.assignee]).map((item) => item.name).join(', ')],
          ...(data.createdByName
            ? ([['Criada por', data.createdByName]] as Array<[string, string]>)
            : []),
          ...(data.leadName ? ([['Oportunidade', data.leadName]] as Array<[string, string]>) : []),
          ...(data.leadCompanyName
            ? ([['Empresa', data.leadCompanyName]] as Array<[string, string]>)
            : []),
          ...(data.leadStageName
            ? ([['Etapa da oportunidade', data.leadStageName]] as Array<[string, string]>)
            : []),
          ['Prazo', data.dueDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
          ['Prioridade', this.taskPriorityLabel(data.priority)],
          ['Status', this.taskStatusLabel(data.status)],
        ],
        link: `${this.frontendUrl}/tasks/${data.id}`,
        linkLabel: 'Abrir tarefa',
      }),
    );
  }

  private leadRows(data: LeadEmailData): Array<[string, string]> {
    const rows: Array<[string, string | null | undefined]> = [
      ['Oportunidade', data.name],
      ['Empresa', data.companyName],
      ['Contato', data.contactName],
      ['E-mail do contato', data.contactEmail],
      ['Telefone do contato', data.contactPhone],
      ['Responsáveis', data.responsibleNames?.join(', ')],
      ['Etapa', data.stageName],
      ['Prioridade', data.priorityName],
      ['Porte do negócio', data.dealSizeName],
      ['Origem', data.sourceName],
      ['Parceiro comercial', data.partnerName],
      ['Tipo de projeto', data.projectTypeName],
      [
        'Probabilidade de sucesso',
        data.successProbability === null || data.successProbability === undefined
          ? null
          : `${data.successProbability}%`,
      ],
      [
        'Valor estimado',
        data.estimatedValue === null || data.estimatedValue === undefined
          ? null
          : Number(data.estimatedValue).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }),
      ],
      [
        'Previsão de fechamento',
        data.expectedCloseDate
          ? new Date(data.expectedCloseDate).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })
          : null,
      ],
      ['Status', data.status ? this.leadStatusLabel(data.status) : null],
      ['Descrição', data.description],
    ];
    return rows.filter((row): row is [string, string] => Boolean(row[1]));
  }

  private leadStatusLabel(status: string): string {
    return { OPEN: 'Aberta', WON: 'Ganha', LOST: 'Perdida' }[status] ?? status;
  }

  private taskStatusLabel(status: string): string {
    return (
      { TODO: 'A fazer', IN_PROGRESS: 'Em andamento', DONE: 'Concluída', CANCELED: 'Cancelada' }[
        status
      ] ?? status
    );
  }

  private taskPriorityLabel(priority: string): string {
    return { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' }[priority] ?? priority;
  }

  private async sendToEach(
    recipients: Recipient[],
    subject: string,
    html: string,
    throwOnError = false,
  ): Promise<void> {
    let settings;
    try {
      settings = await this.emailSettings.getRuntimeConfig();
    } catch (error) {
      if (throwOnError) throw error;
      this.logger.error('Falha ao carregar a configuração de e-mail.', error);
      return;
    }
    if (!settings) {
      if (throwOnError) {
        throw new BadRequestException('Ative o envio e cadastre a senha SMTP antes de testar.');
      }
      return;
    }
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.username, pass: settings.password },
    });
    const from = `"${settings.fromName}" <${settings.fromEmail}>`;
    const uniqueRecipients = [
      ...new Map(
        recipients.filter((item) => item.email).map((item) => [item.email.toLowerCase(), item]),
      ).values(),
    ];

    const results = await Promise.allSettled(
      uniqueRecipients.map((recipient) =>
        transporter.sendMail({
          from,
          to: { name: recipient.name, address: recipient.email },
          subject,
          html,
        }),
      ),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Falha ao enviar e-mail para ${uniqueRecipients[index].email}`,
          result.reason,
        );
      }
    });
    const failure = results.find((result) => result.status === 'rejected');
    if (throwOnError && failure?.status === 'rejected') {
      throw new ServiceUnavailableException(`Falha no envio SMTP: ${String(failure.reason)}`);
    }
  }

  private template(input: {
    title: string;
    greeting: string;
    rows: Array<[string, string]>;
    link: string;
    linkLabel: string;
  }): string {
    const rows = input.rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 12px;color:#64748b">${escapeHtml(label)}</td><td style="padding:8px 12px;font-weight:600;color:#1e293b">${escapeHtml(value)}</td></tr>`,
      )
      .join('');
    return `<!doctype html><html><body style="margin:0;background:#f5f3f8;font-family:Arial,sans-serif;color:#1e293b"><div style="max-width:620px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden"><div style="padding:24px;background:#523e86;color:#fff"><h1 style="margin:0;font-size:22px">${escapeHtml(input.title)}</h1></div><div style="padding:24px"><p style="margin-top:0;line-height:1.6">${escapeHtml(input.greeting)}</p><table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:10px">${rows}</table><p style="margin:28px 0 8px"><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#74529f;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(input.linkLabel)}</a></p></div></div></body></html>`;
  }
}
