ALTER TABLE "leads" ADD COLUMN "technicalPartnerId" TEXT;

ALTER TABLE "leads"
ADD CONSTRAINT "leads_technicalPartnerId_fkey"
FOREIGN KEY ("technicalPartnerId") REFERENCES "partners"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "leads_technicalPartnerId_idx" ON "leads"("technicalPartnerId");
