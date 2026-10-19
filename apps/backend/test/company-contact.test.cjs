const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CompanyContactService } = require('../dist/src/companies/company-contact.service');
const { normalizeName } = require('../dist/src/companies/company-contact.normalize');

function fakeTx() {
  const companies = [];
  const contacts = [];
  let seq = 0;
  const matches = (row, where) =>
    Object.entries(where).every(([key, value]) => (row[key] ?? null) === value);
  return {
    companies,
    contacts,
    async $executeRaw(_strings, name, normalizedName, document, segment, createdBy) {
      if (companies.some((c) => c.normalizedName === normalizedName)) return 0;
      companies.push({ id: `co${++seq}`, name, normalizedName, document, segment, createdBy });
      return 1;
    },
    company: {
      findUniqueOrThrow: async ({ where }) => ({ ...companies.find((c) => matches(c, where)) }),
      update: async ({ where, data }) => Object.assign(companies.find((c) => c.id === where.id), data),
    },
    contact: {
      findFirst: async ({ where }) => {
        const row = contacts.find((c) => matches(c, where));
        return row ? { ...row } : null;
      },
      create: async ({ data }) => {
        const row = { id: `ct${++seq}`, deletedAt: null, ...data };
        contacts.push(row);
        return row;
      },
      update: async ({ where, data }) => Object.assign(contacts.find((c) => c.id === where.id), data),
    },
  };
}

const service = new CompanyContactService({});

test('normalização de nomes', () => {
  assert.equal(normalizeName('  Empresa   Teste  MASCOTE '), 'empresa teste mascote');
});

test('grava empresa e contato novos ao salvar o lead', async () => {
  const tx = fakeTx();
  const result = await service.syncForLead(
    tx,
    { companyName: ' Nova  Empresa ', companyDocument: '12.345', contactName: 'Ana', contactEmail: 'Ana@X.com' },
    'u1',
  );
  assert.equal(tx.companies.length, 1);
  assert.equal(tx.companies[0].name, 'Nova Empresa');
  assert.equal(tx.contacts.length, 1);
  assert.equal(tx.contacts[0].normalizedEmail, 'ana@x.com');
  assert.equal(tx.contacts[0].companyId, result.companyId);
  assert.equal(result.contactId, tx.contacts[0].id);
});

test('reaproveita empresa existente e só completa dados ausentes', async () => {
  const tx = fakeTx();
  await service.syncForLead(tx, { companyName: 'ACME', companySegment: 'Saúde' }, 'u1');
  const again = await service.syncForLead(
    tx,
    { companyName: '  acme ', companyDocument: '99', companySegment: 'Outro' },
    'u2',
  );
  assert.equal(tx.companies.length, 1);
  assert.equal(again.companyId, tx.companies[0].id);
  assert.equal(tx.companies[0].document, '99', 'documento ausente é preenchido');
  assert.equal(tx.companies[0].segment, 'Saúde', 'segmento existente não é sobrescrito');
});

test('contato: mesmo e-mail e nome; sem e-mail, por nome dentro da empresa', async () => {
  const tx = fakeTx();
  await service.syncForLead(tx, { contactName: 'Roberto', contactEmail: 'r@x.com' }, 'u1');
  await service.syncForLead(tx, { contactName: ' roberto ', contactEmail: 'R@X.COM', contactPhone: '1199' }, 'u1');
  assert.equal(tx.contacts.length, 1, 'mesmo e-mail e nome é o mesmo contato');
  assert.equal(tx.contacts[0].phone, '1199', 'telefone ausente é preenchido');
  const other = await service.syncForLead(tx, { contactName: 'João', contactEmail: 'r@x.com' }, 'u1');
  assert.equal(tx.contacts.length, 2, 'outro nome com o mesmo e-mail é outro contato');
  assert.equal(tx.contacts[1].name, 'João');
  assert.equal(other.contactId, tx.contacts[1].id);

  await service.syncForLead(tx, { companyName: 'VIVARA', contactName: 'Paulo' }, 'u1');
  await service.syncForLead(tx, { companyName: 'vivara', contactName: ' paulo ' }, 'u1');
  await service.syncForLead(tx, { companyName: 'SCALA', contactName: 'Paulo' }, 'u1');
  assert.equal(tx.contacts.filter((c) => c.normalizedName === 'paulo').length, 2, 'Paulo por empresa');
});

test('sem empresa ou contato não grava nada', async () => {
  const tx = fakeTx();
  const result = await service.syncForLead(tx, { companyName: '  ', contactName: null }, 'u1');
  assert.deepEqual(result, { companyId: null, contactId: null });
  assert.equal(tx.companies.length + tx.contacts.length, 0);
});
