CREATE TABLE "task_assignees" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("taskId", "userId")
);

CREATE INDEX "task_assignees_userId_idx" ON "task_assignees"("userId");

ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "task_assignees" ("taskId", "userId", "assignedAt", "assignedBy")
SELECT "id", "assigneeId", "assigneeAssignedAt", "createdByUserId" FROM "tasks";
