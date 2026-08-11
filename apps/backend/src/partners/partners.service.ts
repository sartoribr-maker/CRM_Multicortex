import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { ListPartnersQueryDto } from './dto/list-partners.query.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

const PARTNER_INCLUDE = {
  _count: { select: { leads: { where: { deletedAt: null } } } },
} satisfies Prisma.PartnerInclude;

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(query: ListPartnersQueryDto) {
    const where: Prisma.PartnerWhereInput = {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { document: { contains: query.search, mode: 'insensitive' } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.partner.findMany({ where, include: PARTNER_INCLUDE, orderBy: { name: 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.partner.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async findOne(id: string) {
    const partner = await this.prisma.partner.findFirst({
      where: { id, deletedAt: null }, include: {
        ...PARTNER_INCLUDE,
        leads: { where: { deletedAt: null }, include: { stage: true, owner: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' }, take: 20 },
      },
    });
    if (!partner) throw new NotFoundException('Parceiro não encontrado.');
    return partner;
  }

  async create(dto: CreatePartnerDto, actorUserId: string) {
    try {
      const partner = await this.prisma.partner.create({ data: { ...dto, createdBy: actorUserId }, include: PARTNER_INCLUDE });
      await this.audit.record({ action: 'PARTNER_CREATED', actorUserId, targetType: 'Partner', targetId: partner.id });
      return partner;
    } catch (error) { this.handleUnique(error); throw error; }
  }

  async update(id: string, dto: UpdatePartnerDto, actorUserId: string) {
    await this.findOne(id);
    try {
      const partner = await this.prisma.partner.update({ where: { id }, data: dto, include: PARTNER_INCLUDE });
      await this.audit.record({ action: 'PARTNER_UPDATED', actorUserId, targetType: 'Partner', targetId: id });
      return partner;
    } catch (error) { this.handleUnique(error); throw error; }
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actorUserId: string) {
    await this.findOne(id);
    const partner = await this.prisma.partner.update({ where: { id }, data: { status }, include: PARTNER_INCLUDE });
    await this.audit.record({ action: status === 'ACTIVE' ? 'PARTNER_REACTIVATED' : 'PARTNER_DEACTIVATED', actorUserId, targetType: 'Partner', targetId: id });
    return partner;
  }

  async remove(id: string, actorUserId: string) {
    const partner = await this.findOne(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'PARTNER_DELETED',
          actorUserId,
          targetType: 'Partner',
          targetId: id,
          metadata: { name: partner.name, linkedLeads: partner._count.leads },
        },
      });
      await tx.partner.delete({ where: { id } });
    });
  }

  private handleUnique(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Já existe um parceiro com este documento.');
  }
}
