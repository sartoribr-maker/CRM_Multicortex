import { Injectable } from '@nestjs/common';
import { LeadActivityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RecordActivityParams {
  leadId: string;
  type: LeadActivityType;
  message: string;
  actorUserId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class LeadActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordActivityParams): Promise<void> {
    await this.prisma.leadActivity.create({
      data: {
        leadId: params.leadId,
        type: params.type,
        message: params.message,
        actorUserId: params.actorUserId,
        metadata: params.metadata,
      },
    });
  }
}
