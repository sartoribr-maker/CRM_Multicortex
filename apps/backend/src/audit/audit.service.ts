import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'USER_DELETED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'ROLE_PERMISSIONS_CHANGED'
  | 'SETTINGS_ITEM_CREATED'
  | 'SETTINGS_ITEM_UPDATED'
  | 'SETTINGS_ITEM_ARCHIVED'
  | 'SETTINGS_ITEM_REORDERED'
  | 'PARTNER_CREATED'
  | 'PARTNER_UPDATED'
  | 'PARTNER_DEACTIVATED'
  | 'PARTNER_REACTIVATED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_ARCHIVED';

interface RecordParams {
  action: AuditAction;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actorUserId,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata,
      },
    });
  }
}
