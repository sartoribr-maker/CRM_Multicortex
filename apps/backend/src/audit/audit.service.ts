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
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'ROLE_PERMISSIONS_CHANGED';

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
