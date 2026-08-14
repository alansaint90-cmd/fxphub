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
      [
        "Agora faça uma pergunta como se você fosse um cliente entrando em contato com a sua autoescola.",
        "Você pode escolher uma das perguntas abaixo ou escrever a sua.",
        "",
        "1. Quanto custa para tirar a primeira habilitação?",
        "2. Vocês fazem habilitação para carro e moto?",
        "3. Quais documentos eu preciso para começar a tirar a CNH?",
        "Pode começar...",
      ].join("\n"),
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
