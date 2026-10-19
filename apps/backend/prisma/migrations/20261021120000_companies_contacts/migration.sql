-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "contactId" TEXT;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "document" TEXT,
    "segment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "phone" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_normalizedName_key" ON "companies"("normalizedName");

-- CreateIndex
CREATE INDEX "contacts_normalizedEmail_idx" ON "contacts"("normalizedEmail");

-- CreateIndex
CREATE INDEX "contacts_normalizedName_companyId_idx" ON "contacts"("normalizedName", "companyId");

-- CreateIndex
CREATE INDEX "leads_companyId_idx" ON "leads"("companyId");

-- CreateIndex
CREATE INDEX "leads_contactId_idx" ON "leads"("contactId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Importa empresas e contatos dos leads existentes. A normalização (minúsculas,
-- espaços colapsados) é a mesma usada pelo backend em company-contact.normalize.ts.

WITH named AS (
  SELECT
    lower(regexp_replace(btrim("companyName"), '\s+', ' ', 'g')) AS norm,
    regexp_replace(btrim("companyName"), '\s+', ' ', 'g') AS name,
    NULLIF(btrim("companyDocument"), '') AS document,
    NULLIF(btrim("companySegment"), '') AS segment,
    "createdAt", "updatedAt", "createdBy"
  FROM "leads"
  WHERE NULLIF(btrim("companyName"), '') IS NOT NULL
)
INSERT INTO "companies" ("id", "name", "normalizedName", "document", "segment", "createdAt", "updatedAt", "createdBy")
SELECT
  gen_random_uuid()::text,
  (array_agg(name ORDER BY "updatedAt" DESC))[1],
  norm,
  (array_agg(document ORDER BY "updatedAt" DESC) FILTER (WHERE document IS NOT NULL))[1],
  (array_agg(segment ORDER BY "updatedAt" DESC) FILTER (WHERE segment IS NOT NULL))[1],
  min("createdAt"),
  now(),
  (array_agg("createdBy" ORDER BY "createdAt"))[1]
FROM named
GROUP BY norm
ON CONFLICT ("normalizedName") DO NOTHING;

UPDATE "leads" l
SET "companyId" = c."id"
FROM "companies" c
WHERE l."companyId" IS NULL
  AND NULLIF(btrim(l."companyName"), '') IS NOT NULL
  AND c."normalizedName" = lower(regexp_replace(btrim(l."companyName"), '\s+', ' ', 'g'));

-- Contato: mesmo e-mail e mesmo nome; sem e-mail, mesmo nome dentro da mesma empresa
-- (mesma regra do backend em CompanyContactService.syncContact).
WITH src AS (
  SELECT
    l."id" AS lead_id,
    regexp_replace(btrim(l."contactName"), '\s+', ' ', 'g') AS name,
    lower(regexp_replace(btrim(l."contactName"), '\s+', ' ', 'g')) AS norm,
    NULLIF(btrim(l."contactEmail"), '') AS email,
    lower(NULLIF(btrim(l."contactEmail"), '')) AS norm_email,
    NULLIF(btrim(l."contactPhone"), '') AS phone,
    l."companyId", l."createdAt", l."updatedAt", l."createdBy"
  FROM "leads" l
  WHERE NULLIF(btrim(l."contactName"), '') IS NOT NULL
),
keyed AS (
  SELECT src.*,
    CASE
      WHEN norm_email IS NOT NULL THEN 'email:' || norm_email || '|' || norm
      ELSE 'nome:' || norm || '|' || coalesce("companyId", '')
    END AS k
  FROM src
),
grouped AS (
  SELECT
    k,
    gen_random_uuid()::text AS id,
    (array_agg(name ORDER BY "updatedAt" DESC))[1] AS name,
    (array_agg(norm ORDER BY "updatedAt" DESC))[1] AS norm,
    (array_agg(email ORDER BY "updatedAt" DESC) FILTER (WHERE email IS NOT NULL))[1] AS email,
    (array_agg(norm_email ORDER BY "updatedAt" DESC) FILTER (WHERE norm_email IS NOT NULL))[1] AS norm_email,
    (array_agg(phone ORDER BY "updatedAt" DESC) FILTER (WHERE phone IS NOT NULL))[1] AS phone,
    (array_agg("companyId" ORDER BY "updatedAt" DESC) FILTER (WHERE "companyId" IS NOT NULL))[1] AS company_id,
    min("createdAt") AS created_at,
    (array_agg("createdBy" ORDER BY "createdAt"))[1] AS created_by
  FROM keyed
  GROUP BY k
),
inserted AS (
  INSERT INTO "contacts" (
    "id", "name", "normalizedName", "email", "normalizedEmail", "phone", "companyId",
    "createdAt", "updatedAt", "createdBy"
  )
  SELECT id, name, norm, email, norm_email, phone, company_id, created_at, now(), created_by
  FROM grouped
  RETURNING "id"
)
UPDATE "leads" l
SET "contactId" = g.id
FROM keyed kd
JOIN grouped g ON g.k = kd.k
WHERE l."id" = kd.lead_id
  AND l."contactId" IS NULL
  AND EXISTS (SELECT 1 FROM inserted i WHERE i."id" = g.id);
