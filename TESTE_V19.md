# TESTE_V19.md - Resumo da Arquitetura

## Visão Geral

CRM MultiCortex — monorepo gerenciado por npm workspaces, com dois apps e um pacote compartilhado.

## Estrutura

```
CRM/
├── apps/
│   ├── backend/    → NestJS + Prisma + PostgreSQL
│   └── frontend/   → React + Vite + Tailwind + Zustand
├── packages/
│   └── shared/     → Tipos e interfaces compartilhados (TypeScript)
├── infra/          → Docker Compose (dev + prod), Dockerfiles, Nginx
└── storage/        → Uploads locais
```

## Backend (`apps/backend`)

- **Framework:** NestJS (v10)
- **ORM:** Prisma (v5) com PostgreSQL 16
- **Auth:** Passport + JWT (access + refresh tokens)
- **Segurança:** Helmet, Throttler (rate limiting 60 req/min), bcrypt
- **Email:** Nodemailer (SMTP configurável)
- **WhatsApp:** Integração via API Meta (v23.0)
- **API Docs:** Swagger (`@nestjs/swagger`)

### Módulos principais

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login, registro, refresh tokens, reset de senha |
| `users` | CRUD de usuários |
| `roles` | RBAC — Roles e Permissions |
| `leads` | Entidade central do CRM (oportunidades) |
| `leads/attachments` | Anexos associados a leads |
| `partners` | Parceiros (referral, tecnologia, consultoria, canal) |
| `tasks` | Tarefas vinculadas a leads |
| `dashboard` | Métricas e relatórios |
| `audit` | Log de auditoria |
| `storage` | Upload e gerenciamento de arquivos (local/S3) |
| `settings/*` | Configurações dominiais: stages, priorities, deal sizes, sources, segments, project types, services, custom fields |
| `notifications` | Configurações de email e WhatsApp |
| `health` | Health check |

## Frontend (`apps/frontend`)

- **Framework:** React 18 com TypeScript
- **Build:** Vite 5
- **Estilo:** Tailwind CSS
- **State:** Zustand (`useAuthStore`, `useUiStore`)
- **Roteamento:** React Router v6 com rotas protegidas e controle de permissão

### Páginas

- Login, Esqueci a senha, Reset de senha, Alterar senha obrigatória
- Home / Dashboard
- Leads (Kanban, lista, detalhes)
- Tarefas
- Parceiros
- Relatórios
- Configurações (stages, prioridades, deal sizes, sources, segments, tipos de projeto, serviços, campos customizados, email, WhatsApp, perfis, permissões)

## Modelo de Dados (Prisma)

Entidades principais: `Lead`, `User`, `Role`, `Permission`, `Partner`, `Task`, `Stage`, `Priority`, `DealSize`, `Source`, `Segment`, `ProjectType`, `Service`, `CustomField`, `Attachment`, `AuditLog`, `EmailSettings`, `WhatsAppSettings`.

Relacionamentos-chave:
- Lead → Stage (funil), Priority, DealSize, Source, Partner (referral + técnico), Owner (User), ProjectTypes
- Task → Lead (opcional), Assignee (User), Creator (User)
- RBAC via many-to-many: Role ↔ Permission

## Infraestrutura

### Dev (docker-compose.yml)
- **PostgreSQL 16** (porta 5433)
- **Backend** NestJS (watch mode)
- **Frontend** Vite (hot reload, porta 5173 mapeada)
- **Adminer** para inspeção do banco (porta 8080)

### Produção (docker-compose.prod.yml)
- **PostgreSQL** (rede interna, sem exposição)
- **Backend** com health check via `/api/v1/health`
- **Frontend** com Nginx servindo build estático + proxy reverso para backend
- Redes `internal` e `public` separadas

## Comandos

```bash
npm run dev:backend   # Backend em modo watch
npm run dev:frontend  # Frontend em modo dev
npm run build         # Build de todos os workspaces
npm run lint          # Lint em todos os workspaces
```
