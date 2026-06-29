import type { QualificationQuestionId } from "./types";

const yesPattern = /\b(sim|uso|utilizo|tenho|invisto|fazemos|rodamos|ativo|claro)\b/i;
const noPattern = /\b(nao|não|nunca|ainda nao|ainda não|sem|nenhum)\b/i;

export function parseAnswer(questionId: QualificationQuestionId, rawAnswer: string): string | number | boolean {
  const text = rawAnswer.trim();

  if (questionId === "monthlyEnrollments" || questionId === "commercialAttendants") {
    const number = Number(text.match(/\d+/)?.[0]);
    if (!Number.isFinite(number)) {
      throw new Error("Nao consegui identificar um numero nessa resposta.");
    }
    return number;
  }

  if (questionId === "usesCrm" || questionId === "runsPaidTraffic") {
    if (noPattern.test(text)) return false;
    if (yesPattern.test(text)) return true;
    throw new Error("Responda com sim ou nao para eu registrar corretamente.");
  }

  if (text.length < 2) {
    throw new Error("Me envie um pouco mais de detalhe para eu registrar certo.");
  }

  return text;
}
