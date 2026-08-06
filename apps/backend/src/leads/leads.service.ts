import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomFieldType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeadActivityService } from './lead-activity.service';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads.query.dto';
import type { CustomFieldValueInputDto } from './dto/custom-field-value-input.dto';

const LEAD_LIST_INCLUDE = {
  stage: true,
  priority: true,
  dealSize: true,
  source: true,
  projectType: true,
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LeadInclude;

const LEAD_DETAIL_INCLUDE = {
  ...LEAD_LIST_INCLUDE,
  customFieldValues: { include: { customField: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadActivityService: LeadActivityService,
  ) {}

  private canViewAll(currentUser: JwtPayload): boolean {
    return currentUser.permissions.includes(PERMISSIONS.LEADS_VIEW_ALL);
  }

  private ownershipFilter(currentUser: JwtPayload): Prisma.LeadWhereInput {
    return this.canViewAll(currentUser) ? {} : { ownerId: currentUser.sub };
  }

  async findAll(query: ListLeadsQueryDto, currentUser: JwtPayload) {
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...this.ownershipFilter(currentUser),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.stageId ? { stageId: query.stageId } : {}),
      ...(query.priorityId ? { priorityId: query.priorityId } : {}),
      ...(query.dealSizeId ? { dealSizeId: query.dealSizeId } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.projectTypeId ? { projectTypeId: query.projectTypeId } : {}),
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

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string, currentUser: JwtPayload) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null, ...this.ownershipFilter(currentUser) },
      include: LEAD_DETAIL_INCLUDE,
    });
    if (!lead) {
      throw new NotFoundException('Lead não encontrado.');
    }
    return lead;
  }

  async ensureVisible(id: string, currentUser: JwtPayload) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null, ...this.ownershipFilter(currentUser) },
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
      this.assertValueMatchesType(field.name, field.type, field.options as string[] | null, entry.value);
    }

    if (enforceRequired) {
      const providedIds = new Set((values ?? []).map((v) => v.customFieldId));
      const missing = activeFields.filter((field) => field.isRequired && !providedIds.has(field.id));
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
        if (!Array.isArray(value) || !value.every((v) => (options ?? []).includes(v))) throw invalid();
        break;
    }
  }

  async create(dto: CreateLeadDto, currentUser: JwtPayload) {
    await this.validateCustomFieldValues(dto.customFieldValues, { enforceRequired: true });

    const stage = dto.stageId
      ? await this.prisma.stage.findFirst({ where: { id: dto.stageId, deletedAt: null } })
      : await this.prisma.stage.findFirst({ where: { deletedAt: null }, orderBy: { order: 'asc' } });

    if (!stage) {
      throw new BadRequestException('Nenhuma etapa do funil disponível. Cadastre etapas em Configurações.');
    }

    const status = stage.isWonStage ? 'WON' : stage.isLostStage ? 'LOST' : 'OPEN';
    const ownerId = dto.ownerId ?? currentUser.sub;

    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          name: dto.name,
          companyName: dto.companyName,
          companyDocument: dto.companyDocument,
          companySegment: dto.companySegment,
          contactName: dto.contactName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          projectTypeId: dto.projectTypeId,
          stageId: stage.id,
          priorityId: dto.priorityId,
          dealSizeId: dto.dealSizeId,
          sourceId: dto.sourceId,
          successProbability: dto.successProbability,
          estimatedValue: dto.estimatedValue,
          periodicity: dto.periodicity,
          expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
          ownerId,
          description: dto.description,
          status,
          createdBy: currentUser.sub,
        },
        include: LEAD_DETAIL_INCLUDE,
      });

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

    await this.leadActivityService.record({
      leadId: lead.id,
      type: 'CREATED',
      message: `Lead criado na etapa "${stage.name}".`,
      actorUserId: currentUser.sub,
    });

    return this.findOne(lead.id, currentUser);
  }

  async update(id: string, dto: UpdateLeadDto, currentUser: JwtPayload) {
    const existing = await this.ensureVisible(id, currentUser);
    await this.validateCustomFieldValues(dto.customFieldValues, { enforceRequired: false });

    let stageChangeMessage: string | null = null;
    const data: Prisma.LeadUpdateInput = {
      name: dto.name,
      companyName: dto.companyName,
      companyDocument: dto.companyDocument,
      companySegment: dto.companySegment,
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      successProbability: dto.successProbability,
      estimatedValue: dto.estimatedValue,
      periodicity: dto.periodicity,
      description: dto.description,
      lossReason: dto.lossReason,
      ...(dto.expectedCloseDate ? { expectedCloseDate: new Date(dto.expectedCloseDate) } : {}),
      ...(dto.projectTypeId !== undefined ? { projectType: { connect: { id: dto.projectTypeId } } } : {}),
      ...(dto.priorityId !== undefined ? { priority: { connect: { id: dto.priorityId } } } : {}),
      ...(dto.dealSizeId !== undefined ? { dealSize: { connect: { id: dto.dealSizeId } } } : {}),
      ...(dto.sourceId !== undefined ? { source: { connect: { id: dto.sourceId } } } : {}),
      ...(dto.ownerId !== undefined ? { owner: { connect: { id: dto.ownerId } } } : {}),
    };

    await this.prisma.$transaction(async (tx) => {
      if (dto.stageId && dto.stageId !== existing.stageId) {
        const newStage = await tx.stage.findFirst({ where: { id: dto.stageId, deletedAt: null } });
        if (!newStage) {
          throw new BadRequestException('Etapa de destino não encontrada.');
        }
        if (newStage.isLostStage && !dto.lossReason) {
          throw new BadRequestException('Informe o motivo da perda ao mover o lead para esta etapa.');
        }

        const now = new Date();
        const secondsInPrevious = Math.round((now.getTime() - existing.stageEnteredAt.getTime()) / 1000);

        await tx.stageHistoryEntry.create({
          data: {
            leadId: id,
            fromStageId: existing.stageId,
            toStageId: newStage.id,
            changedByUserId: currentUser.sub,
            timeInPreviousStageSeconds: secondsInPrevious,
            reason: dto.lossReason,
          },
        });

        data.stage = { connect: { id: newStage.id } };
        data.stageEnteredAt = now;
        data.status = newStage.isWonStage ? 'WON' : newStage.isLostStage ? 'LOST' : 'OPEN';

        stageChangeMessage = `Etapa alterada para "${newStage.name}".`;
      }

      await tx.lead.update({ where: { id }, data });

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
      (key) => key !== 'stageId' && key !== 'lossReason' && key !== 'customFieldValues',
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

    return this.findOne(id, currentUser);
  }

  async archive(id: string, currentUser: JwtPayload) {
    await this.ensureVisible(id, currentUser);
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
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
