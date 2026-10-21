# Prompt — Fase 1: Perfil SDR e Portal de Terceiros (`/terceiro`)

> Cole este prompt no Claude Code (VS Code) na raiz do repositório `CRM/`. Se o arquivo `CONTEXTO_PROJETO_CRM.md` estiver no repositório, referencie-o com `@CONTEXTO_PROJETO_CRM.md`.

---

## Papel e forma de trabalho

Você é um engenheiro sênior full-stack trabalhando no **Multicortex CRM** (monorepo npm workspaces: NestJS 10 + Prisma 5 + PostgreSQL 16 no backend; React 18 + Vite 5 + Tailwind + Zustand no frontend). Toda a UI, mensagens, e-mails e comentários de domínio são em **português do Brasil**. Fuso: Brasília.

Siga esta ordem, sem pular etapas:

1. **Leia o contexto** em `@CONTEXTO_PROJETO_CRM.md` e depois **explore o código real** (não confie só no documento). No mínimo:
   - `apps/backend/prisma/schema.prisma`, as últimas migrations e `prisma/seed.ts`
   - `apps/backend/src/auth/` (constants/permissions.ts, guards, decorators, estratégia JWT, payload do token, `GET /auth/me`)
   - `apps/backend/src/leads/leads.service.ts` e controller (visibilidade, mudança de etapa, `createTask`, e-mails)
   - `apps/backend/src/dashboard/` e `apps/backend/src/notifications/monitoring/` (padrão de settings singleton)
   - `apps/frontend/src/App.tsx`, `routes/ProtectedRoute`, `routes/RequirePermission`, `store/useAuthStore`, `lib/api.ts`, página de login e de troca de senha, `pages/leads/` (Kanban), `components/AppShell`
   - `infra/nginx.conf` e `infra/backend-entrypoint.sh`
2. **Entre em modo de planejamento** e me apresente um plano com: arquivos a criar/alterar, migration(s), endpoints novos, mudanças no frontend, riscos e a lista de "Decisões a confirmar" (seção abaixo). **Não escreva código antes da minha aprovação do plano.**
3. Implemente em uma branch nova `feature/portal-sdr`, em commits pequenos e com mensagens claras em português. **Nunca faça push para `master`** (o deploy de produção faz `reset --hard origin/master`) e não rode nada contra produção.
4. Ao final, rode build do backend e do frontend, os testes existentes (`node --test` em `apps/backend/test`) e os novos testes, e me entregue um resumo do que mudou + roteiro de teste manual + passos de deploy.

---

## Objetivo de negócio

A Multicortex está fechando contrato com uma **empresa terceirizada de SDR** (pré-vendas / prospecção). Os SDRs vão usar o mesmo CRM, **na mesma base de dados**, mas em uma experiência isolada e restrita:

- Existe um novo perfil **SDR**.
- Usuário com esse perfil, ao logar, é **sempre direcionado para `https://crm.multicortex.com.br/terceiro`** e **não acessa nenhuma outra área** do CRM.
- Em `/terceiro` ele vê:
  1. Um **Dashboard SDR** com os indicadores relevantes para o trabalho de prospecção.
  2. O acesso às oportunidades **apenas no formato Kanban comercial**, lendo e alimentando as mesmas tabelas de leads (criar, editar, mover etapa, comentar), com as mesmas regras de negócio já existentes (código de negócio, histórico de etapa, `actionDescription` obrigatória, timeline, e-mails).

Esta é a **Fase 1**. Mantenha o escopo enxuto e bem-feito; deixe ganchos para fases seguintes, sem implementá-las.

---

## Requisitos funcionais

### 1. Perfil SDR e confinamento ao portal (segurança em profundidade)

O isolamento **não pode depender só do frontend**. Implementar nas duas camadas:

**Modelo:**
- Adicionar em `Role` um campo que identifique perfis de portal externo, por exemplo `portal` enum `PortalType { INTERNAL, THIRD_PARTY }` com default `INTERNAL` (ou solução equivalente que você justificar no plano). **Não** basear regras no nome do perfil "SDR" — o projeto já sofre com regras dependentes de nome (ver item 10.2 do contexto).
- Nova permissão no catálogo `permissions.ts`, módulo `portal`:
  - `portal.sdr.access` — "Acessar o Portal de Terceiros (SDR)".
- Novo perfil de sistema **SDR** (`isSystem = true`, `portal = THIRD_PARTY`) com exatamente as permissões necessárias para o portal: `portal.sdr.access`, `leads.view`, `leads.create`, `leads.edit` e o que mais for **estritamente necessário** após você verificar o código (ex.: se o fluxo de "criar tarefa ao mover etapa" exigir `tasks.create`/`tasks.view`, liste no plano e justifique). Sem `leads.delete`, sem `leads.view.all`, sem acesso a usuários, perfis, configurações, parceiros ou dashboard interno.
- O Administrador recebe `portal.sdr.access` para poder **visualizar** `/terceiro` (para suporte/homologação), sem ser redirecionado para lá no login.

**Token / sessão:**
- Incluir no payload do JWT (e no retorno de `GET /auth/me`) a informação do portal do perfil (ex.: `portal: 'THIRD_PARTY'`).

**Backend — guard global de portal:**
- Criar um guard (ou estender o existente) que, para usuários de perfil `THIRD_PARTY`, **bloqueie com 403 qualquer rota que não esteja explicitamente liberada** via um decorator novo, ex.: `@AllowThirdPartyPortal()`.
- Liberar somente: endpoints do portal (novos), `auth/*` necessários (me, refresh, logout, troca de senha), leitura de catálogos usados pelo Kanban (stages, priorities, deal-sizes, sources, segments, project-types, custom-fields — somente `GET`), os endpoints de leads usados pelo Kanban/painel do card (listar, detalhe, criar, PATCH, comentários, atividades, histórico de etapas, autocomplete, anexos de lead — upload/listar/download, **sem** excluir) e o avatar.
- Verificar como o guard interage com `@Public()`, `PermissionsGuard` e a ordem de guards globais no `main.ts`/`app.module.ts`.

**Frontend — roteamento:**
- Após login (incluindo o fluxo de `mustChangePassword` e a restauração de sessão via refresh no carregamento da SPA), se `portal === 'THIRD_PARTY'` → `navigate('/terceiro', { replace: true })`.
- Criar uma rota protegida (ex.: `ThirdPartyPortalRoute`) e um "confinamento": usuário THIRD_PARTY que tentar acessar qualquer rota interna (`/`, `/leads`, `/tasks`, `/settings/...` etc.) é redirecionado para `/terceiro`.
- Usuário interno sem `portal.sdr.access` que acessar `/terceiro` é redirecionado para `/`.
- O Nginx já faz fallback da SPA para `index.html`; confirme que `/terceiro` e subrotas funcionam com F5 em produção.

### 2. Layout do portal `/terceiro`

- Layout próprio (`ThirdPartyShell`), **sem o menu lateral do CRM interno**. Cabeçalho simples com logotipo Multicortex, identificação "Portal SDR", nome/avatar do usuário, alternância de tema claro/escuro (reaproveitar `useUiStore`) e "Sair".
- Duas abas/rotas:
  - `/terceiro` → Dashboard SDR
  - `/terceiro/kanban` → Kanban comercial
- Responsivo (desktop, tablet e celular), seguindo os padrões visuais e componentes já existentes (máscaras, formatters, ErrorBoundary, `TaskDeadline` se exibir tarefas).

### 3. Configurações do portal (evitar regra por nome de etapa)

Criar um singleton `SdrPortalSettings` (id `"default"`, mesmo padrão de `MonitoringSettings`) com tela em `/settings/sdr-portal` (permissão `settings.manage`, item no menu de Configurações):

- `visibleStageIds` — etapas que aparecem como colunas no Kanban do SDR (sugestão de default na migration: Backlog, Leads, Contato/Qualificação, Diagnóstico/Reunião — resolvendo por nome **apenas uma vez**, na migration, se existirem; depois tudo é por ID).
- `allowedTargetStageIds` — etapas para as quais o SDR pode mover um card (pode incluir a etapa de "passagem de bastão", ex.: Diagnóstico/Reunião, e opcionalmente "Perdido" como desqualificação).
- `qualifiedStageId` — etapa que representa "lead qualificado / reunião agendada" (marco principal de conversão do SDR).
- `defaultSourceId` — origem aplicada automaticamente a leads criados pelo SDR (ex.: criar/usar uma origem "SDR – Prospecção ativa").
- `hideFinancialValues` (boolean, default `true`) — esconder CAPEX, OPEX, valor estimado, valor do parceiro técnico e probabilidade no portal.
- `staleDays` (inteiro, default 7) — dias sem movimentação para considerar um lead "parado".

### 4. Kanban comercial no portal (`/terceiro/kanban`)

- **Reaproveitar** o Kanban existente (`pages/leads/`) extraindo componentes compartilhados (board, coluna, card, modal de motivo de perda, modal de descrição da ação + criação opcional de tarefa) em vez de duplicar código. O Kanban interno deve continuar funcionando exatamente como hoje.
- Colunas = `visibleStageIds` na ordem configurada das etapas.
- Drag-and-drop com atualização otimista e rollback (como no interno). Ao soltar em etapa fora de `allowedTargetStageIds`, bloquear no front **e** validar no backend (403/400 com mensagem clara em PT-BR).
- Mover etapa mantém as regras atuais: `actionDescription` obrigatória, `lossReason` em etapa de perda, histórico de etapa, timeline, e-mails, criação opcional de tarefa por responsável.
- **Criar oportunidade** a partir do Kanban (botão "Nova oportunidade" e/ou "+" na coluna inicial): formulário enxuto com empresa, CNPJ, segmento, contato (nome, e-mail, telefone), linha (ENT/PRI/MIX), tipo de projeto, prioridade, descrição e campos customizados com `showInForm`. Origem = `defaultSourceId`; responsável = o próprio SDR. Usar o autocomplete de empresa/contato existente.
- **Painel lateral (drawer) ao clicar no card** — não navegar para `/leads/:id`. Mostrar e permitir editar os campos de prospecção, ver timeline, histórico de etapas, comentar e anexar arquivos. Sem arquivar/excluir. Respeitar `hideFinancialValues`.
- Filtros simples: busca (empresa/contato/código), prioridade, linha e "parados há mais de N dias".

### 5. Visibilidade e proteção de dados no backend

- O SDR vê apenas leads em que é `owner` ou está em `assignees` (regra atual de `leads.view`) **e** que estejam em etapas visíveis do portal — ver "Decisões a confirmar".
- Quando `hideFinancialValues = true`, os campos financeiros devem ser **removidos da resposta da API** para usuários THIRD_PARTY (não apenas escondidos na tela) e **ignorados/rejeitados** se enviados em POST/PATCH por esses usuários.
- Validar que o SDR não consegue, via PATCH, alterar `ownerIds` para tirar a si mesmo, nem setar `partnerId`/`technicalPartnerId`/`technicalServiceValue`, nem `status` diretamente. Liste no plano o conjunto exato de campos editáveis pelo SDR.
- Na criação por SDR, forçar `ownerId` = usuário logado e `sourceId` = `defaultSourceId` no backend.
- Registrar em `AuditLog` os acessos relevantes (ex.: `THIRD_PARTY_PORTAL_ACCESS_DENIED` quando o guard bloquear uma rota).

### 6. Dashboard SDR (`/terceiro`)

Novo endpoint `GET /api/v1/portal/sdr/summary?period=today|week|month|custom&from=&to=` (permissão `portal.sdr.access`), sempre no escopo do usuário logado (seus leads), com datas calculadas em fuso de Brasília. Testável com funções puras (mesmo padrão dos testes de dashboard existentes).

Indicadores (cards no topo):
- **Leads criados** no período (pelo SDR).
- **Leads qualificados / reuniões agendadas** no período = entradas na `qualifiedStageId` vindas de `StageHistoryEntry` cujo `changedByUser` é o SDR.
- **Taxa de qualificação** = qualificados / criados no período.
- **Desqualificados (perdidos)** no período e principais motivos de perda (top 5 de `lossReason`).
- **Carteira ativa**: total de leads abertos do SDR por etapa visível.
- **Leads parados**: abertos sem mudança de etapa há mais de `staleDays` (via `stageEnteredAt`).
- **Tempo médio por etapa** (dias) nas etapas visíveis, a partir de `timeInPreviousStageSeconds`.

Blocos visuais:
- Funil do SDR (quantidade por etapa visível).
- Evolução diária/semanal de criados × qualificados no período (gráfico simples; se não houver lib de gráficos no projeto, use SVG/CSS próprio — não adicione dependência pesada sem me consultar).
- Lista "Precisam de atenção": leads parados e leads com prioridade mais alta, com link que abre o drawer no Kanban.
- Tarefas do SDR: atrasadas e com vencimento nos próximos 7 dias (com o semáforo `TaskDeadline`), **se** o SDR tiver acesso a tarefas na decisão confirmada.
- Últimas atividades nos leads do SDR (timeline resumida).

Sem valores financeiros quando `hideFinancialValues = true`.

---

## Requisitos técnicos

- **Migrations Prisma** para: enum/campo de portal em `Role`, `SdrPortalSettings`, e **inserção de dados** (permissão `portal.sdr.access`, perfil SDR com suas permissões, vínculo da nova permissão ao Administrador, origem "SDR – Prospecção ativa" se adotada, defaults de settings). Atenção: em produção o entrypoint roda apenas `prisma migrate deploy` — **o seed não roda em produção**, então tudo que precisa existir lá deve estar em migration SQL idempotente (`ON CONFLICT DO NOTHING`/`WHERE NOT EXISTS`). Atualize também o `seed.ts` para ambientes de dev (incluir um usuário demo `sdr@multicortex.com.br` / `Senha@123`).
- **Arquivos `.js` compilados no frontend:** há `.js` versionados ao lado dos `.tsx` (ex.: `App.js` e `App.tsx`). Antes de editar qualquer arquivo que tenha "gêmeo" `.js`, **verifique qual o Vite realmente resolve** (`resolve.extensions` — o default do Vite coloca `.js` antes de `.tsx`) e como o build de produção se comporta. Me reporte o achado no plano e proponha a solução (ex.: remover os `.js` órfãos que tenham `.tsx` correspondente, ou ajustar a configuração). Não crie novos `.js` compilados.
- Permissões no JWT só atualizam no refresh (até 15 min): documente isso; o confinamento ao portal deve valer já no próximo login/refresh.
- Swagger: documentar os novos endpoints e DTOs (com `class-validator`, compatível com `whitelist` + `forbidNonWhitelisted`).
- Não alterar o comportamento da integração do site (`multicortex@multicortex.ai` / perfil "Integração SITE") nem do monitoramento.
- Não corrigir dívidas técnicas fora do escopo (ex.: visibilidade de tarefas por nome "Administrador"); apenas aponte se impactarem o portal.

## Testes

Criar testes `node --test` em `apps/backend/test/` (mesmo padrão dos existentes) cobrindo, no mínimo:
- Guard de portal: rota não liberada → 403 para THIRD_PARTY; rota liberada → passa; usuário INTERNAL não é afetado.
- Cálculo do resumo do Dashboard SDR (criados, qualificados, taxa, parados, tempo médio por etapa, limites de período em fuso de Brasília).
- Sanitização de campos financeiros para THIRD_PARTY e bloqueio de mover para etapa não permitida.

## Critérios de aceite (roteiro de teste manual)

1. Login com `sdr@multicortex.com.br` → cai em `/terceiro`; digitar `/leads`, `/tasks`, `/settings/stages` ou `/` na URL → volta para `/terceiro`.
2. Com o token do SDR, chamar `GET /api/v1/users`, `GET /api/v1/dashboard/summary`, `DELETE /api/v1/leads/:id` → 403.
3. SDR cria uma oportunidade no Kanban → ela aparece no CRM interno (`/leads`, `/leads/kanban`) para o Administrador com código de negócio correto, origem SDR e responsável = SDR.
4. SDR move o card para a etapa qualificada com descrição da ação → histórico, timeline e e-mail gerados; o indicador "Qualificados" do dashboard SDR aumenta.
5. SDR tenta mover para etapa não permitida → bloqueado com mensagem clara.
6. Com `hideFinancialValues = true`, nenhuma resposta da API do SDR contém CAPEX/OPEX/estimado.
7. Administrador acessa `/terceiro` para visualizar e continua logando normalmente em `/`.
8. Kanban interno, dashboard interno, integração do site e monitoramento seguem funcionando sem regressão.
9. F5 em `/terceiro/kanban` em build de produção (Nginx) carrega a página.

---

## Decisões a confirmar (pergunte antes de implementar; use os defaults se eu aprovar o plano sem comentar)

1. **Visibilidade dos leads:** default = SDR vê apenas leads em que é responsável/participante **e** que estão em etapas visíveis do portal. Alternativas: (a) ver também leads que ele criou e já foram passados ao comercial (somente leitura); (b) toda a equipe SDR enxerga os leads uns dos outros.
2. **Valores financeiros:** default = ocultos (`hideFinancialValues = true`).
3. **Tarefas:** default = SDR vê e conclui apenas as próprias tarefas dentro do portal (drawer do lead + bloco no dashboard), sem acesso à tela `/tasks`. Confirme se a criação automática de tarefa ao mover etapa deve ficar disponível para o SDR.
4. **Passagem de bastão:** ao mover para `qualifiedStageId`, o lead deve ganhar automaticamente um responsável interno (ex.: um usuário configurado em `SdrPortalSettings`) mantendo o SDR como participante? Default = **não** nesta fase (apenas registrar; gancho para Fase 2).
5. **Multiempresa:** default = um único perfil SDR para a empresa contratada (sem modelo de "empresa terceira" no banco). Fica como gancho para Fase 2 se houver mais de um fornecedor.

## Fora do escopo desta fase (não implementar)

Ranking/metas por SDR, comissionamento, cadências de prospecção, integração com discador/WhatsApp, relatórios exportáveis, multiempresa de terceiros, notificações específicas do portal.

## Entrega final esperada

- Resumo das alterações por camada (banco, backend, frontend, infra).
- Lista de migrations criadas e o que cada uma faz.
- Passos de deploy (branch → revisão → merge em `master` → `deploy-crm`) e como criar os usuários SDR em produção pela tela `/settings/access`.
- Pendências e sugestões para a Fase 2.
