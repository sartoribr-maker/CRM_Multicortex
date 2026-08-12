import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'stream';
import { extname } from 'path';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage-provider.interface';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  position: true,
  phone: true,
  status: true,
  mustChangePassword: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const DEFAULT_TEMPORARY_PASSWORD = 'Senha@123';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
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

    const passwordHash = await bcrypt.hash(
      dto.mustChangePassword ? DEFAULT_TEMPORARY_PASSWORD : dto.password,
      10,
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          roleId: dto.roleId,
          position: dto.position,
          phone: dto.phone,
          mustChangePassword: dto.mustChangePassword ?? false,
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
    const existingUser = await this.findOne(id);
    const enablingRequiredPasswordChange =
      dto.mustChangePassword === true && !existingUser.mustChangePassword;

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, deletedAt: null } });
      if (!role) {
        throw new NotFoundException('Perfil (role) não encontrado.');
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...dto,
          ...(enablingRequiredPasswordChange
            ? { passwordHash: await bcrypt.hash(DEFAULT_TEMPORARY_PASSWORD, 10) }
            : {}),
        },
        select: SAFE_USER_SELECT,
      });

      // Uma sessão persistente anterior não pode contornar a troca obrigatória
      // quando a aplicação for aberta novamente.
      if (enablingRequiredPasswordChange) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.auditService.record({
        action: 'USER_UPDATED',
        actorUserId,
        targetType: 'User',
        targetId: id,
        metadata: enablingRequiredPasswordChange
          ? { temporaryPasswordAssigned: true, requiredPasswordChange: true }
          : undefined,
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

    if (id === actorUserId && status === 'INACTIVE') {
      throw new ConflictException('Você não pode inativar a própria conta.');
    }

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

  async uploadAvatar(id: string, file: Express.Multer.File, actorUserId: string) {
    const existing = await this.findOne(id);
    const saved = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: saved.storageKey },
      select: SAFE_USER_SELECT,
    });
    if (existing.avatarUrl) await this.storage.delete(existing.avatarUrl);
    await this.auditService.record({
      action: 'USER_UPDATED',
      actorUserId,
      targetType: 'User',
      targetId: id,
      metadata: { avatarUpdated: true },
    });
    return user;
  }

  async getAvatar(id: string): Promise<{ stream: Readable; mimeType: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { avatarUrl: true },
    });
    if (!user?.avatarUrl) throw new NotFoundException('Foto do usuário não encontrada.');
    const mimeType =
      { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[
        extname(user.avatarUrl).toLowerCase()
      ] ?? 'application/octet-stream';
    return { stream: await this.storage.getStream(user.avatarUrl), mimeType };
  }

  async remove(id: string, actorUserId: string): Promise<void> {
    if (id === actorUserId) {
      throw new ConflictException('Você não pode excluir a própria conta.');
    }
    const user = await this.findOne(id);
    const [
      ownedLeads,
      assignments,
      stageChanges,
      attachments,
      activities,
      assignedTasks,
      createdTasks,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { ownerId: id } }),
      this.prisma.leadAssignee.count({ where: { userId: id } }),
      this.prisma.stageHistoryEntry.count({ where: { changedByUserId: id } }),
      this.prisma.attachment.count({ where: { uploadedByUserId: id } }),
      this.prisma.leadActivity.count({ where: { actorUserId: id } }),
      this.prisma.taskAssignee.count({ where: { userId: id } }),
      this.prisma.task.count({ where: { createdByUserId: id } }),
    ]);
    const linkedRecords =
      ownedLeads +
      assignments +
      stageChanges +
      attachments +
      activities +
      assignedTasks +
      createdTasks;
    if (linkedRecords > 0) {
      throw new ConflictException(
        'Este usuário possui registros vinculados e não pode ser excluído. Inative-o para preservar o histórico.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'USER_DELETED',
          actorUserId,
          targetType: 'User',
          targetId: id,
          metadata: { name: user.name, email: user.email },
        },
      });
      await tx.user.delete({ where: { id } });
    });
    if (user.avatarUrl) await this.storage.delete(user.avatarUrl);
  }
}
