import { normalizeScheduleText } from "./scheduling";

export function getSchedulingObjectionResponse(text: string) {
  const normalizedText = normalizeScheduleText(text);

  const knowledgeResponse = getKnowledgeBaseResponse(normalizedText);
  if (knowledgeResponse) return addFlowReturn(knowledgeResponse);

  return null;
}

function addFlowReturn(response: string) {
  return `${response}\n\nFicou claro? Posso seguir e te ajudar com o melhor horario para a demonstracao?`;
}

function getKnowledgeBaseResponse(normalizedText: string) {
  if (/\b(o que e a fxp|quem e a fxp|voces sao agencia|sao agencia)\b/.test(normalizedText)) {
    return "A FXP e uma assessoria especializada em vendas online. Unimos marketing digital, trafego pago, Inteligencia Artificial, tecnologia e processos comerciais para melhorar a geracao, o atendimento e a conversao de oportunidades.";
  }

  if (/\b(trabalham so com autoescola|so com autoescolas|apenas autoescola)\b/.test(normalizedText)) {
    return "Somos especializados no mercado de autoescolas, mas tambem desenvolvemos solucoes para instituicoes de ensino e negocios que trabalham com captacao de alunos.";
  }

  if (/\b(como voces ajudam|como ajuda|aumentar matriculas|aumentar as matriculas)\b/.test(normalizedText)) {
    return "Ajudamos nos pontos que influenciam a venda: geracao de demanda, velocidade de atendimento, qualificacao dos leads, organizacao comercial, acompanhamento e melhoria do processo de vendas.";
  }

  if (/\b(diferenca.*agencia|agencia comum|diferente de agencia|so trafego|tambem atendimento)\b/.test(normalizedText)) {
    return "A diferenca e que nao olhamos apenas os anuncios. Analisamos a realidade da autoescola, gargalos comerciais, atendimento e conversao para criar uma estrategia mais completa e personalizada.";
  }

  if (/\b(cuidam dos anuncios|criam campanhas|fazem campanhas|gerenciam campanhas)\b/.test(normalizedText)) {
    return "Sim. Criamos e gerenciamos campanhas em cooperacao com o cliente, unindo o conhecimento da autoescola com nossa experiencia em anuncios e geracao de demanda.";
  }

  if (/\b(como funciona.*trafego|trafego pago funciona|funciona o trafego)\b/.test(normalizedText)) {
    return "O trafego pago funciona com anuncios direcionados para pessoas com maior potencial de interesse. Definimos publico, regiao, estrategia e oferta para levar interessados ao WhatsApp ou a outra etapa do funil comercial.";
  }

  if (/\b(facebook|instagram|meta ads|google ads|google)\b/.test(normalizedText)) {
    return "Sim. Podemos trabalhar com Facebook, Instagram e, dependendo da estrategia, Google Ads. A escolha depende do publico, regiao e objetivo da autoescola.";
  }

  if (/\b(quanto preciso investir|20 por dia|valor minimo|minimo para comecar|pouco investimento)\b/.test(normalizedText)) {
    return "E possivel comecar com investimentos em anuncios a partir de aproximadamente R$ 20 por dia. O ideal depende da regiao, concorrencia, objetivo da campanha e quantidade de oportunidades desejadas.";
  }

  if (/\b(anuncios.*incluso|midia.*inclus|verba.*inclus|pagar anuncios separado|anuncios separado)\b/.test(normalizedText)) {
    return "O investimento dos anuncios e separado do valor da gestao da FXP. Assim o cliente sabe quanto esta pagando pela assessoria e quanto esta indo diretamente para as plataformas de anuncios.";
  }

  if (/\b(quanto tempo|em quanto tempo|primeiros contatos|comeco a receber)\b/.test(normalizedText)) {
    return "Depois que a campanha entra no ar, os primeiros contatos podem comecar a chegar nas primeiras 48 horas. Esse prazo pode variar conforme aprovacao dos anuncios, regiao, publico e comportamento da campanha.";
  }

  if (/\b(garantem matriculas|garantia|garante resultado|garantem resultado)\b/.test(normalizedText)) {
    return "Nao seria responsavel garantir uma quantidade especifica de matriculas, porque a venda depende de oferta, preco, atendimento, velocidade de resposta e capacidade comercial. Nosso trabalho e gerar demanda e melhorar o processo para aumentar as chances de conversao.";
  }

  if (/\b(leads?|contatos?|oportunidades?)\b.*\b(bom|bons|boms|boa|boas|qualidade|qualificados|qualificado|vem|chegam|chega)\b/.test(normalizedText)) {
    return "A qualidade dos leads e avaliada e otimizada durante a campanha. Analisamos comportamento dos contatos, ajustamos publico, anuncios e estrategia conforme os dados aparecem.";
  }

  if (/\b(ja tentei|tentei anuncio|nao funcionou|nao deu certo|experiencia ruim|queimei dinheiro)\b/.test(normalizedText)) {
    return "Entendo. Uma campanha pode falhar por publico errado, anuncio fraco, oferta pouco atrativa, falta de acompanhamento ou problemas no atendimento depois que o lead chega. Primeiro buscamos entender o que aconteceu para corrigir o processo antes de propor uma nova estrategia.";
  }

  if (/\b(cidade pequena|pouco publico|minha cidade nao tem muito publico)\b/.test(normalizedText)) {
    return "Pode funcionar, sim. Em cidades menores, a estrategia precisa considerar tamanho do publico, cidades proximas e regiao de atendimento para criar uma campanha compativel com a realidade local.";
  }

  if (/\b(anunciar.*regiao|so para minha regiao|segmentar|cidade|raio)\b/.test(normalizedText)) {
    return "Sim. Podemos segmentar campanhas geograficamente para alcancar pessoas dentro da cidade, bairro, raio ou regiao especifica.";
  }

  if (/\b(artes|criativos|imagem|video|material)\b/.test(normalizedText)) {
    return "Sim. A criacao pode ser feita em parceria com a autoescola, usando materiais, imagens e informacoes do proprio negocio quando fizer sentido.";
  }

  if (/\b(quem acompanha|acompanha resultados|relatorio|indicadores|medem)\b/.test(normalizedText)) {
    return "Nossa equipe acompanha os resultados e realiza otimizacoes. Tambem damos ao cliente a possibilidade de acompanhar o desempenho e entender o que esta acontecendo com as campanhas.";
  }

  if (/\b(quantos leads|leads por mes|300 leads)\b/.test(normalizedText)) {
    return "O volume real varia por cidade, concorrencia, investimento, oferta e desempenho. Em alguns cenarios, trabalhamos com metas de ate 300 novos leads por mes, mas a estimativa precisa ser feita sobre o seu cenario.";
  }

  if (/\b(quantas matriculas|taxa de conversao|conversao)\b/.test(normalizedText)) {
    return "Matriculas dependem diretamente do processo comercial. Velocidade de atendimento, abordagem, preco, oferta, follow-up e treinamento influenciam bastante. Taxas entre 4% e 12% ja podem representar resultados relevantes, dependendo da operacao.";
  }

  if (/\b(nao der resultado|se nao funcionar|cancelar servico)\b/.test(normalizedText)) {
    return "Antes de qualquer decisao, nosso papel e analisar dados, identificar o que pode estar impedindo resultado e ajustar campanha, oferta ou atendimento. Tambem existem opcoes sem fidelidade, conforme o plano contratado.";
  }

  if (/\b(vale a pena|faz sentido|minha autoescola pequena|autoescola pequena|autoescola comecando|esta comecando)\b/.test(normalizedText)) {
    return "Pode fazer sentido se a estrategia estiver adequada ao momento, capacidade de investimento e atendimento da autoescola. Para negocios menores ou iniciantes, o trafego pago pode acelerar a chegada dos primeiros interessados.";
  }

  if (/\b(quanto custa|preco|valor|investimento|caro|orcamento)\b/.test(normalizedText)) {
    return "O investimento depende da solucao que sua autoescola precisa. Temos opcoes para trafego pago, atendimento com IA e solucoes mais completas. O ideal e entender primeiro sua necessidade para indicar o melhor custo-beneficio.";
  }

  if (/\b(mensalidade|taxa de implantacao|fidelidade|contrato|posso cancelar|plano barato)\b/.test(normalizedText)) {
    return "Temos diferentes formatos de servico. Algumas solucoes podem ter implantacao, existem opcoes sem fidelidade e as condicoes variam conforme o plano escolhido. Tudo e apresentado de forma clara antes da contratacao.";
  }

  if (/\b(ia responde|ia no whatsapp|substitui.*atendente|assumir conversa|cliente sabe.*ia|ia agenda|ia vende|ia responder errado|crm)\b/.test(normalizedText)) {
    return "A IA pode atender no WhatsApp, responder duvidas, qualificar interessados, organizar oportunidades e conduzir etapas do processo. Ela nao precisa substituir a equipe: o humano pode assumir quando necessario e o agente e configurado com regras da empresa.";
  }

  if (/\b(equipe comercial|atende manual|manual|poucos atendentes|curiosos|responder rapido|leads somem|treinam minha equipe|mudar atendimento)\b/.test(normalizedText)) {
    return "A estrategia pode ser adaptada para autoescolas com vendedores, poucos atendentes ou atendimento manual. Primeiro analisamos o que ja funciona e depois melhoramos pontos como velocidade, qualificacao, follow-up e organizacao.";
  }

  if (/\b(o que sera mostrado|o que vai ser mostrado|mostrar na reuniao|mostrado na reuniao|o que acontece na reuniao)\b/.test(normalizedText)) {
    return "Na reuniao vamos entender o momento atual da sua autoescola, seus principais desafios e objetivos. Depois mostramos como nossas estrategias e solucoes podem ser aplicadas a sua realidade.";
  }

  if (/\b(quanto tempo dura|dura a reuniao|tempo da reuniao)\b/.test(normalizedText)) {
    return "Normalmente e uma conversa rapida e objetiva. O tempo pode variar conforme as duvidas e necessidades da autoescola.";
  }

  if (/\b(whatsapp ou video|videochamada|chamada de video|pelo whatsapp)\b/.test(normalizedText)) {
    return "O primeiro atendimento pode acontecer pelo WhatsApp e, quando necessario, podemos realizar uma reuniao por videochamada.";
  }

  if (/\b(quem vai me atender|quem atende|consultor|profissional)\b/.test(normalizedText)) {
    return "Voce sera atendido por um profissional da equipe preparado para entender sua necessidade e apresentar os proximos passos.";
  }

  if (/\b(pagar.*reuniao|reuniao.*gratuita|diagnostico.*gratuito|sem compromisso)\b/.test(normalizedText)) {
    return "A conversa inicial de diagnostico e gratuita e sem compromisso.";
  }

  if (/\b(reagendar|remarcar|cancelar|tem horario hoje|pode ser amanha|outro horario|nesses horarios)\b/.test(normalizedText)) {
    return null;
  }

  if (/\b(falar com humano|atendente humano|pessoa da equipe|alguem humano)\b/.test(normalizedText)) {
    return "Claro. Posso encaminhar seu atendimento para um profissional da nossa equipe.";
  }

  if (/\b(nao tenho dinheiro|sem dinheiro|orcamento apertado)\b/.test(normalizedText)) {
    return "Entendo. Antes de pensar em contratar qualquer solucao, vale entender quanto a falta de geracao ou atendimento pode estar custando hoje. Tambem podemos avaliar uma forma mais enxuta de comecar.";
  }

  if (/\b(sem tempo|nao tenho tempo|correria|ocupado|ocupada|agenda cheia)\b/.test(normalizedText)) {
    return "Entendo perfeitamente. A conversa e objetiva justamente para quem tem rotina corrida, e muitas solucoes existem para ajudar empresas sobrecarregadas a reduzir trabalho manual.";
  }

  if (/\b(ja tenho agencia|tenho agencia|minha agencia|ja tenho gestor|tenho gestor)\b/.test(normalizedText)) {
    return "Otimo. Nosso objetivo nao precisa ser substituir uma parceria que ja funciona. Podemos avaliar pontos complementares, principalmente atendimento com IA, organizacao comercial e melhoria da conversao dos leads.";
  }

  if (/\b(preciso pensar|vou pensar)\b/.test(normalizedText)) {
    return "Claro. E importante tomar uma decisao com seguranca. Existe alguma duvida especifica ou algum ponto que ainda nao ficou claro?";
  }

  if (/\b(vou falar com meu socio|falar com socio|meu socio)\b/.test(normalizedText)) {
    return "Perfeito. E importante todos estarem alinhados. Se ajudar, podemos organizar os pontos principais ou fazer uma conversa com voces juntos.";
  }

  if (/\b(medo de gastar|gastar e nao vender|tenho medo)\b/.test(normalizedText)) {
    return "Esse receio e compreensivel. Por isso acompanhamos indicadores durante o processo e tambem olhamos gargalos no atendimento e conversao, porque a venda nao depende apenas do anuncio.";
  }

  if (/\b(nao quero depender de anuncio|depender de anuncio)\b/.test(normalizedText)) {
    return "Faz sentido. O trafego pago nao precisa ser a unica fonte de clientes; ele pode complementar indicacoes, presenca organica, parcerias e outros canais que sua autoescola ja possui.";
  }

  if (/\b(ja recebo leads suficientes|leads suficientes)\b/.test(normalizedText)) {
    return "Excelente. Nesse caso, talvez o principal ponto seja aproveitar melhor os contatos que ja chegam, olhando velocidade de resposta, acompanhamento e taxa de conversao.";
  }

  if (/\b(problema nao e lead|meu problema e atendimento|problema.*atendimento)\b/.test(normalizedText)) {
    return "Nesse caso, talvez nao faca sentido aumentar demanda agora. Podemos olhar primeiro organizacao, atendimento, qualificacao e follow-up para aproveitar melhor as oportunidades atuais.";
  }

  if (/\b(nao quero ia|sem ia|ia falando com meus clientes)\b/.test(normalizedText)) {
    return "Entendo. A IA nao precisa assumir todo o atendimento. Ela pode atuar apenas em etapas especificas, como responder perguntas iniciais, atender fora do horario ou coletar informacoes antes de encaminhar para a equipe.";
  }

  if (/\b(prefiro continuar manual|continuar manualmente|manual por enquanto)\b/.test(normalizedText)) {
    return "Sem problema. Se o processo manual ainda atende bem, ele pode continuar. O ponto e acompanhar se existem oportunidades sendo perdidas por demora, falta de follow-up ou sobrecarga.";
  }

  if (isQuestionLike(normalizedText)) {
    return "Claro. Qual e a sua duvida? Te respondo de forma objetiva para vermos se faz sentido continuar.";
  }

  return null;
}

function isQuestionLike(normalizedText: string) {
  return /\b(o que|como|qual|quais|quando|quanto|quantos|quantas|quem|onde|porque|por que|duvida|explica|me explica|nao entendi|entendi nao|sera que|funciona|vale a pena)\b/.test(
    normalizedText,
  );
}
