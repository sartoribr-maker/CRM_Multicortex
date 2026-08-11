ALTER TABLE "leads"
ADD COLUMN "capexValue" DECIMAL(14,2),
ADD COLUMN "opexValue" DECIMAL(14,2);

-- Valores históricos eram parcelas únicas e passam a representar CAPEX.
UPDATE "leads"
SET "capexValue" = "estimatedValue",
    "opexValue" = 0
WHERE "estimatedValue" IS NOT NULL;
