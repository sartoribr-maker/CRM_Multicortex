export const PERMISSIONS = {
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  SETTINGS_MANAGE: 'settings.manage',
  LEADS_VIEW: 'leads.view',
  LEADS_VIEW_ALL: 'leads.view.all',
  LEADS_CREATE: 'leads.create',
  LEADS_EDIT: 'leads.edit',
  LEADS_DELETE: 'leads.delete',
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
  { key: PERMISSIONS.LEADS_VIEW, module: 'leads', description: 'Visualizar os próprios leads' },
  { key: PERMISSIONS.LEADS_VIEW_ALL, module: 'leads', description: 'Visualizar leads de todos os usuários' },
  { key: PERMISSIONS.LEADS_CREATE, module: 'leads', description: 'Criar leads' },
  { key: PERMISSIONS.LEADS_EDIT, module: 'leads', description: 'Editar leads' },
  { key: PERMISSIONS.LEADS_DELETE, module: 'leads', description: 'Arquivar leads' },
];
