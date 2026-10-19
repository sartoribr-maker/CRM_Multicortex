import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CustomFieldType, LeadLine, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeadActivityService } from './lead-activity.service';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads.query.dto';
import { AutocompleteLeadsQueryDto } from './dto/autocomplete-leads.query.dto';
import type { CustomFieldValueInputDto } from './dto/custom-field-value-input.dto';
import { EmailNotificationsService } from '../notifications/email-notifications.service';
import { AuditService } from '../audit/audit.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage-provider.interface';
import { SdrPortalSettingsService } from '../sdr-portal/sdr-portal-settings.service';
import { CompanyContactService } from '../companies/company-contact.service';
import {
  assertThirdPartyLeadPayload,
  assertThirdPartyStageMove,
  isThirdParty,
  sanitizeLeadForThirdParty,
} from '../sdr-portal/third-party-lead.policy';

const LEAD_LIST_INCLUDE = {
  stage: true,
  priority: true,
  dealSize: true,
  source: true,
  partner: true,
  technicalPartner: true,
  projectType: true,
  projectTypes: { include: { projectType: true } },
  owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { assignedAt: 'asc' },
  },
} satisfies Prisma.LeadInclude;

const LEAD_DETAIL_INCLUDE = {
  ...LEAD_LIST_INCLUDE,
  customFieldValues: { include: { customField: true } },
} satisfies Prisma.LeadInclude;

type LeadEmailPayload = Parameters<EmailNotificationsService['leadCreated']>[0];

/** Campos do lead que alimentam o cadastro de empresas e contatos. */
const PARTY_FIELDS = [
  'companyName',
  'companyDocument',
  'companySegment',
  'contactName',
  'contactEmail',
  'contactPhone',
] as const;

const LEAD_LINE_PREFIX: Record<LeadLine, string> = {
  ENTERPRISE: 'ENT',
  PRIVACY: 'PRI',
  MIX: 'MIX',
};

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadActivityService: LeadActivityService,
    private readonly emailNotifications: EmailNotificationsService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly sdrPortalSettings: SdrPortalSettingsService,
    private readonly companyContacts: CompanyContactService,
  ) {}

  private calculateEstimatedValue(
    capexValue?: number | null,
    opexValue?: number | null,
  ): number | null {
    if (capexValue === undefined && opexValue === undefined) return null;
    return Math.round((Number(capexValue ?? 0) + Number(opexValue ?? 0) * 12) * 100) / 100;
  }

  private canViewAll(currentUser: JwtPayload): boolean {
    return currentUser.permissions.includes(PERMISSIONS.LEADS_VIEW_ALL);
  }

  private ownershipFilter(currentUser: JwtPayload): Prisma.LeadWhereInput {
    return this.canViewAll(currentUser)
      ? {}
      : {
          OR: [{ ownerId: currentUser.sub }, { assignees: { some: { userId: currentUser.sub } } }],
        };
  }

  /**
   * Usuários THIRD_PARTY veem todos os leads do CRM nas etapas visíveis do
   * Portal SDR, independentemente do responsável (fila de prospecção da equipe).
   */
  private async visibilityFilter(currentUser: JwtPayload): Promise<Prisma.LeadWhereInput> {
    if (!isThirdParty(currentUser)) return this.ownershipFilter(currentUser);
    const { visibleStageIds } = await this.sdrPortalSettings.get();
    return { stageId: { in: visibleStageIds } };
  }

  private async presentForUser<T extends object>(lead: T, currentUser: JwtPayload): Promise<T> {
    if (!isThirdParty(currentUser)) return lead;
    return sanitizeLeadForThirdParty(lead, await this.sdrPortalSettings.get());
  }

  async findAll(query: ListLeadsQueryDto, currentUser: JwtPayload) {
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      AND: [
        await this.visibilityFilter(currentUser),
        query.ownerId
          ? { OR: [{ ownerId: query.ownerId }, { assignees: { some: { userId: query.ownerId } } }] }
          : {},
      ],
      ...(query.stageId ? { stageId: query.stageId } : {}),
      ...(query.line ? { line: query.line } : {}),
      ...(query.priorityId ? { priorityId: query.priorityId } : {}),
      ...(query.dealSizeId ? { dealSizeId: query.dealSizeId } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.partnerId ? { partnerId: query.partnerId } : {}),
      ...(query.technicalPartnerId ? { technicalPartnerId: query.technicalPartnerId } : {}),
      ...(query.projectTypeId
        ? { projectTypes: { some: { projectTypeId: query.projectTypeId } } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { businessCode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { companyName: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: LEAD_LIST_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    const settings = isThirdParty(currentUser) ? await this.sdrPortalSettings.get() : null;
    return {
      items: settings ? items.map((item) => sanitizeLeadForThirdParty(item, settings)) : items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  /** Sugestões de empresa/contato a partir do cadastro de empresas e contatos. */
  autocomplete(query: AutocompleteLeadsQueryDto) {
    return this.companyContacts.autocomplete(query.type, query.search);
  }

  async findOne(id: string, currentUser: JwtPayload) {
    return this.presentForUser(await this.loadDetail(id, currentUser), currentUser);
  }

  /**
   * Detalhe sem sanitização, para uso interno. `ignorePortalStages` permite
   * devolver um lead que o SDR acabou de mover para fora das etapas visíveis
   * (a visibilidade já foi conferida antes da alteração).
   */
  private async loadDetail(
    id: string,
    currentUser: JwtPayload,
    { ignorePortalStages = false } = {},
  ) {
    const visibility = !ignorePortalStages
      ? await this.visibilityFilter(currentUser)
      : isThirdParty(currentUser)
        ? {}
        : this.ownershipFilter(currentUser);
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null, ...visibility },
      include: LEAD_DETAIL_INCLUDE,
    });
    if (!lead) {
      throw new NotFoundException('Lead não encontrado.');
    }
    return lead;
  }

  async ensureVisible(id: string, currentUser: JwtPayload) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null, ...(await this.visibilityFilter(currentUser)) },
    });
    if (!lead) {
      throw new NotFoundException('Lead não encontrado.');
    }
    return lead;
  }

  private async validateCustomFieldValues(
    values: CustomFieldValueInputDto[] | undefined,
    { enforceRequired }: { enforceRequired: boolean },
  ) {
    const activeFields = await this.prisma.customField.findMany({
      where: { deletedAt: null, targetEntity: 'LEAD' },
    });
    const fieldById = new Map(activeFields.map((field) => [field.id, field]));

    for (const entry of values ?? []) {
      const field = fieldById.get(entry.customFieldId);
      if (!field) {
        throw new BadRequestException(`Campo customizado ${entry.customFieldId} não encontrado.`);
      }
      this.assertValueMatchesType(
        field.name,
        field.type,
        field.options as string[] | null,
        entry.value,
      );
    }

    if (enforceRequired) {
      const providedIds = new Set((values ?? []).map((v) => v.customFieldId));
      const missing = activeFields.filter(
        (field) => field.isRequired && !providedIds.has(field.id),
      );
      if (missing.length > 0) {
        throw new BadRequestException(
          `Campos customizados obrigatórios ausentes: ${missing.map((f) => f.name).join(', ')}`,
        );
      }
    }
  }

  private assertValueMatchesType(
    fieldName: string,
    type: CustomFieldType,
    options: string[] | null,
    value: unknown,
  ) {
    const invalid = () =>
      new BadRequestException(`Valor inválido para o campo customizado "${fieldName}".`);

    switch (type) {
      case CustomFieldType.TEXT:
        if (typeof value !== 'string') throw invalid();
        break;
      case CustomFieldType.NUMBER:
      case CustomFieldType.CURRENCY:
        if (typeof value !== 'number') throw invalid();
        break;
      case CustomFieldType.BOOLEAN:
        if (typeof value !== 'boolean') throw invalid();
        break;
      case CustomFieldType.DATE:
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw invalid();
        break;
      case CustomFieldType.SINGLE_SELECT:
        if (typeof value !== 'string' || !(options ?? []).includes(value)) throw invalid();
        break;
      case CustomFieldType.MULTI_SELECT:
        if (!Array.isArray(value) || !value.every((v) => (options ?? []).includes(v)))
          throw invalid();
        break;
    }
  }

  private async findExistingSiteLead(
    dto: CreateLeadDto,
    currentUser: JwtPayload,
  ) {
    const existing = await this.prisma.lead.findUnique({
      where: { siteSubmissionId: dto.siteSubmissionId },
      include: LEAD_DETAIL_INCLUDE,
    });

    if (!existing) return null;

    if (
      existing.deletedAt !== null ||
      existing.createdBy !== currentUser.sub ||
      existing.sourceId !== dto.sourceId ||
      existing.contactEmail !== dto.contactEmail ||
      existing.companyName !== dto.companyName
    ) {
      throw new ConflictException(
        'O identificador da submissão já está associado a outra oportunidade.',
      );
    }

    // A conta técnica pode confirmar uma submissão criada por ela,
    // mesmo após a oportunidade ser transferida para um vendedor.
    // A resposta é limitada ao identificador da oportunidade.
    return { id: existing.id };
  }

  /** Na criação pelo SDR, responsável, origem e etapa inicial são definidos pelo backend. */
  private async applyThirdPartyCreateRules(
    dto: CreateLeadDto,
    currentUser: JwtPayload,
  ): Promise<CreateLeadDto> {
    const settings = await this.sdrPortalSettings.get();
    assertThirdPartyLeadPayload(dto, 'create', settings);
    if (!settings.defaultSourceId) {
      throw new BadRequestException(
        'Origem padrão do Portal SDR não configurada. Contate o administrador.',
      );
    }
    const firstStage = await this.prisma.stage.findFirst({
      where: { id: { in: settings.visibleStageIds }, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (!firstStage) {
      throw new BadRequestException(
        'Portal SDR sem etapas configuradas. Contate o administrador.',
      );
    }
    return {
      ...dto,
      ownerIds: [currentUser.sub],
      sourceId: settings.defaultSourceId,
      stageId: firstStage.id,
    };
  }

  async create(dto: CreateLeadDto, currentUser: JwtPayload) {
    if (isThirdParty(currentUser)) {
      dto = await this.applyThirdPartyCreateRules(dto, currentUser);
    }

    if (dto.siteSubmissionId !== undefined) {
      const siteSourceId =
        process.env.CRM_SITE_SOURCE_ID ??
        '59c1b75b-0be5-4321-af47-66fdda1b522c';

      if (
        currentUser.email.toLowerCase() !== 'multicortex@multicortex.ai' ||
        currentUser.roleName !== 'Integração SITE'
      ) {
        throw new ForbiddenException(
          'Identificador de submissão reservado à integração SITE.',
        );
      }

      if (
        !dto.siteSubmissionId.trim() ||
        dto.sourceId !== siteSourceId ||
        (dto.ownerId && dto.ownerId !== currentUser.sub) ||
        (dto.ownerIds?.length &&
          (dto.ownerIds.length !== 1 || dto.ownerIds[0] !== currentUser.sub))
      ) {
        throw new BadRequestException(
          'Identificador, origem ou responsável inválido para a integração SITE.',
        );
      }

      const existing = await this.findExistingSiteLead(dto, currentUser);
      if (existing) return existing;
    }

    await this.validateCustomFieldValues(dto.customFieldValues, { enforceRequired: true });

    const stage = dto.stageId
      ? await this.prisma.stage.findFirst({ where: { id: dto.stageId, deletedAt: null } })
      : await this.prisma.stage.findFirst({
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
        });

    if (!stage) {
      throw new BadRequestException(
        'Nenhuma etapa do funil disponível. Cadastre etapas em Configurações.',
      );
    }

    const status = stage.isWonStage ? 'WON' : stage.isLostStage ? 'LOST' : 'OPEN';
    const requestedOwnerIds = [
      ...new Set(dto.ownerIds?.length ? dto.ownerIds : [dto.ownerId ?? currentUser.sub]),
    ];
    const ownerId = requestedOwnerIds[0];
    const requestedProjectTypeIds = [
      ...new Set(
        dto.projectTypeIds?.length
          ? dto.projectTypeIds
          : dto.projectTypeId
            ? [dto.projectTypeId]
            : [],
      ),
    ];

    const estimatedValue = this.calculateEstimatedValue(dto.capexValue, dto.opexValue);
    let lead: Awaited<ReturnType<typeof this.prisma.lead.create>> | undefined;
    try {
    lead = await this.prisma.$transaction(async (tx) => {
      const [sequence] = await tx.$queryRaw<Array<{ value: number }>>`
        SELECT nextval('lead_business_code_seq')::int AS value
      `;
      if (sequence.value > 99999) {
        throw new BadRequestException('A sequência de IDs de oportunidades atingiu o limite.');
      }
      const businessCode = `${LEAD_LINE_PREFIX[dto.line]}${String(sequence.value).padStart(5, '0')}`;
      const party = await this.companyContacts.syncForLead(tx, dto, currentUser.sub);
      const created = await tx.lead.create({
        data: {
          businessCode,
          companyId: party.companyId,
          contactId: party.contactId,
          siteSubmissionId: dto.siteSubmissionId,
          line: dto.line,
          name: dto.name,
          companyName: dto.companyName,
          companyDocument: dto.companyDocument,
          companySegment: dto.companySegment,
          contactName: dto.contactName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          projectTypeId: requestedProjectTypeIds[0],
          stageId: stage.id,
          priorityId: dto.priorityId,
          dealSizeId: dto.dealSizeId,
          sourceId: dto.sourceId,
          partnerId: dto.partnerId,
          technicalPartnerId: dto.technicalPartnerId,
          technicalServiceValue: dto.technicalServiceValue,
          successProbability: dto.successProbability,
          capexValue: dto.capexValue,
          opexValue: dto.opexValue,
          estimatedValue,
          periodicity: dto.periodicity,
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
          ownerId,
          description: dto.description,
          status,
          createdBy: currentUser.sub,
        },
        include: LEAD_DETAIL_INCLUDE,
      });

      await tx.leadAssignee.createMany({
        data: requestedOwnerIds.map((userId) => ({
          leadId: created.id,
          userId,
          assignedBy: currentUser.sub,
        })),
      });

      if (requestedProjectTypeIds.length) {
        await tx.leadProjectType.createMany({
          data: requestedProjectTypeIds.map((projectTypeId) => ({
            leadId: created.id,
            projectTypeId,
          })),
        });
      }

      await tx.stageHistoryEntry.create({
        data: {
          leadId: created.id,
          fromStageId: null,
          toStageId: stage.id,
          changedByUserId: currentUser.sub,
          timeInPreviousStageSeconds: null,
        },
      });

      if (dto.customFieldValues?.length) {
        await tx.customFieldValue.createMany({
          data: dto.customFieldValues.map((entry) => ({
            leadId: created.id,
            customFieldId: entry.customFieldId,
            value: entry.value as Prisma.InputJsonValue,
          })),
        });
      }

      return created;
    });
    } catch (error) {
      if (
        dto.siteSubmissionId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes('siteSubmissionId')
      ) {
        const existing = await this.findExistingSiteLead(dto, currentUser);
        if (existing) return existing;
      }
      throw error;
    }

    if (!lead) {
      throw new Error('A criação do lead não retornou um resultado.');
    }

    await this.leadActivityService.record({
      leadId: lead.id,
      type: 'CREATED',
      message: `Lead criado na etapa "${stage.name}".`,
      actorUserId: currentUser.sub,
    });

    const result = await this.loadDetail(lead.id, currentUser, { ignorePortalStages: true });
    await this.sendLeadEmail(result, (data) => this.emailNotifications.leadCreated(data));
    return this.presentForUser(result, currentUser);
  }

  async update(id: string, dto: UpdateLeadDto, currentUser: JwtPayload) {
    const existing = await this.ensureVisible(id, currentUser);
    const thirdParty = isThirdParty(currentUser);
    if (thirdParty) {
      const settings = await this.sdrPortalSettings.get();
      assertThirdPartyLeadPayload(dto, 'update', settings);
      if (dto.stageId && dto.stageId !== existing.stageId) {
        assertThirdPartyStageMove(dto.stageId, settings);
      }
    }
    await this.validateCustomFieldValues(dto.customFieldValues, { enforceRequired: false });

    let stageChangeMessage: string | null = null;
    const movementTaskIds: string[] = [];
    const financialValuesChanged = dto.capexValue !== undefined || dto.opexValue !== undefined;
    const capexValue = dto.capexValue ?? Number(existing.capexValue ?? 0);
    const opexValue = dto.opexValue ?? Number(existing.opexValue ?? 0);
    const data: Prisma.LeadUpdateInput = {
      ...(dto.line ? { line: dto.line } : {}),
      name: dto.name,
      companyName: dto.companyName,
      companyDocument: dto.companyDocument,
      companySegment: dto.companySegment,
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      technicalServiceValue: dto.technicalServiceValue,
      successProbability: dto.successProbability,
      capexValue: dto.capexValue,
      opexValue: dto.opexValue,
      ...(financialValuesChanged
        ? { estimatedValue: this.calculateEstimatedValue(capexValue, opexValue) }
        : {}),
      periodicity: dto.periodicity,
      description: dto.description,
      lossReason: dto.lossReason,
      ...(dto.expectedCloseDate ? { expectedCloseDate: new Date(dto.expectedCloseDate) } : {}),
      ...(dto.projectTypeIds?.length
        ? { projectType: { connect: { id: dto.projectTypeIds[0] } } }
        : dto.projectTypeId !== undefined
          ? { projectType: { connect: { id: dto.projectTypeId } } }
          : {}),
      ...(dto.priorityId !== undefined ? { priority: { connect: { id: dto.priorityId } } } : {}),
      ...(dto.dealSizeId !== undefined ? { dealSize: { connect: { id: dto.dealSizeId } } } : {}),
      ...(dto.sourceId !== undefined ? { source: { connect: { id: dto.sourceId } } } : {}),
      ...(dto.partnerId !== undefined
        ? {
            partner: dto.partnerId ? { connect: { id: dto.partnerId } } : { disconnect: true },
          }
        : {}),
      ...(dto.technicalPartnerId !== undefined
        ? {
            technicalPartner: dto.technicalPartnerId
              ? { connect: { id: dto.technicalPartnerId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.ownerIds?.length
        ? { owner: { connect: { id: dto.ownerIds[0] } } }
        : dto.ownerId !== undefined
          ? { owner: { connect: { id: dto.ownerId } } }
          : {}),
    };

    await this.prisma.$transaction(async (tx) => {
      if (dto.line) {
        if (existing.businessCode) {
          data.businessCode = `${LEAD_LINE_PREFIX[dto.line]}${existing.businessCode.slice(3)}`;
        } else {
          const [sequence] = await tx.$queryRaw<Array<{ value: number }>>`
            SELECT nextval('lead_business_code_seq')::int AS value
          `;
          if (sequence.value > 99999) {
            throw new BadRequestException('A sequência de IDs de oportunidades atingiu o limite.');
          }
          data.businessCode = `${LEAD_LINE_PREFIX[dto.line]}${String(sequence.value).padStart(5, '0')}`;
        }
      }

      if (dto.stageId && dto.stageId !== existing.stageId) {
        if (!dto.actionDescription?.trim()) {
          throw new BadRequestException('Descreva a ação realizada ao alterar a etapa.');
        }
        if (dto.createTask && (!dto.taskDueDate || !dto.taskPriority)) {
          throw new BadRequestException('Informe o prazo e a prioridade das tarefas.');
        }
        const newStage = await tx.stage.findFirst({ where: { id: dto.stageId, deletedAt: null } });
        if (!newStage) {
          throw new BadRequestException('Etapa de destino não encontrada.');
        }
        if (newStage.isLostStage && !dto.lossReason) {
          throw new BadRequestException(
            'Informe o motivo da perda ao mover o lead para esta etapa.',
          );
        }

        const now = new Date();
        const secondsInPrevious = Math.round(
          (now.getTime() - existing.stageEnteredAt.getTime()) / 1000,
        );

        await tx.stageHistoryEntry.create({
          data: {
            leadId: id,
            fromStageId: existing.stageId,
            toStageId: newStage.id,
            changedByUserId: currentUser.sub,
            timeInPreviousStageSeconds: secondsInPrevious,
            reason: dto.actionDescription.trim(),
          },
        });

        data.stage = { connect: { id: newStage.id } };
        data.stageEnteredAt = now;
        data.status = newStage.isWonStage ? 'WON' : newStage.isLostStage ? 'LOST' : 'OPEN';

        stageChangeMessage = `Etapa alterada para "${newStage.name}". Ação: ${dto.actionDescription.trim()}`;
      }

      if (PARTY_FIELDS.some((field) => dto[field] !== undefined)) {
        const party = await this.companyContacts.syncForLead(
          tx,
          Object.fromEntries(
            PARTY_FIELDS.map((field) => [field, dto[field] !== undefined ? dto[field] : existing[field]]),
          ),
          currentUser.sub,
        );
        data.company = party.companyId ? { connect: { id: party.companyId } } : { disconnect: true };
        data.contact = party.contactId ? { connect: { id: party.contactId } } : { disconnect: true };
      }

      if (dto.ownerIds?.length) {
        const ownerIds = [...new Set(dto.ownerIds)];
        await tx.leadAssignee.deleteMany({ where: { leadId: id } });
        await tx.leadAssignee.createMany({
          data: ownerIds.map((userId) => ({ leadId: id, userId, assignedBy: currentUser.sub })),
        });
      }

      if (dto.projectTypeIds?.length) {
        const projectTypeIds = [...new Set(dto.projectTypeIds)];
        await tx.leadProjectType.deleteMany({ where: { leadId: id } });
        await tx.leadProjectType.createMany({
          data: projectTypeIds.map((projectTypeId) => ({ leadId: id, projectTypeId })),
        });
      }

      await tx.lead.update({ where: { id }, data });

      if (stageChangeMessage && dto.createTask && dto.taskDueDate && dto.taskPriority) {
        // O SDR não escolhe responsáveis: a tarefa da movimentação é dele.
        const taskOwnerIds = thirdParty
          ? [currentUser.sub]
          : [...new Set(dto.ownerIds?.length ? dto.ownerIds : [existing.ownerId])];
        for (const assigneeId of taskOwnerIds) {
          const task = await tx.task.create({
            data: {
              title: dto.actionDescription!.trim(),
              description: `Tarefa criada pela movimentação da oportunidade "${dto.name ?? existing.name}".`,
              status: 'TODO',
              priority: dto.taskPriority!,
              dueDate: new Date(dto.taskDueDate!),
              leadId: id,
              assigneeId,
              createdByUserId: currentUser.sub,
            },
          });
          await tx.taskAssignee.create({
            data: { taskId: task.id, userId: assigneeId, assignedBy: currentUser.sub },
          });
          movementTaskIds.push(task.id);
        }
      }

      if (dto.customFieldValues?.length) {
        for (const entry of dto.customFieldValues) {
          await tx.customFieldValue.upsert({
            where: { leadId_customFieldId: { leadId: id, customFieldId: entry.customFieldId } },
            update: { value: entry.value as Prisma.InputJsonValue },
            create: {
              leadId: id,
              customFieldId: entry.customFieldId,
              value: entry.value as Prisma.InputJsonValue,
            },
          });
        }
      }
    });

    if (stageChangeMessage) {
      await this.leadActivityService.record({
        leadId: id,
        type: 'STAGE_CHANGED',
        message: stageChangeMessage,
        actorUserId: currentUser.sub,
      });
    }

    const changedFields = Object.keys(dto).filter(
      (key) =>
        ![
          'stageId',
          'lossReason',
          'customFieldValues',
          'actionDescription',
          'createTask',
          'taskDueDate',
          'taskPriority',
        ].includes(key),
    );
    if (changedFields.length > 0) {
      await this.leadActivityService.record({
        leadId: id,
        type: 'FIELD_UPDATED',
        message: `Campos atualizados: ${changedFields.join(', ')}.`,
        actorUserId: currentUser.sub,
        metadata: { fields: changedFields },
      });
    }

    const result = await this.loadDetail(id, currentUser, { ignorePortalStages: true });
    if (stageChangeMessage) {
      const previousStage = await this.prisma.stage.findUnique({ where: { id: existing.stageId } });
      await this.sendLeadEmail(result, (data) =>
        this.emailNotifications.leadStageChanged({
          ...data,
          previousStageName: previousStage?.name ?? 'Etapa anterior',
        }),
      );
    }
    if (movementTaskIds.length) {
      const tasks = await this.prisma.task.findMany({
        where: { id: { in: movementTaskIds } },
        include: {
          assignee: { select: { name: true, email: true } },
          lead: {
            select: { name: true, companyName: true, stage: { select: { name: true } } },
          },
        },
      });
      await Promise.all(
        tasks.map((task) =>
          this.emailNotifications.taskCreated({
            id: task.id,
            title: task.title,
            dueDate: task.dueDate,
            status: task.status,
            priority: task.priority,
            assignee: task.assignee,
            leadName: task.lead?.name,
            description: task.description,
            createdByName: currentUser.name,
            leadCompanyName: task.lead?.companyName,
            leadStageName: task.lead?.stage.name,
          }),
        ),
      );
    }
    return this.presentForUser(result, currentUser);
  }

  private leadEmailPayload(
    lead: Awaited<ReturnType<LeadsService['loadDetail']>>,
  ): Omit<LeadEmailPayload, 'recipients'> {
    return {
      id: lead.id,
      name: lead.name,
      stageName: lead.stage.name,
      companyName: lead.companyName,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
      priorityName: lead.priority?.name,
      dealSizeName: lead.dealSize?.name,
      sourceName: lead.source?.name,
      partnerName: lead.partner?.name,
      projectTypeName: lead.projectTypes.map(({ projectType }) => projectType.name).join(', '),
      successProbability: lead.successProbability,
      estimatedValue: lead.estimatedValue?.toString() ?? null,
      expectedCloseDate: lead.expectedCloseDate,
      status: lead.status,
      description: lead.description,
      responsibleNames: lead.assignees.map(({ user }) => user.name),
    };
  }

  /**
   * Envia o e-mail aos responsáveis. Responsáveis de perfis THIRD_PARTY
   * recebem uma versão sem valores quando o Portal SDR os oculta.
   */
  private async sendLeadEmail(
    lead: Awaited<ReturnType<LeadsService['loadDetail']>>,
    send: (data: LeadEmailPayload) => Promise<void>,
  ) {
    const data = this.leadEmailPayload(lead);
    const recipients = lead.assignees.map(({ user }) => user);
    const thirdPartyUsers = await this.prisma.user.findMany({
      where: { id: { in: recipients.map((user) => user.id) }, role: { portal: 'THIRD_PARTY' } },
      select: { id: true },
    });
    const thirdPartyIds = new Set(thirdPartyUsers.map((user) => user.id));
    const toRecipient = ({ name, email }: { name: string; email: string }) => ({ name, email });
    if (!thirdPartyIds.size || !(await this.sdrPortalSettings.get()).hideFinancialValues) {
      await send({ ...data, recipients: recipients.map(toRecipient) });
      return;
    }
    const internal = recipients.filter((user) => !thirdPartyIds.has(user.id));
    if (internal.length) await send({ ...data, recipients: internal.map(toRecipient) });
    await send({
      ...data,
      estimatedValue: null,
      successProbability: null,
      recipients: recipients.filter((user) => thirdPartyIds.has(user.id)).map(toRecipient),
    });
  }

  async archive(id: string, currentUser: JwtPayload) {
    await this.ensureVisible(id, currentUser);
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async remove(id: string, currentUser: JwtPayload) {
    const lead = await this.ensureVisible(id, currentUser);
    const attachments = await this.prisma.attachment.findMany({
      where: { leadId: id },
      select: { storageKey: true },
    });

    await this.prisma.lead.delete({ where: { id } });
    await Promise.all(attachments.map(({ storageKey }) => this.storage.delete(storageKey)));
    await this.audit.record({
      action: 'LEAD_DELETED',
      actorUserId: currentUser.sub,
      targetType: 'Lead',
      targetId: id,
      metadata: { name: lead.name },
    });
  }

  async listActivities(id: string, currentUser: JwtPayload) {
    await this.ensureVisible(id, currentUser);
    return this.prisma.leadActivity.findMany({
      where: { leadId: id },
      include: { actorUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listStageHistory(id: string, currentUser: JwtPayload) {
    await this.ensureVisible(id, currentUser);
    return this.prisma.stageHistoryEntry.findMany({
      where: { leadId: id },
      include: {
        fromStage: true,
        toStage: true,
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(id: string, message: string, currentUser: JwtPayload) {
    await this.ensureVisible(id, currentUser);
    await this.leadActivityService.record({
      leadId: id,
      type: 'COMMENT',
      message,
      actorUserId: currentUser.sub,
    });
    return this.listActivities(id, currentUser);
  }
}
