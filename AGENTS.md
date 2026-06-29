# Fausto IA - Instrucoes para Agentes

## Stack

- TypeScript em modo strict
- Next.js com App Router
- Drizzle ORM
- PostgreSQL 16
- Redis para buffer de mensagens
- Supabase apenas no servidor quando usado como camada gerenciada

## Regras absolutas

1. Nao usar SQLite.
2. Nao usar Prisma.
3. Nao fazer delete fisico em dados de negocio.
4. Toda tabela de negocio deve ter `created_at`, `updated_at`, `deleted_at`, `is_deleted` e `modified_by`.
5. Toda entrada externa deve ser validada com Zod.
6. Nao expor `service_role`, tokens OpenAI, Evolution API ou credenciais em client-side.
7. Nao duplicar regra de score ou qualificacao fora de `src/lib/qualification`.
8. Toda transferencia IA-humano deve preservar `conversation_messages`.
9. Leads C nao podem consumir agenda comercial.
10. Score deve ser recalculado quando novas respostas forem registradas.

## Pastas principais

- `src/app`: rotas Next.js
- `src/lib/qualification`: regras de perguntas, score e diagnostico
- `src/lib/crm`: repositorios e orquestracao do atendimento
- `src/lib/integrations`: Evolution, OpenAI, Redis, Supabase e agenda
- `src/lib/db/schema`: schema Drizzle
- `docs`: regras de negocio e arquitetura
- `tests`: testes automatizados
