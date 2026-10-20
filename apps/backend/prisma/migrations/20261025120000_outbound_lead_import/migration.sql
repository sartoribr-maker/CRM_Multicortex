-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "companyLocation" TEXT,
ADD COLUMN     "companyLinkedinUrl" TEXT,
ADD COLUMN     "companyWebsite" TEXT,
ADD COLUMN     "companyPhone" TEXT,
ADD COLUMN     "companySizeEstimate" TEXT,
ADD COLUMN     "companyRevenue" TEXT,
ADD COLUMN     "companyEmployeeCount" TEXT,
ADD COLUMN     "contactPosition" TEXT,
ADD COLUMN     "contactLinkedinUrl" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "location" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sizeEstimate" TEXT,
ADD COLUMN     "revenue" TEXT,
ADD COLUMN     "employeeCount" TEXT;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "position" TEXT,
ADD COLUMN     "linkedinUrl" TEXT;

-- CreateTable
CREATE TABLE "lead_import_blacklist" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contactName" TEXT,
    "companyName" TEXT,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "lead_import_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_import_blacklist_key_key" ON "lead_import_blacklist"("key");
