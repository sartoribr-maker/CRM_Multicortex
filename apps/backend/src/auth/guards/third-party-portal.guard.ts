import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../audit/audit.service';
import { ALLOW_THIRD_PARTY_PORTAL_KEY } from '../decorators/allow-third-party-portal.decorator';
import type { JwtPayload } from '../types/jwt-payload.interface';

/**
 * Confina usuários de perfis THIRD_PARTY às rotas marcadas com
 * @AllowThirdPartyPortal(). Roda depois do JwtAuthGuard e do PermissionsGuard
 * (ordem de registro no AuthModule); rotas públicas não têm usuário e passam.
 */
@Injectable()
export class ThirdPartyPortalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (user?.portal !== 'THIRD_PARTY') return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_THIRD_PARTY_PORTAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    await this.audit.record({
      action: 'THIRD_PARTY_PORTAL_ACCESS_DENIED',
      actorUserId: user.sub,
      metadata: { method: request.method, path: request.originalUrl ?? request.url },
    });
    throw new ForbiddenException('Acesso não permitido no Portal de Terceiros.');
  }
}
