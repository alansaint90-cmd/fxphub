import type { QualificationQuestion } from "./types";

export const qualificationQuestions: QualificationQuestion[] = [
  {
    id: "responsibleName",
    prompt: "Com quem eu falo?",
  },
  {
    id: "drivingSchoolName",
    prompt: "Prazer! Como e o nome da sua autoescola?",
  },
  {
    id: "demoConsent",
    prompt:
      "Perfeito. Agora vou te conduzir para um teste rapido. A partir daqui, faca perguntas como se voce fosse um cliente entrando em contato com a sua autoescola. Certo?",
  },
  {
    id: "demoQuestion",
    prompt:
      "Otimo! Pode mandar um texto, um audio ou qualquer pergunta que um cliente normalmente faria para sua autoescola. Vou te mostrar como o agente poderia se comportar no seu WhatsApp.",
  },
];

export function getNextQuestion(answered: Set<string>): QualificationQuestion | null {
  return qualificationQuestions.find((question) => !answered.has(question.id)) ?? null;
}
