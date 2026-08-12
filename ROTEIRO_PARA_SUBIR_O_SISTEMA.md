# Roteiro para subir o Multicortex CRM

Este roteiro inicia todo o sistema com Docker: banco PostgreSQL, backend, frontend e Adminer.

## 1. Abrir o terminal

No VS Code, clique em **Terminal > New Terminal**.

## 2. Entrar na pasta raiz do projeto

Copie e execute:

```bash
cd ~/Multicortex/Projetos/CRM
```

Confirme que está na pasta correta:

```bash
pwd
```

O resultado deve terminar com:

```text
/Multicortex/Projetos/CRM
```

> Não entre nas pastas `apps/backend` ou `apps/frontend`. Os comandos deste roteiro são executados na raiz `CRM`.

## 3. Confirmar que o Docker está funcionando

Abra o aplicativo Docker, caso ele ainda não esteja aberto, e execute:

```bash
docker --version
docker compose version
```

Os dois comandos devem exibir suas versões. Se aparecer uma mensagem dizendo que não foi possível conectar ao Docker daemon, inicie o Docker e tente novamente.

## 4. Preparar o arquivo de configuração (somente na primeira vez)

Veja se o arquivo `.env` já existe:

```bash
ls -la .env
```

Se aparecer o arquivo `.env`, avance para o passo 5.

Somente se ele não existir, crie-o a partir do exemplo:

```bash
cp .env.example .env
```

## 5. Subir o sistema

Execute:

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Na primeira execução, pode demorar alguns minutos. Espere o terminal concluir e liberar uma nova linha para comandos.

## 6. Conferir os serviços

Execute:

```bash
docker compose --env-file .env -f infra/docker-compose.yml ps
```

Os serviços `postgres`, `backend`, `frontend` e `adminer` devem aparecer como `Up`. O PostgreSQL deve aparecer como `healthy`.

## 7. Preparar o banco (somente na primeira vez)

Na primeira instalação, aplique as migrations:

```bash
docker compose --env-file .env -f infra/docker-compose.yml exec -w /app/apps/backend backend npx prisma migrate dev
```

Depois, cadastre os dados e usuários de demonstração:

```bash
docker compose --env-file .env -f infra/docker-compose.yml exec -w /app/apps/backend backend npx prisma db seed
```

Esses dois comandos não precisam ser repetidos toda vez que o computador for ligado.

## 8. Acessar o sistema

Abra no navegador:

- CRM: <http://localhost:5173>
- Documentação da API: <http://localhost:3333/api/docs>
- Verificação da API: <http://localhost:3333/api/v1/health>
- Adminer: <http://localhost:8080>

Login de administrador para demonstração:

```text
E-mail: admin@multicortex.com.br
Senha:  Senha@123
```

## Uso diário

Depois que o ambiente já estiver instalado, normalmente basta executar:

```bash
cd ~/Multicortex/Projetos/CRM
docker compose --env-file .env -f infra/docker-compose.yml up -d
```

Depois, acesse <http://localhost:5173>.

## Encerrar o sistema

Para parar e remover os contêineres, preservando os dados do banco:

```bash
cd ~/Multicortex/Projetos/CRM
docker compose --env-file .env -f infra/docker-compose.yml down
```

> Não acrescente `-v` ao comando. Essa opção apaga o volume e os dados do banco.

## Comandos úteis para resolver problemas

### Ver os logs de todos os serviços

```bash
docker compose --env-file .env -f infra/docker-compose.yml logs -f
```

Pressione `Ctrl+C` para sair da visualização dos logs. Isso não derruba o sistema.

### Ver somente os logs do backend

```bash
docker compose --env-file .env -f infra/docker-compose.yml logs -f backend
```

### Ver somente os logs do frontend

```bash
docker compose --env-file .env -f infra/docker-compose.yml logs -f frontend
```

### Reiniciar os serviços

```bash
docker compose --env-file .env -f infra/docker-compose.yml restart
```

### Recriar após mudanças em dependências ou Dockerfiles

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

## Erros de comando já conhecidos

- No backend, o script local é `npm run start:dev`, não `npm run dev`.
- No frontend, o script local é `npm run dev`, não `npm run start:dev`.
- Não existe a pasta `apps/api`; a API está em `apps/backend`.
- Usando Docker Compose conforme este roteiro, não é necessário iniciar backend e frontend manualmente em terminais separados.

## Publicação (Passo a Passo)

Você altera o CRM
        ↓
testa localmente
        ↓
git add
        ↓
git commit
        ↓
git push
        ↓
GitHub

Depois entra na VM:

ssh ec2-user@13.220.245.81

e executa simplesmente:

deploy-crm