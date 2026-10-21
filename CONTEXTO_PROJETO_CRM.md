# Multicortex CRM — Contexto completo do projeto

> Documento de contexto para uso com IA. Gerado em 2026-10-19 a partir da leitura do repositório (branch `master`, commit `8f0768a`).
> Objetivo: permitir que a IA entenda arquitetura, modelo de dados, regras de negócio, API, frontend, infraestrutura e pontos de atenção, sem acesso ao código.

---

## 1. Visão geral

**O que é:** CRM interno da Multicortex para gestão do funil de vendas (B2B, projetos de tecnologia). Cobre oportunidades (leads) em lista e Kanban, parceiros (indicação e técnicos), tarefas da equipe comercial, dashboard executivo, relatório de pipeline, usuários/perfis com permissões granulares, notificações por e-mail, monitoramento agendado (cobrança de tarefas atrasadas) e integração com o site institucional (criação automática de leads).

**Idioma:** toda a UI, mensagens de erro, e-mails e documentação estão em português do Brasil. Fuso de referência: Brasília (UTC−03:00).

**Produção:** https://crm.multicortex.com.br — servidor Linux (host 52.207.145.100), app em `/opt/multicortex/crm`, disco do Docker montado em `/docker`. Houve incidente de disco cheio em 2026-10-14, que motivou a limpeza automática do Docker (ver seção 9).

**Linha do tempo (git):**
- 2026-08-05/06 — Fases 0 a 10 (setup, auth/RBAC, configurações, leads, Kanban, parceiros, tarefas, dashboard, perfis, UX, deploy).
- 2026-08-07 a 08-27 — notificações por e-mail/WhatsApp, filtros, múltiplos responsáveis, CAPEX/OPEX, parceiro técnico, serviços, "Linha" e código de negócio (ENT/PRI/MIX), semáforo de prazos, aba de tarefas na oportunidade.
- 2026-09-23 — justificativa obrigatória para concluir tarefa.
- 2026-09-24 — integração de leads do site com idempotência.
- 2026-09-28/29 — flag "Cobrador" no usuário, monitoramento agendado, mensagem de cobrança de tarefas.
- 2026-10-03 — script seguro de provisionamento do usuário de integração do site.
- 2026-10-14 — limpeza do Docker no deploy + monitor de disco (systemd).

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |
| Backend | Node.js 20 + TypeScript + NestJS 10, Passport JWT, class-validator, Swagger, Helmet, Throttler, Nodemailer, Multer |
| ORM / Banco | Prisma 5 + PostgreSQL 16 |
| Frontend | React 18 + TypeScript + Vite 5 + TailwindCSS 3 + React Router 6 + Zustand 4 (sem lib de UI/estado de servidor; fetch próprio) |
| Shared | `packages/shared` (praticamente vazio: só `ApiHealthResponse`) |
| Infra | Docker / docker-compose (dev e prod), Nginx servindo SPA + proxy `/api`, scripts systemd no servidor |

## 3. Estrutura de pastas

```
CRM/
├── apps/
│   ├── backend/
│   │   ├── prisma/             schema.prisma, 25 migrations, seed.ts
│   │   ├── scripts/            import-trello-opportunities.ts, create-site-integration-user.cjs (+ .md)
│   │   ├── src/
│   │   │   ├── auth/           login, refresh, reset, troca obrigatória, guards, decorators, PERMISSIONS
│   │   │   ├── users/  roles/  audit/  health/  prisma/  storage/
│   │   │   ├── leads/          leads.service (núcleo), lead-activity.service, attachments/
│   │   │   ├── tasks/          tasks.service, attachments/
│   │   │   ├── partners/  dashboard/
│   │   │   ├── settings/       stages, priorities, deal-sizes, sources, segments, project-types, services, custom-fields
│   │   │   └── notifications/  email (SMTP), whatsapp (Meta Cloud API), monitoring (agendador)
│   │   └── test/               testes node:test (.cjs): dashboard, monitoring, provisionamento
│   └── frontend/src/
│       ├── pages/              leads/, tasks/, partners/, settings/, access/, reports/, auth pages, HomePage (dashboard)
│       ├── components/         AppShell, TaskDeadline (semáforo), MaskedInputs, LeadAutocompleteInput, CustomFieldsFormSection...
│       ├── lib/                api.ts (fetch + refresh automático) e clientes por módulo (*Api.ts), formatters
│       ├── store/              useAuthStore, useUiStore (tema, menu)
│       ├── routes/             ProtectedRoute, RequirePermission
│       └── types/
├── packages/shared/
├── infra/                      docker-compose(.prod).yml, Dockerfiles, nginx.conf, backend-entrypoint.sh, server/ (deploy-crm, monitor de disco)
├── docs/                       DEPLOY.md, MONITORAMENTO_TAREFAS_LEADS.md
├── Documentos/                 export JSON do Trello "FUNIL DE VENDA" (origem dos dados reais) e logotipo
└── README.md, ROTEIRO_PARA_SUBIR_O_SISTEMA.md, TESTE_*.md (arquivos de teste da ferramenta DevCore, sem valor funcional)
```

Observação: no frontend existem arquivos `.js` compilados versionados ao lado de cada `.tsx/.ts` (ex.: `App.js` e `App.tsx`). A fonte de verdade é o `.tsx/.ts`; alguns arquivos novos (ex.: `TaskDeadline.tsx`, `MonitoringSettingsPanel.tsx`) não têm `.js`.

---

## 4. Modelo de dados (Prisma)

Convenções: IDs UUID; quase todas as entidades têm `createdAt`, `updatedAt`, `createdBy` e `deletedAt` (soft delete = "arquivar"). Tabelas configuráveis substituem enums fixos para o funil.

### 4.1 Autenticação e acesso
- **User**: name, email (único), passwordHash (bcrypt), `mustChangePassword`, `isCollector` ("Cobrar" — recebe relatórios de cobrança), avatarUrl, position, phone, status (`ACTIVE`/`INACTIVE`), `roleId`.
- **Role**: name (único), description, `isSystem` (perfis padrão protegidos). N:N com **Permission** via **RolePermission**.
- **Permission**: `key` (ex.: `leads.view.all`), module, description.
- **RefreshToken**: hash SHA-256 de token opaco, expiresAt, revokedAt, userAgent, ip.
- **PasswordResetToken**: hash, expiresAt (1h), usedAt.
- **AuditLog**: action, actorUserId, targetType, targetId, metadata (JSON).

### 4.2 Catálogos configuráveis (Configurações)
- **Stage** (etapa do funil): name, order, color, `isWonStage`, `isLostStage`.
- **Priority**: name, color, order.
- **DealSize** (porte): name, color, order, minValue, maxValue.
- **Source** (origem): name, description.
- **Segment**: name (único), description.
- **ProjectType** (tipo de produto/projeto): name, description, category; N:N com **Service** via ProjectTypeService.
- **Service**: name (único), description, price, billingUnit (`MONTH`/`HOUR`/`ONE_TIME`).
- **CustomField**: name, type (`TEXT`, `NUMBER`, `DATE`, `SINGLE_SELECT`, `MULTI_SELECT`, `BOOLEAN`, `CURRENCY`), targetEntity (`LEAD`), options (JSON), isRequired, showInForm, showInKanbanCard, showInFilters, order.

### 4.3 Oportunidade (Lead) — entidade central
Campos principais:
- Identificação: `businessCode` (único, ex.: `ENT00042`), `line` (`ENTERPRISE`/`PRIVACY`/`MIX`), `name`, `siteSubmissionId` (único, idempotência da integração do site).
- Empresa: companyName, companyDocument (CNPJ), companySegment.
- Contato: contactName, contactEmail, contactPhone.
- Classificação: stageId (obrigatório), priorityId, dealSizeId, sourceId, projectTypeId (principal) + `projectTypes` (N:N LeadProjectType).
- Parceiros: `partnerId` (parceiro de indicação), `technicalPartnerId` + `technicalServiceValue` (parceiro técnico e valor do serviço dele).
- Financeiro: `capexValue` (parcela única), `opexValue` (mensal), `estimatedValue` (calculado), `successProbability` (0–100), `periodicity` (`PONTUAL`, `MENSAL`, `TRIMESTRAL`, `ANUAL`, `RECORRENTE`), expectedCloseDate.
- Responsáveis: `ownerId` (principal) + `assignees` (N:N LeadAssignee — múltiplos responsáveis).
- Estado: `status` (`OPEN`/`WON`/`LOST`, derivado da etapa), lossReason, `stageEnteredAt`, description.
- Relações: customFieldValues, stageHistory, attachments, activities (timeline), tasks.

Entidades associadas:
- **StageHistoryEntry**: fromStage, toStage, changedByUser, `timeInPreviousStageSeconds`, reason (descrição da ação).
- **LeadActivity** (timeline): type (`CREATED`, `FIELD_UPDATED`, `STAGE_CHANGED`, `COMMENT`, `ATTACHMENT_ADDED`), message, metadata, actor.
- **Attachment**: fileName, mimeType, sizeBytes, storageKey, uploadedBy.
- **CustomFieldValue**: (leadId, customFieldId) único, value JSON.

### 4.4 Parceiros
- **Partner**: name, legalName, type (`REFERRAL`, `TECHNOLOGY`, `CONSULTING`, `CHANNEL`, `OTHER`), document (único), contactName, email, phone, website, commissionPercentage, status (`ACTIVE`/`INACTIVE`), notes. Relações: `leads` (indicação) e `technicalLeads`.

### 4.5 Tarefas
- **Task**: title, description, status (`TODO`, `IN_PROGRESS`, `DONE`, `CANCELED`), priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT` — enum fixo, diferente das Prioridades configuráveis de lead), dueDate, completedAt, leadId (opcional, `SetNull` ao excluir lead), assigneeId (principal) + `assignees` (N:N TaskAssignee), createdByUserId.
- **TaskAttachment**: como Attachment.
- **TaskHistoryEntry**: type (`DEADLINE_EXTENDED`, `TRANSFERRED`, `COMPLETED`), reason (obrigatória), metadata, actor.

### 4.6 Configurações singleton (id = `"default"`)
- **EmailSettings**: enabled, host (padrão smtp.gmail.com), port 587, secure, username, `passwordEncrypted`, fromEmail, fromName.
- **WhatsAppSettings**: enabled, apiVersion (v23.0), phoneNumberId, businessAccountId, `accessTokenEncrypted`, languageCode, templates (teste, lead criado, mudança de etapa, tarefa criada/atualizada), testPhone, flags notify*.
- **MonitoringSettings**: enabled, startTime ("08:00"), intervalDays, monitorUserId, nextRunAt, lastRunAt, lastError.

Segredos (senha SMTP, token WhatsApp) são cifrados com AES-256-GCM; chave derivada de `EMAIL_ENCRYPTION_KEY` / `WHATSAPP_ENCRYPTION_KEY` ou, se ausentes, de `JWT_SECRET` (trocar o JWT_SECRET invalida esses segredos).

---

## 5. Permissões e perfis

Chaves de permissão (`apps/backend/src/auth/constants/permissions.ts`):

| Módulo | Permissões |
|---|---|
| users | `users.view`, `users.create`, `users.edit`, `users.delete` |
| roles | `roles.view`, `roles.manage` |
| settings | `settings.manage` |
| leads | `leads.view` (próprios), `leads.view.all`, `leads.create`, `leads.edit`, `leads.delete` |
| partners | `partners.view`, `partners.create`, `partners.edit`, `partners.delete` |
| tasks | `tasks.view` (próprias), `tasks.view.all`, `tasks.create`, `tasks.edit`, `tasks.delete` |
| dashboard | `dashboard.view` |

Perfis do seed (`isSystem = true`, não editáveis/excluíveis):
- **Administrador** — todas.
- **Gestor Comercial** — tudo exceto users.create/edit/delete, roles.manage e settings.manage.
- **Vendedor** — leads.view/create/edit, partners.view/create, tasks.view/create/edit, dashboard.view.
- **Parceiro** — apenas dashboard.view.
- **Visualizador** — leitura (users/roles/leads(all)/partners/tasks(all)/dashboard).

Perfis customizados podem ser criados em `/settings/access`. Existe em produção o perfil técnico **"Integração SITE"** (somente `leads.create`).

Mecânica: o JWT de acesso carrega `sub`, `email`, `name`, `roleId`, `roleName`, `permissions[]`. O `PermissionsGuard` exige todas as permissões do decorator `@RequirePermissions`. Rotas `@Public()` dispensam JWT. Mudanças de permissão só valem após o próximo refresh do token (até 15 min).

---

## 6. Regras de negócio (backend)

### 6.1 Autenticação
- Login por e-mail/senha (bcrypt). Rate limit: 5 req/min em login, forgot-password e change-required-password; 60 req/min global.
- Access token JWT (15 min). Refresh token opaco (48 bytes), guardado como hash SHA-256, enviado em cookie `httpOnly`, validade 7 dias, rotacionado a cada refresh.
- `mustChangePassword`: o login devolve um token de propósito `password-change` (15 min); a nova senha deve ser diferente da atual; todos os refresh tokens são revogados.
- Esqueci a senha: token de 1h enviado por e-mail (`/reset-password?token=...`); ao redefinir, revoga sessões.
- Auditoria: LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_RESET_COMPLETED etc.

### 6.2 Oportunidades (`leads.service.ts`)
- **Visibilidade:** sem `leads.view.all`, o usuário só vê leads em que é `owner` **ou** está em `assignees`. Lead fora do escopo retorna 404.
- **Código de negócio:** na criação, usa a sequence Postgres `lead_business_code_seq` → `PREFIXO + 5 dígitos` (`ENT`, `PRI`, `MIX`). Limite 99999. Ao trocar a linha, mantém o número e troca o prefixo; se não havia código, gera um.
- **Valor estimado:** `estimatedValue = capexValue + opexValue × 12` (arredondado a centavos). Recalculado sempre que CAPEX ou OPEX mudam.
- **Etapa inicial:** se `stageId` não vier, usa a etapa de menor `order`. `status` derivado: etapa de ganho → `WON`, de perda → `LOST`, senão `OPEN`.
- **Mudança de etapa (PATCH):**
  - `actionDescription` é **obrigatória** (descrição da ação realizada).
  - Etapa de perda exige `lossReason`.
  - Grava `StageHistoryEntry` com tempo na etapa anterior; atualiza `stageEnteredAt` e `status`.
  - Opcional `createTask` + `taskDueDate` + `taskPriority`: cria **uma tarefa por responsável** do lead, com título = descrição da ação, vinculada ao lead, e envia e-mail de tarefa criada.
  - Registra atividade `STAGE_CHANGED` e envia e-mail "mudança de etapa" aos responsáveis.
- **Múltiplos responsáveis / tipos de projeto:** enviar `ownerIds` / `projectTypeIds` substitui a lista inteira; o primeiro vira `ownerId` / `projectTypeId` principal.
- **Campos customizados:** validados por tipo (select precisa estar nas opções); obrigatórios checados apenas na criação; no update fazem upsert.
- **Timeline:** criação, campos alterados (lista de campos), mudança de etapa, comentários e anexos geram `LeadActivity`.
- **Arquivar** (`POST /leads/:id/archive`) = soft delete. **Excluir** (`DELETE`) = exclusão física (cascata) + remoção dos arquivos + audit `LEAD_DELETED`.
- **Autocomplete** (`/leads/autocomplete?type=company|contact`): até 8 sugestões distintas para preencher empresa/contato.
- **E-mail "nova oportunidade"** para todos os responsáveis na criação.

### 6.3 Integração do site (leads automáticos)
- O site envia `POST /api/v1/leads` autenticado como usuário técnico, com `siteSubmissionId`.
- Só é aceito se o usuário for exatamente `multicortex@multicortex.ai` com perfil `Integração SITE`, a origem (`sourceId`) for a origem "Site" (`CRM_SITE_SOURCE_ID`, com UUID padrão fixo no código) e o responsável for o próprio usuário técnico.
- **Idempotência:** se o `siteSubmissionId` já existir com mesmo criador, origem, e-mail de contato e empresa, retorna apenas `{ id }` do lead existente (mesmo que já transferido a um vendedor); se divergir, 409 Conflict. Condição de corrida tratada pelo erro de unicidade P2002.
- Provisionamento da conta técnica: script manual `scripts/create-site-integration-user.cjs` (`--check` somente leitura; senha pedida em TTY oculto; nunca imprime segredos; exige role com exclusivamente `leads.create`).

### 6.4 Tarefas (`tasks.service.ts`)
- **Visibilidade:** somente o perfil cujo nome é exatamente "Administrador" vê todas as tarefas; todos os demais veem apenas tarefas em que estão em `assignees` (ver pontos de atenção — não usa `tasks.view.all`).
- Não-administradores só podem criar/reatribuir tarefas para si mesmos.
- Múltiplos responsáveis (`assigneeIds`); o primeiro é o `assigneeId` principal.
- **Concluir exige justificativa** (`completionReason` / `reason`) e gera `TaskHistoryEntry COMPLETED`. Concluir tarefa já concluída → 400.
- **Prorrogar prazo** (`extend-deadline`): nova data deve ser posterior à atual; motivo obrigatório; histórico `DEADLINE_EXTENDED`.
- **Transferir** (`transfer`): para um único usuário ativo; motivo obrigatório; substitui todos os responsáveis; histórico `TRANSFERRED`.
- **Lembrete** (`reminder`): envia e-mail de cobrança aos responsáveis; audit `TASK_REMINDER_SENT`.
- Filtros de listagem: search, status, priority, leadId, assigneeId, `mine`, `overdue` (prazo < agora e não concluída/cancelada). Ordenação: status, depois prazo.
- E-mails em criação, atualização e conclusão.
- Semáforo no frontend (`TaskDeadline`): vermelho = vencida; amarelo = vence em até 5 dias; verde = mais de 5 dias.

### 6.5 Parceiros
- CRUD com busca/filtros/paginação; `document` único (409 se duplicado); ativar/inativar; detalhe com oportunidades indicadas. Auditoria das operações.

### 6.6 Dashboard (`GET /dashboard/summary`)
- Escopo: leads conforme `leads.view.all`; tarefas conforme `tasks.view.all` (`scope: TEAM | PERSONAL`).
- Métricas: total/abertos/ganhos/perdidos; `pipelineValue` = soma do estimado dos abertos, excluindo etapas chamadas "Ganho (Projeto Ativo)" e "Perdido"; `wonValue`; `averageTicket` = valor dos abertos / qtd abertos; `conversionRate` = ganhos / (ganhos + perdidos); tarefas atrasadas.
- Funil por etapa (qtd e valor), 6 leads movimentados recentemente, 6 tarefas atrasadas, agenda de 7 dias.
- **Leads "Mandatória":** prioridade com nome normalizado "mandatoria", excluindo etapas de ganho/perda e etapas cujo nome contém "espera" e "pausad".
- Desempenho por responsável (somente visão de equipe), ordenado por valor ganho.

### 6.7 Relatório de pipeline
- Página `/reports/pipeline` no frontend, montada a partir da listagem de leads e etapas (sem endpoint próprio).

### 6.8 Notificações por e-mail
- SMTP configurado pela UI (`/settings/email`) com botão de teste. E-mails HTML com escape de conteúdo e link para o CRM (`FRONTEND_URL`).
- Eventos: nova oportunidade, mudança de etapa, tarefa criada, tarefa atualizada/concluída, lembrete de tarefa, reset de senha, relatórios de monitoramento.

### 6.9 WhatsApp
- Tela de configuração (`/settings/whatsapp`) e envio de mensagem de teste via Meta Graph API (`graph.facebook.com/{version}/{phoneNumberId}/messages`, template).
- Os templates e flags de evento existem no banco, mas **não há disparo automático** por eventos no código atual — só o teste.

### 6.10 Monitoramento Tarefas/Leads (`monitoring.service.ts`)
- Configurado em `/settings/monitoring`: usuário monitor, horário (Brasília), intervalo em dias (1–365). Exige SMTP ativo.
- O backend verifica a cada 30 s; a próxima execução fica no banco; "compare-and-swap" evita execução duplicada entre instâncias; após parada, executa uma vez e avança para a próxima data futura.
- Em cada execução:
  1. **Tarefas em atraso:** cada responsável ativo recebe as suas; monitor e usuários com `isCollector` ("Cobrar") recebem o relatório completo (sem duplicar).
  2. **Oportunidades em etapas chamadas "Backlog" ou "Leads"** (case-insensitive): só para monitor e cobradores.
  3. **Tarefas A fazer / Em andamento:** cada responsável ativo recebe a lista das suas (mensagem de cobrança).
- Relatórios vazios não são enviados; falhas gravam `lastError` e não são reenviadas antes do próximo período.

### 6.11 Anexos e storage
- `StorageProvider` com implementação em disco local (`STORAGE_LOCAL_PATH`, volume Docker); preparado para S3/R2.
- Limite 15 MB; allowlist: imagens, PDF, Word/Excel/ODF/RTF, CSV, TXT, ZIP. Leads e tarefas têm anexos; usuários têm avatar (endpoint público de leitura).

### 6.12 Usuários
- CRUD, ativar/inativar, reset de senha pelo admin (pode marcar troca obrigatória), avatar, flag `isCollector`. Não é possível inativar/excluir a própria conta. Exclusão bloqueada se houver vínculos impeditivos.

---

## 7. API REST

Prefixo `/api/v1` · Swagger em `/api/docs` · validação global com `whitelist` + `forbidNonWhitelisted` (campos desconhecidos → 400) · listagens paginadas retornam `{ items, total, page, pageSize, totalPages }`.

| Recurso | Endpoints (permissão) |
|---|---|
| auth | `POST login`, `change-required-password`, `refresh`, `logout`, `forgot-password`, `reset-password` (públicos); `GET me` |
| health | `GET /health` (público, testa o banco) |
| leads | `GET /leads`, `GET /leads/autocomplete`, `GET /leads/:id` (view); `POST /leads` (create); `PATCH /leads/:id`, `POST /leads/:id/comments` (edit); `POST /leads/:id/archive`, `DELETE /leads/:id` (delete); `GET /leads/:id/activities`, `GET /leads/:id/stage-history` (view) |
| lead attachments | `POST/GET /leads/:leadId/attachments`, `GET .../:attachmentId/download`, `DELETE .../:attachmentId` |
| tasks | `GET /tasks`, `GET /tasks/:id`, `GET /tasks/:id/history` (view); `POST /tasks` (create); `PATCH /tasks/:id`, `POST /tasks/:id/complete`, `/reminder`, `/extend-deadline`, `/transfer` (edit); `POST /tasks/:id/archive`, `DELETE /tasks/:id` (delete) |
| task attachments | `/tasks/:taskId/attachments` (mesmo padrão dos leads) |
| partners | `GET`, `GET /:id`, `POST`, `PATCH /:id`, `POST /:id/deactivate`, `POST /:id/reactivate`, `DELETE /:id` |
| users | `GET`, `GET /:id`, `GET /:id/avatar` (público), `POST /:id/avatar`, `POST`, `PATCH /:id`, `POST /:id/deactivate`, `/reactivate`, `/reset-password`, `DELETE /:id` |
| roles | `GET`, `GET /permissions-catalog`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `PUT /:id/permissions` |
| catálogos | `/stages`, `/priorities`, `/deal-sizes`, `/sources`, `/segments`, `/project-types`, `/services`, `/custom-fields`: `GET` (qualquer autenticado, `?includeArchived=true`), `POST`, `PATCH /:id`, `POST /:id/archive` (`settings.manage`); `PUT /reorder` em stages e priorities |
| dashboard | `GET /dashboard/summary` (`dashboard.view`) |
| e-mail | `GET/PUT /email-settings`, `POST /email-settings/test` (`settings.manage`) |
| whatsapp | `GET/PUT /whatsapp-settings`, `POST /whatsapp-settings/test` (`settings.manage`) |
| monitoramento | `GET/PUT /monitoring-settings`, `GET /monitoring-settings/users` (`settings.manage`) |

---

## 8. Frontend

- SPA React; `lib/api.ts` faz fetch com bearer token em memória (Zustand) e **refresh automático** em 401 (uma única promessa de refresh compartilhada; cookie httpOnly).
- `ProtectedRoute` exige sessão; `RequirePermission` checa permissões no cliente.
- Rotas:
  - `/login`, `/forgot-password`, `/reset-password`, `/change-password`
  - `/` — dashboard executivo
  - `/leads` (lista com filtros), `/leads/kanban` (drag-and-drop com atualização otimista e rollback; modal de motivo de perda; descrição da ação e criação opcional de tarefas ao mover), `/leads/novo`, `/leads/:id` (detalhe: timeline, histórico de etapas, anexos, aba de tarefas), `/leads/:id/editar`
  - `/tasks`, `/tasks/nova`, `/tasks/:id` (detalhe: concluir com justificativa, prorrogar, transferir, lembrete, histórico, anexos), `/tasks/:id/editar`
  - `/partners`, `/partners/novo`, `/partners/:id`, `/partners/:id/editar`
  - `/reports/pipeline`
  - `/settings/{stages|priorities|deal-sizes|sources|segments|project-types|services|custom-fields|monitoring|email|whatsapp|access}` (`/access` redireciona para `/settings/access` — usuários e perfis com matriz de permissões)
- UX: tema claro/escuro persistente, menu lateral recolhível e responsivo (mobile/tablet, PWA manifest), máscaras de CPF/CNPJ/telefone/moeda, tabelas com rolagem horizontal fixa, ErrorBoundary global, versão do app exibida (`__APP_VERSION__` do package.json do frontend, hoje 0.1.2).

---

## 9. Infraestrutura e operação

### Desenvolvimento
- `docker compose --env-file .env -f infra/docker-compose.yml up -d --build` → Postgres (host `5435`), backend (`3333`, watch), frontend Vite (`5173`), Adminer (`8080`).
- Migrations/seed: `npx prisma migrate dev` / `npx prisma db seed` dentro do container backend (`/app/apps/backend`).
- Seed: 5 usuários demo (`admin@`, `gestor@`, `vendedor@`, `parceiro@`, `visualizador@multicortex.com.br`, senha `Senha@123`), etapas/prioridades/portes/origens/tipos padrão, 3 parceiros, 5 leads, tarefas.

### Produção
- `infra/docker-compose.prod.yml`: Postgres (rede interna, sem porta exposta), backend (imagem multi-stage; entrypoint roda `prisma migrate deploy` e depois `node dist/src/main.js`; healthcheck `/api/v1/health`), frontend Nginx publicado em `127.0.0.1:${HTTP_PORT:-8081}` (TLS terminado em proxy de borda à frente).
- Nginx: SPA com fallback para `index.html`, proxy `/api/` → `backend:3333`, gzip, cache 1 ano de assets, headers de segurança, `client_max_body_size 16m`, `/healthz`.
- Variáveis (`.env.production`): POSTGRES_*, FRONTEND_URL (também usada no CORS e links de e-mail), HTTP_PORT, JWT_SECRET, JWT_ACCESS/REFRESH_EXPIRES_IN, opcionais EMAIL_/WHATSAPP_ENCRYPTION_KEY, CRM_SITE_SOURCE_ID.
- **Deploy:** comando `deploy-crm` no servidor (`infra/server/deploy-crm`): `git fetch` + `reset --hard origin/master` → `docker compose build` → `up -d` → `docker image prune` + `builder prune` (>7 dias) → aguarda 20 s → testa `/api/v1/health` com Host `crm.multicortex.com.br`.
- **Monitor de disco:** `check-docker-disk` via timer systemd a cada 15 min; acima de 85% em `/docker` faz limpeza segura (imagens órfãs e cache > 24h; nunca volumes) e registra alerta no syslog e em `/run/docker-disk-alert` (exibido no login via `/etc/profile.d`). Instalação: `sudo bash infra/server/install.sh`.
- Backup: recomendado externamente para volumes `postgres_prod_data` e `backend_prod_uploads` (não automatizado no repositório).

### Testes
- Não há suíte de testes de unidade/E2E do Nest. Existem testes `node --test` em `apps/backend/test/*.test.cjs` (dashboard, monitoramento, provisionamento) que rodam sobre o build.

### Dados reais
- Os dados de produção vieram de um board Trello "FUNIL DE VENDA" (`Documentos/*.json`), importado por `npm run db:import:trello`. As etapas reais diferem do seed: Backlog, Leads, Contato/Qualificação, Diagnóstico/Reunião, POCs/MVPs/Piloto, Proposta Técnica, Proposta Comercial, Negociação, Aprovação/Assinatura, Ganho (Projeto Ativo), Em espera/Pausado, Perdido. Prioridades reais incluem "Mandatória". Tipos de projeto incluem "Soluções/Customizações" e "Palestras/Treinamentos". Expectativa baixa/média/alta → probabilidade 25/50/75%.

---

## 10. Pontos de atenção e dívidas técnicas (observados no código)

1. **Visibilidade de tarefas inconsistente:** `tasks.service` libera visão global apenas para o perfil chamado "Administrador" (comparação por nome), ignorando `tasks.view.all`. Gestor Comercial e Visualizador têm a permissão, mas na listagem de tarefas só veem as próprias; já o dashboard usa a permissão corretamente. O README descreve o comportamento por permissão.
2. **Regras dependentes de nomes:** dashboard depende dos nomes "Ganho (Projeto Ativo)", "Perdido", "Em espera/Pausado" e da prioridade "Mandatória"; monitoramento depende das etapas "Backlog" e "Leads". Renomear essas etapas/prioridades em Configurações altera métricas e relatórios silenciosamente.
3. **Integração do site com valores fixos no código:** e-mail `multicortex@multicortex.ai`, nome do perfil `Integração SITE` e UUID padrão da origem Site.
4. **WhatsApp incompleto:** apenas configuração e teste; os eventos configurados não disparam mensagens.
5. **Permissões no JWT:** alterações de perfil levam até 15 min para valer (ou novo login).
6. **Chave de criptografia:** se `EMAIL_/WHATSAPP_ENCRYPTION_KEY` não forem definidas, deriva do `JWT_SECRET`; rotacionar o JWT_SECRET torna ilegíveis a senha SMTP e o token do WhatsApp.
7. **Monitoramento em processo:** `setInterval` no próprio backend; a reserva do horário ocorre antes do envio — se o processo cair durante o disparo, o período pode ficar com entregas incompletas.
8. **E-mails síncronos:** notificações são enviadas dentro da requisição (após a transação); SMTP lento aumenta o tempo de resposta.
9. ~~Arquivos `.js` compilados versionados no frontend~~ — removidos na branch `feature/portal-sdr`.
10. **NestJS 10** com alertas transitivos de `npm audit`; migração de major planejada como entrega separada.
11. **Sem testes automatizados amplos** nem CI no repositório; deploy faz `reset --hard` em `origin/master`.
12. Arquivos `TESTE_*.md` na raiz são artefatos de teste de ferramenta, sem relação com o produto.

---

## 11. Portal de Terceiros — SDR (branch `feature/portal-sdr`, Fase 1)

- `Role.portal` (`INTERNAL` | `THIRD_PARTY`); perfil de sistema **SDR** (`portal.sdr.access`, `leads.view/create/edit`, `tasks.view/edit`); Administrador recebe `portal.sdr.access` só para visualizar.
- `ThirdPartyPortalGuard` global (após JWT, antes das permissões): THIRD_PARTY só acessa rotas com `@AllowThirdPartyPortal()`; demais → 403 + audit `THIRD_PARTY_PORTAL_ACCESS_DENIED`.
- Singleton `SdrPortalSettings` (`/settings/sdr-portal`): etapas visíveis, destinos permitidos, etapa qualificada, origem padrão, `hideFinancialValues`, `staleDays` — tudo por ID.
- Portal lista só leads do parceiro comercial SDR (`SdrPortalSettings.sdrPartnerId`) nas etapas visíveis, de qualquer responsável; Kanban e Dashboard têm filtro de responsável. `Lead.leadType` (INBOUND/OUTBOUND): site → Inbound + parceiro SDR; criado no portal → Outbound + parceiro SDR; criação força responsável/origem/etapa; aceita só campos de prospecção; respostas e e-mails sem valores financeiros.
- Frontend: `/terceiro` (Dashboard SDR, `GET /portal/sdr/summary`) e `/terceiro/kanban` (Kanban + drawer); `ProtectedRoute` devolve THIRD_PARTY ao portal. Componentes compartilhados em `components/leads/` (KanbanBoard, LeadKanbanCard, MoveLeadModal, LeadTimeline, LeadAttachments).
- Documentação: `docs/PORTAL_SDR.md`.

## 12. Cadastro de Empresas e Contatos (branch `feature/portal-sdr`)

- Tabelas `companies` (name, normalizedName único, document, segment) e `contacts` (name, normalizedName, email, normalizedEmail, phone, companyId); `Lead.companyId`/`Lead.contactId` opcionais. Os campos de texto do lead continuam sendo a fonte exibida.
- `CompanyContactService.syncForLead` roda dentro da transação de criação/edição do lead: grava empresa/contato inexistentes e completa dados ausentes. Empresa por nome normalizado (INSERT … ON CONFLICT); contato por e-mail + nome, senão nome + empresa.
- Autocomplete (`GET /leads/autocomplete`) consulta essa base inteira para todos os usuários, inclusive SDR.
- Migration `20261021120000_companies_contacts` cria as tabelas e importa os dados dos leads existentes.

## 13. Reuniões no Google Agenda (branch `feature/portal-sdr`)

- Conta de serviço do Google Workspace com delegação de domínio (escopo `calendar.events`); JWT RS256 + API do Calendar via `fetch` (sem dependência nova). Usuário do domínio (`workspaceDomain`) organiza na própria agenda; os demais, na `fallbackOrganizerEmail`.
- `GoogleCalendarSettings` (singleton, chave criptografada, `meetingStageId`, duração padrão) em `/settings/google-calendar`; `LeadMeeting` (evento, Meet, convidados) e atividade `MEETING_SCHEDULED`.
- Ao mover para `meetingStageId` (Kanban interno e Portal SDR), o hook `useMeetingScheduling` pergunta, abre `ScheduleMeetingModal` e segue para o `MoveLeadModal` com a ação preenchida. O card mostra ícone se `lead.meetings[0]` (próxima reunião não encerrada).
- Rotas: `/calendar/config`, `/calendar/attendee-suggestions`, `/leads/:id/meetings` (liberadas ao portal), `/google-calendar-settings` (settings.manage). Guia: `docs/GOOGLE_AGENDA.md`.

## 14. Glossário

- **Lead / Oportunidade:** mesma entidade (`Lead`); a UI usa ambos os termos.
- **Linha:** classificação de negócio ENTERPRISE (ENT), PRIVACY (PRI) ou MIX — define o prefixo do código.
- **Código de negócio:** identificador legível (ex.: `PRI00137`).
- **Parceiro de indicação vs. parceiro técnico:** quem trouxe o negócio vs. quem presta apoio técnico (com valor de serviço).
- **CAPEX / OPEX:** valor de parcela única / valor mensal recorrente (anualizado ×12 no valor estimado).
- **Cobrador ("Cobrar"):** usuário que recebe relatórios completos de cobrança no monitoramento.
- **Arquivar:** soft delete (`deletedAt`); **Excluir:** remoção física.
