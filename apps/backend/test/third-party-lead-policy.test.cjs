const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const {
  assertThirdPartyLeadPayload,
  assertThirdPartyStageMove,
  sanitizeLeadForThirdParty,
} = require('../dist/src/sdr-portal/third-party-lead.policy');

const lead = {
  id: 'lead',
  name: 'Oportunidade',
  capexValue: '1000',
  opexValue: '100',
  estimatedValue: '2200',
  technicalServiceValue: '300',
  successProbability: 50,
  partner: { id: 'p1', name: 'Parceiro', commissionPercentage: '10', document: '123' },
  technicalPartner: null,
};

test('remove valores financeiros e reduz parceiros quando ocultos', () => {
  const result = sanitizeLeadForThirdParty(lead, { hideFinancialValues: true });
  for (const field of ['capexValue', 'opexValue', 'estimatedValue', 'technicalServiceValue', 'successProbability']) {
    assert.equal(field in result, false, field);
  }
  assert.deepEqual(result.partner, { id: 'p1', name: 'Parceiro' });
  assert.equal(result.technicalPartner, null);
  assert.equal(lead.capexValue, '1000', 'não altera o objeto original');
  assert.equal(JSON.stringify(result).includes('2200'), false);
});

test('mantém valores quando a ocultação está desligada, mas reduz parceiros', () => {
  const result = sanitizeLeadForThirdParty(lead, { hideFinancialValues: false });
  assert.equal(result.estimatedValue, '2200');
  assert.deepEqual(result.partner, { id: 'p1', name: 'Parceiro' });
});

test('aceita somente campos de prospecção', () => {
  const hidden = { hideFinancialValues: true };
  assert.doesNotThrow(() =>
    assertThirdPartyLeadPayload({ line: 'ENTERPRISE', name: 'X', companyName: 'Y', undefinedField: undefined }, 'create', hidden),
  );
  assert.doesNotThrow(() =>
    assertThirdPartyLeadPayload({ stageId: 's', actionDescription: 'Ligação', createTask: true }, 'update', hidden),
  );
  for (const field of ['ownerIds', 'ownerId', 'partnerId', 'technicalPartnerId', 'technicalServiceValue', 'sourceId', 'capexValue', 'siteSubmissionId']) {
    assert.throws(
      () => assertThirdPartyLeadPayload({ name: 'X', [field]: field === 'ownerIds' ? ['u'] : 'v' }, 'update', hidden),
      (error) => error instanceof ForbiddenException && error.message.includes(field),
      field,
    );
  }
  assert.throws(() => assertThirdPartyLeadPayload({ stageId: 's' }, 'create', hidden), ForbiddenException);
  assert.doesNotThrow(() =>
    assertThirdPartyLeadPayload({ capexValue: 10 }, 'update', { hideFinancialValues: false }),
  );
});

test('bloqueia mover para etapa não permitida', () => {
  const settings = { allowedTargetStageIds: ['qualificada', 'perdido'] };
  assert.doesNotThrow(() => assertThirdPartyStageMove('qualificada', settings));
  assert.throws(() => assertThirdPartyStageMove('proposta', settings), /Etapa de destino não permitida/);
});
