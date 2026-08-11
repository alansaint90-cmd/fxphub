import type { QualificationQuestion } from "./types";

export const qualificationQuestions: QualificationQuestion[] = [
  {
    id: "responsibleName",
    prompt: "Com quem eu falo?",
  },
  {
    id: "drivingSchoolName",
    prompt: "Prazer! Como é o nome da sua autoescola?",
  },
  {
    id: "demoConsent",
    prompt:
      "Perfeito. Agora vou te conduzir para um teste rápido. A partir daqui, faça perguntas como se você fosse um cliente entrando em contato com a sua autoescola. Certo?",
  },
  {
    id: "demoQuestion",
    prompt:
      "Ótimo! Pode mandar um texto, um áudio ou qualquer pergunta que um cliente normalmente faria para sua autoescola. Vou te mostrar como o agente poderia se comportar no seu WhatsApp.",
  },
];

export function getNextQuestion(answered: Set<string>): QualificationQuestion | null {
  return qualificationQuestions.find((question) => !answered.has(question.id)) ?? null;
}
