-- AlterTable
ALTER TABLE "services" ADD COLUMN     "tier" TEXT,
ADD COLUMN     "hardwareSpec" TEXT,
ADD COLUMN     "priceWithoutTax" DECIMAL(14,2),
ADD COLUMN     "taxRate" DECIMAL(5,4),
ADD COLUMN     "hardwareCost" DECIMAL(14,2),
ADD COLUMN     "marginValue" DECIMAL(14,2),
ADD COLUMN     "licenseCost" DECIMAL(14,2),
ADD COLUMN     "setupPrivateCloudPrice" DECIMAL(14,2),
ADD COLUMN     "setupOnPremisesPrice" DECIMAL(14,2),
ADD COLUMN     "pocPrice" DECIMAL(14,2),
ADD COLUMN     "pocDays" INTEGER,
ADD COLUMN     "priceReferenceDate" TIMESTAMP(3),
ADD COLUMN     "pricingSource" TEXT;
