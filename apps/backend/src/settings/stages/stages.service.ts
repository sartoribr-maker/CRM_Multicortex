import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';
import { ReorderDto } from '../common/dto/reorder.dto';

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(query: ListSettingsQueryDto) {
    return this.prisma.stage.findMany({
      where: query.includeArchived ? {} : { deletedAt: null },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const stage = await this.prisma.stage.findFirst({ where: { id, deletedAt: null } });
    if (!stage) {
      throw new NotFoundException('Etapa não encontrada.');
    }
    return stage;
  }

  async create(dto: CreateStageDto, actorUserId: string) {
    const maxOrder = await this.prisma.stage.aggregate({ _max: { order: true } });
    const stage = await this.prisma.stage.create({
      data: { ...dto, order: (maxOrder._max.order ?? 0) + 1, createdBy: actorUserId },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_CREATED',
      actorUserId,
      targetType: 'Stage',
      targetId: stage.id,
      metadata: { module: 'stage' },
    });

    return stage;
  }

  async update(id: string, dto: UpdateStageDto, actorUserId: string) {
    await this.findOne(id);
    const stage = await this.prisma.stage.update({ where: { id }, data: dto });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_UPDATED',
      actorUserId,
      targetType: 'Stage',
      targetId: id,
      metadata: { module: 'stage' },
    });

    return stage;
  }

  async archive(id: string, actorUserId: string) {
    await this.findOne(id);
    const stage = await this.prisma.stage.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_ARCHIVED',
      actorUserId,
      targetType: 'Stage',
      targetId: id,
      metadata: { module: 'stage' },
    });

    return stage;
  }

  async reorder(dto: ReorderDto, actorUserId: string) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.stage.update({ where: { id }, data: { order: index + 1 } }),
      ),
    );

    await this.auditService.record({
      action: 'SETTINGS_ITEM_REORDERED',
      actorUserId,
      targetType: 'Stage',
      metadata: { module: 'stage', orderedIds: dto.orderedIds },
    });

    return this.findAll({});
  }
}
