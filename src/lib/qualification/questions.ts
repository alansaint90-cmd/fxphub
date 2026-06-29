import type { QualificationQuestion } from "./types";

export const qualificationQuestions: QualificationQuestion[] = [
  {
    id: "drivingSchoolName",
    prompt: "Qual o nome da sua autoescola?",
  },
  {
    id: "monthlyEnrollments",
    prompt: "Em media, quantas matriculas sua autoescola realiza por mes?",
  },
  {
    id: "commercialAttendants",
    prompt: "Quantos atendentes trabalham hoje no atendimento comercial?",
  },
  {
    id: "usesCrm",
    prompt: "Voce utiliza algum CRM atualmente?",
  },
  {
    id: "runsPaidTraffic",
    prompt: "Voce investe em trafego pago, como Facebook Ads, Instagram Ads ou Google Ads?",
  },
  {
    id: "city",
    prompt: "Em qual cidade sua autoescola esta localizada?",
  },
];

export function getNextQuestion(answered: Set<string>): QualificationQuestion | null {
  return qualificationQuestions.find((question) => !answered.has(question.id)) ?? null;
}
