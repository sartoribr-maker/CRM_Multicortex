-- Evento-lembrete às 10h no Google Agenda para cada tarefa vinculada ao Google Tasks.
ALTER TABLE "task_google_tasks" ADD COLUMN "reminderEventId" TEXT;
