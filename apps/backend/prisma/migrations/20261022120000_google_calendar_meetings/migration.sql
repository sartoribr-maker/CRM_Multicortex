-- CreateEnum
CREATE TYPE "LeadMeetingStatus" AS ENUM ('SCHEDULED', 'CANCELED');

-- AlterEnum
ALTER TYPE "LeadActivityType" ADD VALUE 'MEETING_SCHEDULED';

-- CreateTable
CREATE TABLE "google_calendar_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "workspaceDomain" TEXT NOT NULL DEFAULT 'multicortex.ai',
    "fallbackOrganizerEmail" TEXT NOT NULL DEFAULT 'multicortex@multicortex.ai',
    "serviceAccountEmail" TEXT,
    "serviceAccountKeyEncrypted" TEXT,
    "meetingStageId" TEXT,
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "google_calendar_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_meetings" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "attendees" TEXT[],
    "withMeet" BOOLEAN NOT NULL DEFAULT true,
    "organizerEmail" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "htmlLink" TEXT,
    "meetLink" TEXT,
    "status" "LeadMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_meetings_leadId_startAt_idx" ON "lead_meetings"("leadId", "startAt");

-- AddForeignKey
ALTER TABLE "lead_meetings" ADD CONSTRAINT "lead_meetings_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_meetings" ADD CONSTRAINT "lead_meetings_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Configuração inicial (desativada até a chave da conta de serviço ser informada).
-- A etapa de reunião é resolvida por nome somente aqui; depois é configurada por ID.
INSERT INTO "google_calendar_settings" ("id", "meetingStageId", "updatedAt")
SELECT
  'default',
  (
    SELECT "id" FROM "stages"
    WHERE "deletedAt" IS NULL AND lower(trim("name")) = 'diagnóstico/reunião'
    ORDER BY "order", "createdAt" LIMIT 1
  ),
  now()
ON CONFLICT ("id") DO NOTHING;
