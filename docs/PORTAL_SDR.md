# Portal de Terceiros (SDR)

Experiência isolada do CRM para a equipe terceirizada de pré-vendas (SDR), na mesma base de dados. Usuários com perfil de portal `THIRD_PARTY` acessam somente `/terceiro`:

- `/terceiro`: Dashboard SDR com os indicadores de prospecção do próprio usuário.
- `/terceiro/kanban`: Kanban comercial com criação, edição, movimentação, comentários, anexos e conclusão das próprias tarefas.

## Perfil e permissões

- `Role.portal` (`INTERNAL` | `THIRD_PARTY`) define o confinamento. Nenhuma regra depende do nome do perfil.
- Perfil de sistema **SDR** (`THIRD_PARTY`): `portal.sdr.access`, `leads.view`, `leads.create`, `leads.edit`, `tasks.view` e `tasks.edit`.
  - `tasks.edit` existe apenas para concluir tarefas. O guard do portal não libera edição, transferência, prorrogação nem lembrete de tarefas.
- O **Administrador** tem `portal.sdr.access` para visualizar o portal (suporte/homologação) e continua entrando no CRM interno.
- O portal vai no JWT. Mudanças de perfil valem no próximo login ou refresh (até 15 minutos).

## Confinamento (backend)

`ThirdPartyPortalGuard` é global e roda depois do JWT e antes das permissões. Para usuários `THIRD_PARTY`, responde **403** a qualquer rota sem `@AllowThirdPartyPortal()` e registra `THIRD_PARTY_PORTAL_ACCESS_DENIED` em `audit_logs`.

Rotas liberadas:

- `GET /auth/me` (login, refresh, logout e troca de senha são públicas).
- `GET` de `stages`, `priorities`, `deal-sizes`, `sources`, `segments`, `project-types` e `custom-fields`.
- Leads: listar, autocomplete, detalhe, criar, editar, atividades, histórico de etapas e comentários.
- Anexos de lead: enviar, listar e baixar (sem excluir).
- Tarefas: listar, detalhar e concluir.
- `GET /portal/sdr/config` e `GET /portal/sdr/summary`.

Para liberar uma nova rota ao portal, adicione `@AllowThirdPartyPortal()` ao handler e atualize `apps/backend/test/third-party-portal.test.cjs`.

## Regras para leads do SDR

- **Visibilidade:** o SDR vê e trata **todos** os leads do CRM que estão nas etapas visíveis do portal (por padrão, de Backlog até Diagnóstico/Reunião), de qualquer responsável. Ao mover um lead para uma etapa fora do portal, ele sai da visão do SDR.
- **Criação:** o backend força responsável = o próprio SDR, origem = origem padrão do portal e etapa = primeira etapa visível.
- **Campos aceitos:** `line`, `name`, `companyName`, `companyDocument`, `companySegment`, `contactName`, `contactEmail`, `contactPhone`, `projectTypeIds`, `priorityId`, `description` e `customFieldValues`.
  - Na edição, também os campos de movimentação: `stageId`, `actionDescription`, `lossReason`, `createTask`, `taskDueDate` e `taskPriority`.
  - Com os valores visíveis, também `capexValue`, `opexValue` e `successProbability`.
  - Qualquer outro campo (ex.: `ownerIds`, `partnerId`, `sourceId`) → 403.
- **Movimentação:** mantém as regras existentes: ação obrigatória, motivo em etapa de perda, histórico, timeline e e-mails. O destino precisa estar em "destinos permitidos" (senão 403). A tarefa opcional da movimentação é sempre do próprio SDR.
- **Valores ocultos** (padrão): CAPEX, OPEX, valor estimado, valor do parceiro técnico e probabilidade são removidos das respostas da API. Os e-mails de oportunidade enviados ao SDR saem sem valor estimado e probabilidade. Parceiros aparecem só com id e nome.

## Configuração (`/settings/sdr-portal`, permissão `settings.manage`)

| Campo | Uso |
| --- | --- |
| Etapas visíveis | Colunas do Kanban do SDR e filtro de visibilidade |
| Destinos permitidos | Etapas para as quais o SDR pode mover (inclua a etapa de perda para desqualificar) |
| Etapa qualificada | Marco "lead qualificado / reunião agendada" do dashboard; precisa ser um destino permitido |
| Origem padrão | Aplicada aos leads criados pelo SDR; sem ela a criação é recusada |
| Ocultar valores | Liga ou desliga a remoção dos valores financeiros |
| Dias para lead parado | Destaque no Kanban e indicador do dashboard |

A migration `20261020120100_sdr_portal_data` cria a configuração inicial, resolvendo **uma única vez** as etapas por nome (Backlog, Leads, Contato/Qualificação, Diagnóstico/Reunião; mais Perdido como destino) e a origem `SDR – Prospecção ativa`. Etapas com outros nomes ficam fora: confira a tela após o deploy.

## Dashboard SDR

`GET /portal/sdr/summary?period=today|week|month|custom&from=AAAA-MM-DD&to=AAAA-MM-DD`. Períodos em Brasília, com a semana começando na segunda. Criados, qualificados, desqualificados, tarefas e últimas ações são do usuário logado; funil, leads parados e tempo por etapa cobrem todos os leads das etapas do portal. Calcula:

- leads criados pelo SDR;
- qualificados (entradas na etapa qualificada feitas pelo SDR, uma por lead) e taxa de qualificação;
- desqualificados e os 5 principais motivos;
- leads em prospecção por etapa e leads parados (todos os leads das etapas do portal);
- tempo médio por etapa;
- evolução diária (semanal acima de 62 dias);
- leads que precisam de atenção, tarefas atrasadas e dos próximos 7 dias, e as últimas atividades.

## Implantação

1. Revisar e fazer o merge da branch `feature/portal-sdr` em `master`.
2. No servidor, rodar `deploy-crm`. O entrypoint aplica as migrations `20261020120000_sdr_portal_schema` e `20261020120100_sdr_portal_data`.
3. Conferir em produção que as permissões `leads.*` e `tasks.*` existem (vêm do seed original). A migration só vincula ao perfil SDR as que existirem.
4. Abrir **Configurações → Portal SDR** e conferir as etapas, a etapa qualificada e a origem.
5. Criar os usuários em **Configurações → Usuários e Acessos** com o perfil **SDR**, de preferência marcando a troca de senha no primeiro login.
6. Entrar como SDR e confirmar o redirecionamento para `/terceiro`.

## Fora do escopo (Fase 2)

- Passagem de bastão automática ao qualificar (responsável interno configurável).
- Multiempresa de terceiros.
- Metas e ranking.
- Ocultação de campos customizados do tipo moeda.
- Links de e-mail de tarefas apontando para o portal.
- Notificações específicas do portal.
