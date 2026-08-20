WITH numbered AS (
  SELECT
    "id",
    "line",
    nextval('lead_business_code_seq')::int AS sequence_value
  FROM "leads"
  WHERE "line" IS NOT NULL AND "businessCode" IS NULL
  ORDER BY "createdAt", "id"
)
UPDATE "leads" AS lead
SET "businessCode" =
  CASE numbered."line"
    WHEN 'ENTERPRISE' THEN 'ENT'
    WHEN 'PRIVACY' THEN 'PRI'
    WHEN 'MIX' THEN 'MIX'
  END || lpad(numbered.sequence_value::text, 5, '0')
FROM numbered
WHERE lead."id" = numbered."id";
