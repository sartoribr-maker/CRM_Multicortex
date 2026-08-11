CREATE TABLE "lead_project_types" (
    "leadId" TEXT NOT NULL,
    "projectTypeId" TEXT NOT NULL,
    CONSTRAINT "lead_project_types_pkey" PRIMARY KEY ("leadId", "projectTypeId")
);

CREATE INDEX "lead_project_types_projectTypeId_idx" ON "lead_project_types"("projectTypeId");

ALTER TABLE "lead_project_types" ADD CONSTRAINT "lead_project_types_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_project_types" ADD CONSTRAINT "lead_project_types_projectTypeId_fkey"
FOREIGN KEY ("projectTypeId") REFERENCES "project_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "lead_project_types" ("leadId", "projectTypeId")
SELECT "id", "projectTypeId" FROM "leads" WHERE "projectTypeId" IS NOT NULL;
