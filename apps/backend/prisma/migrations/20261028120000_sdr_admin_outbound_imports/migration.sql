-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "outboundImportId" TEXT;

-- AlterTable
ALTER TABLE "lead_import_blacklist" ADD COLUMN     "importId" TEXT;

-- CreateTable
CREATE TABLE "outbound_imports" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "outbound_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_outboundImportId_idx" ON "leads"("outboundImportId");

-- CreateIndex
CREATE INDEX "lead_import_blacklist_importId_idx" ON "lead_import_blacklist"("importId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_outboundImportId_fkey" FOREIGN KEY ("outboundImportId") REFERENCES "outbound_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_blacklist" ADD CONSTRAINT "lead_import_blacklist_importId_fkey" FOREIGN KEY ("importId") REFERENCES "outbound_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Importações já feitas: um lote por arquivo, a partir da blacklist.
INSERT INTO "outbound_imports" ("id", "fileName", "createdAt", "createdBy")
SELECT
  gen_random_uuid()::text,
  b."fileName",
  min(b."createdAt"),
  (array_agg(b."createdBy" ORDER BY b."createdAt"))[1]
FROM "lead_import_blacklist" b
WHERE b."fileName" IS NOT NULL
GROUP BY b."fileName";

UPDATE "lead_import_blacklist" b
SET "importId" = i."id"
FROM "outbound_imports" i
WHERE b."fileName" = i."fileName";

UPDATE "leads" l
SET "outboundImportId" = b."importId"
FROM "lead_import_blacklist" b
WHERE b."leadId" = l."id" AND b."importId" IS NOT NULL;

-- Permissão de importar (e excluir importações) Outbound no Portal SDR.
INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'portal.sdr.import', 'portal', 'Importar e excluir leads Outbound no Portal de Terceiros (SDR)', now(), now())
ON CONFLICT ("key") DO NOTHING;

-- Perfil de sistema SDR Admin: SDR confinado ao portal que também importa.
INSERT INTO "roles" ("id", "name", "description", "isSystem", "portal", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'SDR Admin', 'SDR com importação de leads Outbound: acesso exclusivo ao Portal de Terceiros.', true, 'THIRD_PARTY', now(), now())
ON CONFLICT ("name") DO UPDATE SET "portal" = 'THIRD_PARTY', "isSystem" = true;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."key" IN (
  'portal.sdr.access', 'portal.sdr.import', 'leads.view', 'leads.create', 'leads.edit', 'tasks.view', 'tasks.edit'
)
WHERE r."name" = 'SDR Admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid()::text, r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."key" = 'portal.sdr.import'
WHERE r."name" = 'Administrador'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
