import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSION_CATALOG, PERMISSIONS, type PermissionKey } from '../src/auth/constants/permissions';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'Senha@123';

const ROLE_DEFINITIONS: Array<{
  name: string;
  description: string;
  permissions: PermissionKey[];
}> = [
  {
    name: 'Administrador',
    description: 'Acesso total à plataforma, incluindo configurações.',
    permissions: PERMISSION_CATALOG.map((p) => p.key),
  },
  {
    name: 'Gestor Comercial',
    description: 'Visão de toda a equipe, gestão de leads e parceiros.',
    permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_VIEW],
  },
  {
    name: 'Vendedor',
    description: 'Visão dos próprios leads e tarefas.',
    permissions: [],
  },
  {
    name: 'Parceiro',
    description: 'Acesso restrito aos leads indicados pelo próprio parceiro.',
    permissions: [],
  },
  {
    name: 'Visualizador',
    description: 'Acesso somente leitura ao dashboard e relatórios.',
    permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_VIEW],
  },
];

const USER_DEFINITIONS = [
  { name: 'Ana Administradora', email: 'admin@multicortex.com.br', role: 'Administrador' },
  { name: 'Gustavo Gestor', email: 'gestor@multicortex.com.br', role: 'Gestor Comercial' },
  { name: 'Vitor Vendedor', email: 'vendedor@multicortex.com.br', role: 'Vendedor' },
  { name: 'Paula Parceira', email: 'parceiro@multicortex.com.br', role: 'Parceiro' },
  { name: 'Vera Visualizadora', email: 'visualizador@multicortex.com.br', role: 'Visualizador' },
];

async function main() {
  console.log('Seed: catálogo de permissões...');
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { module: permission.module, description: permission.description },
      create: permission,
    });
  }

  console.log('Seed: roles...');
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description, isSystem: true },
      create: { name: roleDef.name, description: roleDef.description, isSystem: true },
    });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: roleDef.permissions } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      });
    }
  }

  console.log('Seed: usuários de exemplo...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const userDef of USER_DEFINITIONS) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: userDef.role } });
    await prisma.user.upsert({
      where: { email: userDef.email },
      update: { name: userDef.name, roleId: role.id },
      create: {
        name: userDef.name,
        email: userDef.email,
        passwordHash,
        roleId: role.id,
      },
    });
  }

  console.log('Seed concluído. Senha padrão para todos os usuários de exemplo: ' + SEED_PASSWORD);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
