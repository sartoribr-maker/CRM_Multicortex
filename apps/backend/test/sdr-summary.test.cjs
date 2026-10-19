const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { resolvePeriod, buildTimeline, computeSdrSummary } = require('../dist/src/sdr-portal/sdr-summary');

const iso = (range) => [range.start.toISOString(), range.end.toISOString()];
// Segunda-feira, 19/10/2026 às 23:30 em Brasília (já é terça em UTC).
const MONDAY_NIGHT = new Date('2026-10-20T02:30:00Z');

test('períodos calculados no fuso de Brasília', () => {
  assert.deepEqual(iso(resolvePeriod('today', MONDAY_NIGHT)), ['2026-10-19T03:00:00.000Z', '2026-10-20T03:00:00.000Z']);
  assert.deepEqual(iso(resolvePeriod('week', MONDAY_NIGHT)), ['2026-10-19T03:00:00.000Z', '2026-10-26T03:00:00.000Z']);
  assert.deepEqual(
    iso(resolvePeriod('week', new Date('2026-10-25T23:00:00Z'))),
    ['2026-10-19T03:00:00.000Z', '2026-10-26T03:00:00.000Z'],
    'domingo 20h pertence à semana iniciada na segunda',
  );
  assert.deepEqual(
    iso(resolvePeriod('month', new Date('2026-11-01T02:00:00Z'))),
    ['2026-10-01T03:00:00.000Z', '2026-11-01T03:00:00.000Z'],
    '31/10 23h em Brasília ainda é outubro',
  );
  assert.deepEqual(
    iso(resolvePeriod('custom', MONDAY_NIGHT, '2026-10-01', '2026-10-15')),
    ['2026-10-01T03:00:00.000Z', '2026-10-16T03:00:00.000Z'],
  );
});

test('período personalizado inválido', () => {
  assert.throws(() => resolvePeriod('custom', MONDAY_NIGHT), BadRequestException);
  assert.throws(() => resolvePeriod('custom', MONDAY_NIGHT, '2026-10-10', '2026-10-01'), BadRequestException);
  assert.throws(() => resolvePeriod('custom', MONDAY_NIGHT, '2025-01-01', '2026-10-01'), BadRequestException);
  assert.throws(() => resolvePeriod('custom', MONDAY_NIGHT, '2026-13-01', '2026-13-02'), BadRequestException);
});

test('evolução diária até 62 dias e semanal acima disso', () => {
  const month = buildTimeline(resolvePeriod('month', MONDAY_NIGHT));
  assert.equal(month.granularity, 'day');
  assert.equal(month.buckets.length, 31);
  assert.equal(month.buckets[0].label, '01/10');
  const year = buildTimeline(resolvePeriod('custom', MONDAY_NIGHT, '2026-01-01', '2026-12-31'));
  assert.equal(year.granularity, 'week');
  assert.equal(year.buckets.length, 53);
});

test('indicadores do SDR', () => {
  const now = MONDAY_NIGHT;
  const day = 86400000;
  const range = resolvePeriod('week', now);
  const stage = (id, order) => ({ id, name: id, color: '#000', order });
  const activeLead = (id, stageId, daysAgo, priority = null) => ({
    id, name: id, businessCode: null, companyName: null, stageId,
    stageEnteredAt: new Date(now.getTime() - daysAgo * day), priority,
  });
  const urgent = { id: 'u', name: 'Urgente', color: '#f00', order: 4 };
  const low = { id: 'l', name: 'Baixa', color: '#0f0', order: 1 };
  const result = computeSdrSummary({
    now,
    range,
    staleDays: 7,
    visibleStages: [stage('backlog', 1), stage('reuniao', 2)],
    createdLeads: [
      { id: 'a', createdAt: new Date('2026-10-19T12:00:00Z') },
      { id: 'b', createdAt: new Date('2026-10-19T13:00:00Z') },
      { id: 'c', createdAt: new Date('2026-10-20T02:00:00Z') },
      { id: 'd', createdAt: new Date('2026-10-19T14:00:00Z') },
    ],
    qualifications: [
      { leadId: 'a', createdAt: new Date('2026-10-19T15:00:00Z') },
      { leadId: 'a', createdAt: new Date('2026-10-19T16:00:00Z') },
    ],
    disqualifications: [
      { leadId: 'b', lossReason: 'Sem orçamento' },
      { leadId: 'c', lossReason: ' sem orçamento ' },
      { leadId: 'd', lossReason: null },
    ],
    activeLeads: [
      activeLead('x', 'backlog', 10, low),
      activeLead('y', 'backlog', 2, urgent),
      activeLead('z', 'reuniao', 8),
    ],
    stageDurations: [
      { fromStageId: 'backlog', seconds: 2 * 86400 },
      { fromStageId: 'backlog', seconds: 4 * 86400 },
    ],
  });

  assert.equal(result.metrics.created, 4);
  assert.equal(result.metrics.qualified, 1, 'lead qualificado duas vezes conta uma');
  assert.equal(result.metrics.qualificationRate, 25);
  assert.equal(result.metrics.disqualified, 3);
  assert.deepEqual(result.lossReasons, [
    { reason: 'Sem orçamento', count: 2 },
    { reason: 'Não informado', count: 1 },
  ]);
  assert.equal(result.metrics.activePortfolio, 3);
  assert.equal(result.metrics.stale, 2);
  assert.deepEqual(result.attention.stale.map((lead) => lead.id), ['x', 'z']);
  assert.equal(result.attention.stale[0].daysInStage, 10);
  assert.deepEqual(result.attention.highPriority.map((lead) => lead.id), ['y', 'x']);
  assert.deepEqual(result.funnel.map((item) => item.count), [2, 1]);
  assert.equal(result.averageDaysPerStage[0].averageDays, 3);
  assert.equal(result.averageDaysPerStage[1].averageDays, null);
  assert.equal(result.timeline[0].created, 4, 'criações até 23h de segunda caem na segunda');
  assert.equal(result.timeline[0].qualified, 1);
});

test('taxa de qualificação sem leads criados', () => {
  const result = computeSdrSummary({
    now: MONDAY_NIGHT, range: resolvePeriod('today', MONDAY_NIGHT), staleDays: 7, visibleStages: [],
    createdLeads: [], qualifications: [], disqualifications: [], activeLeads: [], stageDurations: [],
  });
  assert.equal(result.metrics.qualificationRate, null);
});
