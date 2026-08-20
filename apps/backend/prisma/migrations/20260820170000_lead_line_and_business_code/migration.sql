CREATE TYPE "LeadLine" AS ENUM ('ENTERPRISE', 'PRIVACY', 'MIX');

CREATE SEQUENCE "lead_business_code_seq" START 1;

ALTER TABLE "leads"
ADD COLUMN "businessCode" TEXT,
ADD COLUMN "line" "LeadLine";

CREATE UNIQUE INDEX "leads_businessCode_key" ON "leads"("businessCode");
CREATE INDEX "leads_line_idx" ON "leads"("line");
