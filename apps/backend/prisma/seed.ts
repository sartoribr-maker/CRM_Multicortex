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

const PARTNER_DEFINITIONS = [
  { name: 'Nexus Tecnologia', legalName: 'Nexus Tecnologia Ltda', type: 'TECHNOLOGY' as const, document: '12.345.678/0001-90', contactName: 'Marina Costa', email: 'marina@nexustech.com.br', phone: '(11) 98888-1200', website: 'https://nexustech.com.br', commissionPercentage: 8 },
  { name: 'Orbe Consultoria', legalName: 'Orbe Consultoria Empresarial Ltda', type: 'CONSULTING' as const, document: '23.456.789/0001-01', contactName: 'Rafael Lima', email: 'rafael@orbeconsultoria.com.br', phone: '(21) 97777-3400', commissionPercentage: 10 },
  { name: 'Conecta Negócios', type: 'REFERRAL' as const, contactName: 'Camila Souza', email: 'camila@conectanegocios.com.br', phone: '(31) 96666-5600', commissionPercentage: 5 },
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
      PERMISSIONS.PARTNERS_VIEW,
      PERMISSIONS.PARTNERS_CREATE,
      PERMISSIONS.PARTNERS_EDIT,
      PERMISSIONS.PARTNERS_DELETE,
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TASKS_VIEW_ALL,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.TASKS_EDIT,
      PERMISSIONS.TASKS_DELETE,
      PERMISSIONS.DASHBOARD_VIEW,
    ],
  },
  {
    name: 'Vendedor',
    description: 'Visão dos próprios leads e tarefas.',
    permissions: [PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_CREATE, PERMISSIONS.LEADS_EDIT, PERMISSIONS.PARTNERS_VIEW, PERMISSIONS.PARTNERS_CREATE, PERMISSIONS.TASKS_VIEW, PERMISSIONS.TASKS_CREATE, PERMISSIONS.TASKS_EDIT, PERMISSIONS.DASHBOARD_VIEW],
  },
  {
    name: 'Parceiro',
    description: 'Acesso restrito aos leads indicados pelo próprio parceiro.',
    permissions: [PERMISSIONS.DASHBOARD_VIEW],
  },
  {
    name: 'Visualizador',
    description: 'Acesso somente leitura ao dashboard e relatórios.',
    permissions: [
      PERMISSIONS.USERS_VIEW,
      PERMISSIONS.ROLES_VIEW,
      PERMISSIONS.LEADS_VIEW,
      PERMISSIONS.LEADS_VIEW_ALL,
      PERMISSIONS.PARTNERS_VIEW,
      PERMISSIONS.TASKS_VIEW,
      PERMISSIONS.TASKS_VIEW_ALL,
      PERMISSIONS.DASHBOARD_VIEW,
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
    partnerName: 'Nexus Tecnologia',
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

  console.log('Seed: parceiros...');
  for (const partner of PARTNER_DEFINITIONS) {
    const existing = await prisma.partner.findFirst({ where: { name: partner.name } });
    if (!existing) await prisma.partner.create({ data: partner });
  }

  console.log('Seed: leads de exemplo...');
  for (const leadDef of LEAD_DEFINITIONS) {
    const existing = await prisma.lead.findFirst({ where: { name: leadDef.name } });
    if (existing) continue;

    const [owner, stage, priority, dealSize, source, projectType, partner] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: leadDef.ownerEmail } }),
      prisma.stage.findFirstOrThrow({ where: { name: leadDef.stageName } }),
      prisma.priority.findFirstOrThrow({ where: { name: leadDef.priorityName } }),
      prisma.dealSize.findFirstOrThrow({ where: { name: leadDef.dealSizeName } }),
      prisma.source.findFirstOrThrow({ where: { name: leadDef.sourceName } }),
      prisma.projectType.findFirstOrThrow({ where: { name: leadDef.projectTypeName } }),
      leadDef.partnerName ? prisma.partner.findFirst({ where: { name: leadDef.partnerName } }) : Promise.resolve(null),
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
        projectTypes: { create: { projectTypeId: projectType.id } },
        partnerId: partner?.id,
        capexValue: leadDef.estimatedValue,
        opexValue: 0,
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

  console.log('Seed: tarefas de exemplo...');
  const taskOwner = await prisma.user.findUniqueOrThrow({ where: { email: 'vendedor@multicortex.com.br' } });
  const taskCreator = await prisma.user.findUniqueOrThrow({ where: { email: 'gestor@multicortex.com.br' } });
  const taskLead = await prisma.lead.findFirst({ where: { name: 'Implantação CRM - Acme Ltda' } });
  const taskDefinitions = [
    { title: 'Agendar reunião de diagnóstico', description: 'Alinhar disponibilidade com o decisor e preparar roteiro.', priority: 'HIGH' as const, dueDate: new Date(Date.now() + 2 * 86400000), leadId: taskLead?.id },
    { title: 'Enviar apresentação institucional', priority: 'MEDIUM' as const, dueDate: new Date(Date.now() + 86400000), leadId: taskLead?.id },
    { title: 'Revisar proposta comercial', priority: 'URGENT' as const, status: 'IN_PROGRESS' as const, dueDate: new Date(Date.now() - 86400000) },
  ];
  for (const task of taskDefinitions) {
    const existing = await prisma.task.findFirst({ where: { title: task.title } });
    if (!existing) await prisma.task.create({
      data: {
        ...task,
        assigneeId: taskOwner.id,
        createdByUserId: taskCreator.id,
        assignees: { create: { userId: taskOwner.id, assignedBy: taskCreator.id } },
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
