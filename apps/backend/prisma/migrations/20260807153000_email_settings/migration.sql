CREATE TABLE "email_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL DEFAULT 'sartori.br@gmail.com',
    "passwordEncrypted" TEXT,
    "fromEmail" TEXT NOT NULL DEFAULT 'sartori.br@gmail.com',
    "fromName" TEXT NOT NULL DEFAULT 'Multicortex CRM',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "email_settings" (
    "id", "enabled", "host", "port", "secure", "username", "fromEmail", "fromName"
) VALUES (
    'default', false, 'smtp.gmail.com', 587, false, 'sartori.br@gmail.com',
    'sartori.br@gmail.com', 'Multicortex CRM'
);
