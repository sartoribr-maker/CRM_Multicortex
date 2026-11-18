# Multicortex CRM — Contexto completo do projeto

> **Como usar:** cole este documento inteiro no início da conversa com a IA, antes de pedir qualquer tarefa. Ele permite entender o projeto sem acesso ao código; para alterar código, a IA ainda precisa ler os arquivos citados.
> Atualizado em 2026-10-26 a partir da leitura do repositório (branch `master`, commit `8f15fbf`, 57 commits). Substitui a versão de 2026-10-19 (commit `8f0768a`).

---

## INÍCIO DO CONTEXTO

Você vai trabalhar no **Multicortex CRM**. Leia todo este contexto antes de responder. Respeite a arquitetura, as regras de negócio, as permissões e o idioma descritos aqui. Quando algo não estiver claro, pergunte em vez de supor.

### 1. Visão geral

**O que é:** CRM interno da Multicortex para o funil de vendas B2B de projetos de tecnologia/IA. Cobre:
- oportunidades (leads) em lista e Kanban, com empresas e contatos;
- parceiros (indicação e técnicos);
- tarefas da equipe;
- dashboard executivo e relatório de pipeline;
- usuários e perfis com permissões granulares;
- notificações por e-mail e monitoramento agendado (cobrança de tarefas atrasadas);
- reuniões no Google Agenda com Meet;
- catálogo de serviços com precificação importada de planilha;
- **Portal de Terceiros (SDR)**, para a equipe terceirizada de pré-vendas, com importação de leads Outbound;
- integração com o site institucional, que cria leads Inbound automaticamente.

**Idioma:** toda a UI, mensagens de erro, e-mails, commits e documentação estão em português do Brasil. Identificadores de código em inglês. Fuso de referência: Brasília (UTC−03:00).

**Produção:** https://crm.multicortex.com.br. Servidor Linux EC2 `52.207.145.100`, app em `/opt/multicortex/crm`, disco do Docker montado em `/docker`. O mesmo servidor hospeda o site institucional (`www.multicortex.ai`). Houve um incidente de disco cheio em 2026-10-14, que motivou a limpeza automática do Docker (seção 10). Deploys recentes: 2026-10-20 (`ec2e82e`) e 2026-10-21 (`961643b`). Confirme no servidor se `8f15fbf` já foi publicado.

**Linha do tempo (git):**
- 2026-08-05/06 — Fases 0 a 10: setup, auth/RBAC, configurações, leads, Kanban, parceiros, tarefas, dashboard, perfis, UX e deploy.
- 2026-08-07 a 08-27 — notificações por e-mail/WhatsApp, filtros, múltiplos responsáveis, CAPEX/OPEX, parceiro técnico, serviços, "Linha" e código de negócio (ENT/PRI/MIX), semáforo de prazos e aba de tarefas na oportunidade.
- 2026-09-23 — justificativa obrigatória para concluir tarefa.
- 2026-09-24 — integração de leads do site com idempotência.
- 2026-09-28/29 — flag "Cobrador" no usuário, monitoramento agendado e mensagem de cobrança de tarefas.
- 2026-10-03 — script seguro de provisionamento do usuário de integração do site.
- 2026-10-14 — limpeza do Docker no deploy e monitor de disco (systemd).
- 2026-10-19 — **Portal SDR** (`/terceiro`), remoção dos `.js` compilados do frontend, cadastro de **empresas e contatos**, **Google Agenda**, **tipo de lead Inbound/Outbound** e carteira do parceiro SDR, indicadores Inbound × Outbound.
- 2026-10-20 — **importação de leads Outbound** (planilha .xlsx com blacklist) e **importação da precificação de serviços**.
- 2026-10-21 — perfil **SDR Admin** e permissão `portal.sdr.import`, exclusão de importação Outbound por arquivo, **assumir lead Inbound do site** ao movê-lo, **visibilidade das etapas** (Portal SDR / CRM principal).

---

### 2. Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |
| Backend | Node.js 20 + TypeScript + **NestJS 10**, Passport JWT, class-validator, Swagger, Helmet, Throttler, Nodemailer, Multer, **ExcelJS** (planilhas) |
| ORM / Banco | **Prisma 5** + **PostgreSQL 16** (37 migrations) |
| Frontend | **React 18** + TypeScript + **Vite 5** + **TailwindCSS 3** + React Router 6 + Zustand 4. Sem biblioteca de UI e sem lib de estado de servidor; usa um `fetch` próprio |
| Shared | `packages/shared` (praticamente vazio, só `ApiHealthResponse`) |
| Integrações | SMTP, WhatsApp Cloud API (só teste), Google Calendar API (conta de serviço com JWT RS256 via `fetch`, sem SDK), site institucional (usuário técnico) |
| Infra | Docker / docker-compose (dev e prod), Nginx servindo o SPA e fazendo proxy de `/api`, scripts systemd no servidor |

Lint e formatação: ESLint 8 + `@typescript-eslint` + Prettier (`singleQuote`, `trailingComma: all`, `printWidth: 100`).

---

### 3. Estrutura de pastas

```
CRM/
├── apps/
│   ├── backend/
│   │   ├── prisma/             schema.prisma, migrations/, seed.ts
│   │   ├── scripts/            import-trello-opportunities.ts, create-site-integration-user.cjs (+ .md)
│   │   ├── src/
│   │   │   ├── auth/           login, refresh, reset, troca obrigatória, guards, decorators, constants/permissions.ts
│   │   │   ├── users/  roles/  audit/  health/  prisma/  storage/  common/ (planilhas)
│   │   │   ├── leads/          leads.service (núcleo), lead-activity.service, attachments/, dto/
│   │   │   ├── companies/      CompanyContactService (empresas e contatos a partir dos leads)
│   │   │   ├── tasks/          tasks.service, attachments/
│   │   │   ├── partners/  dashboard/
│   │   │   ├── calendar/       Google Agenda: settings, client, reuniões do lead
│   │   │   ├── sdr-portal/     settings, política de leads do terceiro, resumo do dashboard, outbound-import/
│   │   │   ├── settings/       stages, priorities, deal-sizes, sources, segments, project-types,
│   │   │   │                   services (+ import/ da precificação), custom-fields
│   │   │   └── notifications/  e-mail (SMTP), WhatsApp (Meta), monitoring (agendador)
│   │   └── test/               testes node:test (.cjs) sobre o build
│   └── frontend/src/
│       ├── pages/              leads/, tasks/, partners/, settings/, access/, reports/, portal/ (SDR), auth, HomePage
│       ├── components/         AppShell, AuthLayout, Icon, TaskDeadline, MaskedInputs, LeadAutocompleteInput...
│       │   └── leads/          kanban/ (KanbanBoard, LeadKanbanCard, MoveLeadModal, ClaimLeadModal),
│       │                       meetings/ (ScheduleMeetingModal, AvailabilityPanel, useMeetingScheduling),
│       │                       LeadTimeline, LeadAttachments
│       ├── lib/                api.ts (fetch + refresh automático), clientes por módulo (*Api.ts), formatters
│       ├── store/              useAuthStore, useUiStore (tema, menu)
│       ├── routes/             ProtectedRoute, RequirePermission, ThirdPartyPortalRoute
│       └── types/
├── packages/shared/
├── infra/                      docker-compose(.prod).yml, Dockerfiles, nginx/, backend-entrypoint.sh,
│                               server/ (deploy-crm, monitor de disco, install.sh)
├── docs/                       DEPLOY, MONITORAMENTO_TAREFAS_LEADS, PORTAL_SDR, GOOGLE_AGENDA,
│                               padroes/ (prompts padrão de frontend/backend da Multicortex)
├── Documentos/                 export JSON do Trello "FUNIL DE VENDA" (origem dos dados reais) e logotipo
└── README.md, CONTEXTO_PROJETO_CRM.md, PROMPT_FASE1_PORTAL_SDR.md, ROTEIRO_PARA_SUBIR_O_SISTEMA.md
```

Os arquivos `TESTE_*.md` na raiz são artefatos de teste de uma ferramenta, sem valor funcional. `docs/main-design-*.json` é uma chave de conta de serviço do Google que **não deve ser versionada** (o `.gitignore` já cobre chaves novas).

---

### 4. Modelo de dados (Prisma)

Convenções:
- IDs UUID (`@default(uuid())`).
- Quase todas as entidades têm `createdAt`, `updatedAt`, `createdBy` e `deletedAt` (soft delete = "arquivar").
- Tabelas configuráveis substituem enums fixos no funil.
- Dinheiro em `Decimal(14,2)`.
- Configurações globais em tabelas singleton (`id = "default"`).

#### 4.1 Autenticação e acesso
- **User:** `name`, `email` (único), `passwordHash` (bcrypt), `mustChangePassword`, `isCollector` ("Cobrar": recebe relatórios de cobrança), `avatarUrl`, `position`, `phone`, `status` (`ACTIVE`/`INACTIVE`), `roleId`.
- **Role:** `name` (único), `description`, `isSystem` (perfis padrão protegidos), **`portal`** (`INTERNAL` | `THIRD_PARTY`). Relação N:N com **Permission** via **RolePermission**.
- **Permission:** `key` (ex.: `leads.view.all`), `module`, `description`.
- **RefreshToken:** hash SHA-256 de um token opaco, `expiresAt`, `revokedAt`, `userAgent`, `ip`.
- **PasswordResetToken:** hash, `expiresAt` (1 h), `usedAt`.
- **AuditLog:** `action`, `actorUserId`, `targetType`, `targetId`, `metadata` (JSON).

#### 4.2 Catálogos configuráveis (Configurações)
- **Stage** (etapa do funil): `name`, `order`, `color`, `isWonStage`, `isLostStage`, **`visibleInSdrPortal`** (vira coluna no Kanban do `/terceiro`), **`hiddenInMainCrm`** (some do Kanban, filtros, relatório e funil do dashboard do CRM principal).
- **Priority:** `name`, `color`, `order`.
- **DealSize** (porte): `name`, `color`, `order`, `minValue`, `maxValue`.
- **Source** (origem): `name`, `description`.
- **Segment:** `name` (único), `description`.
- **ProjectType** (tipo de produto/projeto): `name`, `description`, `category`. Relação N:N com **Service** via `ProjectTypeService`.
- **Service:** `name` (único), `description`, `price` (preço final com imposto), `billingUnit` (`MONTH`/`HOUR`/`ONE_TIME`). Também tem a **composição do preço** vinda da planilha de precificação:
  - `tier` (GOOD/BEST/TITAN…), `hardwareSpec`, `priceWithoutTax`, `taxRate` (fração), `hardwareCost`, `marginValue`;
  - cobranças únicas: `licenseCost`, `setupPrivateCloudPrice`, `setupOnPremisesPrice`, `pocPrice`, `pocDays`;
  - `priceReferenceDate`, `pricingSource` e `pricingParameters` (JSON, só leitura).
- **CustomField:** `name`, `type` (`TEXT`, `NUMBER`, `DATE`, `SINGLE_SELECT`, `MULTI_SELECT`, `BOOLEAN`, `CURRENCY`), `targetEntity` (`LEAD`), `options` (JSON), `isRequired`, `showInForm`, `showInKanbanCard`, `showInFilters`, `order`.

#### 4.3 Oportunidade (Lead), a entidade central
- **Identificação:** `businessCode` (único, ex.: `ENT00042`), `line` (`ENTERPRISE`/`PRIVACY`/`MIX`), **`leadType`** (`INBOUND`/`OUTBOUND`), `name`, `siteSubmissionId` (único, idempotência da integração do site), **`outboundImportId`** (lote de importação que criou o lead).
- **Empresa:** `companyName`, `companyDocument` (CNPJ), `companySegment`, `companyLocation`, `companyLinkedinUrl`, `companyWebsite`, `companyPhone`, `companySizeEstimate`, `companyRevenue`, `companyEmployeeCount` e o vínculo **`companyId`** → `Company`.
- **Contato:** `contactName`, `contactEmail`, `contactPhone`, `contactPosition`, `contactLinkedinUrl` e o vínculo **`contactId`** → `Contact`.
- **Classificação:** `stageId` (obrigatório), `priorityId`, `dealSizeId`, `sourceId`, `projectTypeId` (principal) + `projectTypes` (N:N `LeadProjectType`).
- **Parceiros:** `partnerId` (parceiro comercial/de indicação; o parceiro "SDR" identifica a carteira do portal), `technicalPartnerId` + `technicalServiceValue`.
- **Financeiro:** `capexValue` (parcela única), `opexValue` (mensal), `estimatedValue` (calculado), `successProbability` (0–100), `periodicity` (`PONTUAL`, `MENSAL`, `TRIMESTRAL`, `ANUAL`, `RECORRENTE`), `expectedCloseDate`.
- **Responsáveis:** `ownerId` (principal) + `assignees` (N:N `LeadAssignee`).
- **Estado:** `status` (`OPEN`/`WON`/`LOST`, derivado da etapa), `lossReason`, `stageEnteredAt`, `description`.
- **Relações:** `customFieldValues`, `stageHistory`, `attachments`, `activities` (timeline), `tasks`, **`meetings`**.

Entidades associadas:
- **StageHistoryEntry:** `fromStage`, `toStage`, `changedByUser`, `timeInPreviousStageSeconds`, `reason` (descrição da ação).
- **LeadActivity** (timeline): `type` (`CREATED`, `FIELD_UPDATED`, `STAGE_CHANGED`, `COMMENT`, `ATTACHMENT_ADDED`, **`MEETING_SCHEDULED`**), `message`, `metadata`, `actor`.
- **Attachment:** `fileName`, `mimeType`, `sizeBytes`, `storageKey`, `uploadedBy`.
- **CustomFieldValue:** par (`leadId`, `customFieldId`) único, `value` JSON.
- **LeadMeeting:** `title`, `description`, `startAt`, `endAt`, `attendees[]`, `withMeet`, `organizerEmail`, `googleEventId`, `htmlLink`, `meetLink`, `status` (`SCHEDULED`/`CANCELED`), `createdByUser`.

#### 4.4 Empresas e contatos
- **Company:** `name`, `normalizedName` (único: minúsculas e espaços normalizados), `document`, `segment`, `location`, `linkedinUrl`, `website`, `phone`, `sizeEstimate`, `revenue`, `employeeCount`.
- **Contact:** `name`, `normalizedName`, `email`, `normalizedEmail`, `phone`, `position`, `linkedinUrl`, `companyId`.

#### 4.5 Parceiros
- **Partner:** `name`, `legalName`, `type` (`REFERRAL`, `TECHNOLOGY`, `CONSULTING`, `CHANNEL`, `OTHER`), `document` (único), `contactName`, `email`, `phone`, `website`, `commissionPercentage`, `status` (`ACTIVE`/`INACTIVE`), `notes`. Relações: `leads` (indicação) e `technicalLeads`.

#### 4.6 Tarefas
- **Task:** `title`, `description`, `status` (`TODO`, `IN_PROGRESS`, `DONE`, `CANCELED`), `priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`; enum fixo, diferente das Prioridades configuráveis de lead), `dueDate`, `completedAt`, `leadId` (opcional, `SetNull` ao excluir o lead), `assigneeId` (principal) + `assignees` (N:N `TaskAssignee`), `createdByUserId`.
- **TaskAttachment:** igual a Attachment.
- **TaskHistoryEntry:** `type` (`DEADLINE_EXTENDED`, `TRANSFERRED`, `COMPLETED`), `reason` (obrigatória), `metadata`, `actor`.

#### 4.7 Portal SDR e importação Outbound
- **SdrPortalSettings** (singleton): `allowedTargetStageIds[]` (destinos fora do portal, ex.: perda), `qualifiedStageId`, `defaultSourceId`, `hideFinancialValues` (padrão `true`), `staleDays` (padrão 7), `sdrPartnerId`. As etapas visíveis **não** ficam mais aqui: vêm de `Stage.visibleInSdrPortal`.
- **OutboundImport:** um arquivo importado (`fileName`, `createdBy`). Ao excluí-lo, apaga as oportunidades e os registros de blacklist dele.
- **LeadImportBlacklist:** `key` única (LinkedIn do contato, e-mail ou nome + empresa, normalizados), `contactName`, `companyName`, `imported`, `leadId`, `fileName`, `importId`. Registros já apresentados numa importação aparecem desmarcados nas seguintes.

#### 4.8 Configurações singleton (`id = "default"`)
- **EmailSettings:** `enabled`, `host` (padrão smtp.gmail.com), porta 587, `secure`, `username`, `passwordEncrypted`, `fromEmail`, `fromName`.
- **WhatsAppSettings:** `enabled`, `apiVersion` (v23.0), `phoneNumberId`, `businessAccountId`, `accessTokenEncrypted`, `languageCode`, templates, `testPhone`, flags `notify*`.
- **MonitoringSettings:** `enabled`, `startTime` ("08:00"), `intervalDays`, `monitorUserId`, `nextRunAt`, `lastRunAt`, `lastError`.
- **GoogleCalendarSettings:** `enabled`, `workspaceDomain` (`multicortex.ai`), `fallbackOrganizerEmail` (`multicortex@multicortex.ai`), `serviceAccountEmail`, `serviceAccountKeyEncrypted`, `meetingStageId`, `defaultDurationMinutes` (60).

Os segredos (senha SMTP, token do WhatsApp, chave da conta de serviço do Google) são cifrados com AES-256-GCM. A chave vem de `EMAIL_ENCRYPTION_KEY` / `WHATSAPP_ENCRYPTION_KEY` / `GOOGLE_CALENDAR_ENCRYPTION_KEY` ou, se ausentes, de `JWT_SECRET`. Por isso, trocar o `JWT_SECRET` invalida esses segredos.

---

### 5. Permissões e perfis

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
| portal | `portal.sdr.access`, `portal.sdr.import` |

Perfis de sistema (`isSystem = true`, não editáveis nem excluíveis):

| Perfil | Portal | Permissões |
|---|---|---|
| **Administrador** | INTERNAL | todas (inclui `portal.sdr.access` só para visualizar o portal e `portal.sdr.import`) |
| **Gestor Comercial** | INTERNAL | tudo exceto `users.create/edit/delete`, `roles.manage` e `settings.manage` |
| **Vendedor** | INTERNAL | `leads.view/create/edit`, `partners.view/create`, `tasks.view/create/edit`, `dashboard.view` |
| **Parceiro** | INTERNAL | apenas `dashboard.view` |
| **Visualizador** | INTERNAL | leitura (users/roles/leads(all)/partners/tasks(all)/dashboard) |
| **SDR** | THIRD_PARTY | `portal.sdr.access`, `leads.view/create/edit`, `tasks.view/edit` |
| **SDR Admin** | THIRD_PARTY | as do SDR + `portal.sdr.import` |

Perfis customizados são criados em `/settings/access`. Existe em produção o perfil técnico **"Integração SITE"** (somente `leads.create`), usado pelo usuário `multicortex@multicortex.ai`.

**Mecânica:**
- O JWT de acesso carrega `sub`, `email`, `name`, `roleId`, `roleName`, **`portal`** e `permissions[]`.
- Guards globais, nesta ordem: `ThrottlerGuard` → `JwtAuthGuard` → **`ThirdPartyPortalGuard`** → `PermissionsGuard`.
- `@RequirePermissions` exige todas as permissões listadas; rotas `@Public()` dispensam JWT.
- Usuários `THIRD_PARTY` só acessam rotas com `@AllowThirdPartyPortal()`; as demais respondem 403 e são auditadas (`THIRD_PARTY_PORTAL_ACCESS_DENIED`).
- Mudanças de permissão só valem após o próximo refresh do token (até 15 min).

---

### 6. Regras de negócio (backend)

#### 6.1 Autenticação
- Login por e-mail e senha (bcrypt). Rate limit: 5 req/min em login, forgot-password e change-required-password; 60 req/min no global.
- Access token JWT de 15 min. Refresh token opaco (48 bytes), guardado como hash SHA-256 e enviado em cookie `httpOnly` (`secure` em produção, `sameSite: lax`, `path` restrito), válido por 7 dias e rotacionado a cada refresh.
- `mustChangePassword`: o login devolve um token de propósito `password-change` (15 min). A nova senha deve ser diferente da atual, e todos os refresh tokens são revogados.
- Esqueci a senha: token de 1 h enviado por e-mail (`/reset-password?token=...`). Ao redefinir, as sessões são revogadas.
- Auditoria: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PASSWORD_RESET_COMPLETED` etc.

#### 6.2 Oportunidades (`leads.service.ts`)
- **Visibilidade:** sem `leads.view.all`, o usuário só vê leads em que é `owner` **ou** está em `assignees`. Lead fora do escopo retorna 404. Usuários do portal seguem a política da seção 6.5.
- **Código de negócio:** na criação, usa a sequence Postgres `lead_business_code_seq` e gera `PREFIXO + 5 dígitos` (`ENT`, `PRI`, `MIX`), com limite de 99999. Ao trocar a linha, mantém o número e troca o prefixo.
- **Valor estimado:** `estimatedValue = capexValue + opexValue × 12`, arredondado a centavos.
- **Etapa inicial:** sem `stageId`, usa a etapa de menor `order`. O `status` é derivado: etapa de ganho → `WON`, de perda → `LOST`, senão `OPEN`.
- **Mudança de etapa (PATCH):**
  - `actionDescription` é **obrigatória**; uma etapa de perda exige `lossReason`;
  - grava `StageHistoryEntry` com o tempo na etapa anterior e atualiza `stageEnteredAt` e `status`;
  - opcionalmente aceita `createTask` + `taskDueDate` + `taskPriority`, que criam **uma tarefa por responsável**, com o título igual à ação, e enviam o e-mail de tarefa criada;
  - registra a atividade `STAGE_CHANGED` e envia o e-mail "mudança de etapa" aos responsáveis.
- **Assumir lead Inbound do site (`awaitingClaim`):** um lead cujo responsável ainda é o usuário técnico do site (`multicortex@multicortex.ai`) vem com `awaitingClaim: true`. Mudar a etapa dele **exige `claimLead: true`**. O backend troca o responsável para quem moveu com uma atualização condicional, para que só o primeiro usuário assuma. Na UI, `ClaimLeadModal` pergunta se a pessoa assume; "Não" devolve o card.
- **Empresas e contatos:** `CompanyContactService.syncForLead` roda dentro da transação de criação/edição.
  - Grava a empresa e o contato se não existirem e só completa dados ausentes, sem sobrescrever.
  - A empresa é identificada pelo nome normalizado (`INSERT … ON CONFLICT`).
  - O contato é identificado por e-mail + nome; sem e-mail, por nome + empresa.
  - Os campos de texto do lead continuam sendo a fonte exibida.
- **Múltiplos responsáveis / tipos de projeto:** enviar `ownerIds` / `projectTypeIds` substitui a lista inteira; o primeiro da lista vira o principal.
- **Campos customizados:** validados por tipo (um select precisa estar entre as opções). Os obrigatórios só são checados na criação; no update, fazem upsert.
- **Timeline:** criação, campos alterados, mudança de etapa, comentários, anexos e reuniões geram `LeadActivity`.
- **Arquivar** (`POST /leads/:id/archive`) = soft delete. **Excluir** (`DELETE`) = exclusão física em cascata, remoção dos arquivos e audit `LEAD_DELETED`.
- **Autocomplete** (`/leads/autocomplete?type=company|contact`): consulta a base de empresas e contatos para todos os usuários, inclusive SDR, e completa CNPJ, segmento, e-mail e telefone.
- **E-mail "nova oportunidade"** para todos os responsáveis na criação.

#### 6.3 Integração do site (leads automáticos)
- O site envia `POST /api/v1/leads` autenticado como usuário técnico, com `siteSubmissionId`. A fila do lado do site faz retries.
- Só é aceito se o usuário for exatamente `multicortex@multicortex.ai` com o perfil `Integração SITE`, se a origem for "Site" (`CRM_SITE_SOURCE_ID`, com UUID padrão fixo no código) e se o responsável for o próprio usuário técnico.
- O lead entra como **Inbound** com o **parceiro SDR**, portanto na carteira do Portal SDR, aguardando quem o assuma (seção 6.2).
- **Idempotência:**
  - se o `siteSubmissionId` já existir com o mesmo criador, origem, e-mail de contato e empresa, a API retorna só o `{ id }` do lead existente;
  - se algum desses dados divergir, retorna 409;
  - a condição de corrida é tratada pelo erro de unicidade P2002.
- Provisionamento da conta técnica: script `scripts/create-site-integration-user.cjs`. A opção `--check` é somente leitura, a senha é pedida em TTY oculto, nenhum segredo é impresso e o perfil precisa ter exclusivamente `leads.create`.

#### 6.4 Tarefas (`tasks.service.ts`)
- **Desde 2026-11-17 as tarefas moram no Multicortex Projetos (PMO)**: `tasks.service` chama a API de integração do PMO pelo `PmoTasksGateway` (`src/pmo/`), que traduz pessoas (id do CRM ↔ e-mail) e devolve o formato de sempre. As tabelas locais de tarefas ficam só para a migração. Tarefas de projeto do PMO aparecem para o responsável e seguem as regras do PMO.
- **Visibilidade:** somente o perfil cujo nome é exatamente "Administrador" vê todas as tarefas; os demais veem apenas aquelas em que estão em `assignees` (ver dívidas técnicas).
- Quem não é administrador só pode criar ou reatribuir tarefas para si mesmo.
- **Concluir exige justificativa** e gera `TaskHistoryEntry COMPLETED`. Concluir uma tarefa já concluída → 400.
- **Prorrogar** (`extend-deadline`): a nova data deve ser posterior à atual e o motivo é obrigatório. **Transferir** (`transfer`): para um único usuário ativo, com motivo obrigatório; substitui todos os responsáveis. **Lembrete** (`reminder`): e-mail de cobrança aos responsáveis.
- Filtros: `search`, `status`, `priority`, `leadId`, `assigneeId`, `mine`, `overdue`. Ordenação: status, depois prazo.
- Semáforo no frontend (`TaskDeadline`): vermelho = vencida; amarelo = vence em até 5 dias; verde = mais de 5 dias.

#### 6.5 Portal de Terceiros — SDR (`sdr-portal/`, `docs/PORTAL_SDR.md`)
- Usuários `THIRD_PARTY` (SDR e SDR Admin) entram sempre em `/terceiro` e não acessam o resto do CRM, nem no frontend nem no backend.
- **Rotas liberadas ao portal:**
  - `GET /auth/me`;
  - `GET` dos catálogos;
  - leads: listar, autocomplete, detalhe, criar, editar, atividades, histórico e comentários;
  - anexos: enviar, listar e baixar;
  - tarefas: listar, detalhar e concluir;
  - reuniões do lead e sugestões/disponibilidade de agenda;
  - `/portal/sdr/*`.
- **Carteira:** leads do parceiro comercial SDR (`sdrPartnerId`) nas etapas com `visibleInSdrPortal`, de qualquer responsável. Ao sair dessas etapas, o lead some do portal.
- **Movimentação:** o destino precisa ser uma etapa do portal ou estar em `allowedTargetStageIds` (senão 403). Valem as regras normais (ação obrigatória, motivo de perda, histórico, e-mails). No portal, a opção "Cadastrar tarefa para esta ação" fica **desabilitada**.
- **Criação no portal:** o backend força responsável = o próprio SDR, origem = `defaultSourceId`, etapa = primeira etapa do portal, `leadType = OUTBOUND` e parceiro = SDR.
  - Só aceita campos de prospecção: linha, nome, empresa, contato, tipos de projeto, prioridade, descrição e campos customizados.
  - Na edição, aceita também os campos de movimentação e, se os valores estiverem visíveis, CAPEX, OPEX e probabilidade.
  - Qualquer outro campo (`ownerIds`, `partnerId`, `sourceId`…) → 403.
- **Valores ocultos** (padrão): CAPEX, OPEX, valor estimado, valor do parceiro técnico e probabilidade são removidos das respostas e dos e-mails enviados ao SDR.
- **Dashboard SDR** (`GET /portal/sdr/summary?period=today|week|month|custom&from&to&ownerId`, em Brasília, com a semana começando na segunda):
  - indicadores: criados, qualificados (entrada na `qualifiedStageId`), taxa de qualificação, desqualificados com os 5 principais motivos, em prospecção por etapa, parados (`staleDays`) e tempo médio por etapa;
  - evolução diária (semanal acima de 62 dias), leads que precisam de atenção, tarefas atrasadas e da semana, e últimas atividades;
  - quadro **Inbound × Outbound**;
  - cards clicáveis que abrem o grid dos leads (`GET /portal/sdr/summary/leads?metric=created|qualified|disqualified|active&leadType=`).
- **Kanban do portal:** filtro por responsável. Um clique abre a oportunidade num drawer; dois cliques abrem o LinkedIn do contato ou, na falta dele, o da empresa.
- **Importação Outbound** (permissão `portal.sdr.import`, botão no dashboard do portal):
  - **Planilha .xlsx:** colunas reconhecidas sem diferenciar acentos e maiúsculas: SDR responsável, nome, cargo, e-mail, telefone, LinkedIn do contato, empresa, localização, LinkedIn da empresa, site, telefone da empresa, porte/faturamento estimado, aderência ao cargo-alvo, faturamento e número de funcionários.
  - **Preview** em grid (marcar ou desmarcar todos). Registros da **blacklist** já vêm desmarcados.
  - **Responsável:** localizado pelo e-mail da coluna do SDR. Os não encontrados podem receber um SDR ou ser excluídos da importação.
  - **Leads criados:** entram na etapa **"Leads"** (resolvida pelo nome), com linha MIX (código `MIX#####`) e segmento "Outros". A prioridade e a probabilidade vêm da aderência.
  - **Notificação:** cada responsável recebe um e-mail com o resumo.
  - **Lote e exclusão:** cada importação gera um `OutboundImport`. "Excluir importação" apaga só as oportunidades e a blacklist daquele arquivo (audit `OUTBOUND_IMPORT_DELETED`).
- **Configuração** em `/settings/sdr-portal` (`settings.manage`): destinos permitidos, etapa qualificada, origem padrão, ocultar valores, dias para lead parado e parceiro comercial. As etapas visíveis do portal são configuradas no cadastro de **Etapas do Funil**.

#### 6.6 Parceiros
- CRUD com busca, filtros e paginação; `document` único (409 se duplicado); ativar/inativar; detalhe com as oportunidades indicadas. Operações auditadas.

#### 6.7 Dashboard (`GET /dashboard/summary`)
- **Escopo:** leads conforme `leads.view.all` e tarefas conforme `tasks.view.all` (`scope: TEAM | PERSONAL`). Etapas `hiddenInMainCrm` ficam fora.
- **Métricas:**
  - total, abertos, ganhos e perdidos;
  - `pipelineValue` = soma do estimado dos abertos, excluindo as etapas **chamadas** "Ganho (Projeto Ativo)" e "Perdido";
  - `wonValue`;
  - `averageTicket`;
  - `conversionRate` = ganhos / (ganhos + perdidos);
  - tarefas atrasadas.
- **Blocos:** funil por etapa (quantidade e valor), 6 leads movimentados recentemente, 6 tarefas atrasadas, agenda de 7 dias e desempenho por responsável (só na visão de equipe).
- **Leads "Mandatória":** prioridade com nome normalizado "mandatoria", excluindo etapas de ganho e perda e etapas cujo nome contém "espera" e "pausad".

#### 6.8 Relatório de pipeline
- Página `/reports/pipeline` (`leads.view.all`), montada a partir da listagem de leads e das etapas, sem endpoint próprio. As etapas ocultas no CRM principal ficam fora.

#### 6.9 Serviços e precificação (`settings/services/`)
- CRUD de serviços com a composição do preço (seção 4.2) e o vínculo a tipos de produto.
- **Importação da planilha de precificação:** uma aba do arquivo por tipo de produto, com preview, vínculo ao tipo de produto, download do modelo (`GET /services/import/template`) e guarda dos parâmetros de cada aba.
- O formulário de oportunidade (CRM e portal) mostra um painel com os planos e valores dos tipos de projeto selecionados, sem totais.

#### 6.10 Reuniões no Google Agenda (`calendar/`, `docs/GOOGLE_AGENDA.md`)
- **Conta de serviço** do Workspace com delegação de domínio. Escopos: `calendar.events`, `calendar.freebusy` e `tasks`.
- **Organizador:** um usuário do domínio cria o evento na própria agenda; os demais (ex.: SDR terceirizado) usam `fallbackOrganizerEmail`, entrando como convidados.
- **Gatilho:** ao mover para `meetingStageId` (Kanban interno ou do portal), o hook `useMeetingScheduling` pergunta se a pessoa quer agendar. Em seguida abre o `ScheduleMeetingModal` (título, data/hora, duração, Meet marcado, convidados com o contato do lead e quem moveu o card, mais sugestões de usuários do CRM). Depois segue para o `MoveLeadModal` com a ação já preenchida.
- **Disponibilidade:** `GET /calendar/availability` (até 45 dias) mostra só livre/ocupado dos convidados do domínio e de quem está agendando, com aviso de conflito.
- **Card:** mostra um ícone com a data enquanto houver reunião não encerrada (`lead.meetings[0]`).
- **Limitações:** não há edição nem cancelamento pelo CRM, e mudanças feitas no Google não voltam para o CRM.
- **Tarefas:** checkbox "Vincular com o Google Agenda" no formulário (só para e-mail do domínio). O `GoogleTasksService` cria/atualiza a tarefa em "Minhas tarefas" (Google Tasks, escopo `tasks`) do próprio usuário (`task_google_tasks`, uma por usuário), com o prazo como data. Como o Tasks não tem lembrete pela API, cria também um evento `⏰` às 10h do prazo com notificação (`reminderEventId`), apagado ao concluir/cancelar. Alterações, conclusão, prorrogação e transferência propagam; arquivar/excluir apaga; falhas do Google viram aviso sem impedir a gravação.

#### 6.11 Notificações por e-mail
- SMTP configurado pela UI (`/settings/email`) com botão de teste. E-mails HTML com escape de conteúdo e link para o CRM (`FRONTEND_URL`).
- Eventos: nova oportunidade, mudança de etapa, tarefa criada, tarefa atualizada/concluída, lembrete de tarefa, reset de senha, relatórios de monitoramento e resumo da importação Outbound.
- O envio é síncrono, feito dentro da requisição depois da transação.

#### 6.12 WhatsApp
- Tela de configuração (`/settings/whatsapp`) e mensagem de teste via Meta Graph API. Templates e flags de evento existem, mas **não há disparo automático**.

#### 6.13 Monitoramento Tarefas/Leads (`monitoring.service.ts`)
- **Configuração** em `/settings/monitoring`: usuário monitor, horário (Brasília) e intervalo em dias. Exige SMTP ativo.
- **Agendamento:** o processo verifica a cada 30 s com `setInterval`. A próxima execução fica no banco, e um compare-and-swap evita duplicidade entre instâncias.
- **A cada execução:**
  1. tarefas em atraso para cada responsável ativo, com o relatório completo para o monitor e os cobradores;
  2. oportunidades nas etapas chamadas "Backlog" ou "Leads", só para o monitor e os cobradores;
  3. tarefas A fazer / Em andamento para cada responsável.
- Relatórios vazios não são enviados, e falhas gravam `lastError`.

#### 6.14 Anexos e storage
- `StorageProvider` com implementação em disco local (`STORAGE_LOCAL_PATH`, volume Docker), preparado para S3/R2.
- Limite de 15 MB e allowlist: imagens, PDF, Word/Excel/ODF/RTF, CSV, TXT e ZIP.
- Leads e tarefas têm anexos. Os usuários têm avatar (endpoint público de leitura).

#### 6.15 Usuários
- CRUD, ativar/inativar, reset de senha pelo admin (pode marcar troca obrigatória), avatar e flag `isCollector`.
- Ninguém pode inativar ou excluir a própria conta, e a exclusão é bloqueada se houver vínculos impeditivos.

---

### 7. API REST

Prefixo `/api/v1`. Swagger em `/api/docs`. Validação global com `whitelist` + `forbidNonWhitelisted` (campos desconhecidos → 400). Listagens paginadas retornam `{ items, total, page, pageSize, totalPages }`.

| Recurso | Endpoints (permissão) |
|---|---|
| auth | `POST login`, `change-required-password`, `refresh`, `logout`, `forgot-password`, `reset-password` (públicos); `GET me` |
| health | `GET /health` (público, testa o banco) |
| leads | `GET /leads`, `GET /leads/autocomplete`, `GET /leads/:id` (view); `POST /leads` (create); `PATCH /leads/:id` (aceita `claimLead`), `POST /leads/:id/comments` (edit); `POST /leads/:id/archive`, `DELETE /leads/:id` (delete); `GET /leads/:id/activities`, `GET /leads/:id/stage-history` (view) |
| lead attachments | `POST/GET /leads/:leadId/attachments`, `GET .../:attachmentId/download`, `DELETE .../:attachmentId` |
| reuniões | `GET /calendar/config` (leads.view); `GET /calendar/attendee-suggestions`, `GET /calendar/availability` (leads.edit); `GET /leads/:leadId/meetings` (view), `POST /leads/:leadId/meetings` (edit) |
| tasks | `GET /tasks`, `GET /tasks/:id`, `GET /tasks/:id/history` (view); `POST /tasks` (create); `PATCH /tasks/:id`, `POST /tasks/:id/complete`, `/reminder`, `/extend-deadline`, `/transfer` (edit); `POST /tasks/:id/archive`, `DELETE /tasks/:id` (delete) |
| task attachments | `/tasks/:taskId/attachments` (mesmo padrão dos leads) |
| partners | `GET`, `GET /:id`, `POST`, `PATCH /:id`, `POST /:id/deactivate`, `POST /:id/reactivate`, `DELETE /:id` |
| users | `GET`, `GET /:id`, `GET /:id/avatar` (público), `POST /:id/avatar`, `POST`, `PATCH /:id`, `POST /:id/deactivate`, `/reactivate`, `/reset-password`, `DELETE /:id` |
| roles | `GET`, `GET /permissions-catalog`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`, `PUT /:id/permissions` |
| catálogos | `/stages`, `/priorities`, `/deal-sizes`, `/sources`, `/segments`, `/project-types`, `/services`, `/custom-fields`: `GET` (qualquer autenticado, `?includeArchived=true`), `POST`, `PATCH /:id`, `POST /:id/archive` (`settings.manage`); `PUT /reorder` em stages e priorities |
| serviços (import) | `GET /services/import/template`, `POST /services/import/preview`, `POST /services/import` (`settings.manage`) |
| portal SDR | `GET /portal/sdr/config`, `GET /portal/sdr/summary`, `GET /portal/sdr/summary/leads` (`portal.sdr.access`); `POST /portal/sdr/imports/outbound/preview`, `POST /portal/sdr/imports/outbound`, `GET /portal/sdr/imports/outbound`, `DELETE /portal/sdr/imports/outbound/:id` (+ `portal.sdr.import`) |
| dashboard | `GET /dashboard/summary` (`dashboard.view`) |
| configurações | `GET/PUT /email-settings` + `POST /test`; `GET/PUT /whatsapp-settings` + `POST /test`; `GET/PUT /monitoring-settings`, `GET /monitoring-settings/users`; `GET/PUT /sdr-portal-settings`; `GET/PUT /google-calendar-settings` + `POST /test` (todos `settings.manage`) |

---

### 8. Frontend

- **SPA React.** `lib/api.ts` faz `fetch` com o bearer token em memória (Zustand) e **refresh automático** em 401, usando uma única promessa de refresh compartilhada e o cookie `httpOnly`.
- **Rotas protegidas:** `ProtectedRoute` exige sessão e devolve usuários `THIRD_PARTY` ao portal. `portalPathFor` converte um link de lead interno em `/terceiro/kanban?lead=<id>`. `RequirePermission` checa a permissão no cliente, e `ThirdPartyPortalRoute` protege o portal.
- **Rotas:**
  - `/login`, `/forgot-password`, `/reset-password`, `/change-password`.
  - `/`: dashboard executivo.
  - `/leads` (lista com filtros, inclusive tipo de lead), `/leads/kanban`, `/leads/novo`, `/leads/:id`, `/leads/:id/editar`.
    - Kanban: drag-and-drop HTML5 com atualização otimista e rollback, modal de assumir lead, agendamento de reunião e modal de movimentação (ação, motivo de perda, responsáveis, tarefa opcional).
    - Detalhe: timeline, histórico de etapas, anexos, tarefas e reuniões.
  - `/tasks`, `/tasks/nova`, `/tasks/:id`, `/tasks/:id/editar`.
  - `/partners`, `/partners/novo`, `/partners/:id`, `/partners/:id/editar`.
  - `/reports/pipeline`.
  - `/settings/{stages|priorities|deal-sizes|sources|segments|project-types|services|custom-fields|monitoring|sdr-portal|google-calendar|email|whatsapp|access}`. `/access` redireciona para `/settings/access`.
  - **Portal:** `/terceiro` (Dashboard SDR, com importação e exclusão de importação Outbound para quem tem `portal.sdr.import`) e `/terceiro/kanban` (Kanban, drawer do lead, formulário do SDR). Layout próprio em `ThirdPartyShell`.
- **Identidade visual:**
  - roxo `#74529f` (primária), menu `#30224a`, laranja `#f68e35` de acento e azul `#4a80c0`;
  - fontes Inter (texto) e Manrope (títulos);
  - classes `card`, `btn-primary`, `form-control` e `data-table` em `index.css`.
- **UX:** tema claro/escuro persistente, menu lateral recolhível e responsivo (PWA manifest), máscaras de CPF/CNPJ/telefone/moeda, tabelas com rolagem horizontal fixa, ErrorBoundary global e versão do app no menu (`__APP_VERSION__`, hoje 0.1.2).
- O padrão completo está em `docs/padroes/PROMPT_PADRAO_FRONTEND.md`.

---

### 9. Testes

- Não há suíte Jest/E2E do Nest. Os testes usam `node --test` em `apps/backend/test/*.test.cjs` e rodam sobre o build.
- Arquivos: `company-contact`, `dashboard`, `google-calendar`, `monitoring`, `sdr-summary`, `site-integration-provisioning`, `third-party-lead-policy` e `third-party-portal`.
- Para liberar uma rota nova ao portal, atualize `third-party-portal.test.cjs`.
- Não há CI no repositório.

---

### 10. Infraestrutura e operação

#### Desenvolvimento
- `docker compose --env-file .env -f infra/docker-compose.yml up -d --build` sobe Postgres (host `5435`), backend (`3333`, watch), frontend Vite (`5173`) e Adminer (`8080`).
- Migrations e seed: `npx prisma migrate dev` / `npx prisma db seed` dentro do container backend (`/app/apps/backend`).
- Sem Docker: `npm install`, `npm run build --workspace=@multicortex/shared`, `npm run dev:backend` e `npm run dev:frontend`.
- O seed cria usuários de demonstração por perfil (admin@, gestor@, vendedor@, parceiro@, visualizador@, sdr@`multicortex.com.br`, senha no README), etapas, prioridades, portes, origens e tipos padrão, 3 parceiros, 5 leads e tarefas.

#### Produção
- **`infra/docker-compose.prod.yml`:**
  - Postgres na rede interna, sem porta exposta;
  - backend com imagem multi-stage `node:20-alpine` e usuário `node`; o entrypoint roda `prisma migrate deploy` e depois `node dist/src/main.js`, com healthcheck em `/api/v1/health`;
  - frontend Nginx publicado em `127.0.0.1:${HTTP_PORT:-8081}`, com TLS no proxy de borda.
- **Nginx:**
  - SPA com fallback para `index.html` e proxy de `/api/` para `backend:3333`;
  - gzip e cache de 1 ano para assets;
  - headers de segurança, `client_max_body_size 16m` e `/healthz`.
- **Variáveis** (`.env.production`):
  - `POSTGRES_*`;
  - `FRONTEND_URL` (CORS e links de e-mail) e `HTTP_PORT`;
  - `JWT_SECRET` e `JWT_ACCESS/REFRESH_EXPIRES_IN`;
  - opcionais: `EMAIL_/WHATSAPP_/GOOGLE_CALENDAR_ENCRYPTION_KEY` e `CRM_SITE_SOURCE_ID`.
- **Deploy:** comando `deploy-crm` no servidor (`infra/server/deploy-crm`), em 7 etapas:
  1. `git fetch`;
  2. `git reset --hard origin/master`;
  3. `docker compose build`;
  4. `up -d`;
  5. `docker image prune` e `builder prune` (mais de 7 dias);
  6. espera de 20 s;
  7. teste de `/api/v1/health` com o Host `crm.multicortex.com.br`.

  As migrations rodam no start do backend.
- **Monitor de disco:** `check-docker-disk`, via timer systemd a cada 15 min. Acima de 85% de uso em `/docker`, faz uma limpeza segura (nunca volumes) e registra um alerta no syslog e no login. Instalação: `sudo bash infra/server/install.sh`.
- **Backup:** feito manualmente antes de deploys com migration (arquivos `.dump` guardados em `~/backups`). Não há backup automatizado dos volumes `postgres_prod_data` e `backend_prod_uploads`.

#### Dados reais
- Os dados vieram do board Trello "FUNIL DE VENDA" (`npm run db:import:trello`).
- Etapas reais: Backlog, Leads, Contato/Qualificação, Diagnóstico/Reunião, POCs/MVPs/Piloto, Proposta Técnica, Proposta Comercial, Negociação, Aprovação/Assinatura, Ganho (Projeto Ativo), Em espera/Pausado e Perdido.
- As prioridades reais incluem "Mandatória". Expectativa baixa/média/alta → probabilidade de 25/50/75%.

---

### 11. Pontos de atenção e dívidas técnicas

1. **Visibilidade de tarefas por nome de perfil:** `tasks.service` libera a visão global só ao perfil chamado "Administrador", ignorando `tasks.view.all`. Já o dashboard usa a permissão.
2. **Regras dependentes de nomes:**
   - o dashboard depende de "Ganho (Projeto Ativo)", "Perdido", "Em espera/Pausado" e da prioridade "Mandatória";
   - o monitoramento depende de "Backlog" e "Leads";
   - a importação Outbound depende da etapa "Leads" e do segmento "Outros";
   - a migration inicial do portal resolveu as etapas por nome uma única vez.

   Renomear essas etapas ou prioridades altera métricas e relatórios silenciosamente. O Portal SDR, as etapas visíveis e a reunião já usam IDs ou flags.
3. **Integração do site com valores fixos no código:** e-mail `multicortex@multicortex.ai` (inclusive na regra de `awaitingClaim`), nome do perfil `Integração SITE` e UUID padrão da origem Site.
4. **WhatsApp incompleto:** só configuração e teste.
5. **Permissões no JWT:** mudanças de perfil levam até 15 min para valer.
6. **Chaves de criptografia:** sem as variáveis `*_ENCRYPTION_KEY`, a chave é derivada do `JWT_SECRET`. Rotacioná-lo torna ilegíveis a senha SMTP, o token do WhatsApp e a chave do Google.
7. **Monitoramento em processo** (`setInterval`): a reserva do horário ocorre antes do envio.
8. **E-mails síncronos:** um SMTP lento deixa as respostas lentas.
9. **NestJS 10** com alertas transitivos do `npm audit`; a migração de major está planejada como entrega separada.
10. **Sem testes amplos nem CI.** O deploy faz `reset --hard` em `origin/master`.
11. **Drag-and-drop nativo do HTML5** no Kanban não funciona em telas de toque.
12. **Google Agenda:** as reuniões não sincronizam de volta (cancelamento ou remarcação no Google).
13. `docs/PORTAL_SDR.md` ainda cita "Etapas visíveis" na tela do portal e a branch `feature/portal-sdr`. Hoje isso está no cadastro de etapas e já foi incorporado ao `master`.
14. Arquivos sensíveis ou pesados versionados em `docs/` (planilha de contatos `.xlsx`, JSON de conta de serviço) e os `TESTE_*.md` na raiz.

---

### 12. Glossário

- **Lead / Oportunidade:** a mesma entidade (`Lead`); a UI usa os dois termos.
- **Linha:** ENTERPRISE (ENT), PRIVACY (PRI) ou MIX; define o prefixo do código de negócio (ex.: `PRI00137`).
- **Inbound / Outbound:** o lead veio até a empresa (site, WhatsApp, IA) ou foi prospectado (portal ou importação).
- **Parceiro SDR:** parceiro comercial cujos leads formam a carteira do Portal SDR.
- **Assumir lead (`awaitingClaim`):** lead do site ainda sem responsável humano; o primeiro que movê-lo vira o responsável.
- **Parceiro de indicação vs. parceiro técnico:** quem trouxe o negócio vs. quem presta apoio técnico (com valor de serviço).
- **CAPEX / OPEX:** valor de parcela única / valor mensal recorrente (anualizado × 12 no valor estimado).
- **Cobrador ("Cobrar"):** usuário que recebe os relatórios completos de cobrança no monitoramento.
- **Blacklist (importação):** registros já apresentados numa importação Outbound, desmarcados nas seguintes.
- **Arquivar:** soft delete (`deletedAt`). **Excluir:** remoção física.

---

### 13. Regras para você (IA) ao trabalhar neste projeto

1. Leia os arquivos envolvidos antes de propor mudanças; este documento resume, mas não substitui o código.
2. Toda regra de acesso fica no **backend**, por permissão (nunca pelo nome do perfil). Toda rota nova precisa de `@RequirePermissions` e, se for usada pelo portal, de `@AllowThirdPartyPortal()` + o teste correspondente.
3. Use IDs ou flags configuráveis, não nomes de etapas ou prioridades, em regras novas.
4. Mudanças de banco entram por migration Prisma nova (nunca edite uma migration aplicada); em produção elas rodam no start do backend.
5. Mantenha textos e mensagens em português, o padrão visual (seção 8) e o formato de paginação da API.
6. Não faça commit, deploy ou alterações em produção sem pedido explícito. Antes de concluir, rode `npm run lint`, `npm run build` e os testes de `apps/backend/test`, e relate os resultados com fidelidade.

## FIM DO CONTEXTO
