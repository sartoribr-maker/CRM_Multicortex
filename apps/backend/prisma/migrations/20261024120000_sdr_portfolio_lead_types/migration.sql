-- Carteira do Portal SDR e classificação Inbound/Outbound dos leads existentes.
-- Etapas e parceiro vêm da configuração do portal; as origens são resolvidas
-- por nome somente nesta migration.

-- 1) Leads abertos nas etapas do portal que não vieram do site: parceiro SDR e
--    Outbound. A linha do tempo registra o parceiro anterior.
WITH settings AS (
  SELECT "visibleStageIds", "sdrPartnerId"
  FROM "sdr_portal_settings"
  WHERE "id" = 'default' AND "sdrPartnerId" IS NOT NULL
),
target AS (
  SELECT l."id", l."partnerId" AS previous_partner_id, s."sdrPartnerId"
  FROM "leads" l
  CROSS JOIN settings s
  LEFT JOIN "sources" so ON so."id" = l."sourceId"
  WHERE l."deletedAt" IS NULL
    AND l."stageId" = ANY(s."visibleStageIds")
    AND l."siteSubmissionId" IS NULL
    AND (so."name" IS NULL OR lower(trim(so."name")) <> 'site')
),
logged AS (
  INSERT INTO "lead_activities" ("id", "leadId", "type", "message", "metadata", "createdAt")
  SELECT
    gen_random_uuid()::text,
    t."id",
    'FIELD_UPDATED',
    CASE
      WHEN previous."name" IS NULL
        THEN 'Parceiro comercial definido como "' || sdr."name" || '" e tipo de lead como Outbound (carteira do Portal SDR).'
      ELSE 'Parceiro comercial alterado de "' || previous."name" || '" para "' || sdr."name" || '" e tipo de lead definido como Outbound (carteira do Portal SDR).'
    END,
    jsonb_build_object('previousPartnerId', t.previous_partner_id, 'previousPartnerName', previous."name"),
    now()
  FROM target t
  JOIN "partners" sdr ON sdr."id" = t."sdrPartnerId"
  LEFT JOIN "partners" previous ON previous."id" = t.previous_partner_id
  WHERE t.previous_partner_id IS DISTINCT FROM t."sdrPartnerId"
  RETURNING 1
)
UPDATE "leads" l
SET "leadType" = 'OUTBOUND', "partnerId" = t."sdrPartnerId"
FROM target t
WHERE l."id" = t."id";

-- 2) Leads do site nas etapas do portal: Inbound (parceiro SDR se ainda sem parceiro).
UPDATE "leads" l
SET "leadType" = 'INBOUND', "partnerId" = coalesce(l."partnerId", s."sdrPartnerId")
FROM "sdr_portal_settings" s
WHERE s."id" = 'default'
  AND l."deletedAt" IS NULL
  AND l."stageId" = ANY(s."visibleStageIds")
  AND (
    l."siteSubmissionId" IS NOT NULL
    OR l."sourceId" IN (SELECT "id" FROM "sources" WHERE lower(trim("name")) = 'site')
  );

-- 3) Demais leads ainda sem tipo: classificação pela origem.
UPDATE "leads" l
SET "leadType" = (
  CASE lower(trim(so."name"))
    WHEN 'outbound' THEN 'OUTBOUND'
    WHEN 'sdr – prospecção ativa' THEN 'OUTBOUND'
    ELSE 'INBOUND'
  END
)::"LeadType"
FROM "sources" so
WHERE so."id" = l."sourceId"
  AND l."leadType" IS NULL
  AND lower(trim(so."name")) IN (
    'site', 'indicação', 'parceiro', 'evento', 'outbound', 'sdr – prospecção ativa'
  );
