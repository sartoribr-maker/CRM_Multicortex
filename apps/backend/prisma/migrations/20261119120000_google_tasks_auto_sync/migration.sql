-- Integração automática de tarefas "Em andamento" com o Google Tasks, por usuário.
ALTER TABLE "users" ADD COLUMN "googleTasksAutoSync" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "task_google_tasks" ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "task_google_tasks" ADD COLUMN "crmStatus" "TaskStatus";
ALTER TABLE "task_google_tasks" ADD COLUMN "syncedHash" TEXT;
