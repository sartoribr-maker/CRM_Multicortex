# Multicortex CRM

Plataforma de CRM da Multicortex: funil de vendas em Kanban, gestão de oportunidades, parceiros, tarefas e dashboard executivo.

> Estado atual: **Fases 9 e 10 concluídas — refinamento de UX/UI e preparação para deploy**.

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
│   └── nginx/              # frontend estático e reverse proxy da API
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

### Acesso por celular ou tablet

Com o dispositivo conectado à mesma rede Wi-Fi do computador, abra no navegador:

```text
http://IP_DO_COMPUTADOR:5173
```

No Linux, o IP local pode ser consultado com `hostname -I` (normalmente começa com `192.168`). O frontend encaminha as chamadas da API pelo mesmo endereço, portanto não é necessário configurar `localhost` no dispositivo móvel. Se a página não abrir, libere a porta `5173` no firewall da máquina.

A interface possui menu lateral móvel, áreas seguras para aparelhos com recorte, controles adequados ao toque, formulários sem zoom automático no iOS, tabelas com rolagem horizontal e Kanban adaptado à largura da tela. O manifesto também permite adicionar o CRM à tela inicial em navegadores compatíveis.

Para derrubar o ambiente: `docker compose -f infra/docker-compose.yml down` (adicione `-v` para também apagar o volume de dados do Postgres).

Após subir o ambiente pela primeira vez, aplique a migration e o seed (usuários/perfis de exemplo):

```bash
docker compose --env-file .env -f infra/docker-compose.yml exec -w /app/apps/backend backend npx prisma migrate dev
docker compose --env-file .env -f infra/docker-compose.yml exec -w /app/apps/backend backend npx prisma db seed
```

## Login de demonstração (seed da Fase 1)

Todos os usuários abaixo usam a senha `Senha@123`:

| E-mail                          | Perfil                       |
| ------------------------------- | ---------------------------- |
| admin@multicortex.com.br        | Administrador (acesso total) |
| gestor@multicortex.com.br       | Gestor Comercial             |
| vendedor@multicortex.com.br     | Vendedor                     |
| parceiro@multicortex.com.br     | Parceiro                     |
| visualizador@multicortex.com.br | Visualizador                 |

O fluxo "esqueci minha senha" ainda não envia e-mail de verdade (SMTP entra na Fase 6+) — o link de redefinição é impresso no log do container `backend`.

## Configurações (Fase 2)

O Administrador tem acesso ao menu lateral expansível **Configurações**. Cada cadastro possui submenu, rota, grid e CRUD próprios, sem depender de abas ou alteração de código:

- **Etapas do Funil** (`Stage`) — colunas do Kanban, com cor, ordem (reordenável) e flags de etapa de ganho/perda.
- **Prioridades** (`Priority`) — nível de urgência, com cor e ordem (reordenável).
- **Porte do Negócio** (`DealSize`) — faixas de valor estimado, com cor.
- **Origem do Lead** (`Source`) — de onde o lead veio.
- **Tipos de Projeto** (`ProjectType`) — categoria do projeto/produto vendido.
- **Campos Customizados** (`CustomField`) — campos extras para o cadastro de leads (texto, número, data, seleção única/múltipla, booleano, moeda); a tabela de valores por lead entra na Fase 3.
- **Usuários e Acessos** — administração de pessoas, perfis personalizados e matriz granular de permissões.

Todas as 6 já vêm com dados de exemplo pelo seed (etapas sugeridas na seção 7 do documento, prioridades, portes, origens e tipos de projeto comuns). "Arquivar" é soft delete (`deletedAt`) — o item some das listagens padrão mas pode ser consultado com `?includeArchived=true`. Leitura (`GET`) é liberada para qualquer usuário autenticado; criar/editar/arquivar/reordenar exige a permissão `settings.manage` (só o perfil Administrador tem, por padrão).

## Leads/Oportunidades (Fase 3)

Entidade central do CRM, acessível pelo botão **Leads** no header (visível para quem tem `leads.view`). Cobre CRUD completo, campos customizados, upload de anexos e timeline de atividades — o board Kanban com drag-and-drop fica para a Fase 4; por ora a visão é em lista/tabela com filtros.

- **Visibilidade por dono**: quem não tem `leads.view.all` (Vendedor) só vê/edita os próprios leads; Gestor Comercial, Administrador e Visualizador veem todos.
- **Transição de etapa**: ao mudar a etapa de um lead (`PATCH /leads/:id`), o backend registra o histórico (`StageHistoryEntry`, com tempo gasto na etapa anterior), sincroniza `status` (`OPEN/WON/LOST`) conforme as flags da etapa, e **exige `lossReason`** ao mover para uma etapa de perda.
- **Timeline** (`LeadActivity`): toda criação, edição, mudança de etapa, comentário e upload de anexo vira uma entrada na aba "Linha do Tempo" do lead.
- **Anexos**: armazenados localmente em disco (volume `backend_uploads`) atrás de uma interface `StorageProvider`, pronta para trocar por S3/R2 na infra de produção sem mudar o resto do código. Limite de 15MB, allowlist de tipos (imagens, PDF, Office, texto, zip).
- **Campos customizados**: os `CustomField` cadastrados em Configurações aparecem automaticamente no formulário do lead (`showInForm`) e ficam salvos por lead em `CustomFieldValue`.

Seed inclui 5 leads de exemplo distribuídos em etapas diferentes (incluindo um Ganho e um Perdido), para a lista já nascer com dados reais.

## Kanban Comercial (Fase 4)

A rota `/leads/kanban` apresenta o pipeline em colunas configuráveis, ordenadas conforme as Etapas do Funil. Os cards podem ser movidos com drag-and-drop por usuários com `leads.edit`; cada movimento utiliza a mesma regra de transição do backend, registra o histórico e atualiza automaticamente o status da oportunidade.

- Busca e filtros por prioridade, tipo de projeto e responsável.
- Quantidade de oportunidades e soma do valor estimado por coluna.
- Carregamento de todas as páginas que correspondem aos filtros ativos.
- Atualização otimista durante o movimento, com retorno automático à coluna original em caso de erro.
- Modal obrigatório para informar o motivo ao mover uma oportunidade para uma etapa de perda.
- Acesso rápido ao detalhe do lead e alternância entre as visões de lista e Kanban.

## Parceiros (Fase 5)

O módulo `/partners` centraliza a rede de indicação, tecnologia, consultoria e canais comerciais. Inclui grid paginado com busca, filtros e ordenação, cadastro completo, detalhe com oportunidades relacionadas, status ativo/inativo e comissão padrão.

- Permissões próprias (`partners.view`, `partners.create`, `partners.edit` e `partners.delete`).
- Tipos de parceria configurados no domínio e auditoria de criação, alteração e status.
- Vínculo opcional de um parceiro a cada lead, disponível no formulário e detalhe da oportunidade.
- Contagem e consulta das oportunidades indicadas diretamente na página do parceiro.
- Seed com três parceiros de demonstração e uma oportunidade vinculada.

## Tarefas (Fase 6)

O módulo `/tasks` organiza os próximos passos da equipe comercial com responsável, prazo, prioridade, status e vínculo opcional a uma oportunidade. Usuários comuns visualizam suas próprias tarefas; gestores e administradores podem acompanhar e atribuir atividades para toda a equipe.

- Grid paginado com busca, filtros, ordenação e identificação visual de atrasos.
- Estados A fazer, Em andamento, Concluída e Cancelada; prioridades Baixa, Média, Alta e Urgente.
- Conclusão rápida pela listagem ou pela tela de detalhe, registrando data e hora.
- Formulário completo e acesso direto entre tarefa e oportunidade relacionada.
- Permissões próprias (`tasks.view`, `tasks.view.all`, `tasks.create`, `tasks.edit` e `tasks.delete`).
- Auditoria de criação, alteração, conclusão e arquivamento.

## Dashboard Executivo (Fase 7)

A página inicial agora consolida os principais indicadores comerciais e operacionais. As métricas respeitam automaticamente o escopo do usuário: vendedores visualizam apenas sua carteira e agenda; gestores e administradores acompanham toda a equipe.

- Pipeline aberto, receita conquistada, ticket médio e taxa de conversão.
- Distribuição de oportunidades e valores por etapa do funil.
- Oportunidades movimentadas recentemente.
- Tarefas atrasadas e agenda dos próximos sete dias.
- Comparativo de desempenho por responsável para usuários com visão global.
- Acessos rápidos ao Kanban, oportunidades e tarefas relacionadas.

## Usuários e Perfis de Acesso (Fase 8)

A central `/access` permite administrar usuários e criar perfis personalizados com permissões granulares agrupadas por módulo.

- Grid de usuários com busca e filtros por perfil e status.
- Criação e edição de usuários, ativação/inativação e redefinição administrativa de senha.
- Criação, edição e exclusão segura de perfis personalizados.
- Matriz visual de permissões por módulo, com seleção individual ou em grupo.
- Perfis padrão do sistema protegidos contra edição e exclusão.
- Proteção contra autoinativação e rejeição de permissões inexistentes.
- Auditoria das alterações em usuários, perfis e permissões.

## Refinamento de UX/UI (Fase 9)

- Tema claro/escuro persistente e menu lateral recolhível em desktop.
- Navegação responsiva, link para pular ao conteúdo e foco visível para teclado.
- Respeito à preferência de redução de movimento do sistema operacional.
- Tratamento global de falhas de renderização para impedir uma tela branca sem orientação.
- Design consistente entre grids, filtros, tabelas, formulários, cards e estados interativos.

## Preparação para deploy (Fase 10)

- Imagens Docker de produção multi-stage para API e frontend.
- Nginx servindo o SPA, comprimindo assets e encaminhando `/api` para a rede interna.
- Somente a porta HTTP é publicada; API e PostgreSQL não ficam expostos diretamente.
- Migrations automáticas no início da API, health checks e política de reinício.
- Headers defensivos, limite de upload, suporte correto a proxy e CORS configurável.
- Procedimento completo em [`docs/DEPLOY.md`](docs/DEPLOY.md) e variáveis em `.env.production.example`.

## Variáveis de ambiente

Ver `.env.example` na raiz. Nesta fase são utilizadas:

| Variável                                              | Descrição                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | credenciais do Postgres                                                                    |
| `DATABASE_URL`                                        | connection string usada pelo Prisma                                                        |
| `BACKEND_PORT`                                        | porta da API NestJS (padrão `3333`)                                                        |
| `FRONTEND_PORT`                                       | porta do Vite dev server (padrão `5173`)                                                   |
| `FRONTEND_URL`                                        | usada pelo backend para configurar CORS e montar o link de reset de senha                  |
| `APP_DOMAIN`                                          | domínio da aplicação (relevante a partir da Fase 10, deploy)                               |
| `JWT_SECRET`                                          | segredo de assinatura do access token JWT                                                  |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`    | validade do access token (padrão `15m`) e do refresh token (padrão `7d`)                   |
| `STORAGE_DRIVER`                                      | driver de armazenamento de anexos (`local` por ora; `s3`/`r2` em produção futura)          |
| `STORAGE_LOCAL_PATH`                                  | caminho no container onde os anexos ficam gravados (montado como volume `backend_uploads`) |

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
3. ✅ Módulo de Leads/Oportunidades (CRUD, campos customizados, anexos, timeline)
4. ✅ Kanban (drag-and-drop, filtros, detalhe do lead)
5. ✅ Parceiros
6. ✅ Tarefas
7. ✅ Dashboard executivo
8. ✅ Perfis de acesso avançados
9. ✅ Refino de UX/UI
10. ✅ Preparação para deploy
