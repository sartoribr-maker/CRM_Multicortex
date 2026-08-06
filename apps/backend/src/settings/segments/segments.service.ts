import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService, type AuditAction } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';

@Injectable()
export class SegmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  findAll(query: ListSettingsQueryDto) {
    return this.prisma.segment.findMany({
      where: query.includeArchived ? {} : { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
  private async existing(id: string) {
    const item = await this.prisma.segment.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException('Segmento não encontrado.');
    return item;
  }
  async create(dto: CreateSegmentDto, actorUserId: string) {
    try {
      const item = await this.prisma.segment.create({ data: { ...dto, createdBy: actorUserId } });
      await this.record('SETTINGS_ITEM_CREATED', actorUserId, item.id);
      return item;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Já existe um segmento com este nome.');
      throw error;
    }
  }
  async update(id: string, dto: UpdateSegmentDto, actorUserId: string) {
    await this.existing(id);
    const item = await this.prisma.segment.update({ where: { id }, data: dto });
    await this.record('SETTINGS_ITEM_UPDATED', actorUserId, id);
    return item;
  }
  async archive(id: string, actorUserId: string) {
    await this.existing(id);
    const item = await this.prisma.segment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.record('SETTINGS_ITEM_ARCHIVED', actorUserId, id);
    return item;
  }
  private record(action: AuditAction, actorUserId: string, targetId: string) {
    return this.audit.record({
      action,
      actorUserId,
      targetType: 'Segment',
      targetId,
      metadata: { module: 'segment' },
    });
  }
}
