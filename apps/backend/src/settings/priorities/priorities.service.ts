import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';
import { ReorderDto } from '../common/dto/reorder.dto';

@Injectable()
export class PrioritiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(query: ListSettingsQueryDto) {
    return this.prisma.priority.findMany({
      where: query.includeArchived ? {} : { deletedAt: null },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const priority = await this.prisma.priority.findFirst({ where: { id, deletedAt: null } });
    if (!priority) {
      throw new NotFoundException('Prioridade não encontrada.');
    }
    return priority;
  }

  async create(dto: CreatePriorityDto, actorUserId: string) {
    const maxOrder = await this.prisma.priority.aggregate({ _max: { order: true } });
    const priority = await this.prisma.priority.create({
      data: { ...dto, order: (maxOrder._max.order ?? 0) + 1, createdBy: actorUserId },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_CREATED',
      actorUserId,
      targetType: 'Priority',
      targetId: priority.id,
      metadata: { module: 'priority' },
    });

    return priority;
  }

  async update(id: string, dto: UpdatePriorityDto, actorUserId: string) {
    await this.findOne(id);
    const priority = await this.prisma.priority.update({ where: { id }, data: dto });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_UPDATED',
      actorUserId,
      targetType: 'Priority',
      targetId: id,
      metadata: { module: 'priority' },
    });

    return priority;
  }

  async archive(id: string, actorUserId: string) {
    await this.findOne(id);
    const priority = await this.prisma.priority.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_ARCHIVED',
      actorUserId,
      targetType: 'Priority',
      targetId: id,
      metadata: { module: 'priority' },
    });

    return priority;
  }

  async reorder(dto: ReorderDto, actorUserId: string) {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.priority.update({ where: { id }, data: { order: index + 1 } }),
      ),
    );

    await this.auditService.record({
      action: 'SETTINGS_ITEM_REORDERED',
      actorUserId,
      targetType: 'Priority',
      metadata: { module: 'priority', orderedIds: dto.orderedIds },
    });

    return this.findAll({});
  }
}
