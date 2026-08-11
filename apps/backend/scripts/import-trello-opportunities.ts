import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LeadStatus, PrismaClient } from '@prisma/client';

type TrelloLabel = { id: string; name: string };
type TrelloList = { id: string; name: string; closed: boolean; pos: number };
type TrelloMember = { id: string; fullName: string; username: string };
type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  idList: string;
  idLabels: string[];
  idMembers: string[];
};
type TrelloBoard = {
  cards: TrelloCard[];
  labels: TrelloLabel[];
  lists: TrelloList[];
  members: TrelloMember[];
};

const prisma = new PrismaClient();

const PRIORITY_NAMES = new Set(['baixa', 'media', 'alta', 'mandatoria']);
const PROBABILITY_BY_EXPECTATION: Record<string, number> = {
  baixa: 25,
  media: 50,
  alta: 75,
};

const PROJECT_TYPE_ALIASES: Record<string, string> = {
  'solucoes | customizacoes': 'Soluções/Customizações',
  'palestras | eventos': 'Palestras/Treinamentos',
};

const STAGE_ALIASES: Record<string, string> = {
  backlog: 'Backlog',
  leads: 'Leads',
  'primeiro contato': 'Contato/Qualificação',
  'qualificacao / descoberta': 'Diagnóstico/Reunião',
  'pocs | mvps | piloto': 'POCs/MVPs/Piloto',
  'proposta tecnica': 'Proposta Técnica',
  'proposta comercial': 'Proposta Comercial',
  negociacao: 'Negociação',
  'aprovacao/assinatura': 'Aprovação/Assinatura',
  projeto: 'Ganho (Projeto Ativo)',
  'cliente ativo': 'Ganho (Projeto Ativo)',
  'em espera/pausado': 'Em espera/Pausado',
  perdidos: 'Perdido',
};

const STAGE_COLORS = [
  '#74529F',
  '#4A80C0',
  '#52C9E9',
  '#F68E35',
  '#EAC634',
  '#42AD83',
  '#EF325A',
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractDescriptionField(description: string, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const expression = new RegExp(
      `(?:\\*\\*)?${fieldName}(?:\\*\\*)?\\s*:\\s*(?:-\\s*)?([^\\r\\n]+)`,
      'i',
    );
    const match = description.match(expression);
    if (!match) continue;

    const value = match[1]
      .replace(/\*\*/g, '')
      .trim()
      .replace(/^[-–—]\s*/, '')
      .trim();

    if (!value || normalize(value).startsWith('nao definido')) return null;
    return value;
  }

  return null;
}

function dealSizeName(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const value = normalize(rawValue).replace(/^[-–—]\s*/, '');
  if (value.startsWith('pequen')) return 'Pequeno';
  if (value.startsWith('medi')) return 'Médio';
  if (value.startsWith('grand')) return 'Grande';
  if (value.startsWith('estrateg') || value.startsWith('enterprise')) return 'Enterprise';
  return null;
}

function probability(description: string): number | null {
  const rawValue = extractDescriptionField(description, [
    'Expectativa(?: de)? Sucesso',
    'Probabilidade(?: de)? Sucesso',
  ]);
  if (!rawValue) return null;

  const numericValue = rawValue.match(/(\d{1,3})(?:\s*%)?/);
  if (numericValue) return Math.min(100, Math.max(0, Number(numericValue[1])));

  return PROBABILITY_BY_EXPECTATION[normalize(rawValue).replace(/^[-–—]\s*/, '')] ?? null;
}

function partnerName(description: string): string | null {
  return extractDescriptionField(description, ['Vendedor', 'Origem\\s*/?\\s*Parceiro Indicador']);
}

async function findUserForMember(member: TrelloMember) {
  const memberName = normalize(member.fullName);
  let expectedName: string;

  if (memberName === 'multicortex' || memberName.includes('guilherme multicortex')) {
    expectedName = memberName === 'multicortex' ? 'bruno' : 'guilherme';
  } else if (memberName.includes('tiago')) {
    expectedName = 'tiago';
  } else if (memberName.includes('alessandro')) {
    expectedName = 'alessandro';
  } else {
    expectedName = memberName.split(' ')[0];
  }

  const users = await prisma.user.findMany({ where: { deletedAt: null } });
  return users.find((user) => normalize(user.name).includes(expectedName)) ?? null;
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? 'Documentos/GZ0IsxjM - funil-de-venda.json');
  const board = JSON.parse(await readFile(inputPath, 'utf8')) as TrelloBoard;

  const labelsById = new Map(board.labels.map((label) => [label.id, label]));
  const listsById = new Map(board.lists.map((list) => [list.id, list]));
  const membersById = new Map(board.members.map((member) => [member.id, member]));
  const activeCards = board.cards.filter(
    (card) => !card.closed && card.name.trim() && !/^\++$/.test(card.name.trim()),
  );

  const bruno = (await prisma.user.findMany({ where: { deletedAt: null } })).find((user) =>
    normalize(user.name).includes('bruno'),
  );
  if (!bruno) throw new Error('Usuário Bruno não encontrado. Ele é necessário como responsável padrão.');

  const indicationSource = await prisma.source.findFirst({
    where: { name: { equals: 'Indicação', mode: 'insensitive' }, deletedAt: null },
  });
  if (!indicationSource) throw new Error('Origem "Indicação" não encontrada.');

  let created = 0;
  let updated = 0;

  for (const [cardIndex, card] of activeCards.entries()) {
    const list = listsById.get(card.idList);
    if (!list) throw new Error(`Lista não encontrada para o cartão ${card.id}: ${card.name}`);

    const requestedStageName = STAGE_ALIASES[normalize(list.name)] ?? list.name.trim();
    let stage = await prisma.stage.findFirst({
      where: { name: { equals: requestedStageName, mode: 'insensitive' }, deletedAt: null },
    });
    if (!stage) {
      stage = await prisma.stage.create({
        data: {
          name: requestedStageName,
          order: cardIndex + 1,
          color: STAGE_COLORS[cardIndex % STAGE_COLORS.length],
        },
      });
    }

    const labels = card.idLabels
      .map((labelId) => labelsById.get(labelId))
      .filter((label): label is TrelloLabel => Boolean(label));
    const priorityLabel = labels.find((label) => PRIORITY_NAMES.has(normalize(label.name)));
    const projectTypeLabel = labels.find((label) => !PRIORITY_NAMES.has(normalize(label.name)));

    const priority = priorityLabel
      ? await prisma.priority.findFirst({
          where: { name: { equals: priorityLabel.name, mode: 'insensitive' }, deletedAt: null },
        })
      : null;
    const projectType = projectTypeLabel
      ? await prisma.projectType.findFirst({
          where: {
            name: {
              equals: PROJECT_TYPE_ALIASES[normalize(projectTypeLabel.name)] ?? projectTypeLabel.name,
              mode: 'insensitive',
            },
            deletedAt: null,
          },
        })
      : null;
    const sizeName = dealSizeName(extractDescriptionField(card.desc, ['Porte(?: do)? Projeto']));
    const dealSize = sizeName
      ? await prisma.dealSize.findFirst({
          where: { name: { equals: sizeName, mode: 'insensitive' }, deletedAt: null },
        })
      : null;

    const rawPartnerName = partnerName(card.desc);
    let partner = rawPartnerName
      ? await prisma.partner.findFirst({
          where: { name: { equals: rawPartnerName, mode: 'insensitive' }, deletedAt: null },
        })
      : null;
    if (rawPartnerName && !partner) {
      partner = await prisma.partner.create({
        data: {
          name: rawPartnerName,
          type: 'REFERRAL',
          notes: `Parceiro indicador importado do Trello (cartão ${card.id}).`,
        },
      });
    }

    const assignees = (
      await Promise.all(
        card.idMembers
          .map((memberId) => membersById.get(memberId))
          .filter((member): member is TrelloMember => Boolean(member))
          .map(findUserForMember),
      )
    ).filter((user): user is NonNullable<typeof user> => Boolean(user));
    const uniqueAssignees = [...new Map(assignees.map((user) => [user.id, user])).values()];
    const owner = uniqueAssignees[0] ?? bruno;
    const status: LeadStatus = stage.isWonStage ? 'WON' : stage.isLostStage ? 'LOST' : 'OPEN';
    const expectedCloseDate = new Date('2026-08-31T12:00:00.000Z');

    const existing = await prisma.lead.findFirst({ where: { name: card.name } });
    const leadData = {
      name: card.name,
      stageId: stage.id,
      priorityId: priority?.id ?? null,
      projectTypeId: projectType?.id ?? null,
      dealSizeId: dealSize?.id ?? null,
      sourceId: rawPartnerName ? indicationSource.id : null,
      partnerId: partner?.id ?? null,
      successProbability: probability(card.desc),
      expectedCloseDate,
      ownerId: owner.id,
      description: card.desc.trim() || null,
      status,
      lossReason: status === 'LOST' ? 'Importado da etapa Perdidos do Trello.' : null,
    };

    const lead = existing
      ? await prisma.lead.update({ where: { id: existing.id }, data: leadData })
      : await prisma.lead.create({ data: leadData });
    await prisma.leadProjectType.deleteMany({ where: { leadId: lead.id } });
    if (projectType) {
      await prisma.leadProjectType.create({
        data: { leadId: lead.id, projectTypeId: projectType.id },
      });
    }
    existing ? updated++ : created++;

    await prisma.leadAssignee.deleteMany({ where: { leadId: lead.id } });
    const assigneesToSave = uniqueAssignees.length ? uniqueAssignees : [owner];
    await prisma.leadAssignee.createMany({
      data: assigneesToSave.map((user) => ({
        leadId: lead.id,
        userId: user.id,
        assignedBy: bruno.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    JSON.stringify(
      {
        imported: activeCards.length,
        created,
        updated,
        ignoredArchivedCards: board.cards.filter((card) => card.closed).length,
        ignoredSeparators: board.cards.filter((card) => /^\++$/.test(card.name.trim())).length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
