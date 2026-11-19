# Google Agenda: agendamento de reuniões

Quando uma oportunidade é movida para a **etapa de reunião** (padrão: Diagnóstico/Reunião), no Kanban interno ou no Portal SDR, o CRM pergunta se o usuário quer agendar uma reunião.

- **Sim:** abre o formulário de agendamento:
  - título, data e horário (Brasília) e duração;
  - **Google Meet já marcado**;
  - convidados: o contato do lead já vem incluído, e é possível digitar outros e-mails ou escolher entre as sugestões de usuários do CRM.
- **Ao confirmar:** o evento é criado no Google Agenda, o Google envia os convites com o link do Meet e o CRM segue para a confirmação da mudança de etapa, com a ação já descrita.
- **Mover sem agendar:** segue o fluxo normal de mudança de etapa.

Ao incluir um convidado do domínio do Workspace (ex.: `@multicortex.ai`), o formulário mostra a agenda do mês da reunião com os dias e horários **ocupados** desse convidado e de quem está agendando. O CRM consulta só livre/ocupado, então título, participantes e demais detalhes dos compromissos nunca são lidos. Se o horário escolhido conflitar, aparece um aviso, e clicar em um dia usa essa data. E-mails de fora do domínio não são consultados.

O card ganha um ícone de calendário com a data enquanto houver uma reunião agendada que ainda não terminou. A reunião também aparece na linha do tempo do lead.

## Em qual agenda a reunião é criada

| Quem agenda | Agenda (organizador) |
| --- | --- |
| Usuário com e-mail do domínio do Workspace (ex.: `@multicortex.ai`) | A agenda do próprio usuário |
| Usuário de fora do domínio (ex.: SDR terceirizado) | A agenda padrão (`multicortex@multicortex.ai`), com o usuário como convidado |

Os convidados externos (contatos das empresas) não precisam de conta Google: recebem o convite por e-mail.

## Configuração (administrador do Google Workspace)

A integração usa uma **conta de serviço com delegação em todo o domínio**. A senha de envio de e-mail (SMTP) **não** serve para isso.

1. **Projeto no Google Cloud:** acesse https://console.cloud.google.com, crie ou escolha um projeto e ative a **Google Calendar API** (APIs e serviços → Biblioteca).
2. **Conta de serviço:** em IAM e administrador → Contas de serviço, crie uma conta (ex.: `crm-agenda`). Em **Chaves**, adicione uma chave do tipo **JSON** e guarde o arquivo baixado. Anote o **ID do cliente** (número) da conta.
3. **Delegação em todo o domínio:** no Admin Console do Workspace (https://admin.google.com), vá em Segurança → Acesso e controle de dados → Controles de API → **Gerenciar delegação em todo o domínio** → Adicionar:
   - ID do cliente: o número do passo 2;
   - Escopos (separados por vírgula): `https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/calendar.freebusy,https://www.googleapis.com/auth/tasks` (o último é usado pelas tarefas; veja abaixo).
     O primeiro cria as reuniões; o segundo, somente leitura, consulta os horários ocupados.
4. **No CRM:** em **Configurações → Google Agenda**, informe o domínio (`multicortex.ai`) e a agenda padrão (`multicortex@multicortex.ai`). Envie o arquivo JSON da chave, escolha a etapa de reunião, marque **Integração ativa** e salve.
5. Clique em **Testar conexão**. O teste acessa a agenda padrão. Se falhar com "não autorizou a conta de serviço", confira o passo 3 (pode levar alguns minutos para propagar).

A chave é guardada criptografada (AES-256-GCM), com `GOOGLE_CALENDAR_ENCRYPTION_KEY` ou, na ausência dela, `JWT_SECRET`. Trocar esse segredo exige reenviar a chave. Arquivos de chave não devem ser versionados no Git.

## Tarefas no Google Agenda (Google Tasks)

No formulário de inclusão/alteração de tarefas há o checkbox **Vincular com o Google Agenda**. A tarefa entra em **"Minhas tarefas"** (Google Tasks), que aparece no painel de tarefas e na grade do Google Agenda. O checkbox só fica habilitado para usuários com e-mail do domínio do Workspace (`workspaceDomain`, padrão `multicortex.ai`), porque a tarefa é criada na conta do próprio usuário.

- **Marcado ao salvar:** cria a tarefa com o título, as notas (descrição + link para o CRM) e o prazo como data. Se ela já existe, é atualizada. Uma tarefa excluída no Google é recriada.
- **Lembrete às 10h:** como a API do Google Tasks não aceita horário nem notificação, o CRM cria também um evento `⏰ <título>` das 10h às 10h15 (São Paulo) no dia do prazo, com notificação no horário, sem convidados e como "livre". Ele acompanha as alterações da tarefa e é apagado quando ela é concluída ou cancelada (volta se a tarefa for reaberta). O evento usa o escopo `calendar.events`, que já está autorizado.
- **Desmarcado numa tarefa já vinculada:** a tarefa e o lembrete são apagados do Google.
- O vínculo é por usuário (`task_google_tasks`). Alterar, prorrogar ou transferir a tarefa atualiza as tarefas Google de todos os vinculados. Concluir no CRM marca como concluída no Google, e reabrir desmarca. Arquivar ou excluir apaga.
- Se o Google falhar, a tarefa é salva mesmo assim e o usuário vê um aviso.

**Configuração extra (uma vez):**
1. No Google Cloud, no projeto da conta de serviço, ative a **Google Tasks API**.
2. No Admin Console (Segurança → Controles de API → Delegação em todo o domínio), edite o client ID da conta de serviço e acrescente o escopo `https://www.googleapis.com/auth/tasks` aos que já existem (`calendar.events` e `calendar.freebusy`).

## Integração automática de tarefas (cadastro do usuário)

No cadastro do usuário (Acessos → Usuários) há o checkbox **Integrar Tarefas com Calendar do Google**. Ele só pode ser marcado com a integração ativa e e-mail do domínio do Workspace (ex.: `@multicortex.ai`), porque as tarefas vão para a conta Google do próprio usuário.

Com a opção marcada, valem estas regras para as tarefas sob responsabilidade do usuário (responsável ou corresponsável, criadas no CRM ou no PMO):

| No CRM/PMO | No Google ("Minhas tarefas") |
| --- | --- |
| Entra em **Em andamento** | A tarefa é criada |
| Muda título, descrição, prazo, prioridade etc. | A tarefa é atualizada |
| Vai para **Concluída** | É marcada como feita |
| Vai para **A Fazer** ou **Cancelada**, é arquivada/excluída ou sai da responsabilidade do usuário | É excluída |

| No Google | No CRM/PMO |
| --- | --- |
| Marcar como concluída | A tarefa vai para **Concluída** (justificativa: "Concluída pelo usuário no Google Agenda (Tarefas).") |
| Excluir a tarefa | A tarefa vai para **Cancelada** |

- **Campos:** título `[código] título`; notas com a descrição, prioridade, oportunidade (e empresa), etapa da oportunidade, projeto, responsáveis, quem criou e o link da tarefa no CRM; prazo como data (o Google Tasks não guarda horário). Não há lembrete das 10h nessas tarefas.
- **Quando sincroniza:** na hora, quando a tarefa é alterada pelo CRM; e a cada 2 minutos (`GOOGLE_TASKS_AUTO_SYNC_INTERVAL_SECONDS`, mínimo 30), que pega as mudanças feitas no PMO e no Google. O Google Tasks não avisa alterações, por isso o que é feito lá aparece no CRM em até um intervalo.
- **Conflito:** se a tarefa mudou no CRM (ex.: voltou para "A Fazer") antes de a ação feita no Google ser lida, vale a do CRM.
- Depois de concluída, a tarefa deixa de ser acompanhada: reabri-la no Google não muda o CRM. Se ela voltar para "Em andamento" no CRM, uma nova tarefa é criada no Google.
- Mover a tarefa para outra lista do Google conta como exclusão (a integração usa "Minhas tarefas").
- **Desmarcar a opção** (ou inativar o usuário, ou trocar o e-mail) exclui do Google as tarefas em andamento criadas pela integração. As concluídas ficam.
- Com a opção marcada, as tarefas **Em andamento** que o usuário já tinha vinculado pelo checkbox da tarefa (**Vincular com o Google Agenda**) passam para a integração automática: a mesma tarefa do Google é reaproveitada, o lembrete das 10h é apagado e, se ela já tinha sido concluída/excluída no Google, isso é aplicado no CRM. Vínculos manuais de tarefas em outras situações continuam com as regras do vínculo manual. Numa tarefa que está no Google pela integração automática, o checkbox da tarefa aparece marcado e bloqueado.
- Escopo usado: `https://www.googleapis.com/auth/tasks` (o mesmo do vínculo manual; nenhuma configuração nova no Google).

## API

- `GET /calendar/config`: integração ativa, etapa de reunião e duração padrão.
- `GET /calendar/attendee-suggestions?search=`: usuários ativos do CRM.
- `GET /calendar/availability?emails=a,b&from=&to=`: intervalos ocupados (até 45 dias), apenas de e-mails do domínio.
- `GET /leads/:id/meetings` e `POST /leads/:id/meetings`: o POST recebe `title`, `description`, `startAt`, `endAt`, `attendees[]` e `withMeet`.
- `GET /tasks/google-calendar`: integração ativa e se o usuário logado pode vincular. `POST /tasks` e `PATCH /tasks/:id` aceitam `syncGoogleCalendar` (`true` vincula/atualiza no Google Tasks, `false` remove).
- `POST /users` e `PATCH /users/:id` aceitam `googleTasksAutoSync` (integração automática de tarefas).
- `GET`/`PUT /google-calendar-settings` e `POST /google-calendar-settings/test`: exigem `settings.manage`.

## Limitações atuais

- Remarcações e cancelamentos feitos direto no Google Agenda não voltam para o CRM. O ícone some quando termina o horário registrado no agendamento.
- Não há edição nem cancelamento de reunião pelo CRM.
