import { BadRequestException } from '@nestjs/common';

// Brasília (UTC−03:00) sem horário de verão, como no monitoramento.
const BRT_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
const MAX_CUSTOM_RANGE_DAYS = 366;
const DAILY_BUCKET_LIMIT_DAYS = 62;

export type SdrPeriod = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: Date;
  /** Exclusivo. */
  end: Date;
}

/** Instante UTC da meia-noite (Brasília) do dia em que `date` cai em Brasília. */
export function brasiliaDayStart(date: Date): Date {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BRT_OFFSET_MS,
  );
}

function parseBrasiliaDate(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00-03:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Data inválida em "${field}". Use o formato AAAA-MM-DD.`);
  }
  return date;
}

export function resolvePeriod(
  period: SdrPeriod,
  now: Date,
  from?: string,
  to?: string,
): DateRange {
  const todayStart = brasiliaDayStart(now);
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  switch (period) {
    case 'today':
      return { start: todayStart, end: new Date(todayStart.getTime() + DAY_MS) };
    case 'week': {
      // Semana começa na segunda-feira.
      const daysSinceMonday = (local.getUTCDay() + 6) % 7;
      const start = new Date(todayStart.getTime() - daysSinceMonday * DAY_MS);
      return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
    }
    case 'month': {
      const year = local.getUTCFullYear();
      const month = local.getUTCMonth();
      return {
        start: new Date(Date.UTC(year, month, 1) + BRT_OFFSET_MS),
        end: new Date(Date.UTC(year, month + 1, 1) + BRT_OFFSET_MS),
      };
    }
    case 'custom': {
      if (!from || !to) {
        throw new BadRequestException('Informe as datas inicial e final do período.');
      }
      const start = parseBrasiliaDate(from, 'from');
      const end = new Date(parseBrasiliaDate(to, 'to').getTime() + DAY_MS);
      if (end <= start) {
        throw new BadRequestException('A data final deve ser igual ou posterior à inicial.');
      }
      if (end.getTime() - start.getTime() > MAX_CUSTOM_RANGE_DAYS * DAY_MS) {
        throw new BadRequestException(`O período pode ter no máximo ${MAX_CUSTOM_RANGE_DAYS} dias.`);
      }
      return { start, end };
    }
  }
}

export interface TimelineBucket {
  start: Date;
  label: string;
  created: number;
  qualified: number;
}

function bucketLabel(date: Date): string {
  const local = new Date(date.getTime() - BRT_OFFSET_MS);
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function buildTimeline(range: DateRange): {
  granularity: 'day' | 'week';
  buckets: TimelineBucket[];
} {
  const days = Math.ceil((range.end.getTime() - range.start.getTime()) / DAY_MS);
  const granularity = days > DAILY_BUCKET_LIMIT_DAYS ? 'week' : 'day';
  const step = granularity === 'week' ? 7 * DAY_MS : DAY_MS;
  const buckets: TimelineBucket[] = [];
  for (let time = range.start.getTime(); time < range.end.getTime(); time += step) {
    const start = new Date(time);
    buckets.push({ start, label: bucketLabel(start), created: 0, qualified: 0 });
  }
  return { granularity, buckets };
}

function bucketFor(buckets: TimelineBucket[], date: Date): TimelineBucket | undefined {
  for (let index = buckets.length - 1; index >= 0; index--) {
    if (buckets[index].start <= date) return buckets[index];
  }
  return undefined;
}

export interface SummaryStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

export type SummaryLeadType = 'INBOUND' | 'OUTBOUND' | null;

export interface SummaryLead {
  id: string;
  leadType?: SummaryLeadType;
  name: string;
  businessCode: string | null;
  companyName: string | null;
  stageId: string;
  stageEnteredAt: Date;
  priority: { id: string; name: string; color: string; order: number } | null;
}

export interface SdrSummaryInput {
  now: Date;
  range: DateRange;
  staleDays: number;
  visibleStages: SummaryStage[];
  /** Leads criados no período. */
  createdLeads: Array<{ id: string; createdAt: Date; leadType?: SummaryLeadType }>;
  /** Entradas na etapa qualificada no período. */
  qualifications: Array<{ leadId: string; createdAt: Date; leadType?: SummaryLeadType }>;
  /** Movimentações para etapas de perda no período. */
  disqualifications: Array<{ leadId: string; lossReason: string | null; leadType?: SummaryLeadType }>;
  /** Leads abertos do SDR em etapas visíveis. */
  activeLeads: SummaryLead[];
  /** Saídas de etapas visíveis no período, nos leads do SDR. */
  stageDurations: Array<{ fromStageId: string; seconds: number }>;
}

const ATTENTION_LIMIT = 6;

export function computeSdrSummary(input: SdrSummaryInput) {
  const { buckets, granularity } = buildTimeline(input.range);
  for (const lead of input.createdLeads) {
    const bucket = bucketFor(buckets, lead.createdAt);
    if (bucket) bucket.created++;
  }

  // Cada lead conta uma única vez como qualificado no período.
  const firstQualification = new Map<string, Date>();
  for (const entry of input.qualifications) {
    const current = firstQualification.get(entry.leadId);
    if (!current || entry.createdAt < current) firstQualification.set(entry.leadId, entry.createdAt);
  }
  for (const date of firstQualification.values()) {
    const bucket = bucketFor(buckets, date);
    if (bucket) bucket.qualified++;
  }

  const disqualifiedLeads = new Map<string, string | null>();
  for (const entry of input.disqualifications) disqualifiedLeads.set(entry.leadId, entry.lossReason);
  const reasons = new Map<string, { reason: string; count: number }>();
  for (const reason of disqualifiedLeads.values()) {
    const text = reason?.trim() || 'Não informado';
    const key = text.toLocaleLowerCase('pt-BR');
    const current = reasons.get(key) ?? { reason: text, count: 0 };
    current.count++;
    reasons.set(key, current);
  }

  const staleLimit = input.now.getTime() - input.staleDays * DAY_MS;
  const staleLeads = input.activeLeads
    .filter((lead) => lead.stageEnteredAt.getTime() < staleLimit)
    .sort((a, b) => a.stageEnteredAt.getTime() - b.stageEnteredAt.getTime());
  const highPriorityLeads = input.activeLeads
    .filter((lead) => lead.priority)
    .sort(
      (a, b) =>
        b.priority!.order - a.priority!.order ||
        a.stageEnteredAt.getTime() - b.stageEnteredAt.getTime(),
    );

  const durations = new Map<string, { total: number; samples: number }>();
  for (const entry of input.stageDurations) {
    const current = durations.get(entry.fromStageId) ?? { total: 0, samples: 0 };
    current.total += entry.seconds;
    current.samples++;
    durations.set(entry.fromStageId, current);
  }

  const created = input.createdLeads.length;
  const qualified = firstQualification.size;

  // Mesmos indicadores separados por tipo de lead (Inbound, Outbound e sem tipo).
  const typeOf = new Map<string, SummaryLeadType>();
  for (const entry of input.qualifications) typeOf.set(entry.leadId, entry.leadType ?? null);
  const disqualifiedTypes = new Map<string, SummaryLeadType>();
  for (const entry of input.disqualifications) {
    disqualifiedTypes.set(entry.leadId, entry.leadType ?? null);
  }
  const byLeadType = (['INBOUND', 'OUTBOUND', null] as SummaryLeadType[])
    .map((leadType) => {
      const matches = (value?: SummaryLeadType) => (value ?? null) === leadType;
      const typeCreated = input.createdLeads.filter((lead) => matches(lead.leadType)).length;
      const typeQualified = [...firstQualification.keys()].filter((id) =>
        matches(typeOf.get(id)),
      ).length;
      return {
        leadType,
        created: typeCreated,
        qualified: typeQualified,
        qualificationRate: typeCreated ? (typeQualified / typeCreated) * 100 : null,
        disqualified: [...disqualifiedTypes.values()].filter(matches).length,
        active: input.activeLeads.filter((lead) => matches(lead.leadType)).length,
        stale: staleLeads.filter((lead) => matches(lead.leadType)).length,
      };
    })
    // "Sem tipo" só aparece quando há algum lead nessa situação.
    .filter(
      (row) =>
        row.leadType !== null ||
        row.created + row.qualified + row.disqualified + row.active > 0,
    );
  const toAttentionItem = (lead: SummaryLead) => ({
    ...lead,
    daysInStage: Math.floor((input.now.getTime() - lead.stageEnteredAt.getTime()) / DAY_MS),
  });

  return {
    period: { start: input.range.start, end: input.range.end, granularity },
    metrics: {
      created,
      qualified,
      qualificationRate: created ? (qualified / created) * 100 : null,
      disqualified: disqualifiedLeads.size,
      activePortfolio: input.activeLeads.length,
      stale: staleLeads.length,
      staleDays: input.staleDays,
    },
    byLeadType,
    lossReasons: [...reasons.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    funnel: input.visibleStages.map((stage) => ({
      ...stage,
      count: input.activeLeads.filter((lead) => lead.stageId === stage.id).length,
    })),
    averageDaysPerStage: input.visibleStages.map((stage) => {
      const duration = durations.get(stage.id);
      return {
        ...stage,
        averageDays: duration ? duration.total / duration.samples / 86_400 : null,
        samples: duration?.samples ?? 0,
      };
    }),
    timeline: buckets,
    attention: {
      stale: staleLeads.slice(0, ATTENTION_LIMIT).map(toAttentionItem),
      highPriority: highPriorityLeads.slice(0, ATTENTION_LIMIT).map(toAttentionItem),
    },
  };
}
