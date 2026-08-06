import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateProjectTypeDto } from './dto/create-project-type.dto';
import { UpdateProjectTypeDto } from './dto/update-project-type.dto';
import { ListSettingsQueryDto } from '../common/dto/list-settings.query.dto';

@Injectable()
export class ProjectTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(query: ListSettingsQueryDto) {
    return this.prisma.projectType.findMany({
      where: query.includeArchived ? {} : { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const projectType = await this.prisma.projectType.findFirst({ where: { id, deletedAt: null } });
    if (!projectType) {
      throw new NotFoundException('Tipo de projeto não encontrado.');
    }
    return projectType;
  }

  async create(dto: CreateProjectTypeDto, actorUserId: string) {
    const projectType = await this.prisma.projectType.create({
      data: { ...dto, createdBy: actorUserId },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_CREATED',
      actorUserId,
      targetType: 'ProjectType',
      targetId: projectType.id,
      metadata: { module: 'projectType' },
    });

    return projectType;
  }

  async update(id: string, dto: UpdateProjectTypeDto, actorUserId: string) {
    await this.findOne(id);
    const projectType = await this.prisma.projectType.update({ where: { id }, data: dto });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_UPDATED',
      actorUserId,
      targetType: 'ProjectType',
      targetId: id,
      metadata: { module: 'projectType' },
    });

    return projectType;
  }

  async archive(id: string, actorUserId: string) {
    await this.findOne(id);
    const projectType = await this.prisma.projectType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      action: 'SETTINGS_ITEM_ARCHIVED',
      actorUserId,
      targetType: 'ProjectType',
      targetId: id,
      metadata: { module: 'projectType' },
    });

    return projectType;
  }
}
