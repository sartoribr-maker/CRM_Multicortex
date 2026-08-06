-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('REFERRAL', 'TECHNOLOGY', 'CONSULTING', 'CHANNEL', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "type" "PartnerType" NOT NULL DEFAULT 'REFERRAL',
    "document" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "commissionPercentage" DECIMAL(5,2),
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "partnerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "partners_document_key" ON "partners"("document");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
