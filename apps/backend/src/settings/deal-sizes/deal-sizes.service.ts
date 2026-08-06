import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateDealSizeDto } from './dto/create-deal-size.dto';
import { UpdateDealSizeDto } from './dto/update-deal-size.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';

@Injectable()
export class DealSizesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(query: ListSettingsQueryDto) {
    return this.prisma.dealSize.findMany({
      where: query.includeArchived ? {} : { deletedAt: null },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const dealSize = await this.prisma.dealSize.findFirst({ where: { id, deletedAt: null } });
    if (!dealSize) {
      throw new NotFoundException('Porte de negócio não encontrado.');
    }
    return dealSize;
  }

  async create(dto: CreateDealSizeDto, actorUserId: string) {
    const dealSize = await this.prisma.dealSize.create({
      data: { ...dto, createdBy: actorUserId },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_CREATED',
      actorUserId,
      targetType: 'DealSize',
      targetId: dealSize.id,
      metadata: { module: 'dealSize' },
    });

    return dealSize;
  }

  async update(id: string, dto: UpdateDealSizeDto, actorUserId: string) {
    await this.findOne(id);
    const dealSize = await this.prisma.dealSize.update({ where: { id }, data: dto });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_UPDATED',
      actorUserId,
      targetType: 'DealSize',
      targetId: id,
      metadata: { module: 'dealSize' },
    });

    return dealSize;
  }

  async archive(id: string, actorUserId: string) {
    await this.findOne(id);
    const dealSize = await this.prisma.dealSize.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_ARCHIVED',
      actorUserId,
      targetType: 'DealSize',
      targetId: id,
      metadata: { module: 'dealSize' },
    });

    return dealSize;
  }
}
