import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_WITH_PERMISSIONS = {
  include: { permissions: { include: { permission: true } } },
} satisfies Prisma.RoleDefaultArgs;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private toRoleDto(role: Prisma.RoleGetPayload<typeof ROLE_WITH_PERMISSIONS>) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.key),
    };
  }

  async findAll() {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      ...ROLE_WITH_PERMISSIONS,
    });
    return roles.map((role) => this.toRoleDto(role));
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      ...ROLE_WITH_PERMISSIONS,
    });
    if (!role) {
      throw new NotFoundException('Perfil não encontrado.');
    }
    return this.toRoleDto(role);
  }

  async listPermissionCatalog() {
    return this.prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    });
  }

  async create(dto: CreateRoleDto, actorUserId: string) {
    try {
      const role = await this.prisma.role.create({
        data: { name: dto.name, description: dto.description, createdBy: actorUserId },
        ...ROLE_WITH_PERMISSIONS,
      });
      await this.auditService.record({
        action: 'ROLE_CREATED',
        actorUserId,
        targetType: 'Role',
        targetId: role.id,
      });
      return this.toRoleDto(role);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um perfil com este nome.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateRoleDto, actorUserId: string) {
    await this.findOne(id);
    try {
      const role = await this.prisma.role.update({
        where: { id },
        data: dto,
        ...ROLE_WITH_PERMISSIONS,
      });
      await this.auditService.record({
        action: 'ROLE_UPDATED',
        actorUserId,
        targetType: 'Role',
        targetId: id,
      });
      return this.toRoleDto(role);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um perfil com este nome.');
      }
      throw error;
    }
  }

  async remove(id: string, actorUserId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      throw new NotFoundException('Perfil não encontrado.');
    }
    if (role.isSystem) {
      throw new ForbiddenException('Perfis padrão do sistema não podem ser excluídos.');
    }
    if (role._count.users > 0) {
      throw new ConflictException('Não é possível excluir um perfil com usuários vinculados.');
    }

    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.auditService.record({
      action: 'ROLE_DELETED',
      actorUserId,
      targetType: 'Role',
      targetId: id,
    });
  }

  async setPermissions(id: string, permissionKeys: string[], actorUserId: string) {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null } });
    if (!role) {
      throw new NotFoundException('Perfil não encontrado.');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys }, deletedAt: null },
    });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })),
      }),
    ]);

    await this.auditService.record({
      action: 'ROLE_PERMISSIONS_CHANGED',
      actorUserId,
      targetType: 'Role',
      targetId: id,
      metadata: { permissions: permissionKeys },
    });

    return this.findOne(id);
  }
}
