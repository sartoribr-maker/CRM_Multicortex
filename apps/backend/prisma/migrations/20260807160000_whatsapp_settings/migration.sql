CREATE TABLE "whatsapp_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiVersion" TEXT NOT NULL DEFAULT 'v23.0',
    "phoneNumberId" TEXT NOT NULL DEFAULT '',
    "businessAccountId" TEXT NOT NULL DEFAULT '',
    "accessTokenEncrypted" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'pt_BR',
    "testTemplate" TEXT NOT NULL DEFAULT 'hello_world',
    "leadCreatedTemplate" TEXT NOT NULL DEFAULT '',
    "leadStageTemplate" TEXT NOT NULL DEFAULT '',
    "taskCreatedTemplate" TEXT NOT NULL DEFAULT '',
    "taskUpdatedTemplate" TEXT NOT NULL DEFAULT '',
    "testPhone" TEXT NOT NULL DEFAULT '',
    "notifyLeadCreated" BOOLEAN NOT NULL DEFAULT true,
    "notifyLeadStageChanged" BOOLEAN NOT NULL DEFAULT true,
    "notifyTaskCreated" BOOLEAN NOT NULL DEFAULT true,
    "notifyTaskUpdated" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "whatsapp_settings" ("id") VALUES ('default');
