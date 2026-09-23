# Multicortex CRM - Arquitetura V16

## Visão Geral

Monorepo com **npm workspaces** contendo uma plataforma CRM fullstack para gestão de leads, oportunidades, parceiros e tarefas.

## Estrutura

```
multicortex-crm/
├── apps/
│   ├── backend/          # NestJS (API REST)
│   └── frontend/         # React + Vite (SPA)
├── packages/
│   └── shared/           # Tipos compartilhados (mínimo)
├── infra/
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
└── package.json          # workspaces: ["apps/*", "packages/*"]
```

## Backend (`apps/backend`)

- **Framework:** NestJS v10
- **ORM:** Prisma v5
- **Banco:** PostgreSQL 16
- **Auth:** JWT (access + refresh tokens) via Passport
- **Segurança:** Helmet, rate limiting (Throttler), CORS, validação com class-validator
- **Docs:** Swagger em `/api/docs`

### Módulos NestJS

| Módulo | Responsabilidade |
|--------|------------------|
| `auth` | Login, refresh, reset/change password |
| `users` | CRUD de usuários |
| `roles` | RBAC (Role → Permission) |
| `leads` | Entidade central do CRM (oportunidades) |
| `partners` | Parceiros/referrals |
| `tasks` | Tarefas vinculadas a leads |
| `dashboard` | Métricas e relatórios |
| `settings/*` | Stages, Priorities, DealSizes, Sources, Segments, ProjectTypes, Services, CustomFields |
| `storage` | Upload de anexos (local/S3) |
| `notifications` | Email (Nodemailer) e WhatsApp (Cloud API) |
| `audit` | Log de auditoria |
| `health` | Health check |

### Modelo de Dados (Prisma)

Entidades principais: `User`, `Role`, `Permission`, `Lead`, `Partner`, `Task`, `Stage`, `Priority`, `DealSize`, `Source`, `Segment`, `ProjectType`, `Service`, `CustomField`, `Attachment`, `LeadActivity`, `StageHistoryEntry`, `AuditLog`.

Sistema configurável — tabelas de domínio (stages, priorities, etc.) são editáveis pelo admin, não enums fixos.

## Frontend (`apps/frontend`)

- **Framework:** React 18 + TypeScript
- **Bundler:** Vite
- **Estilo:** Tailwind CSS
- **State:** Zustand
- **Router:** React Router v6
- **API:** Camada `lib/*.ts` com fetch wrapper (acesso via proxy `/api/v1`)

### Páginas

- Auth: Login, Forgot/Reset Password, Change Required Password
- Home: Dashboard
- Leads: Lista, Kanban, Formulário, Detalhe
- Partners: Lista, Formulário, Detalhe
- Tasks: Lista, Formulário, Detalhe
- Settings: Stages, Priorities, DealSizes, Sources, Segments, ProjectTypes, Services, CustomFields, Email, WhatsApp, Access
- Reports: Pipeline

### Controle de Acesso

- `ProtectedRoute` — autenticação obrigatória
- `RequirePermission` — verificação granular por permissão (ex: `leads.view`, `tasks.create`, `settings.manage`)

## Infraestrutura

- **Docker Compose** (dev): PostgreSQL, Backend, Frontend, Adminer
- **Volumes** para node_modules e uploads
- **Health checks** no Postgres
- **Produção:** `docker-compose.prod.yml`

## Portas Padrão

| Serviço | Porta |
|---------|-------|
| Frontend | 5173 |
| Backend | 3333 |
| Postgres | 5433 |
| Adminer | 8080 |
