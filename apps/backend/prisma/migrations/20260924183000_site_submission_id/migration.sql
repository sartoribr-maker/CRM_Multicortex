ALTER TABLE "leads"
ADD COLUMN "siteSubmissionId" TEXT;

CREATE UNIQUE INDEX "leads_siteSubmissionId_key"
ON "leads"("siteSubmissionId");
