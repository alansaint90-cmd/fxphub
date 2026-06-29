# Integracoes

## Evolution API

Configure:

- `EVOLUTION_API_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

Webhook de entrada:

```text
POST /api/webhooks/evolution
```

O endpoint espera o formato padrao do evento Evolution com `data.key.remoteJid`,
`data.pushName`, `data.messageType` e `data.message`.

## OpenAI

Configure:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

O codigo usa OpenAI apenas para polir a resposta final.
Score, classificacao, dores e permissao de agenda ficam em TypeScript.

## Redis

Configure:

- `REDIS_URL`

`ConversationBuffer` esta pronto para juntar mensagens picotadas por uma janela curta.

## PostgreSQL

Configure:

- `DATABASE_URL`

Comandos:

```bash
docker compose up -d
npm install
npm run db:push
npm run dev
```

## Supabase

Configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Use a service role apenas no servidor.
Nao exponha essa chave em componentes client-side nem variaveis `NEXT_PUBLIC_*`.

Ao expor tabelas via Data API, habilite RLS e crie politicas especificas por papel/usuario.
