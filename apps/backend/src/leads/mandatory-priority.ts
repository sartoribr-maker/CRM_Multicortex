import type { Prisma, PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtPayload } from '../auth/types/jwt-payload.interface';

type PriorityReader = Pick<PrismaClient, 'priority'>;
type LeadReader = Pick<PrismaClient, 'priority' | 'lead'>;

export function normalizePriorityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function isMandatoryPriorityName(name: string | null | undefined): boolean {
  return !!name && normalizePriorityName(name) === 'mandatoria';
}

export function canViewMandatoryLeads(user: Pick<JwtPayload, 'permissions'>): boolean {
  return user.permissions.includes(PERMISSIONS.LEADS_VIEW_MANDATORY);
}

/** IDs das prioridades "Mandatória" (comparação sem acento e sem caixa). */
export async function mandatoryPriorityIds(prisma: PriorityReader): Promise<string[]> {
  const priorities = await prisma.priority.findMany({ select: { id: true, name: true } });
  return priorities.filter((priority) => isMandatoryPriorityName(priority.name)).map((p) => p.id);
}

/**
 * Filtro de leads para quem não tem "leads.view.mandatory": esconde os leads
 * com prioridade Mandatória. Para os demais usuários, não restringe nada.
 */
export async function mandatoryLeadFilter(
  prisma: PriorityReader,
  user: Pick<JwtPayload, 'permissions'>,
): Promise<Prisma.LeadWhereInput> {
  if (canViewMandatoryLeads(user)) return {};
  const ids = await mandatoryPriorityIds(prisma);
  if (ids.length === 0) return {};
  return { OR: [{ priorityId: null }, { priorityId: { notIn: ids } }] };
}

/** Tarefas vinculadas a leads Mandatórios ficam ocultas para quem não vê esses leads. */
export async function mandatoryTaskFilter(
  prisma: PriorityReader,
  user: Pick<JwtPayload, 'permissions'>,
): Promise<Prisma.TaskWhereInput> {
  if (canViewMandatoryLeads(user)) return {};
  const ids = await mandatoryPriorityIds(prisma);
  if (ids.length === 0) return {};
  return {
    OR: [
      { leadId: null },
      { lead: { priorityId: null } },
      { lead: { priorityId: { notIn: ids } } },
    ],
  };
}

/**
 * IDs dos leads Mandatórios que o usuário não pode ver (as tarefas desses leads ficam ocultas).
 * As tarefas moram no PMO, que não conhece prioridades de lead: o CRM manda a lista.
 */
export async function hiddenMandatoryLeadIds(
  prisma: LeadReader,
  user: Pick<JwtPayload, 'permissions'>,
): Promise<string[] | undefined> {
  if (canViewMandatoryLeads(user)) return undefined;
  const ids = await mandatoryPriorityIds(prisma);
  if (!ids.length) return undefined;
  const leads = await prisma.lead.findMany({
    where: { priorityId: { in: ids } },
    select: { id: true },
  });
  return leads.map((lead) => lead.id);
}
