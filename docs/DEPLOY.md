# Implantação em produção

A composição de produção publica somente o Nginx. PostgreSQL e API permanecem isolados na rede interna; o frontend usa `/api/v1` no mesmo domínio, evitando dependência de CORS entre domínios.

## Pré-requisitos

- Servidor Linux com Docker Engine e Docker Compose v2.
- DNS do domínio apontando para o servidor.
- Proxy de borda com certificado TLS (Caddy, Traefik, load balancer ou serviço de nuvem).
- Backup externo e periódico dos volumes do PostgreSQL e de anexos.

## Primeira implantação

```bash
cp .env.production.example .env.production
# Edite senhas, domínio e JWT_SECRET antes de continuar.
docker compose --env-file .env.production -f infra/docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f infra/docker-compose.prod.yml ps
```

As migrations são aplicadas automaticamente e de forma idempotente antes da API iniciar. O seed não roda em produção.

Valide `http://SERVIDOR/healthz` e `http://SERVIDOR/api/v1/health`. O segundo endpoint também testa a conexão com o banco.

## Atualização

```bash
git pull --ff-only
docker compose --env-file .env.production -f infra/docker-compose.prod.yml up -d --build
```

## Operação e segurança

- Termine HTTPS no proxy de borda e encaminhe para `HTTP_PORT`; não exponha a porta do banco nem da API.
- Restrinja firewall a SSH, HTTP e HTTPS e mantenha Docker/SO atualizados.
- Guarde `.env.production` fora do Git e use um gerenciador de segredos quando disponível.
- Faça restore de teste dos backups; um backup sem restauração validada não é garantia de recuperação.
- Consulte logs com `docker compose --env-file .env.production -f infra/docker-compose.prod.yml logs -f --tail=200`.

## Manutenção de dependências

Execute `npm audit --omit=dev` antes de cada release. A versão atual do NestJS 10 possui alertas transitivos cuja correção automática exige migração para uma versão principal nova; essa migração deve ser feita em uma entrega própria, com testes de regressão, e nunca com `npm audit fix --force` diretamente em produção.
