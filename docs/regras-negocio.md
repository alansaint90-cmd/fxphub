# Regras de Negocio - Fausto IA

## Objetivo

O Fausto IA realiza pre-qualificacao automatica de leads de autoescolas antes de consumir agenda comercial.
O objetivo nao e vender imediatamente, mas identificar potencial, dores e momento de compra.

## Perguntas obrigatorias

1. Qual o nome da sua autoescola?
2. Em media, quantas matriculas sua autoescola realiza por mes?
3. Quantos atendentes trabalham hoje no atendimento comercial?
4. Voce utiliza algum CRM atualmente?
5. Voce investe em trafego pago, como Facebook Ads, Instagram Ads ou Google Ads?
6. Em qual cidade sua autoescola esta localizada?

Cada resposta deve ser salva no CRM assim que recebida.

## Classificacao

- A: cliente ideal. Operacao ativa, volume de matriculas, crescimento via marketing ou dor comercial clara.
- B: cliente potencial. Estrutura parcial e interesse em melhorar vendas, mas processos ainda imaturos.
- C: curioso. Pouca estrutura, baixa urgencia ou sem necessidade imediata.

Leads A e B podem avancar para agendamento.
Leads C devem permanecer no CRM como nao qualificados para futuras campanhas.

## Dores mapeadas

- demora no atendimento
- leads perdidos
- falta de CRM
- equipe pequena
- atendimento manual
- falta de acompanhamento dos leads
- falta de processo comercial
- baixa conversao

## Agendamento

Quando o lead for A ou B, a IA consulta horarios disponiveis e oferece opcoes objetivas.
Depois da escolha:

- cria compromisso no CRM
- registra data e horario da reuniao
- move o funil para `reuniao_agendada`
- envia confirmacao pelo WhatsApp
- agenda lembrete antes da reuniao

Mensagem base:

> Reuniao confirmada com sucesso. Nossa equipe apresentara como o Auto Pro IA CRM pode automatizar seu atendimento, organizar seus leads e aumentar suas matriculas. Nos vemos em breve.

## Recalculo

O score deve ser recalculado sempre que uma nova informacao de qualificacao for recebida.
O resumo do lead deve refletir o estado mais recente.

## Transferencia IA-humano

O historico da conversa fica em `conversation_messages`.
Pausar a IA nao remove historico e nao altera as mensagens anteriores.
