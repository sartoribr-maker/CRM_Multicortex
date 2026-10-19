-- Dados do Portal de Terceiros (SDR). O seed não roda em produção, então
-- tudo que precisa existir lá é criado aqui de forma idempotente.

-- Permissão de acesso ao portal.
INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'portal.sdr.access', 'portal', 'Acessar o Portal de Terceiros (SDR)', now(), now())
ON CONFLICT ("key") DO NOTHING;

-- Perfil de sistema SDR, confinado ao portal.
INSERT INTO "roles" ("id", "name", "description", "isSystem", "portal", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'SDR', 'Pré-vendas terceirizado: acesso exclusivo ao Portal de Terceiros.', true, 'THIRD_PARTY', now(), now())
ON CONFLICT ("name") DO UPDATE SET "portal" = 'THIRD_PARTY', "isSystem" = true;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."key" IN (
  'portal.sdr.access', 'leads.view', 'leads.create', 'leads.edit', 'tasks.view', 'tasks.edit'
)
WHERE r."name" = 'SDR'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Administrador pode visualizar o portal para suporte e homologação.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."key" = 'portal.sdr.access'
WHERE r."name" = 'Administrador'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Origem aplicada aos leads criados pelo SDR.
INSERT INTO "sources" ("id", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'SDR – Prospecção ativa', 'Leads criados pela equipe terceirizada de SDR', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "sources" WHERE "name" = 'SDR – Prospecção ativa' AND "deletedAt" IS NULL);

-- Configuração inicial. As etapas são resolvidas por nome somente aqui;
-- daqui em diante o portal trabalha apenas com IDs.
INSERT INTO "sdr_portal_settings" (
  "id", "visibleStageIds", "allowedTargetStageIds", "qualifiedStageId", "defaultSourceId",
  "hideFinancialValues", "staleDays", "updatedAt"
)
SELECT
  'default',
  ARRAY(
    SELECT "id" FROM "stages"
    WHERE "deletedAt" IS NULL
      AND lower(trim("name")) IN ('backlog', 'leads', 'contato/qualificação', 'diagnóstico/reunião')
    ORDER BY "order", "createdAt"
  ),
  ARRAY(
    SELECT "id" FROM "stages"
    WHERE "deletedAt" IS NULL
      AND lower(trim("name")) IN ('backlog', 'leads', 'contato/qualificação', 'diagnóstico/reunião', 'perdido')
    ORDER BY "order", "createdAt"
  ),
  (
    SELECT "id" FROM "stages"
    WHERE "deletedAt" IS NULL AND lower(trim("name")) = 'diagnóstico/reunião'
    ORDER BY "order", "createdAt" LIMIT 1
  ),
  (
    SELECT "id" FROM "sources"
    WHERE "deletedAt" IS NULL AND "name" = 'SDR – Prospecção ativa'
    ORDER BY "createdAt" LIMIT 1
  ),
  true,
  7,
  now()
ON CONFLICT ("id") DO NOTHING;
