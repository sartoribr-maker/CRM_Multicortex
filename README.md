# Multicortex CRM

Plataforma de CRM da Multicortex: funil de vendas em Kanban, gestão de oportunidades, parceiros, tarefas e dashboard executivo.

> Este README é expandido a cada fase de execução. Estado atual: **Fase 2 — Módulo de configurações base**.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + React Router + Zustand
- **Backend:** Node.js + TypeScript + NestJS + Prisma
- **Banco de dados:** PostgreSQL
- **Infra:** Docker + docker-compose (Postgres, Backend, Frontend, Adminer)

## Estrutura do monorepo

```
CRM/
├── apps/
│   ├── frontend/          # React + Vite
│   └── backend/           # NestJS (API REST)
├── packages/
│   └── shared/            # tipos/DTOs compartilhados entre front e back
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── nginx/              # reverse proxy (a partir da Fase 10)
├── docs/
└── Documentos/              # ativos de marca (logotipo original)
```

## Como rodar localmente

1. Copie o arquivo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
2. Suba todo o ambiente com um único comando (a partir da raiz do repositório):
   ```bash
   docker compose -f infra/docker-compose.yml up -d --build
   ```
3. Acesse:
   - Frontend: http://localhost:5173
   - API: http://localhost:3333/api/v1
   - Documentação Swagger: http://localhost:3333/api/docs
   - Health check: http://localhost:3333/api/v1/health
   - Adminer (cliente Postgres): http://localhost:8080 — sistema `PostgreSQL`, servidor `postgres`, usuário/senha/base conforme `.env`
   - Postgres exposto ao host em `localhost:5433` (porta interna do container continua `5432`; `5433` foi escolhida porque `5432` já estava em uso por um Postgres local do sistema)

Para derrubar o ambiente: `docker compose -f infra/docker-compose.yml down` (adicione `-v` para também apagar o volume de dados do Postgres).

Após subir o ambiente pela primeira vez, aplique a migration e o seed (usuários/perfis de exemplo):

```bash
docker compose --env-file .env -f infra/docker-compose.yml exec -w /app/apps/backend backend npx prisma migrate dev
docker compose --env-file .env -f infra/docker-compose.yml exec -w /app/apps/backend backend npx prisma db seed
```

## Login de demonstração (seed da Fase 1)

Todos os usuários abaixo usam a senha `Senha@123`:

| E-mail | Perfil |
|---|---|
| admin@multicortex.com.br | Administrador (acesso total) |
| gestor@multicortex.com.br | Gestor Comercial |
| vendedor@multicortex.com.br | Vendedor |
| parceiro@multicortex.com.br | Parceiro |
| visualizador@multicortex.com.br | Visualizador |

O fluxo "esqueci minha senha" ainda não envia e-mail de verdade (SMTP entra na Fase 6+) — o link de redefinição é impresso no log do container `backend`.

## Configurações (Fase 2)

O Administrador tem acesso a **Configurações** (botão no header da home) para gerenciar as listas usadas pelo funil de vendas e pelo cadastro de leads, todas editáveis sem alteração de código:

- **Etapas do Funil** (`Stage`) — colunas do Kanban, com cor, ordem (reordenável) e flags de etapa de ganho/perda.
- **Prioridades** (`Priority`) — nível de urgência, com cor e ordem (reordenável).
- **Porte do Negócio** (`DealSize`) — faixas de valor estimado, com cor.
- **Origem do Lead** (`Source`) — de onde o lead veio.
- **Tipos de Projeto** (`ProjectType`) — categoria do projeto/produto vendido.
- **Campos Customizados** (`CustomField`) — campos extras para o cadastro de leads (texto, número, data, seleção única/múltipla, booleano, moeda); a tabela de valores por lead entra na Fase 3.

Todas as 6 já vêm com dados de exemplo pelo seed (etapas sugeridas na seção 7 do documento, prioridades, portes, origens e tipos de projeto comuns). "Arquivar" é soft delete (`deletedAt`) — o item some das listagens padrão mas pode ser consultado com `?includeArchived=true`. Leitura (`GET`) é liberada para qualquer usuário autenticado; criar/editar/arquivar/reordenar exige a permissão `settings.manage` (só o perfil Administrador tem, por padrão).

## Variáveis de ambiente

Ver `.env.example` na raiz. Nesta fase são utilizadas:

| Variável | Descrição |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciais do Postgres |
| `DATABASE_URL` | connection string usada pelo Prisma |
| `BACKEND_PORT` | porta da API NestJS (padrão `3333`) |
| `FRONTEND_PORT` | porta do Vite dev server (padrão `5173`) |
| `FRONTEND_URL` | usada pelo backend para configurar CORS e montar o link de reset de senha |
| `APP_DOMAIN` | domínio da aplicação (relevante a partir da Fase 10, deploy) |
| `JWT_SECRET` | segredo de assinatura do access token JWT |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | validade do access token (padrão `15m`) e do refresh token (padrão `7d`) |

O refresh token não é um JWT: é um valor aleatório opaco, guardado com hash (SHA-256) no banco, entregue ao navegador em um cookie `httpOnly`. Variáveis de storage e SMTP estão documentadas no `.env.example` para as fases futuras, mas ainda não são utilizadas.

## Desenvolvimento sem Docker (opcional)

```bash
npm install
npm run build --workspace=@multicortex/shared
npm run dev:backend    # http://localhost:3333
npm run dev:frontend   # http://localhost:5173
```

Requer um PostgreSQL local acessível conforme `DATABASE_URL` no `.env`.

## Roteiro de fases

0. ✅ Setup do projeto (monorepo, Docker, Prisma+Postgres, hello world front↔back)
1. ✅ Autenticação e usuários (User/Role/Permission, JWT + refresh, RBAC, login/esqueci-senha)
2. ✅ Módulo de configurações base (Stages, ProjectType, Priority, DealSize, Source, CustomFields)
3. Módulo de Leads/Oportunidades
4. Kanban (drag-and-drop, filtros, detalhe do lead)
5. Parceiros
6. Tarefas
7. Dashboard executivo
8. Perfis de acesso avançados
9. Refino de UX/UI
10. Preparação para deploy
