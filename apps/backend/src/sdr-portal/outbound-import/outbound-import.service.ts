import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { JwtPayload } from '../../auth/types/jwt-payload.interface';
import { CompanyContactService } from '../../companies/company-contact.service';
import { EmailNotificationsService } from '../../notifications/email-notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../storage/storage-provider.interface';
import { SdrPortalSettingsService } from '../sdr-portal-settings.service';
import { foldName } from '../../common/spreadsheet';
import { blacklistKey, parseOutboundSheet, type OutboundSheetRow } from './outbound-sheet.parser';

/** Aderência ao cargo-alvo → probabilidade de sucesso (%). */
const ADHERENCE_PROBABILITY: Record<string, number> = {
  alta: 80,
  media: 50,
  baixa: 20,
};

const DEFAULT_SEGMENT = 'Outros';
/** Etapa do funil que recebe todos os leads importados. */
const IMPORT_STAGE_NAME = 'Leads';
const IMPORT_TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;

export interface OutboundImportPreviewRow extends OutboundSheetRow {
  key: string | null;
  /** Usuário encontrado pelo e-mail da coluna "SDR responsável"; null se não houver. */
  ownerId: string | null;
  ownerName: string | null;
  successProbability: number | null;
  priorityName: string | null;
  /** Já apresentado em uma importação anterior. */
  blacklisted: boolean;
  /** Mesmo contato em uma linha anterior do arquivo. */
  duplicate: boolean;
  /** Motivo que impede a importação (ex.: sem empresa). */
  invalidReason: string | null;
  /** Marcação inicial no grid. */
  selected: boolean;
}

interface OwnerCandidate {
  id: string;
  name: string;
  email: string;
}

export interface OutboundImportOptions {
  selectedKeys: string[];
  /** Responsável escolhido no grid para registros sem SDR encontrado (chave → usuário). */
  ownerOverrides: Record<string, string>;
  /** Retirados da lista: não são importados nem vão para a blacklist. */
  excludedKeys: string[];
}

function textOrDash(value: string | null): string {
  return value ?? '—';
}

/** Descrição estruturada da oportunidade com todas as informações da planilha. */
function buildDescription(row: OutboundSheetRow, fileName: string, importedAt: Date): string {
  const date = importedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const lines = (entries: Array<[string, string | null]>) =>
    entries.map(([label, value]) => `- ${label}: ${textOrDash(value)}`).join('\n');
  return [
    `Lead Outbound importado da planilha "${fileName}" (linha ${row.rowNumber}) em ${date}.`,
    '',
    'CONTATO',
    lines([
      ['Nome', row.contactName],
      ['Cargo', row.contactPosition],
      ['E-mail', row.contactEmail],
      ['Telefone', row.contactPhone],
      ['LinkedIn', row.contactLinkedinUrl],
    ]),
    '',
    'EMPRESA',
    lines([
      ['Nome', row.companyName],
      ['Localização', row.companyLocation],
      ['LinkedIn', row.companyLinkedinUrl],
      ['Site', row.companyWebsite],
      ['Telefone', row.companyPhone],
      ['Porte / Faturamento estimado', row.companySizeEstimate],
      ['Faturamento', row.companyRevenue],
      ['Qtde. de funcionários', row.companyEmployeeCount],
    ]),
    '',
    'QUALIFICAÇÃO',
    lines([
      ['SDR responsável (planilha)', row.sdrName],
      ['Aderência ao cargo-alvo', row.adherence],
    ]),
  ].join('\n');
}

/**
 * Importação de leads Outbound a partir de planilha no Portal SDR. Todo
 * registro apresentado numa importação confirmada vai para a blacklist, para
 * vir desmarcado nas importações seguintes.
 */
@Injectable()
export class OutboundImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SdrPortalSettingsService,
    private readonly companyContacts: CompanyContactService,
    private readonly emailNotifications: EmailNotificationsService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async preview(file: Express.Multer.File) {
    const rows = await parseOutboundSheet(file.buffer);
    return {
      fileName: file.originalname,
      rows: await this.enrich(rows),
      sdrUsers: await this.sdrUsers(),
    };
  }

  /** Usuários ativos de perfil SDR (Portal de Terceiros), opções de responsável no grid. */
  private sdrUsers(): Promise<OwnerCandidate[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', role: { portal: 'THIRD_PARTY' } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  private async enrich(rows: OutboundSheetRow[]): Promise<OutboundImportPreviewRow[]> {
    const [users, priorities] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true, email: true },
      }),
      this.prisma.priority.findMany({ where: { deletedAt: null }, select: { name: true } }),
    ]);
    const keys = rows.map(blacklistKey).filter((key): key is string => key !== null);
    const blacklisted = new Set(
      (
        await this.prisma.leadImportBlacklist.findMany({
          where: { key: { in: keys } },
          select: { key: true },
        })
      ).map((entry) => entry.key),
    );
    const priorityNames = new Map(priorities.map((priority) => [foldName(priority.name), priority.name]));
    const resolveOwner = this.ownerResolver(users);
    const seen = new Set<string>();

    return rows.map((row) => {
      const key = blacklistKey(row);
      const duplicate = key !== null && seen.has(key);
      if (key) seen.add(key);
      const owner = row.sdrName ? resolveOwner(row.sdrName) : null;
      const adherence = row.adherence ? foldName(row.adherence) : null;
      const invalidReason = !row.companyName
        ? 'Sem empresa'
        : !row.contactName
          ? 'Sem nome do contato'
          : null;
      const isBlacklisted = key !== null && blacklisted.has(key);
      return {
        ...row,
        key,
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? null,
        successProbability: adherence ? (ADHERENCE_PROBABILITY[adherence] ?? null) : null,
        priorityName: adherence ? (priorityNames.get(adherence) ?? null) : null,
        blacklisted: isBlacklisted,
        duplicate,
        invalidReason,
        selected: !isBlacklisted && !duplicate && !invalidReason && owner !== null,
      };
    });
  }

  /** A coluna "SDR responsável" traz o e-mail do usuário. */
  private ownerResolver(users: OwnerCandidate[]) {
    const byEmail = new Map(users.map((user) => [user.email.trim().toLowerCase(), user]));
    return (sdrEmail: string): OwnerCandidate | null =>
      byEmail.get(sdrEmail.trim().toLowerCase()) ?? null;
  }

  async import(
    file: Express.Multer.File,
    options: OutboundImportOptions,
    currentUser: JwtPayload,
  ) {
    const settings = await this.settings.get();
    if (!settings.defaultSourceId || !settings.sdrPartnerId) {
      throw new BadRequestException(
        'Origem padrão ou parceiro SDR do Portal SDR não configurados. Contate o administrador.',
      );
    }
    const stages = await this.prisma.stage.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { order: 'asc' },
    });
    const stage = stages.find((item) => foldName(item.name) === foldName(IMPORT_STAGE_NAME));
    if (!stage) {
      throw new BadRequestException(
        `Etapa "${IMPORT_STAGE_NAME}" não encontrada no funil. Contate o administrador.`,
      );
    }
    const priorities = await this.prisma.priority.findMany({ where: { deletedAt: null } });
    const priorityIds = new Map(priorities.map((priority) => [foldName(priority.name), priority.id]));

    const sdrUsers = new Map((await this.sdrUsers()).map((user) => [user.id, user]));
    const invalidOverride = Object.values(options.ownerOverrides).some((id) => !sdrUsers.has(id));
    if (invalidOverride) {
      throw new BadRequestException('Responsável escolhido não é um usuário SDR ativo.');
    }

    const excluded = new Set(options.excludedKeys);
    const rows = (await this.enrich(await parseOutboundSheet(file.buffer)))
      .filter((row) => !row.key || !excluded.has(row.key))
      .map((row) => {
        const override = row.key ? options.ownerOverrides[row.key] : undefined;
        if (row.ownerId || !override) return row;
        return { ...row, ownerId: override, ownerName: sdrUsers.get(override)!.name };
      });
    const selected = new Set(options.selectedKeys);
    const fileName = file.originalname;
    const importedAt = new Date();
    // Sem responsável relacionado não é importado, mesmo se marcado.
    const toImport = rows.filter(
      (row) =>
        row.key && row.ownerId && selected.has(row.key) && !row.duplicate && !row.invalidReason,
    );

    const created = await this.prisma.$transaction(
      async (tx) => {
        const batch = await tx.outboundImport.create({
          data: { fileName, createdBy: currentUser.sub },
          select: { id: true },
        });
        const leadIds = new Map<string, string>();
        const createdLeads: Array<{ row: OutboundImportPreviewRow; businessCode: string }> = [];
        for (const row of toImport) {
          const lead = await this.createLead(tx, row, {
            stageId: stage.id,
            sourceId: settings.defaultSourceId!,
            partnerId: settings.sdrPartnerId!,
            priorityId: row.priorityName ? priorityIds.get(foldName(row.priorityName)) : undefined,
            description: buildDescription(row, fileName, importedAt),
            importId: batch.id,
            actorUserId: currentUser.sub,
          });
          leadIds.set(row.key!, lead.id);
          createdLeads.push({ row, businessCode: lead.businessCode });
        }

        // Todos os registros apresentados, marcados ou não, entram na blacklist.
        for (const row of rows) {
          if (!row.key || row.duplicate) continue;
          const leadId = leadIds.get(row.key);
          await tx.leadImportBlacklist.upsert({
            where: { key: row.key },
            create: {
              key: row.key,
              contactName: row.contactName,
              companyName: row.companyName,
              imported: leadId !== undefined,
              leadId,
              fileName,
              importId: batch.id,
              createdBy: currentUser.sub,
            },
            update: leadId ? { imported: true, leadId, fileName, importId: batch.id } : {},
          });
        }
        return createdLeads;
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
    );

    await this.notifyOwners(created, {
      stageName: stage.name,
      fileName,
      importedByName: currentUser.name,
    });

    return {
      imported: created.length,
      blacklisted: rows.filter((row) => row.key && !row.duplicate).length,
      skipped: rows.length - created.length,
    };
  }

  /** Arquivos importados, do mais recente ao mais antigo. */
  async list() {
    const imports = await this.prisma.outboundImport.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        createdBy: true,
        _count: { select: { leads: true, blacklist: true } },
      },
    });
    const userIds = [...new Set(imports.map((item) => item.createdBy).filter((id): id is string => !!id))];
    const users = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      ).map((user) => [user.id, user.name]),
    );
    return imports.map(({ _count, createdBy, ...item }) => ({
      ...item,
      createdByName: createdBy ? (users.get(createdBy) ?? null) : null,
      leadCount: _count.leads,
      recordCount: _count.blacklist,
    }));
  }

  /**
   * Exclui as oportunidades criadas pelo arquivo e os registros dele na
   * blacklist, para que possam ser importados de novo. Empresas e contatos
   * vinculados são mantidos (podem estar em outras oportunidades).
   */
  async remove(id: string, currentUser: JwtPayload) {
    const batch = await this.prisma.outboundImport.findUnique({
      where: { id },
      select: { id: true, fileName: true, leads: { select: { id: true } } },
    });
    if (!batch) throw new NotFoundException('Importação não encontrada.');
    const leadIds = batch.leads.map((lead) => lead.id);
    const attachments = await this.prisma.attachment.findMany({
      where: { leadId: { in: leadIds } },
      select: { storageKey: true },
    });

    const [deletedLeads] = await this.prisma.$transaction([
      this.prisma.lead.deleteMany({ where: { id: { in: leadIds } } }),
      this.prisma.outboundImport.delete({ where: { id } }),
    ]);
    await Promise.all(attachments.map(({ storageKey }) => this.storage.delete(storageKey)));
    await this.audit.record({
      action: 'OUTBOUND_IMPORT_DELETED',
      actorUserId: currentUser.sub,
      targetType: 'OutboundImport',
      targetId: id,
      metadata: { fileName: batch.fileName, deletedLeads: deletedLeads.count },
    });
    return { deletedLeads: deletedLeads.count };
  }

  private async createLead(
    tx: Prisma.TransactionClient,
    row: OutboundImportPreviewRow,
    context: {
      stageId: string;
      sourceId: string;
      partnerId: string;
      priorityId?: string;
      description: string;
      importId: string;
      actorUserId: string;
    },
  ): Promise<{ id: string; businessCode: string }> {
    const [sequence] = await tx.$queryRaw<Array<{ value: number }>>`
      SELECT nextval('lead_business_code_seq')::int AS value
    `;
    if (sequence.value > 99999) {
      throw new BadRequestException('A sequência de IDs de oportunidades atingiu o limite.');
    }
    const party = {
      companyName: row.companyName,
      companySegment: DEFAULT_SEGMENT,
      companyLocation: row.companyLocation,
      companyLinkedinUrl: row.companyLinkedinUrl,
      companyWebsite: row.companyWebsite,
      companyPhone: row.companyPhone,
      companySizeEstimate: row.companySizeEstimate,
      companyRevenue: row.companyRevenue,
      companyEmployeeCount: row.companyEmployeeCount,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      contactPosition: row.contactPosition,
      contactLinkedinUrl: row.contactLinkedinUrl,
    };
    const links = await this.companyContacts.syncForLead(tx, party, context.actorUserId);
    const lead = await tx.lead.create({
      data: {
        ...party,
        businessCode: `MIX${String(sequence.value).padStart(5, '0')}`,
        companyId: links.companyId,
        contactId: links.contactId,
        line: 'MIX',
        leadType: 'OUTBOUND',
        name: row.companyName!,
        stageId: context.stageId,
        priorityId: context.priorityId,
        sourceId: context.sourceId,
        partnerId: context.partnerId,
        successProbability: row.successProbability,
        ownerId: row.ownerId!,
        description: context.description,
        outboundImportId: context.importId,
        status: 'OPEN',
        createdBy: context.actorUserId,
      },
      select: { id: true, businessCode: true },
    });
    await tx.leadAssignee.create({
      data: { leadId: lead.id, userId: row.ownerId!, assignedBy: context.actorUserId },
    });
    await tx.stageHistoryEntry.create({
      data: {
        leadId: lead.id,
        fromStageId: null,
        toStageId: context.stageId,
        changedByUserId: context.actorUserId,
        timeInPreviousStageSeconds: null,
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'CREATED',
        message: 'Lead importado da planilha de prospecção Outbound.',
        actorUserId: context.actorUserId,
      },
    });
    return { id: lead.id, businessCode: lead.businessCode! };
  }

  /** Um e-mail por responsável com os leads importados para ele. */
  private async notifyOwners(
    created: Array<{ row: OutboundImportPreviewRow; businessCode: string }>,
    context: { stageName: string; fileName: string; importedByName: string },
  ) {
    const byOwner = new Map<string, typeof created>();
    for (const item of created) {
      const ownerId = item.row.ownerId!;
      byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), item]);
    }
    const owners = await this.prisma.user.findMany({
      where: { id: { in: [...byOwner.keys()] } },
      select: { id: true, name: true, email: true, role: { select: { portal: true } } },
    });
    await Promise.all(
      owners.map((owner) =>
        this.emailNotifications.outboundLeadsImported({
          recipient: { name: owner.name, email: owner.email },
          ...context,
          leads: byOwner.get(owner.id)!.map(({ row, businessCode }) => ({
            businessCode,
            name: row.companyName!,
            contactName: row.contactName,
            contactPosition: row.contactPosition,
          })),
          path: owner.role.portal === 'THIRD_PARTY' ? '/terceiro/kanban' : '/leads',
        }),
      ),
    );
  }
}
