import type { QualificationQuestionId } from "./types";

const yesPattern = /\b(sim|uso|utilizo|tenho|invisto|fazemos|rodamos|ativo|claro|crm|sistema|automatico|automacao)\b/i;
const noPattern = /\b(nao|não|nunca|ainda nao|ainda não|sem|nenhum)\b/i;

export function parseAnswer(questionId: QualificationQuestionId, rawAnswer: string): string | number | boolean {
  const text = rawAnswer.trim();

  if (questionId === "monthlyEnrollments" || questionId === "commercialAttendants") {
    const number = Number(text.match(/\d+/)?.[0]);
    if (!Number.isFinite(number)) {
      throw new Error("Me diga um numero aproximado de leads ou atendimentos para eu seguir.");
    }
    return number;
  }

  if (questionId === "usesCrm" || questionId === "runsPaidTraffic") {
    if (noPattern.test(text)) return false;
    if (/\b(manual|planilha|whatsapp|caderno|papel)\b/i.test(text)) return false;
    if (yesPattern.test(text)) return true;
    return true;
  }

  if (text.length < 2) {
    throw new Error("Me envie um pouco mais de detalhe para eu registrar certo.");
  }

  return text;
}
