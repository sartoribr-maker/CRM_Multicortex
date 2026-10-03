# Provisionamento manual da integração do site

O script não roda na inicialização ou no deploy. A criação exige execução manual
aprovada; importar seus helpers em testes não executa a CLI. Não usar registros
reais para testar.

Configuração obrigatória no ambiente do processo:

- `CRM_INTEGRATION_EMAIL`: e-mail técnico válido.
- `CRM_INTEGRATION_ROLE_ID`: UUID da role técnica já provisionada.
- `CRM_PROVISION_DATABASE_URL`: destino PostgreSQL aprovado; se ausente, usa
  `DATABASE_URL`. Nenhum host, porta ou banco é substituído pelo script.
- `CRM_INTEGRATION_NAME`: nome opcional, padrão `Integração do site`.

Não colocar valores reais no Git, terminal compartilhado ou logs. Fornecer a URL
por gestor de segredos/ambiente protegido. A senha é solicitada duas vezes em TTY
com entrada oculta; não é aceita por argumento ou pipe, nem impressa ou registrada.
O DTO existente valida os dados; o serviço existente faz hashing e auditoria.

A role deve ter exclusivamente `leads.create` ativa. A role não é criada pelo
script. Uma conta existente somente é aceita se ativa, com a mesma role e sem
exigência de troca de senha; divergências falham sem alterar a conta. Repetição
com configuração compatível preserva a senha e o usuário existentes.

Após preparar o ambiente e obter autorização, executar na raiz de `apps/backend`:

```bash
TS_NODE_PROJECT=tsconfig.json node -r ts-node/register/transpile-only scripts/create-site-integration-user.cjs --check
# Criação manual, somente depois de conferir destino e role:
TS_NODE_PROJECT=tsconfig.json node -r ts-node/register/transpile-only scripts/create-site-integration-user.cjs
```

`--check` é somente leitura e não solicita senha. Sem parâmetros obrigatórios,
role segura ou terminal adequado, a operação é recusada. A CLI imprime apenas
estado controlado da conta; nunca password/hash, URL, conexão ou stack.

Homologação e produção têm destinos, roles, contas e secrets independentes.
Aplicar migrations no ambiente aprovado e provisionar a role por procedimento
administrativo separado antes desta CLI. Git não instala scheduler nem cria
usuário de produção. O site precisa configurar origem Site e produto DevCore,
além das credenciais server-side, usando os IDs do próprio ambiente.

Validação isolada (sem banco e sem executar main):

```bash
node test/site-integration-provisioning.test.cjs
```
