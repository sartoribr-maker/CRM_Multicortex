ALTER TABLE "tasks"
ADD COLUMN "assigneeAssignedAt" TIMESTAMP(3);

UPDATE "tasks"
SET "assigneeAssignedAt" = "createdAt";

ALTER TABLE "tasks"
ALTER COLUMN "assigneeAssignedAt" SET NOT NULL,
ALTER COLUMN "assigneeAssignedAt" SET DEFAULT CURRENT_TIMESTAMP;
