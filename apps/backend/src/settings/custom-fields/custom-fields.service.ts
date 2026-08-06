import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomFieldType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';

const SELECT_TYPES: CustomFieldType[] = [CustomFieldType.SINGLE_SELECT, CustomFieldType.MULTI_SELECT];

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private assertOptions(type: CustomFieldType, options?: string[]) {
    if (SELECT_TYPES.includes(type) && (!options || options.length === 0)) {
      throw new BadRequestException(
        'Campos de seleção única/múltipla precisam de ao menos uma opção.',
      );
    }
  }

  findAll(query: ListSettingsQueryDto) {
    return this.prisma.customField.findMany({
      where: query.includeArchived ? {} : { deletedAt: null },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const customField = await this.prisma.customField.findFirst({ where: { id, deletedAt: null } });
    if (!customField) {
      throw new NotFoundException('Campo customizado não encontrado.');
    }
    return customField;
  }

  async create(dto: CreateCustomFieldDto, actorUserId: string) {
    this.assertOptions(dto.type, dto.options);

    const customField = await this.prisma.customField.create({
      data: {
        ...dto,
        options: dto.options as Prisma.InputJsonValue | undefined,
        createdBy: actorUserId,
      },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_CREATED',
      actorUserId,
      targetType: 'CustomField',
      targetId: customField.id,
      metadata: { module: 'customField' },
    });

    return customField;
  }

  async update(id: string, dto: UpdateCustomFieldDto, actorUserId: string) {
    const existing = await this.findOne(id);
    this.assertOptions(dto.type ?? existing.type, dto.options ?? (existing.options as string[] | undefined));

    const customField = await this.prisma.customField.update({
      where: { id },
      data: { ...dto, options: dto.options as Prisma.InputJsonValue | undefined },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_UPDATED',
      actorUserId,
      targetType: 'CustomField',
      targetId: id,
      metadata: { module: 'customField' },
    });

    return customField;
  }

  async archive(id: string, actorUserId: string) {
    await this.findOne(id);
    const customField = await this.prisma.customField.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_ARCHIVED',
      actorUserId,
      targetType: 'CustomField',
      targetId: id,
      metadata: { module: 'customField' },
    });

    return customField;
  }
}
