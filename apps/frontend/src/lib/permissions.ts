import type { AuthUser } from '../types/auth';

type DeletableModule = 'leads' | 'tasks' | 'partners';

/** "<módulo>.delete" exclui qualquer registro; "<módulo>.delete.own", só os criados pelo usuário. */
export function canDeleteRecord(
  user: AuthUser | null | undefined,
  module: DeletableModule,
  createdBy: string | null | undefined,
): boolean {
  if (!user) return false;
  if (user.permissions.includes(`${module}.delete`)) return true;
  return user.permissions.includes(`${module}.delete.own`) && !!createdBy && createdBy === user.id;
}

/** Perfis com "stages.view.all" veem também as etapas ocultas no CRM principal. */
export function canViewAllStages(user: AuthUser | null | undefined): boolean {
  return user?.permissions.includes('stages.view.all') ?? false;
}
