-- Integração com o Multicortex Projetos: as tarefas passam a morar na base do PMO.
-- O vínculo com o Google Tasks guarda o id da tarefa do PMO, então deixa de ter FK para "tasks".
-- As tabelas antigas de tarefas ficam intactas até a migração dos dados.
ALTER TABLE "task_google_tasks" DROP CONSTRAINT IF EXISTS "task_google_tasks_taskId_fkey";
