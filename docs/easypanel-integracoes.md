# EasyPanel - Integracoes Reais

## Servicos necessarios

Crie ou conecte estes servicos no EasyPanel:

- App Next.js: `fxpapp`
- PostgreSQL
- Redis
- Evolution API
- OpenAI API
- Google Calendar via Service Account

## Variaveis do App

Configure no app `fxpapp`:

```env
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000

DATABASE_URL=postgres://USUARIO:SENHA@HOST:5432/BANCO
REDIS_URL=redis://HOST:6379
MESSAGE_BUFFER_QUIET_MS=2500
MESSAGE_BUFFER_TTL_SECONDS=60

SYSTEM_USER_ID=00000000-0000-0000-0000-000000000000
MINIMUM_SCORE_TO_SCHEDULE=55

OPENAI_API_KEY=sua_chave_openai
OPENAI_MODEL=gpt-4.1-mini

EVOLUTION_API_BASE_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_chave_evolution
EVOLUTION_INSTANCE_NAME=fausto
EVOLUTION_WEBHOOK_SECRET=um_segredo_opcional_para_o_webhook

GOOGLE_CALENDAR_ID=primary
GOOGLE_SERVICE_ACCOUNT_EMAIL=sua-service-account@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nconteudo_da_chave\n-----END PRIVATE KEY-----\n"
GOOGLE_TIME_ZONE=America/Sao_Paulo
```

## Google Agenda

1. No Google Cloud, crie um projeto.
2. Ative a API `Google Calendar API`.
3. Crie uma `Service Account`.
4. Gere uma chave JSON.
5. Copie `client_email` para `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
6. Copie `private_key` para `GOOGLE_PRIVATE_KEY`, mantendo os `\n`.
7. Abra a agenda que recebera os eventos.
8. Compartilhe essa agenda com o e-mail da service account.
9. De permissao para criar/alterar eventos.
10. Use o ID da agenda em `GOOGLE_CALENDAR_ID`.

Para agenda principal da propria service account, `primary` funciona. Para agenda de um usuario ou empresa, prefira o ID real da agenda.

## Deploy

1. No EasyPanel, conecte o repositorio `alansaint90-cmd/fxphub`.
2. Branch: `main`.
3. Dockerfile: `/Dockerfile`.
4. Porta exposta: `3000`.
5. Faca `Deploy` ou `Rebuild`.
6. Se houver cache antigo, use `Clear build cache` ou `Force rebuild`.

## Webhook Evolution

Configure a URL:

```text
https://SEU_DOMINIO/api/webhooks/evolution
```

Se configurar `EVOLUTION_WEBHOOK_SECRET`, envie esse valor no header:

```text
x-fausto-webhook-secret: seu_segredo
```

## Rotas de saude

Webhook Evolution:

```text
GET https://SEU_DOMINIO/api/webhooks/evolution
```

Memoria Redis:

```text
GET https://SEU_DOMINIO/api/health/memory
```

Quando `REDIS_URL` estiver configurado e acessivel, a rota de memoria retorna `memory: "ok"`.

## Banco

Depois do primeiro deploy, rode uma vez:

```bash
npm run db:push
```

Use o `DATABASE_URL` de producao.
