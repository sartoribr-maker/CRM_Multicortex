import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionKey } from '../constants/permissions';
import type { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    const hasAllPermissions =
      !!user && requiredPermissions.every((permission) => user.permissions.includes(permission));

    if (!hasAllPermissions) {
      throw new ForbiddenException('Você não tem permissão para executar esta ação.');
    }

    return true;
  }
}
