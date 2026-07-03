# EasyPanel - Integracoes Reais

## Servicos necessarios

Crie ou conecte estes servicos no EasyPanel:

- App Next.js: `fxpapp`
- PostgreSQL
- Redis
- Evolution API
- OpenAI API
- Agenda interna do fxphub

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
```

## Agenda interna

O fxphub usa a propria agenda interna para gerar horarios, confirmar reunioes e registrar compromissos em `appointments`.

Nao configure `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` ou service account no EasyPanel. Essas variaveis nao sao mais necessarias para o agente responder no WhatsApp.

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
