# Arquitetura CRM - Resumo

## Tipo de Projeto
Monorepo (npm workspaces) com arquitetura de **monolito modular**.

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | NestJS 10 (TypeScript) |
| Frontend | React 18 + Vite + TailwindCSS |
| ORM | Prisma 5.19 |
| Banco de Dados | PostgreSQL 16 |
| Containers | Docker + docker-compose |
| Proxy Reverso | Nginx (produção) |
| Estado (Frontend) | Zustand |
| Roteamento | React Router DOM 6 |

## Estrutura de Diretórios

```
CRM/
├── apps/
│   ├── backend/          # API REST (NestJS)
│   │   ├── src/          # Módulos: auth, leads, tasks, partners, settings, dashboard, etc.
│   │   ├── prisma/       # Schema (25+ modelos, 693 linhas), seed, migrations
│   │   └── scripts/      # Utilitários (ex: importação Trello)
│   └── frontend/         # SPA (React)
│       └── src/          # components, pages, lib (API clients), store, routes, types
├── packages/shared/      # Tipos compartilhados (minimal por enquanto)
├── infra/                # Docker, Nginx, compose files (dev + prod)
├── storage/              # Armazenamento de uploads
└── docs/                 # Documentação de deploy
```

## Autenticação & Segurança

- **JWT** com access token (15min) + refresh token opaque (7d) em cookie httpOnly
- **RBAC** completo: Usuários → Roles → Permissões (ex: `leads.view`, `tasks.create`)
- Rate limiting via `@nestjs/throttler` (60 req/min global, 5/min nos endpoints de auth)
- Helmet para headers de segurança
- Hashing de senhas com bcrypt

## Módulos Principais (11 fases concluídas)

| Módulo | Descrição |
|---|---|
| Auth | Login/logout, refresh, reset de senha, mudança forçada |
| Users & Roles | CRUD completo, RBAC granular |
| Leads/Oportunidades | Entidade central — Kanban, múltiplos responsáveis, campos customizados, timeline de atividade |
| Tasks | Gerenciamento de tarefas com status, prioridade, prazo e histórico |
| Partners | Rede de parceiros (Referral, Technology, Consulting, Channel) |
| Dashboard | Métricas executivas, taxas de conversão, tarefas atrasadas |
| Settings | 8 catálogos configuráveis (estágios, prioridades, fontes, segmentos, etc.) |
| Notifications | Configuração de email (Nodemailer) e WhatsApp Business API |
| Audit | Log centralizado de auditoria |
| Storage | Abstração de upload de arquivos (pronto para S3/R2) |
| Reports | Relatórios de pipeline |

## API

- Prefixo global: `/api/v1`
- Documentação Swagger em `/api/docs`
- Padrão REST com JSON
- Validação via `class-validator`
- Soft deletes (`deletedAt`)
- Paginação, filtros, ordenação e busca nos endpoints de listagem
- Visibilidade por dono (vendedores veem apenas seus leads; gestores veem todos)

## Banco de Dados

- **25+ modelos** no Prisma Schema
- Enums definidos para status, tipos, prioridades
- Padrão de soft delete em todas as tabelas de domínio
- 21 migrations (Agosto 2026)
- Seed com dados demo (5 usuários, 5 leads, 3 parceiros)

## Infraestrutura

- **Dev:** docker-compose com PostgreSQL, backend, frontend e Adminer
- **Prod:** docker-compose com Nginx, backend e PostgreSQL
- Multi-stage Docker builds para otimização de imagem
