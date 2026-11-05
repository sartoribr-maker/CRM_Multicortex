import { ForbiddenException } from '@nestjs/common';
import type { PermissionKey } from './constants/permissions';
import type { JwtPayload } from './types/jwt-payload.interface';

/**
 * Exclusão/arquivamento: quem tem a permissão ampla exclui qualquer registro;
 * quem só tem a permissão ".own" exclui apenas o que criou.
 */
export function assertCanDeleteRecord(
  user: Pick<JwtPayload, 'sub' | 'permissions'>,
  deleteAnyPermission: PermissionKey,
  createdBy: string | null | undefined,
) {
  if (user.permissions.includes(deleteAnyPermission)) return;
  if (createdBy && createdBy === user.sub) return;
  throw new ForbiddenException('Você só pode excluir registros criados por você.');
}
