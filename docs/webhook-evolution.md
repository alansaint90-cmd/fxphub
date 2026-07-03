# Webhook Evolution API

## URL do Webhook

No EasyPanel, depois de apontar o dominio para o app, configure a Evolution API para enviar eventos para:

```text
https://SEU_DOMINIO/api/webhooks/evolution
```

Exemplo:

```text
https://fausto.seudominio.com/api/webhooks/evolution
```

## Metodo

```text
POST
```

## Header opcional de seguranca

Se `EVOLUTION_WEBHOOK_SECRET` estiver configurado no EasyPanel, envie:

```text
x-fausto-webhook-secret: SEU_SEGREDO
```

Se esse header estiver ausente ou incorreto, o webhook retorna `401`.

## Eventos esperados

O webhook aceita mensagens de texto da Evolution API com campos como:

```json
{
  "instance": "fausto",
  "data": {
    "key": {
      "remoteJid": "5571999999999@s.whatsapp.net",
      "id": "MESSAGE_ID",
      "fromMe": false
    },
    "pushName": "Nome do Lead",
    "messageType": "conversation",
    "message": {
      "conversation": "Ola, quero saber mais"
    }
  }
}
```

Tambem aceita `extendedTextMessage.text`.

## Rotas de validacao

Validar webhook:

```text
GET https://SEU_DOMINIO/api/webhooks/evolution
```

Validar memoria Redis:

```text
GET https://SEU_DOMINIO/api/health/memory
```

## Fluxo conectado

1. Evolution envia mensagem para `/api/webhooks/evolution`.
2. Payload e validado com Zod.
3. Mensagens picotadas sao agrupadas no Redis.
4. Lead e mensagens sao salvos no PostgreSQL.
5. IA gera/procura a proxima resposta.
6. Score e diagnostico sao recalculados.
7. Agenda interna do fxphub e consultada quando o lead chega em agendamento.
8. Resposta volta ao WhatsApp via Evolution API.

## Variaveis obrigatorias

```env
DATABASE_URL=postgres://USUARIO:SENHA@HOST:5432/BANCO
REDIS_URL=redis://HOST:6379
EVOLUTION_API_BASE_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua_chave
EVOLUTION_INSTANCE_NAME=fausto
OPENAI_API_KEY=sua_chave_openai
```

## Variaveis recomendadas

```env
EVOLUTION_WEBHOOK_SECRET=um_segredo_forte
MESSAGE_BUFFER_QUIET_MS=2500
MESSAGE_BUFFER_TTL_SECONDS=60
```
