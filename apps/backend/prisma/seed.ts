import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSION_CATALOG, PERMISSIONS, type PermissionKey } from '../src/auth/constants/permissions';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'Senha@123';

const STAGE_DEFINITIONS = [
  { name: 'Lead Captado', order: 1, color: '#74529F' },
  { name: 'Qualificação', order: 2, color: '#4A80C0' },
  { name: 'Diagnóstico/Reunião', order: 3, color: '#52C9E9' },
  { name: 'Proposta Enviada', order: 4, color: '#F68E35' },
  { name: 'Negociação', order: 5, color: '#EAC634' },
  { name: 'Ganho (Projeto Ativo)', order: 6, color: '#42AD83', isWonStage: true },
  { name: 'Perdido', order: 7, color: '#EF325A', isLostStage: true },
];

const PRIORITY_DEFINITIONS = [
  { name: 'Baixa', order: 1, color: '#85C557' },
  { name: 'Média', order: 2, color: '#EAC634' },
  { name: 'Alta', order: 3, color: '#F68E35' },
  { name: 'Urgente', order: 4, color: '#EF325A' },
];

const DEAL_SIZE_DEFINITIONS = [
  { name: 'Pequeno', order: 1, color: '#52C9E9', minValue: 0, maxValue: 10_000 },
  { name: 'Médio', order: 2, color: '#4A80C0', minValue: 10_000, maxValue: 50_000 },
  { name: 'Grande', order: 3, color: '#74529F', minValue: 50_000, maxValue: 200_000 },
  { name: 'Enterprise', order: 4, color: '#523E86', minValue: 200_000, maxValue: null },
];

const SOURCE_DEFINITIONS = [
  { name: 'Indicação', description: 'Indicado por cliente ou parceiro' },
  { name: 'Site', description: 'Formulário ou chat do site institucional' },
  { name: 'Evento', description: 'Feiras, palestras e eventos do setor' },
  { name: 'Parceiro', description: 'Trazido por um parceiro comercial' },
  { name: 'Outbound', description: 'Prospecção ativa da equipe comercial' },
  { name: 'Outro', description: 'Origem não mapeada nas demais categorias' },
];

const PROJECT_TYPE_DEFINITIONS = [
  { name: 'Consultoria', description: 'Projetos de consultoria especializada' },
  { name: 'Implementação', description: 'Implantação de sistema/solução' },
  { name: 'Licenciamento', description: 'Venda de licenças de software' },
  { name: 'Suporte/Manutenção', description: 'Contratos recorrentes de suporte' },
];

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
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.ROLES_VIEW,
      PERMISSIONS.LEADS_VIEW,
      PERMISSIONS.LEADS_VIEW_ALL,
      PERMISSIONS.LEADS_CREATE,
      PERMISSIONS.LEADS_EDIT,
      PERMISSIONS.LEADS_DELETE,
    ],
  },
  {
    name: 'Vendedor',
    description: 'Visão dos próprios leads e tarefas.',
    permissions: [PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_CREATE, PERMISSIONS.LEADS_EDIT],
  },
  {
    name: 'Parceiro',
    description: 'Acesso restrito aos leads indicados pelo próprio parceiro.',
    permissions: [],
  },
  {
    name: 'Visualizador',
    description: 'Acesso somente leitura ao dashboard e relatórios.',
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.ROLES_VIEW,
      PERMISSIONS.LEADS_VIEW,
      PERMISSIONS.LEADS_VIEW_ALL,
    ],
  },
];

const LEAD_DEFINITIONS = [
  {
    name: 'Implantação CRM - Acme Ltda',
    companyName: 'Acme Ltda',
    ownerEmail: 'vendedor@multicortex.com.br',
    stageName: 'Qualificação',
    priorityName: 'Alta',
    dealSizeName: 'Médio',
    sourceName: 'Site',
    projectTypeName: 'Implementação',
    estimatedValue: 35_000,
    periodicity: 'PONTUAL' as const,
  },
  {
    name: 'Consultoria de Processos - Beta Corp',
    companyName: 'Beta Corp',
    ownerEmail: 'gestor@multicortex.com.br',
    stageName: 'Diagnóstico/Reunião',
    priorityName: 'Média',
    dealSizeName: 'Grande',
    sourceName: 'Indicação',
    projectTypeName: 'Consultoria',
    estimatedValue: 80_000,
    periodicity: 'PONTUAL' as const,
  },
  {
    name: 'Licenciamento Anual - Gamma SA',
    companyName: 'Gamma SA',
    ownerEmail: 'admin@multicortex.com.br',
    stageName: 'Proposta Enviada',
    priorityName: 'Urgente',
    dealSizeName: 'Enterprise',
    sourceName: 'Parceiro',
    projectTypeName: 'Licenciamento',
    estimatedValue: 250_000,
    periodicity: 'ANUAL' as const,
  },
  {
    name: 'Suporte Mensal - Delta ME',
    companyName: 'Delta ME',
    ownerEmail: 'vendedor@multicortex.com.br',
    stageName: 'Ganho (Projeto Ativo)',
    priorityName: 'Baixa',
    dealSizeName: 'Pequeno',
    sourceName: 'Outbound',
    projectTypeName: 'Suporte/Manutenção',
    estimatedValue: 5_000,
    periodicity: 'MENSAL' as const,
  },
  {
    name: 'Projeto Piloto - Epsilon Tech',
    companyName: 'Epsilon Tech',
    ownerEmail: 'gestor@multicortex.com.br',
    stageName: 'Perdido',
    priorityName: 'Média',
    dealSizeName: 'Médio',
    sourceName: 'Evento',
    projectTypeName: 'Consultoria',
    estimatedValue: 40_000,
    periodicity: 'PONTUAL' as const,
    lossReason: 'Optou por concorrente',
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

  console.log('Seed: etapas do funil...');
  for (const stage of STAGE_DEFINITIONS) {
    const existing = await prisma.stage.findFirst({ where: { name: stage.name } });
    if (!existing) {
      await prisma.stage.create({ data: stage });
    }
  }

  console.log('Seed: prioridades...');
  for (const priority of PRIORITY_DEFINITIONS) {
    const existing = await prisma.priority.findFirst({ where: { name: priority.name } });
    if (!existing) {
      await prisma.priority.create({ data: priority });
    }
  }

  console.log('Seed: portes de negócio...');
  for (const dealSize of DEAL_SIZE_DEFINITIONS) {
    const existing = await prisma.dealSize.findFirst({ where: { name: dealSize.name } });
    if (!existing) {
      await prisma.dealSize.create({ data: dealSize });
    }
  }

  console.log('Seed: origens de lead...');
  for (const source of SOURCE_DEFINITIONS) {
    const existing = await prisma.source.findFirst({ where: { name: source.name } });
    if (!existing) {
      await prisma.source.create({ data: source });
    }
  }

  console.log('Seed: tipos de projeto...');
  for (const projectType of PROJECT_TYPE_DEFINITIONS) {
    const existing = await prisma.projectType.findFirst({ where: { name: projectType.name } });
    if (!existing) {
      await prisma.projectType.create({ data: projectType });
    }
  }

  console.log('Seed: leads de exemplo...');
  for (const leadDef of LEAD_DEFINITIONS) {
    const existing = await prisma.lead.findFirst({ where: { name: leadDef.name } });
    if (existing) continue;

    const [owner, stage, priority, dealSize, source, projectType] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: leadDef.ownerEmail } }),
      prisma.stage.findFirstOrThrow({ where: { name: leadDef.stageName } }),
      prisma.priority.findFirstOrThrow({ where: { name: leadDef.priorityName } }),
      prisma.dealSize.findFirstOrThrow({ where: { name: leadDef.dealSizeName } }),
      prisma.source.findFirstOrThrow({ where: { name: leadDef.sourceName } }),
      prisma.projectType.findFirstOrThrow({ where: { name: leadDef.projectTypeName } }),
    ]);

    const status = stage.isWonStage ? 'WON' : stage.isLostStage ? 'LOST' : 'OPEN';

    const lead = await prisma.lead.create({
      data: {
        name: leadDef.name,
        companyName: leadDef.companyName,
        ownerId: owner.id,
        stageId: stage.id,
        priorityId: priority.id,
        dealSizeId: dealSize.id,
        sourceId: source.id,
        projectTypeId: projectType.id,
        estimatedValue: leadDef.estimatedValue,
        periodicity: leadDef.periodicity,
        status,
        lossReason: leadDef.lossReason,
      },
    });

    await prisma.stageHistoryEntry.create({
      data: {
        leadId: lead.id,
        fromStageId: null,
        toStageId: stage.id,
        changedByUserId: owner.id,
        timeInPreviousStageSeconds: null,
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'CREATED',
        message: `Lead criado na etapa "${stage.name}".`,
        actorUserId: owner.id,
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
