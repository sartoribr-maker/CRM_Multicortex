# Monitoramento Tarefas/Leads

Acesse **Configurações → Monitoramento Tarefas/Leads** com a permissão `settings.manage`. Configure o SMTP em **Configuração de E-mail**, selecione um usuário ativo para monitoramento, informe o horário de Brasília e o intervalo de 1 a 365 dias, marque **Monitoramento ativo** e salve.

A primeira execução ocorre na próxima ocorrência do horário escolhido. Intervalo 1 envia diariamente; intervalo 7 envia semanalmente. Alterar horário ou intervalo reinicia o agendamento. Trocar somente o destinatário preserva a próxima execução.

- Tarefas: prazo anterior ao instante da execução, não excluídas e com status diferente de Concluída e Cancelada. Cada responsável ativo recebe somente suas tarefas. O monitor e todos os usuários ativos com **Cobrar** marcado recebem um relatório completo. Quem acumula esses papéis recebe apenas um relatório de tarefas.
- Oportunidades: não excluídas, em etapas não excluídas chamadas **Backlog** ou **Leads** (sem distinção de maiúsculas). O relatório é enviado separadamente apenas ao monitor e aos cobradores.
- Relatórios vazios não são enviados. Usuários inativos ou excluídos não recebem mensagens. Se o monitor ficar inativo, os relatórios ficam suspensos até a configuração ser corrigida.

O backend verifica a agenda a cada 30 segundos. A próxima execução persiste no PostgreSQL e uma atualização condicional impede duas instâncias de executar o mesmo horário. Após uma parada, envia uma única execução pendente e avança até a próxima data futura, sem repetir todos os períodos perdidos.

A tela mostra próxima execução, última tentativa e eventual erro. Falhas SMTP não geram repetição automática imediata: os próximos relatórios serão tentados no próximo período. A reserva do horário ocorre antes do envio; uma interrupção do processo durante o disparo pode deixar entregas incompletas naquele período. Os logs do backend registram os detalhes de falhas SMTP.

## Implantação e validação

Aplique as migrations pendentes, incluindo `20260928190000_user_is_collector` e `20260928200000_monitoring_settings`, antes de iniciar o backend atualizado. No ambiente de execução do backend, utilize `npx prisma migrate deploy` a partir de `apps/backend`. Gere o cliente Prisma e reconstrua os aplicativos conforme o fluxo de implantação do projeto.

Validação local sem envio real de e-mails:

```bash
npm run prisma:generate --workspace=@multicortex/backend
npm run build
node --test apps/backend/test/monitoring.test.cjs
```

Os testes cobrem horário, recuperação após parada, concorrência, filtros das consultas, separação de destinatários, relatórios vazios e falhas de configuração/envio. A entrega real depende do SMTP configurado.
