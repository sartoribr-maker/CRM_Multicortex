# Google Agenda: agendamento de reuniões

Quando uma oportunidade é movida para a **etapa de reunião** (padrão: Diagnóstico/Reunião), no Kanban interno ou no Portal SDR, o CRM pergunta se o usuário quer agendar uma reunião.

- **Sim:** abre o formulário de agendamento:
  - título, data e horário (Brasília) e duração;
  - **Google Meet já marcado**;
  - convidados: o contato do lead já vem incluído, e é possível digitar outros e-mails ou escolher entre as sugestões de usuários do CRM.
- **Ao confirmar:** o evento é criado no Google Agenda, o Google envia os convites com o link do Meet e o CRM segue para a confirmação da mudança de etapa, com a ação já descrita.
- **Mover sem agendar:** segue o fluxo normal de mudança de etapa.

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
   - Escopo: `https://www.googleapis.com/auth/calendar.events`.
4. **No CRM:** em **Configurações → Google Agenda**, informe o domínio (`multicortex.ai`) e a agenda padrão (`multicortex@multicortex.ai`). Envie o arquivo JSON da chave, escolha a etapa de reunião, marque **Integração ativa** e salve.
5. Clique em **Testar conexão**. O teste acessa a agenda padrão. Se falhar com "não autorizou a conta de serviço", confira o passo 3 (pode levar alguns minutos para propagar).

A chave é guardada criptografada (AES-256-GCM), com `GOOGLE_CALENDAR_ENCRYPTION_KEY` ou, na ausência dela, `JWT_SECRET`. Trocar esse segredo exige reenviar a chave. Arquivos de chave não devem ser versionados no Git.

## API

- `GET /calendar/config`: integração ativa, etapa de reunião e duração padrão.
- `GET /calendar/attendee-suggestions?search=`: usuários ativos do CRM.
- `GET /leads/:id/meetings` e `POST /leads/:id/meetings`: o POST recebe `title`, `description`, `startAt`, `endAt`, `attendees[]` e `withMeet`.
- `GET`/`PUT /google-calendar-settings` e `POST /google-calendar-settings/test`: exigem `settings.manage`.

## Limitações atuais

- Remarcações e cancelamentos feitos direto no Google Agenda não voltam para o CRM. O ícone some quando termina o horário registrado no agendamento.
- Não há edição nem cancelamento de reunião pelo CRM.
