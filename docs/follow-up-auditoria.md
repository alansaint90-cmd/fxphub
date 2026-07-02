# Auditoria de follow-up

Data da auditoria: 2026-07-02

## Fluxos ativos mapeados

### 1. Primeira resposta no WhatsApp

- Entrada: `POST /api/webhooks/evolution`
- Origem: Evolution API envia mensagem recebida pelo WhatsApp.
- Destinatario da resposta: o proprio lead que enviou a mensagem, identificado por `data.key.remoteJid`.
- Registro no CRM:
  - `leads`
  - `conversation_messages` inbound
  - `conversation_messages` outbound quando a IA responde
- Observacao: mensagens enviadas pelo proprio numero conectado (`fromMe`) sao ignoradas para evitar loop.

### 2. Pre-qualificacao automatica

- Entrada: cada nova mensagem do lead no webhook da Evolution.
- Destinatario da resposta: o mesmo lead em atendimento.
- Regra ativa: a IA pergunta os campos definidos em `src/lib/qualification/questions.ts`.
- Registro no CRM:
  - `qualification_answers`
  - campos de qualificacao em `leads`
  - score, classificacao, dores e resumo em `leads`
- Observacao: o score e recalculado quando uma nova resposta estruturada e registrada.

### 3. Agendamento para leads A ou B

- Entrada: lead conclui a qualificacao e atinge a pontuacao minima.
- Destinatario da mensagem: o lead qualificado que esta em atendimento.
- Regra ativa: somente leads com `canSchedule = true` recebem opcoes de horario.
- Registro no CRM:
  - etapa `agendamento_em_andamento` em `leads`
  - apos escolha do horario, cria registro em `appointments`
  - atualiza etapa para `reuniao_agendada`
- Mensagem ativa: confirmacao de reuniao pelo WhatsApp no mesmo fluxo da conversa.

### 4. Teste manual da Evolution

- Entrada: aba Integracoes, botao de envio de teste.
- Destinatario da mensagem: numero digitado manualmente no campo de teste.
- Registro no CRM: nao registra lead nem historico, pois e teste tecnico de integracao.

## Follow-ups ainda nao ativos

### Lembrete antes da reuniao

- Campo existente: `appointments.reminder_sent_at`
- Status atual: nao ha rotina agendada buscando reunioes futuras com `reminder_sent_at` vazio.
- Quem deve receber: lead com reuniao marcada, pelo telefone/JID associado ao `lead_id`.
- Requisito para ativar: criar job/endpoint protegido que consulte `appointments` futuras e envie lembrete via Evolution.

### Nutricao de lead C

- Status atual: lead C e salvo como nao qualificado e nao consome agenda.
- Quem deve receber: leads classificados como C, apenas em campanhas futuras de marketing.
- Requisito para ativar: criar fluxo separado de campanha/nutricao para nao misturar com agenda comercial.

## Recomendacao operacional

Para producao, manter o webhook da Evolution ativo em:

`https://fxphub.space/api/webhooks/evolution`

Se usar segredo no webhook, enviar o header:

`x-fausto-webhook-secret: valor_configurado`

As configuracoes da aba Integracoes agora sao persistidas em `integration_settings`. Campos secretos ficam salvos no servidor, mas nao sao devolvidos em texto aberto para a interface.
