import type { QualificationQuestion } from "./types";

export const qualificationQuestions: QualificationQuestion[] = [
  {
    id: "responsibleName",
    prompt: "Com quem eu falo?",
  },
  {
    id: "drivingSchoolName",
    prompt: "Qual o nome da sua autoescola?",
  },
  {
    id: "city",
    prompt: "Em qual cidade ela fica?",
  },
  {
    id: "monthlyEnrollments",
    prompt: "Hoje chegam em media quantos leads ou atendimentos pelo WhatsApp por dia ou semana?",
  },
  {
    id: "usesCrm",
    prompt: "Voce ja usa CRM ou algum atendimento automatico?",
  },
  {
    id: "runsPaidTraffic",
    prompt: "Hoje voces ja fazem trafego pago para captar interessados?",
  },
  {
    id: "mainPain",
    prompt: "Qual e a maior dificuldade hoje: demora no atendimento, perder leads, falta de organizacao ou baixa conversao?",
  },
];

export function getNextQuestion(answered: Set<string>): QualificationQuestion | null {
  return qualificationQuestions.find((question) => !answered.has(question.id)) ?? null;
}
