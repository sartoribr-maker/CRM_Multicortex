CREATE TABLE "monitoring_settings" (
 "id" TEXT NOT NULL DEFAULT 'default',
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "startTime" TEXT NOT NULL DEFAULT '08:00',
 "intervalDays" INTEGER NOT NULL DEFAULT 1,
 "monitorUserId" TEXT,
 "nextRunAt" TIMESTAMP(3),
 "lastRunAt" TIMESTAMP(3),
 "lastError" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "updatedBy" TEXT,
 CONSTRAINT "monitoring_settings_pkey" PRIMARY KEY ("id")
);
