import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../../audit/audit.service';
import { foldName } from '../../../common/spreadsheet';
import { PrismaService } from '../../../prisma/prisma.service';
import { parsePricingSheet, type PricingSheet, type PricingSheetRow } from './pricing-sheet.parser';

export interface PricingImportOptions {
  /** Prefixo dos nomes dos serviços (padrão: o do título da planilha). */
  productName?: string;
  /** Tipo de produto ao qual os serviços importados serão relacionados. */
  projectTypeId?: string;
}

export interface PricingPreviewRow extends PricingSheetRow {
  name: string;
  /** Serviço de mesmo nome já cadastrado (é atualizado). */
  existingId: string | null;
  archived: boolean;
  invalidReason: string | null;
}

function serviceName(productName: string | null, row: PricingSheetRow): string {
  return [productName, row.tier, '—', row.hardwareSpec]
    .filter((part) => part)
    .join(' ')
    .replace(/^— /, '');
}

/**
 * Importação da planilha de precificação no catálogo de serviços: um serviço
 * por máquina, com a mensalidade como valor e as cobranças únicas (licença,
 * setups, PoC) em campos próprios. Serviços de mesmo nome são atualizados.
 */
@Injectable()
export class ServicesImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(file: Express.Multer.File, productName?: string) {
    const sheet = await parsePricingSheet(file.buffer);
    const projectTypes = await this.prisma.projectType.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const product = productName?.trim() || sheet.productName;
    const suggested = product
      ? projectTypes.find((type) => foldName(type.name) === foldName(product))
      : undefined;
    return {
      fileName: file.originalname,
      productName: product,
      referenceDate: sheet.referenceDate,
      taxRate: sheet.taxRate,
      pocDays: sheet.pocDays,
      tabs: sheet.tabs,
      rows: await this.rows(sheet, product),
      projectTypes,
      suggestedProjectTypeId: suggested?.id ?? null,
    };
  }

  private async rows(sheet: PricingSheet, productName: string | null): Promise<PricingPreviewRow[]> {
    const names = sheet.rows.map((row) => serviceName(productName, row));
    const existing = new Map(
      (
        await this.prisma.service.findMany({
          where: { name: { in: names } },
          select: { id: true, name: true, deletedAt: true },
        })
      ).map((service) => [service.name, service]),
    );
    return sheet.rows.map((row, index) => {
      const service = existing.get(names[index]);
      return {
        ...row,
        name: names[index],
        existingId: service?.id ?? null,
        archived: Boolean(service?.deletedAt),
        invalidReason: row.price === null ? 'Sem preço final' : null,
      };
    });
  }

  async import(file: Express.Multer.File, options: PricingImportOptions, actorUserId: string) {
    const sheet = await parsePricingSheet(file.buffer);
    if (options.projectTypeId) {
      const projectType = await this.prisma.projectType.findFirst({
        where: { id: options.projectTypeId, deletedAt: null },
      });
      if (!projectType) throw new BadRequestException('Tipo de produto não encontrado.');
    }
    const productName = options.productName?.trim() || sheet.productName;
    const rows = (await this.rows(sheet, productName)).filter((row) => !row.invalidReason);
    if (!rows.length) throw new BadRequestException('Nenhum item com preço final para importar.');

    // Parâmetros e notas de cada aba, guardados com cada serviço para consulta.
    const pricingParameters = sheet.tabs.map(({ name, title, parameters, notes }) => ({
      sheet: name,
      title,
      parameters,
      notes,
    })) as unknown as Prisma.InputJsonValue;

    const result = await this.prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      const ids: string[] = [];
      for (const row of rows) {
        const data = {
          price: row.price!,
          billingUnit: 'MONTH' as const,
          tier: row.tier,
          hardwareSpec: row.hardwareSpec,
          priceWithoutTax: row.priceWithoutTax,
          taxRate: sheet.taxRate,
          hardwareCost: row.hardwareCost,
          marginValue: row.marginValue,
          licenseCost: row.licenseCost,
          setupPrivateCloudPrice: row.setupPrivateCloudPrice,
          setupOnPremisesPrice: row.setupOnPremisesPrice,
          pocPrice: row.pocPrice,
          pocDays: sheet.pocDays,
          priceReferenceDate: sheet.referenceDate,
          pricingSource: file.originalname,
          pricingParameters,
        } satisfies Prisma.ServiceUncheckedUpdateInput;
        if (row.existingId) {
          await tx.service.update({ where: { id: row.existingId }, data: { ...data, deletedAt: null } });
          ids.push(row.existingId);
          updated++;
        } else {
          const service = await tx.service.create({
            data: { ...data, name: row.name, createdBy: actorUserId },
            select: { id: true },
          });
          ids.push(service.id);
          created++;
        }
      }
      if (options.projectTypeId) {
        await tx.projectTypeService.createMany({
          data: ids.map((serviceId) => ({ projectTypeId: options.projectTypeId!, serviceId })),
          skipDuplicates: true,
        });
      }
      return { created, updated };
    });

    await this.audit.record({
      action: 'SETTINGS_ITEM_UPDATED',
      actorUserId,
      targetType: 'Service',
      metadata: {
        module: 'service',
        import: file.originalname,
        ...result,
        projectTypeId: options.projectTypeId ?? null,
      },
    });
    return { ...result, linked: options.projectTypeId ? rows.length : 0 };
  }
}
