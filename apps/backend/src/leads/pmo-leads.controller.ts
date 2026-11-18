import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permissions';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from './leads.service';

/** Chamadas do PMO: chave compartilhada `PMO_INTEGRATION_KEY` no cabeçalho `X-Integration-Key`. */
@Injectable()
export class PmoIntegrationKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('PMO_INTEGRATION_KEY');
    if (!expected) throw new NotFoundException();
    const received = String(context.switchToHttp().getRequest().headers['x-integration-key'] ?? '');
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!received || !timingSafeEqual(digest(received), digest(expected))) {
      throw new UnauthorizedException('Chave de integração inválida.');
    }
    return true;
  }
}

const LEAD_SELECT = {
  id: true,
  name: true,
  companyName: true,
  stage: { select: { name: true, color: true } },
} as const;

/**
 * Leads para o PMO escolher ao vincular uma tarefa: só os que a pessoa (pelo e-mail) vê no CRM.
 * Rede interna; o Nginx público não expõe `/api/v1/integration/`.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@UseGuards(PmoIntegrationKeyGuard)
@Controller('integration/pmo/leads')
export class PmoLeadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
  ) {}

  /** A pessoa do PMO como usuário do CRM (mesmo e-mail), com as permissões do perfil dela aqui. */
  private async actor(req: Request): Promise<JwtPayload> {
    const email = String(req.headers['x-acting-user-email'] ?? '').trim();
    const user = email
      ? await this.prisma.user.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' },
            deletedAt: null,
            status: 'ACTIVE',
          },
          include: {
            role: {
              include: { permissions: { include: { permission: { select: { key: true } } } } },
            },
          },
        })
      : null;
    if (!user) throw new ForbiddenException('Usuário sem acesso ao CRM.');
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.permissions.map((p) => p.permission.key),
      portal: user.role.portal,
    };
  }

  @Get()
  async search(@Query('search') search: string | undefined, @Req() req: Request) {
    const user = await this.actor(req);
    if (!user.permissions.includes(PERMISSIONS.LEADS_VIEW)) return [];
    const term = (search ?? '').trim();
    return this.prisma.lead.findMany({
      where: {
        AND: [
          { deletedAt: null },
          await this.leads.visibleLeadsWhere(user),
          term
            ? {
                OR: [
                  { name: { contains: term, mode: 'insensitive' } },
                  { companyName: { contains: term, mode: 'insensitive' } },
                  { businessCode: { contains: term, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: LEAD_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  @Get(':id')
  async one(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = await this.actor(req);
    const lead = user.permissions.includes(PERMISSIONS.LEADS_VIEW)
      ? await this.prisma.lead.findFirst({
          where: { AND: [{ id, deletedAt: null }, await this.leads.visibleLeadsWhere(user)] },
          select: LEAD_SELECT,
        })
      : null;
    if (!lead) throw new NotFoundException('Lead não encontrado.');
    return lead;
  }
}
