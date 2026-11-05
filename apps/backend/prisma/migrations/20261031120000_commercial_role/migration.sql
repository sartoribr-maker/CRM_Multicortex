-- Permissões novas: exclusão restrita ao criador, leads Mandatórios e todas as etapas.
INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'leads.delete.own', 'leads', 'Excluir apenas os leads criados pelo próprio usuário', now(), now()),
  (gen_random_uuid()::text, 'leads.view.mandatory', 'leads', 'Visualizar leads com prioridade Mandatória', now(), now()),
  (gen_random_uuid()::text, 'partners.delete.own', 'partners', 'Excluir apenas os parceiros criados pelo próprio usuário', now(), now()),
  (gen_random_uuid()::text, 'tasks.delete.own', 'tasks', 'Excluir apenas as tarefas criadas pelo próprio usuário', now(), now()),
  (gen_random_uuid()::text, 'stages.view.all', 'stages', 'Ver todas as etapas do funil, inclusive as ocultas no CRM e fora do Portal SDR', now(), now())
ON CONFLICT ("key") DO NOTHING;

-- Até aqui todos os perfis viam leads Mandatórios: mantém o comportamento atual.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."key" = 'leads.view.mandatory'
WHERE r."deletedAt" IS NULL
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."key" IN ('leads.delete.own', 'partners.delete.own', 'tasks.delete.own')
WHERE r."name" = 'Administrador'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Perfil de sistema Comercial: CRM interno sem Configurações/Usuários, acessos do SDR,
-- todas as etapas, sem leads Mandatórios e exclusão só do que criou.
INSERT INTO "roles" ("id", "name", "description", "isSystem", "portal", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Comercial', 'Equipe comercial: menus do CRM e Portal SDR, todas as etapas, sem leads Mandatórios; exclui só o que criou.', true, 'INTERNAL', now(), now())
ON CONFLICT ("name") DO UPDATE SET "portal" = 'INTERNAL', "isSystem" = true;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."key" IN (
  'leads.view', 'leads.view.all', 'leads.create', 'leads.edit', 'leads.delete.own',
  'partners.view', 'partners.create', 'partners.edit', 'partners.delete.own',
  'tasks.view', 'tasks.view.all', 'tasks.create', 'tasks.edit', 'tasks.delete.own',
  'dashboard.view', 'portal.sdr.access', 'stages.view.all'
)
WHERE r."name" = 'Comercial'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
