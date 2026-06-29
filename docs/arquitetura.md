# Arquitetura - Fausto IA

## Stack

- Next.js com App Router
- TypeScript strict
- Drizzle ORM
- PostgreSQL 16
- Redis para buffer curto de conversa
- Evolution API para WhatsApp
- OpenAI API para polimento e interpretacao de linguagem
- Supabase como camada operacional/CRM quando conectado ao projeto gerenciado

## Fluxo principal

1. Lead chega via anuncio e envia mensagem no WhatsApp.
2. Evolution API dispara `POST /api/webhooks/evolution`.
3. O webhook valida payload com Zod.
4. O CRM cria ou atualiza o lead pelo `whatsapp_jid`.
5. A mensagem inbound e registrada em `conversation_messages`.
6. `FaustoConversationService` identifica a pergunta atual.
7. A resposta e salva em `qualification_answers`.
8. O score e recalculado por `calculateQualification`.
9. O lead recebe classificacao A, B ou C.
10. Se A/B, a agenda e consultada e o lead pode marcar reuniao.
11. Se C, o funil vai para `nao_qualificado`.

## Modulos

- `src/lib/qualification`: perguntas, parser, score, dores e prompt base.
- `src/lib/crm`: contrato de CRM, repositorio Drizzle e orquestrador da conversa.
- `src/lib/integrations`: Evolution, OpenAI, Redis, Supabase e agenda.
- `src/lib/db/schema`: tabelas PostgreSQL com auditoria e soft delete.
- `src/app/api/webhooks/evolution`: entrada oficial do WhatsApp.

## Decisoes importantes

- O motor de score e puro e testavel.
- Nenhuma regra critica depende apenas do prompt da IA.
- O prompt melhora linguagem, mas a decisao de score/agendamento fica no codigo.
- Mensagens inbound e outbound sao persistidas antes/depois do envio.
- Leads com `ai_paused = true` nao recebem resposta automatica, preservando handoff humano.
