CREATE TYPE "ServiceBillingUnit" AS ENUM ('MONTH', 'HOUR', 'ONE_TIME');

CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "billingUnit" "ServiceBillingUnit" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_type_services" (
    "projectTypeId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    CONSTRAINT "project_type_services_pkey" PRIMARY KEY ("projectTypeId", "serviceId")
);

CREATE UNIQUE INDEX "services_name_key" ON "services"("name");
CREATE INDEX "project_type_services_serviceId_idx" ON "project_type_services"("serviceId");

ALTER TABLE "project_type_services" ADD CONSTRAINT "project_type_services_projectTypeId_fkey"
FOREIGN KEY ("projectTypeId") REFERENCES "project_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_type_services" ADD CONSTRAINT "project_type_services_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
