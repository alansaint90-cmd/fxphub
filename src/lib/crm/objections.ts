import { normalizeScheduleText } from "./scheduling";

export function getSchedulingObjectionResponse(text: string) {
  const normalizedText = normalizeScheduleText(text);

  if (/\b(ja tentei|tentei|nao funcionou|nao deu certo|experiencia ruim|queimei dinheiro)\b/.test(normalizedText)) {
    return [
      "Entendo. Normalmente isso acontece quando o trafego roda sem estrategia, acompanhamento e ajuste das conversas que chegam no WhatsApp.",
      "A ideia da demonstracao e olhar o seu cenario e mostrar como evitar esse erro. Quer que eu te passe os horarios disponiveis?",
    ].join("\n");
  }

  if (/\b(preco|valor|quanto custa|investimento|caro|orçamento|orcamento)\b/.test(normalizedText)) {
    return [
      "Boa pergunta. O valor depende do objetivo, cidade e estrutura atual da autoescola, por isso eu nao quero te passar algo solto por aqui.",
      "Na demonstracao a equipe entende o seu cenario e mostra o melhor caminho. Quer que eu te passe os horarios disponiveis?",
    ].join("\n");
  }

  if (/\b(sem tempo|nao tenho tempo|correria|ocupado|ocupada|agenda cheia)\b/.test(normalizedText)) {
    return [
      "Justamente por isso a conversa e rapida. Em cerca de 15 minutos o time te mostra o caminho sem tomar seu dia.",
      "Quer que eu te passe os horarios mais proximos?",
    ].join("\n");
  }

  if (/\b(ja tenho agencia|tenho agencia|minha agencia|ja tenho gestor|tenho gestor)\b/.test(normalizedText)) {
    return [
      "Otimo. A ideia nao e desconsiderar o que voce ja tem, e sim mostrar como trafego e IA podem trabalhar junto para aumentar oportunidades e melhorar o atendimento.",
      "Faz sentido comparar com o que voce usa hoje em uma demonstracao rapida?",
    ].join("\n");
  }

  if (/\b(vou pensar|preciso pensar|depois eu vejo|depois|mais tarde|outro dia)\b/.test(normalizedText)) {
    return [
      "Claro. So para voce decidir com mais clareza, a demonstracao serve justamente para entender se faz sentido para sua autoescola antes de qualquer decisao.",
      "Quer que eu te passe algumas opcoes de horario?",
    ].join("\n");
  }

  if (/\b(nao|tenho duvida|duvida|depende|como funciona|explica|me explica|nao entendi)\b/.test(normalizedText)) {
    return "Claro. Qual e a sua duvida? Te respondo de forma objetiva para vermos se faz sentido agendar.";
  }

  return null;
}
