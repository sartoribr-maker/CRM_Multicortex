-- CreateEnum
CREATE TYPE "PortalType" AS ENUM ('INTERNAL', 'THIRD_PARTY');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN "portal" "PortalType" NOT NULL DEFAULT 'INTERNAL';

-- CreateTable
CREATE TABLE "sdr_portal_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "visibleStageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedTargetStageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualifiedStageId" TEXT,
    "defaultSourceId" TEXT,
    "hideFinancialValues" BOOLEAN NOT NULL DEFAULT true,
    "staleDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "sdr_portal_settings_pkey" PRIMARY KEY ("id")
);
