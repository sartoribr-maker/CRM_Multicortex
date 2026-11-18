# Prompt padrão — Backend de aplicativos Multicortex

> **Como usar:** copie tudo a partir de "INÍCIO DO PROMPT" e cole no início da conversa com a IA, substituindo os campos `{{...}}`. Depois descreva as entidades, regras e endpoints da fase atual.
> **Origem:** extraído do Multicortex CRM (`apps/backend` + `infra/`, outubro/2026). Onde o CRM tem uma dívida técnica conhecida, o padrão já traz a correção, marcada como **(evolução)**.
> Par deste documento: [`PROMPT_PADRAO_FRONTEND.md`](PROMPT_PADRAO_FRONTEND.md).

---

## INÍCIO DO PROMPT

Você vai construir o **backend** do aplicativo **{{APP_NOME}}** da Multicortex.

- Descrição: {{DESCRICAO_CURTA}}
- Slug técnico: `{{app-slug}}` (pacote `@multicortex/{{app-slug}}-backend`)
- Domínio de produção: `https://{{subdominio}}.multicortex.com.br` (API em `/api/v1` no mesmo domínio)
- Entidades principais: {{LISTA_DE_ENTIDADES}}
- Perfis de acesso previstos: {{PERFIS}} (sempre existe "Administrador")
- Integrações externas: {{INTEGRACOES_OU_NENHUMA}}

Siga a arquitetura, a infraestrutura e as regras de segurança abaixo, que são o padrão da empresa (referência: Multicortex CRM). Se algo não estiver coberto, escolha a opção mais próxima do que está definido aqui e diga qual foi a escolha.

### 1. Idioma

- Mensagens de erro, e-mails, descrições do Swagger e documentação em **português do Brasil**. Fuso de referência: Brasília (UTC−03:00); datas gravadas em UTC.
- Identificadores de código, nomes de tabela, colunas, enums e rotas da API em **inglês** (`/leads`, `/tasks/:id/complete`). Comentários em português, só quando explicam o porquê.

### 2. Stack obrigatória

| Item | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js LTS | 20 |
| Linguagem | TypeScript (`strictNullChecks`, `noImplicitAny`, decorators) | 5.5+ |
| Framework | NestJS (`@nestjs/core`, `common`, `platform-express`, `config`) | 10.4 (11.x permitido em projeto novo) |
| ORM | Prisma Client + Prisma Migrate | 5.x |
| Banco | PostgreSQL | 16 |
| Validação | `class-validator` + `class-transformer` (DTOs) | 0.14 / 0.5 |
| Autenticação | `@nestjs/passport` + `passport-jwt` + `@nestjs/jwt`; `bcrypt` para senhas | — |
| Documentação | `@nestjs/swagger` (OpenAPI em `/api/docs`) | 7.x |
| Segurança HTTP | `helmet`, `cookie-parser`, `@nestjs/throttler` | — |
| Upload | Multer (via `@nestjs/platform-express`) atrás da interface `StorageProvider` | — |
| E-mail | `nodemailer` (SMTP configurável pela UI) | 6.x |
| Planilhas | `exceljs` (importação/exportação `.xlsx`) | 4.x |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) | — |
| Lint/format | ESLint 8 + `@typescript-eslint` + Prettier 3 (mesma config do frontend) | — |

**Complementos aprovados:**

| Necessidade | Biblioteca |
|---|---|
| Jobs agendados/filas confiáveis **(evolução — o CRM usa `setInterval` no processo)** | `@nestjs/schedule` para gatilhos + tabela `outbox`/`jobs` no Postgres; `bullmq` + Redis só se o volume justificar |
| Logs estruturados em JSON **(evolução)** | `nestjs-pino` + `pino-http` |
| Testes **(evolução)** | Jest + `@nestjs/testing` (unidade) e Supertest (e2e) contra um Postgres de teste |
| Integrações Google (Agenda, Workspace) | `fetch` nativo + JWT RS256 de conta de serviço (sem SDK pesado), como no CRM |
| Armazenamento em nuvem | `@aws-sdk/client-s3` (S3 ou Cloudflare R2) como nova implementação de `StorageProvider` |

**Proibido:** Express "cru" fora do Nest, TypeORM/Sequelize/Mongoose, MongoDB como banco principal, `jsonwebtoken` direto (use `@nestjs/jwt`), `axios` (use `fetch` nativo do Node 20), `moment`, guardar segredos em texto puro no banco, SQL montado por concatenação de strings.

### 3. Arquitetura

**Monólito modular** em NestJS: um processo de API, um banco PostgreSQL, módulos por domínio. Não crie microsserviços.

```
apps/backend/
├── prisma/
│   ├── schema.prisma          # fonte única do modelo de dados
│   ├── migrations/            # versionadas; nunca editar migration já aplicada
│   └── seed.ts                # perfis, permissões, admin e dados de exemplo
├── scripts/                   # scripts operacionais (importações, provisionamento)
├── src/
│   ├── main.ts                # bootstrap (seção 5)
│   ├── app.module.ts          # ConfigModule global, ThrottlerModule, módulos
│   ├── prisma/                # PrismaModule global + PrismaService
│   ├── auth/                  # login/refresh/reset, guards, decorators, constants/permissions.ts
│   ├── users/  roles/         # usuários, perfis e matriz de permissões
│   ├── audit/                 # AuditService (trilha de auditoria)
│   ├── health/                # GET /health (público, testa o banco)
│   ├── storage/               # StorageProvider + implementação local
│   ├── notifications/         # e-mail (SMTP), WhatsApp, jobs agendados
│   ├── settings/<catalogo>/   # catálogos configuráveis (um módulo por catálogo)
│   ├── common/                # utilitários sem estado (planilhas, normalização)
│   └── <dominio>/             # <dominio>.module.ts, .controller.ts, .service.ts, dto/, <sub>/
└── test/
```

Regras de camada:

- **Controller**: só rota, decorators (`@ApiTags`, `@RequirePermissions`, `@CurrentUser`), `ParseUUIDPipe` nos IDs e repasse ao service. Nenhuma regra de negócio.
- **Service**: toda regra de negócio, validação de escopo (o que o usuário pode ver), transações e auditoria. Lança exceções do Nest com mensagem em português (`NotFoundException('Oportunidade não encontrada.')`).
- **DTO**: uma classe por entrada (`CreateXDto`, `UpdateXDto` via `PartialType`, `ListXQueryDto`), com `class-validator` e `@ApiProperty`/`@ApiPropertyOptional`. Números de query com `@Type(() => Number)`.
- **PrismaService**: o único acesso ao banco, injetado nos services. Sem repositórios genéricos extras.
- Operações com várias escritas dentro de `prisma.$transaction`. **Efeitos externos (e-mail, WhatsApp, webhooks) só depois do commit** e, preferencialmente, enfileirados numa tabela `outbox` processada fora da requisição **(evolução — no CRM o envio é síncrono e deixa a resposta lenta quando o SMTP demora)**.
- Tipos compartilhados com o frontend em `packages/shared`.

### 4. Modelo de dados (convenções Prisma)

- IDs `String @id @default(uuid())`.
- Toda entidade de negócio tem `createdAt`, `updatedAt`, `createdBy` (id do usuário) e `deletedAt` (soft delete). Na UI e na API, **"Arquivar"** = preencher `deletedAt` (`POST /:id/archive`); **"Excluir"** = remoção física (`DELETE /:id`), restrita a uma permissão própria, com auditoria e remoção de arquivos ligados.
- Listagens filtram `deletedAt: null` por padrão; `?includeArchived=true` para incluir arquivados.
- Tabelas em `snake_case` plural com `@@map("...")`; campos em `camelCase` no Prisma.
- **Valores configuráveis pelo negócio são tabelas, não enums** (etapas, prioridades, origens, segmentos, tipos…), cada uma com `name`, `color` quando houver, `order` reordenável (`PUT /reorder`) e `deletedAt`. Enums Prisma só para estados que o código interpreta (`OPEN/WON/LOST`, `TODO/IN_PROGRESS/DONE/CANCELED`).
- **Regras de negócio referenciam registros por ID ou por flag, nunca por nome** (`isWonStage`, `meetingStageId` em configuração) **(evolução — no CRM, renomear etapas como "Perdido" ou "Backlog" altera métricas silenciosamente)**.
- Configurações globais do sistema em tabelas **singleton** (`id String @id @default("default")`), editadas pela UI de Configurações.
- Relações N:N com tabela explícita (`LeadAssignee`, `RolePermission`). Quando houver "responsável principal" + lista, o primeiro da lista é o principal.
- Códigos legíveis para humanos (ex.: `ENT00042`) gerados por **sequence do Postgres**, nunca por `count() + 1`.
- Dinheiro em `Decimal @db.Decimal(14, 2)`; percentuais `Decimal(5,2)` ou `Int` 0–100.
- Histórico/linha do tempo em tabela própria (`XActivity`, `XHistoryEntry`) com tipo, mensagem, metadata `Json`, ator e data.
- Índices para toda coluna usada em filtro, ordenação ou FK; `@@unique` para chaves naturais (e-mail, documento, chave de idempotência).
- Migrations geradas com `prisma migrate dev`, revisadas e commitadas; em produção só `prisma migrate deploy`. Migration que importa/transforma dados deve ser idempotente.

### 5. Bootstrap e convenções da API

`main.ts` padrão:

```ts
const app = await NestFactory.create(AppModule);
app.getHttpAdapter().getInstance().set('trust proxy', 1);
app.enableShutdownHooks();
app.use(helmet());
app.use(cookieParser());
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
app.setGlobalPrefix('api/v1', { exclude: ['api/docs', 'api/docs-json'] });
app.enableCors({ origin: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map((o) => o.trim()), credentials: true });
// Swagger com addBearerAuth() em /api/docs
await app.listen(process.env.BACKEND_PORT ?? 3333);
```

- Prefixo **`/api/v1`**; Swagger em **`/api/docs`** (em produção, protegido ou desabilitado por variável); `GET /api/v1/health` público, testando o banco.
- REST com recursos no plural. Ações de negócio que não são CRUD viram `POST /:id/<acao>` (`/complete`, `/archive`, `/deactivate`, `/transfer`). Atualização parcial com `PATCH`.
- Listagens paginadas: query `page`, `pageSize` (máx. 100), `search`, filtros e `sortBy`/`sortOrder`; resposta **`{ items, total, page, pageSize, totalPages }`**.
- Erros no formato padrão do Nest (`{ statusCode, message, error }`), `message` em português. Campos desconhecidos → 400 (pelo `forbidNonWhitelisted`).
- Registro fora do escopo do usuário responde **404** (não revela que existe); falta de permissão responde **403**; conflito de unicidade (erro Prisma `P2002`) vira **409** com mensagem clara.
- Integrações que criam registros enviam uma **chave de idempotência** (ex.: `siteSubmissionId` único): repetição idêntica devolve o registro existente; repetição divergente devolve 409.

### 6. Segurança

#### 6.1 Autenticação

- Login por e-mail + senha; senha com `bcrypt` custo **12** **(evolução — o CRM usa 10)**; política mínima de 8 caracteres com letras e números.
- **Access token JWT** de 15 min (`JWT_ACCESS_EXPIRES_IN`), enviado em `Authorization: Bearer`. Payload: `sub`, `email`, `name`, `roleId`, `roleName`, `permissions[]` e, se houver portal externo, `portal`.
- **Refresh token opaco** (48 bytes aleatórios de `crypto.randomBytes`), guardado no banco **somente como hash SHA-256**, com `expiresAt` (7 dias), `revokedAt`, `userAgent` e `ip`. Entregue em cookie `httpOnly`, `secure` em produção, `sameSite: 'lax'`, `path` restrito à rota de auth. **Rotacionado a cada uso**; logout revoga.
- Troca obrigatória de senha no primeiro acesso (`mustChangePassword`), com token de propósito específico; ao trocar ou redefinir a senha, revogar todas as sessões.
- "Esqueci a senha": token aleatório de uso único, hash no banco, validade de 1 hora, link enviado por e-mail; a resposta é sempre a mesma, exista ou não o e-mail.
- Mudanças de permissão valem no próximo refresh (≤ 15 min). Ao inativar um usuário, revogue os refresh tokens dele imediatamente.

#### 6.2 Autorização (RBAC)

- Guards globais registrados via `APP_GUARD`, nesta ordem: `ThrottlerGuard` → `JwtAuthGuard` → (guard de portal externo, se houver) → `PermissionsGuard`.
- **Tudo é privado por padrão**; rotas abertas usam `@Public()`.
- Permissões granulares no formato **`modulo.acao`** (`leads.view`, `leads.view.all`, `leads.create`, `leads.edit`, `leads.delete`, `settings.manage`, `users.view`…), definidas num único `auth/constants/permissions.ts` (`PERMISSIONS` + `PERMISSION_CATALOG` com módulo e descrição em português) e aplicadas com `@RequirePermissions(...)` (exige todas).
- `*.view` = só os próprios registros; `*.view.all` = todos. O filtro de escopo é aplicado no service, em toda consulta.
- **Decisões de acesso sempre por permissão, nunca pelo nome do perfil** **(evolução — o CRM compara `roleName === 'Administrador'` nas tarefas)**.
- Perfis `Role` com `isSystem` (perfis padrão protegidos contra edição/exclusão) e perfis personalizados criados pela UI. Ninguém pode inativar ou excluir a própria conta; rejeitar permissões inexistentes.
- Usuários de terceiros (portal externo) têm `Role.portal = THIRD_PARTY` e só acessam rotas marcadas com `@AllowThirdPartyPortal()`; qualquer outra responde 403 e é auditada.
- Contas técnicas de integração: perfil dedicado com **apenas** a permissão necessária, provisionadas por script que não imprime segredos.

#### 6.3 Proteções gerais

- `ValidationPipe` global com `whitelist` + `forbidNonWhitelisted` + `transform`; IDs com `ParseUUIDPipe`.
- Rate limit global 60 req/min por IP; **5 req/min** em login, esqueci a senha, redefinição e troca de senha.
- `helmet()`; CORS restrito a `FRONTEND_URL` com `credentials`; `trust proxy` = 1 (atrás do Nginx).
- Segredos de integrações salvos no banco (senha SMTP, tokens de API, chaves de conta de serviço) **cifrados com AES-256-GCM** (IV aleatório de 12 bytes + auth tag, formato `iv.tag.dado` em base64), com chave própria por variável de ambiente — **nunca derivada do `JWT_SECRET`** **(evolução)**. A API nunca devolve o segredo, só se está configurado.
- Uploads: limite de tamanho (15 MB por padrão; Nginx com `client_max_body_size 16m`), **allowlist de MIME e extensão** (imagens, PDF, Office/ODF, CSV, TXT, ZIP), nome original só como metadado; arquivo salvo com chave aleatória; download sempre passa pela API checando permissão e escopo.
- Conteúdo de usuário escapado em todo HTML gerado (e-mails).
- **Auditoria** (`AuditLog`: `action`, `actorUserId`, `targetType`, `targetId`, `metadata`) para login com sucesso/falha, logout, reset de senha, CRUD de usuários/perfis/permissões, alterações de configuração, exclusões, ações sensíveis do domínio e acessos negados. Ações como união de strings tipada (`AuditAction`).
- Nunca registrar em log: senhas, tokens, hashes, segredos de integração, conteúdo de anexos.
- `npm audit` sem vulnerabilidades altas/críticas em dependências diretas antes de cada entrega.

### 7. Integrações e tarefas em segundo plano

- E-mail via SMTP configurado pela UI (singleton `EmailSettings`, senha cifrada) com botão "Enviar teste"; templates HTML simples com link para o app (`FRONTEND_URL`).
- Cada integração externa (WhatsApp/Meta, Google Agenda, site institucional) tem: singleton de configuração editável pela UI, botão de teste, segredo cifrado, chamadas com `fetch` e timeout, e falhas registradas sem derrubar a operação principal.
- Jobs agendados: horário e intervalo configuráveis no banco (`nextRunAt`, `lastRunAt`, `lastError`); reserva da execução por **compare-and-swap** no banco para não duplicar entre instâncias; relatórios vazios não são enviados. Marque o período como concluído **só depois** do envio **(evolução)**.

### 8. Armazenamento de arquivos

Interface única:

```ts
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
export interface StorageProvider {
  save(params: { buffer: Buffer; originalName: string; mimeType: string }): Promise<{ storageKey: string; sizeBytes: number }>;
  getStream(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}
```

Implementação `local` (disco em volume Docker, `STORAGE_LOCAL_PATH`) para começar; `s3`/`r2` escolhida por `STORAGE_DRIVER` sem mudar o resto do código.

### 9. Infraestrutura

#### 9.1 Desenvolvimento

`infra/docker-compose.yml` sobe tudo com um comando (`docker compose --env-file .env -f infra/docker-compose.yml up -d --build`):

- `postgres:16-alpine` com volume nomeado e healthcheck `pg_isready`; porta do host configurável (`POSTGRES_HOST_PORT`).
- `backend` em modo watch (`nest start --watch`) na porta 3333.
- `frontend` Vite na porta 5173 (proxy de `/api` para o backend).
- `adminer` na 8080 para inspecionar o banco.
- Migrations e seed: `npx prisma migrate dev` e `npx prisma db seed` dentro do container do backend. O seed cria perfis padrão, todas as permissões, um usuário por perfil (senha de demonstração documentada no README) e dados de exemplo.

#### 9.2 Produção

- **Um servidor Linux com Docker Compose** (`infra/docker-compose.prod.yml`), app em `/opt/multicortex/{{app-slug}}`, variáveis em `.env.production` (fora do git; modelo em `.env.production.example`).
- Serviços:
  - `postgres` — só na rede `internal` (`internal: true`), **sem porta publicada**.
  - `backend` — imagem multi-stage `node:20-alpine` (builder: `npm ci`, build do shared, `prisma generate`, `nest build`, `npm prune --omit=dev`; runtime: só `dist`, `prisma`, `node_modules`, **usuário `node`**, `openssl` + `curl`). Entrypoint executa `prisma migrate deploy` e depois `exec node dist/src/main.js`. Healthcheck em `/api/v1/health`. `depends_on` com `condition: service_healthy`.
  - `frontend` — imagem multi-stage que gera o build do Vite e serve com `nginx:1.27-alpine`; publicada **somente em `127.0.0.1:${HTTP_PORT}`**.
  - `restart: unless-stopped` em todos; volumes nomeados para banco e uploads.
- **Nginx do app**: SPA com fallback para `index.html`; `location /api/` → `proxy_pass http://backend:3333` com `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`; gzip; cache de 1 ano (`immutable`) para assets com hash; `server_tokens off`; `X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy`; `/healthz`.
- **TLS terminado no proxy de borda** do servidor (certificado Let's Encrypt) apontando para `127.0.0.1:${HTTP_PORT}`, com HSTS.
- **Deploy** por script no servidor (`infra/server/deploy-{{app-slug}}`): `git fetch` + `reset --hard origin/master` → `docker compose build` → `up -d` → `docker image prune -f` + `docker builder prune --filter until=168h` → espera → testa o health check. Instalar com `infra/server/install.sh` (copia para `/usr/local/bin`, mantém backup da versão anterior).
- **Monitor de disco** (timer systemd a cada 15 min): acima de 85% limpa imagens órfãs e cache de build (nunca volumes) e registra alerta no syslog e no login.
- **Backup diário automatizado (evolução — o CRM não automatiza)**: `pg_dump -Fc` do banco + cópia do volume de uploads, retenção de 7 diários e 4 semanais, cópia fora do servidor (bucket S3/R2) e teste de restauração mensal documentado.
- **CI (evolução)**: GitHub Actions em todo push/PR rodando `npm ci`, `lint`, `build` dos workspaces e testes; deploy só a partir de `master` com CI verde.

#### 9.3 Variáveis de ambiente

| Variável | Uso |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciais do Postgres |
| `DATABASE_URL` | connection string do Prisma |
| `BACKEND_PORT` / `FRONTEND_PORT` / `HTTP_PORT` | portas (3333 / 5173 / porta local do Nginx em produção) |
| `FRONTEND_URL` | origem(ns) do CORS (separadas por vírgula) e base dos links de e-mail; sem barra no final |
| `JWT_SECRET` | segredo do access token (`openssl rand -base64 48`, mínimo 32 caracteres) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` |
| `SECRETS_ENCRYPTION_KEY` | chave dos segredos cifrados no banco (independente do JWT) |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_PATH` | `local` \| `s3` \| `r2` / caminho no container |
| `NODE_ENV` | `production` ativa cookie `secure` |

O backend deve **falhar ao iniciar** se uma variável obrigatória estiver ausente em produção (validação no `ConfigModule`), em vez de cair em valores padrão inseguros como `dev-secret`.

### 10. Qualidade

- Prettier (`semi`, `singleQuote`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`) e ESLint compartilhados na raiz do monorepo.
- Testes de unidade para regras de negócio dos services (cálculos, transições de estado, escopo de visibilidade, permissões) e e2e para auth e endpoints críticos.
- Scripts do `package.json`: `build`, `start`, `start:dev`, `prisma:generate`, `prisma:migrate`, `db:seed`, `lint`, `test`.
- README com: stack, como rodar (Docker e sem Docker), usuários de demonstração, variáveis, permissões por perfil e uma seção por fase entregue. Documentos operacionais em `docs/` (deploy, integrações).

### 11. Entrega de cada fase

Ao terminar, confirme:

1. `npm run lint`, `npm run build` e os testes passando.
2. Migration nova gerada, revisada e aplicável do zero (`migrate reset`) e sobre a base existente.
3. Toda rota nova com `@RequirePermissions` (ou `@Public()` justificado), DTO validado, `@ApiTags`/`@ApiProperty` no Swagger e escopo de visibilidade aplicado no service.
4. Novas permissões adicionadas a `PERMISSIONS`, ao catálogo e aos perfis do seed.
5. Ações sensíveis auditadas; nenhum segredo em log ou resposta.
6. Variáveis novas no `.env.example` e no `.env.production.example`.
7. README e `docs/` atualizados.

## FIM DO PROMPT
