import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSdrPortalSettingsDto } from './dto/update-sdr-portal-settings.dto';
import { isSdrTargetStage } from './third-party-lead.policy';

const STAGE_SELECT = {
  id: true,
  name: true,
  color: true,
  order: true,
  isWonStage: true,
  isLostStage: true,
  visibleInSdrPortal: true,
  deletedAt: true,
} as const;

@Injectable()
export class SdrPortalSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Configuração do portal; as etapas visíveis vêm do cadastro de etapas. */
  async get() {
    const [settings, visibleStages] = await Promise.all([
      this.prisma.sdrPortalSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' },
      }),
      this.prisma.stage.findMany({
        where: { visibleInSdrPortal: true, deletedAt: null },
        select: { id: true },
        orderBy: { order: 'asc' },
      }),
    ]);
    return { ...settings, visibleStageIds: visibleStages.map((stage) => stage.id) };
  }

  /** Configuração consumida pelo portal, com as etapas já resolvidas e ordenadas. */
  async getPortalConfig() {
    const settings = await this.get();
    const stageIds = [...new Set([...settings.visibleStageIds, ...settings.allowedTargetStageIds])];
    const stages = await this.prisma.stage.findMany({
      where: { id: { in: stageIds }, deletedAt: null },
      select: STAGE_SELECT,
      orderBy: { order: 'asc' },
    });
    return {
      visibleStages: stages.filter((stage) => settings.visibleStageIds.includes(stage.id)),
      allowedTargetStages: stages.filter((stage) => isSdrTargetStage(stage.id, settings)),
      qualifiedStageId: settings.qualifiedStageId,
      defaultSourceId: settings.defaultSourceId,
      sdrPartnerId: settings.sdrPartnerId,
      hideFinancialValues: settings.hideFinancialValues,
      staleDays: settings.staleDays,
    };
  }

  async update(dto: UpdateSdrPortalSettingsDto, actorUserId: string) {
    const allowedTargetStageIds = [...new Set(dto.allowedTargetStageIds)];
    const stageIds = [
      ...new Set([...allowedTargetStageIds, ...(dto.qualifiedStageId ? [dto.qualifiedStageId] : [])]),
    ];
    const existingStages = await this.prisma.stage.count({
      where: { id: { in: stageIds }, deletedAt: null },
    });
    if (existingStages !== stageIds.length) {
      throw new BadRequestException('Uma ou mais etapas informadas não existem ou estão arquivadas.');
    }
    if (
      dto.qualifiedStageId &&
      !isSdrTargetStage(dto.qualifiedStageId, {
        visibleStageIds: (await this.get()).visibleStageIds,
        allowedTargetStageIds,
      })
    ) {
      throw new BadRequestException(
        'A etapa de lead qualificado precisa ser uma etapa do portal ou um destino permitido.',
      );
    }
    if (
      dto.defaultSourceId &&
      !(await this.prisma.source.findFirst({ where: { id: dto.defaultSourceId, deletedAt: null } }))
    ) {
      throw new BadRequestException('Origem padrão não encontrada ou arquivada.');
    }
    if (
      dto.sdrPartnerId &&
      !(await this.prisma.partner.findFirst({ where: { id: dto.sdrPartnerId, deletedAt: null } }))
    ) {
      throw new BadRequestException('Parceiro comercial SDR não encontrado ou excluído.');
    }

    const data = {
      allowedTargetStageIds,
      qualifiedStageId: dto.qualifiedStageId ?? null,
      defaultSourceId: dto.defaultSourceId ?? null,
      sdrPartnerId: dto.sdrPartnerId ?? null,
      hideFinancialValues: dto.hideFinancialValues,
      staleDays: dto.staleDays,
      updatedBy: actorUserId,
    };
    const settings = await this.prisma.sdrPortalSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
    await this.audit.record({
      action: 'SDR_PORTAL_SETTINGS_UPDATED',
      actorUserId,
      targetType: 'SdrPortalSettings',
      targetId: settings.id,
    });
    return this.get();
  }
}
