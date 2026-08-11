CREATE TYPE "TaskHistoryType" AS ENUM ('DEADLINE_EXTENDED', 'TRANSFERRED');

CREATE TABLE "task_history_entries" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "TaskHistoryType" NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_history_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_history_entries_taskId_createdAt_idx"
ON "task_history_entries"("taskId", "createdAt");

ALTER TABLE "task_history_entries" ADD CONSTRAINT "task_history_entries_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_history_entries" ADD CONSTRAINT "task_history_entries_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
