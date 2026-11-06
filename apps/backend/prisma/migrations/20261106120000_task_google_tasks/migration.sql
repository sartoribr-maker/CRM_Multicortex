-- Vínculo de tarefas do CRM com o Google Tasks ("Minhas tarefas"), um por usuário.
CREATE TABLE "task_google_tasks" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "googleTaskId" TEXT NOT NULL,
    "webViewLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_google_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_google_tasks_taskId_userId_key" ON "task_google_tasks"("taskId", "userId");
CREATE INDEX "task_google_tasks_userId_idx" ON "task_google_tasks"("userId");

ALTER TABLE "task_google_tasks" ADD CONSTRAINT "task_google_tasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_google_tasks" ADD CONSTRAINT "task_google_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
