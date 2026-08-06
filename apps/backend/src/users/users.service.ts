import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  position: true,
  phone: true,
  status: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async create(dto: CreateUserDto, actorUserId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, deletedAt: null } });
    if (!role) {
      throw new NotFoundException('Perfil (role) não encontrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          roleId: dto.roleId,
          position: dto.position,
          phone: dto.phone,
          createdBy: actorUserId,
        },
        select: SAFE_USER_SELECT,
      });

      await this.auditService.record({
        action: 'USER_CREATED',
        actorUserId,
        targetType: 'User',
        targetId: user.id,
      });

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string) {
    await this.findOne(id);

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, deletedAt: null } });
      if (!role) {
        throw new NotFoundException('Perfil (role) não encontrado.');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: dto,
        select: SAFE_USER_SELECT,
      });

      await this.auditService.record({
        action: 'USER_UPDATED',
        actorUserId,
        targetType: 'User',
        targetId: id,
      });

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }
      throw error;
    }
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actorUserId: string) {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: SAFE_USER_SELECT,
    });

    if (status === 'INACTIVE') {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.record({
      action: status === 'ACTIVE' ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
      actorUserId,
      targetType: 'User',
      targetId: id,
    });

    return user;
  }

  async resetPassword(id: string, newPassword: string, actorUserId: string) {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.record({
      action: 'USER_UPDATED',
      actorUserId,
      targetType: 'User',
      targetId: id,
      metadata: { passwordReset: true },
    });
  }
}
