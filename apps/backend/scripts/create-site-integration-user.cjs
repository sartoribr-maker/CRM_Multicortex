/* eslint-disable @typescript-eslint/no-var-requires -- CommonJS CLI loads the CRM TypeScript services through ts-node. */
'use strict';
const { validate } = require('class-validator');
const { CreateUserDto } = require('../src/users/dto/create-user.dto');
const { UsersService } = require('../src/users/users.service');
const { AuditService } = require('../src/audit/audit.service');
function readConfiguration(env = process.env) {
  const email = env.CRM_INTEGRATION_EMAIL?.trim();
  const roleId = env.CRM_INTEGRATION_ROLE_ID?.trim();
  const databaseUrl = env.CRM_PROVISION_DATABASE_URL || env.DATABASE_URL;
  const name = env.CRM_INTEGRATION_NAME?.trim() || 'Integração do site';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !roleId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId) ||
      name.length < 2 || name.length > 120 || !databaseUrl) {
    throw new Error('Configuração obrigatória ausente ou inválida.');
  }
  let url;
  try { url = new URL(databaseUrl); } catch { throw new Error('Destino inválido.'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error('Destino inválido.');
  }
  return { email, roleId, name, databaseUrl };
}

function readHidden(prompt, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Execute em terminal interativo; a senha não será lida por pipe.'));
  }
  return new Promise((resolve, reject) => {
    let value = '';
    const previousRaw = Boolean(input.isRaw);
    const wasPaused = input.isPaused();
    output.write(prompt);
    function finish(error) {
      input.removeListener('data', onData);
      input.removeListener('end', onEnd);
      input.removeListener('error', onError);
      input.setRawMode(previousRaw);
      if (wasPaused) input.pause();
      output.write('\n');
      const result = value;
      value = '';
      if (error) reject(error); else resolve(result);
    }
    function onEnd() { finish(new Error('Entrada encerrada; nenhuma conta criada.')); }
    function onError() { finish(new Error('Falha na entrada oculta; nenhuma conta criada.')); }
    function onData(chunk) {
      // Ignore terminal escape sequences without displaying password input.
      // eslint-disable-next-line no-control-regex
      const text = chunk.toString('utf8').replace(/\x1b\[[0-9;]*[A-Za-z~]/g, '');
      for (const char of text) {
        if (char === '\u0003' || char === '\u0004') return finish(new Error('Operação cancelada.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') value = Array.from(value).slice(0, -1).join('');
        else if (char >= ' ') value += char;
      }
    }
    input.setRawMode(true);
    input.on('data', onData);
    input.once('end', onEnd);
    input.once('error', onError);
    input.resume();
  });
}

async function validateAccountDto(password, config) {
  const dto = Object.assign(new CreateUserDto(), {
    name: config.name, email: config.email, roleId: config.roleId,
    password, mustChangePassword: false, isCollector: false,
  });
  const errors = await validate(dto, { validationError: { target: false, value: false } });
  if (errors.length) {
    dto.password = '';
    throw new Error('Dados inválidos; a senha deve ter ao menos 8 caracteres.');
  }
  return dto;
}

async function prerequisites(db, config) {
  const role = await db.role.findUnique({ where: { id: config.roleId }, include: { permissions: { include: { permission: true } } } });
  if (!role || role.deletedAt || role.permissions.length !== 1 ||
      role.permissions[0].permission.key !== 'leads.create' || role.permissions[0].permission.deletedAt) {
    throw new Error('Papel técnico ou permissões divergentes; operação interrompida.');
  }
  const existing = await db.user.findUnique({ where: { email: config.email }, select: {
    email: true, status: true, deletedAt: true, mustChangePassword: true,
    role: { select: { id: true, name: true, permissions: { include: { permission: true } } } },
  } });
  if (existing && (existing.status !== 'ACTIVE' || existing.deletedAt || existing.mustChangePassword ||
      existing.role.id !== config.roleId || existing.role.permissions.length !== 1 ||
      existing.role.permissions[0].permission.key !== 'leads.create' || existing.role.permissions[0].permission.deletedAt)) {
    throw new Error('Conta existente divergente; nenhuma alteração realizada.');
  }
  return existing;
}

async function createAccount(db, dto, config) {
  try {
    return await db.$transaction(async tx => {
      const existing = await prerequisites(tx, config);
      if (existing) return { created: false, account: existing };
      const audit = new AuditService(tx);
      const audited = { record: params => audit.record({ ...params, metadata: {
        provisioning: 'MANUAL_CLI', requestedOperation: 'CREATE_SITE_INTEGRATION_USER',
      } }) };
      // create() does not use storage. No administrator identity is fabricated:
      // createdBy/actorUserId remain null, as supported by the CRM schema.
      const users = new UsersService(tx, audited, undefined);
      await users.create(dto, undefined);
      const account = await tx.user.findUnique({ where: { email: config.email }, select: {
        email: true, status: true, deletedAt: true, mustChangePassword: true,
        role: { select: { id: true, name: true, permissions: { include: { permission: true } } } },
      } });
      const count = await tx.user.count({ where: { email: config.email } });
      if (!account || count !== 1 || account.status !== 'ACTIVE' || account.deletedAt ||
          account.mustChangePassword || account.role.id !== config.roleId ||
          account.role.permissions.length !== 1 || account.role.permissions[0].permission.key !== 'leads.create') {
        throw new Error('Validação da conta falhou; transação revertida.');
      }
      return { created: true, account: { email: account.email, status: account.status,
        deletedAt: account.deletedAt, role: { name: account.role.name },
        mustChangePassword: account.mustChangePassword, permissions: ['leads.create'], count } };
    }, { timeout: 15000 });
  } finally { dto.password = ''; }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 1 && args[0] === '--check')) {
    throw new Error('Opção inválida. Use sem argumentos ou somente --check.');
  }
  const checkOnly = args[0] === '--check';
  if (!checkOnly && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error('Execute manualmente em terminal interativo.');
  }
  const config = readConfiguration();
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: config.databaseUrl } }, log: [] });
  let password = ''; let confirmation = ''; let dto;
  try {
    const existing = await prerequisites(db, config);
    if (existing) {
      console.log('Conta já existe; senha e papel não foram alterados.');
      console.log(JSON.stringify(existing, null, 2));
      return;
    }
    if (checkOnly) {
      console.log('Pré-requisitos OK. Conta ausente. Nenhuma escrita ou leitura de senha realizada.');
      return;
    }
    password = await readHidden('Senha da conta técnica (entrada oculta): ');
    dto = await validateAccountDto(password, config);
    confirmation = await readHidden('Confirme a senha (entrada oculta): ');
    if (password !== confirmation) throw new Error('Senhas diferentes; nenhuma conta criada.');
    password = ''; confirmation = '';
    const result = await createAccount(db, dto, config);
    console.log(result.created ? 'Conta criada com sucesso.' : 'Conta já existe; nenhuma alteração realizada.');
    console.log(JSON.stringify(result.account, null, 2));
  } finally {
    password = ''; confirmation = ''; if (dto) dto.password = '';
    await db.$disconnect();
  }
}

module.exports = { readConfiguration, readHidden, validateAccountDto, prerequisites, createAccount };
if (require.main === module) main().catch(() => {
  console.error('Operação interrompida. Verifique pré-requisitos, senha de ao menos 8 caracteres e confirmação. Nenhuma senha ou detalhe interno foi exibido.');
  process.exitCode = 1;
});
