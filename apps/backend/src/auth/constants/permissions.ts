export const PERMISSIONS = {
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: Array<{ key: PermissionKey; module: string; description: string }> = [
  { key: PERMISSIONS.USERS_VIEW, module: 'users', description: 'Visualizar usuários' },
  { key: PERMISSIONS.USERS_CREATE, module: 'users', description: 'Criar usuários' },
  { key: PERMISSIONS.USERS_EDIT, module: 'users', description: 'Editar usuários' },
  { key: PERMISSIONS.USERS_DELETE, module: 'users', description: 'Inativar/excluir usuários' },
  { key: PERMISSIONS.ROLES_VIEW, module: 'roles', description: 'Visualizar perfis e permissões' },
  { key: PERMISSIONS.ROLES_MANAGE, module: 'roles', description: 'Criar/editar perfis e atribuir permissões' },
  { key: PERMISSIONS.SETTINGS_MANAGE, module: 'settings', description: 'Gerenciar configurações da plataforma' },
];
