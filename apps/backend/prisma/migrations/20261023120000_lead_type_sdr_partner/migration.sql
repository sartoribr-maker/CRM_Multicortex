-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "leadType" "LeadType";

-- AlterTable
ALTER TABLE "sdr_portal_settings" ADD COLUMN     "sdrPartnerId" TEXT;

-- CreateIndex
CREATE INDEX "leads_leadType_idx" ON "leads"("leadType");

-- Parceiro comercial "SDR": reaproveita o existente ou cria. O nome é usado
-- somente aqui; depois o portal trabalha com o ID salvo na configuração.
INSERT INTO "partners" ("id", "name", "type", "status", "notes", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'SDR', 'CHANNEL', 'ACTIVE', 'Equipe de SDR (Portal de Terceiros)', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "partners" WHERE "deletedAt" IS NULL AND lower(trim("name")) = 'sdr'
);

UPDATE "sdr_portal_settings"
SET "sdrPartnerId" = (
  SELECT "id" FROM "partners"
  WHERE "deletedAt" IS NULL AND lower(trim("name")) = 'sdr'
  ORDER BY "createdAt" LIMIT 1
)
WHERE "id" = 'default' AND "sdrPartnerId" IS NULL;

-- Leads já recebidos do site: Inbound e, se ainda sem parceiro, parceiro SDR.
UPDATE "leads" l
SET "leadType" = 'INBOUND',
    "partnerId" = coalesce(l."partnerId", s."sdrPartnerId")
FROM "sdr_portal_settings" s
WHERE s."id" = 'default' AND l."siteSubmissionId" IS NOT NULL;

-- Leads já criados por usuários do Portal de Terceiros: Outbound e parceiro SDR.
UPDATE "leads" l
SET "leadType" = 'OUTBOUND',
    "partnerId" = coalesce(l."partnerId", s."sdrPartnerId")
FROM "sdr_portal_settings" s, "users" u, "roles" r
WHERE s."id" = 'default'
  AND l."siteSubmissionId" IS NULL
  AND u."id" = l."createdBy"
  AND r."id" = u."roleId"
  AND r."portal" = 'THIRD_PARTY';
