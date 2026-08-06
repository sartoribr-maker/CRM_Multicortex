import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';

@Injectable()
export class SourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(query: ListSettingsQueryDto) {
    return this.prisma.source.findMany({
      where: query.includeArchived ? {} : { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const source = await this.prisma.source.findFirst({ where: { id, deletedAt: null } });
    if (!source) {
      throw new NotFoundException('Origem não encontrada.');
    }
    return source;
  }

  async create(dto: CreateSourceDto, actorUserId: string) {
    const source = await this.prisma.source.create({ data: { ...dto, createdBy: actorUserId } });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_CREATED',
      actorUserId,
      targetType: 'Source',
      targetId: source.id,
      metadata: { module: 'source' },
    });

    return source;
  }

  async update(id: string, dto: UpdateSourceDto, actorUserId: string) {
    await this.findOne(id);
    const source = await this.prisma.source.update({ where: { id }, data: dto });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_UPDATED',
      actorUserId,
      targetType: 'Source',
      targetId: id,
      metadata: { module: 'source' },
    });

    return source;
  }

  async archive(id: string, actorUserId: string) {
    await this.findOne(id);
    const source = await this.prisma.source.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_ARCHIVED',
      actorUserId,
      targetType: 'Source',
      targetId: id,
      metadata: { module: 'source' },
    });

    return source;
  }
}
