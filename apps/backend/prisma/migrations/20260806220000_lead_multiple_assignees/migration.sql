CREATE TABLE "lead_assignees" (
  "leadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" TEXT,
  CONSTRAINT "lead_assignees_pkey" PRIMARY KEY ("leadId", "userId")
);

CREATE INDEX "lead_assignees_userId_idx" ON "lead_assignees"("userId");
ALTER TABLE "lead_assignees" ADD CONSTRAINT "lead_assignees_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_assignees" ADD CONSTRAINT "lead_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "lead_assignees" ("leadId", "userId", "assignedBy")
SELECT "id", "ownerId", "createdBy" FROM "leads";
