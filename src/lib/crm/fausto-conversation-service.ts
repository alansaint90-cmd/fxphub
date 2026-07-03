import type { CalendarGateway } from "@/lib/integrations/calendar";
import type { AiMessagePlanner } from "@/lib/integrations/openai";
import { faustoSystemPrompt } from "@/lib/qualification/fausto-prompt";
import { parseAnswer } from "@/lib/qualification/parser";
import { getNextQuestion, qualificationQuestions } from "@/lib/qualification/questions";
import { calculateQualification } from "@/lib/qualification/scoring";
import type { QualificationAnswerSet, QualificationQuestionId } from "@/lib/qualification/types";
import type { CrmRepository, LeadRecord } from "./types";

interface HandleInboundInput {
  whatsappJid: string;
  phone: string;
  pushName?: string;
  text: string;
  messageType: string;
  providerMessageId?: string;
}

export class FaustoConversationService {
  constructor(
    private readonly crm: CrmRepository,
    private readonly ai: AiMessagePlanner,
    private readonly calendar: CalendarGateway,
  ) {}

  async handleInbound(input: HandleInboundInput): Promise<{ response: string; shouldSend: boolean }> {
    const lead = await this.crm.upsertLead({
      whatsappJid: input.whatsappJid,
      phone: input.phone,
      pushName: input.pushName,
    });

    await this.crm.saveInboundMessage({
      leadId: lead.id,
      body: input.text,
      messageType: input.messageType,
      providerMessageId: input.providerMessageId,
    });

    if (lead.aiPaused) {
      return { response: "", shouldSend: false };
    }

    const draft = await this.buildDraftResponse(lead, input.text);
    const response = await this.ai.polishResponse({
      systemPrompt: faustoSystemPrompt,
      userContext: JSON.stringify({ lead, latestMessage: input.text }),
      draft,
    });

    await this.crm.saveOutboundMessage({ leadId: lead.id, body: response });
    return { response, shouldSend: true };
  }

  private async buildDraftResponse(lead: LeadRecord, text: string): Promise<string> {
    if (lead.funnelStage === "agendamento_em_andamento") {
      return this.tryScheduleMeeting(lead, text);
    }

    const answers = getAnswerSet(lead);
    const answered = new Set(
      Object.entries(answers)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key),
    );
    const firstQuestion = qualificationQuestions[0];

    if (!lead.qualificationStarted) {
      await this.crm.setQualificationProgress({
        leadId: lead.id,
        currentQualificationQuestion: firstQuestion.id,
        qualificationStarted: true,
      });

      return [
        "Ola! Vou entender rapido se o fxphub faz sentido para sua autoescola.",
        firstQuestion.prompt,
      ].join("\n");
    }

    const currentQuestion =
      qualificationQuestions.find((question) => question.id === lead.currentQualificationQuestion) ??
      getNextQuestion(answered);

    if (!currentQuestion) {
      return this.finishQualification(lead, answers);
    }

    const isFirstQuestion = answered.size === 0 && !text.trim();
    if (isFirstQuestion) return currentQuestion.prompt;

    try {
      const parsedValue = parseAnswer(currentQuestion.id, text);
      const nextAnswers = { ...answers, [currentQuestion.id]: parsedValue };

      await this.crm.saveQualificationAnswer({
        leadId: lead.id,
        questionId: currentQuestion.id,
        rawAnswer: text,
        parsedValue,
      });

      const result = calculateQualification(nextAnswers);
      const nextQuestion = getNextQuestion(new Set([...answered, currentQuestion.id]));
      await this.crm.updateLeadQualification({
        leadId: lead.id,
        answers: nextAnswers,
        score: result.score,
        classification: result.classification,
        painPoints: result.painPoints,
        summary: result.summary,
        funnelStage: "ia_atendendo",
        currentQualificationQuestion: nextQuestion?.id ?? null,
      });

      if (nextQuestion) return nextQuestion.prompt;

      return this.finishQualification(lead, nextAnswers);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Nao consegui registrar essa resposta.";
      return `${detail}\n\n${currentQuestion.prompt}`;
    }
  }

  private async finishQualification(lead: LeadRecord, answers: QualificationAnswerSet): Promise<string> {
    const result = calculateQualification(answers);
    await this.crm.updateLeadQualification({
      leadId: lead.id,
      answers,
      score: result.score,
      classification: result.classification,
      painPoints: result.painPoints,
      summary: result.summary,
      funnelStage: result.nextStage,
      currentQualificationQuestion: null,
    });

    if (!result.canSchedule) {
      return [
        "Obrigado. Vou deixar seu contato salvo para retomarmos quando fizer mais sentido.",
      ].join("\n");
    }

    const slots = await this.calendar.getAvailableSlots();
    const options = slots.slice(0, 3).map((slot) => slot.label).join(", ");
    const pain = answers.mainPain ? `Pelo que voce comentou sobre ${answers.mainPain},` : "Pelo seu contexto,";
    return [
      `${pain} vale te mostrar isso de forma pratica.`,
      `Tenho ${options}. Qual horario prefere para uma demonstracao rapida?`,
    ].join("\n");
  }

  private async tryScheduleMeeting(lead: LeadRecord, text: string): Promise<string> {
    const slots = await this.calendar.getAvailableSlots();
    const selectedSlot = slots.find((slot) => matchesSlot(text, slot));

    if (!selectedSlot) {
      return `Tenho ${slots.slice(0, 3).map((slot) => slot.label).join(", ")}. Qual desses fica melhor?`;
    }

    const event = await this.calendar.createEvent({
      startsAt: selectedSlot.startsAt,
      endsAt: selectedSlot.endsAt,
      leadName: lead.drivingSchoolName ?? lead.pushName ?? "Lead fxphub",
      phone: lead.phone,
    });

    await this.crm.markMeetingScheduled({
      leadId: lead.id,
      startsAt: selectedSlot.startsAt,
      endsAt: selectedSlot.endsAt,
      externalEventId: event.eventId,
    });

    return [
      "Reuniao confirmada.",
      "Na demonstracao vamos mostrar como organizar os leads e acelerar o atendimento pelo WhatsApp.",
    ].join("\n");
  }
}

function matchesSlot(text: string, slot: { startsAt: Date; label: string }) {
  const normalizedText = normalizeScheduleText(text);
  const hour = `${String(slot.startsAt.getHours()).padStart(2, "0")}h`;
  const hourWithMinutes = `${String(slot.startsAt.getHours()).padStart(2, "0")}:00`;
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(slot.startsAt);

  return (
    normalizedText.includes(normalizeScheduleText(slot.label)) ||
    normalizedText.includes(normalizeScheduleText(`${date} ${hour}`)) ||
    normalizedText.includes(normalizeScheduleText(`${date} ${hourWithMinutes}`)) ||
    normalizedText.includes(normalizeScheduleText(hour)) ||
    normalizedText.includes(normalizeScheduleText(hourWithMinutes))
  );
}

function normalizeScheduleText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAnswerSet(lead: LeadRecord): QualificationAnswerSet {
  return {
    drivingSchoolName: lead.drivingSchoolName,
    monthlyEnrollments: lead.monthlyEnrollments,
    commercialAttendants: lead.commercialAttendants,
    usesCrm: lead.usesCrm,
    runsPaidTraffic: lead.runsPaidTraffic,
    city: lead.city,
    mainPain: lead.mainPain,
  };
}

export const qualificationFieldMap: Record<QualificationQuestionId, keyof QualificationAnswerSet> = {
  drivingSchoolName: "drivingSchoolName",
  monthlyEnrollments: "monthlyEnrollments",
  commercialAttendants: "commercialAttendants",
  usesCrm: "usesCrm",
  runsPaidTraffic: "runsPaidTraffic",
  city: "city",
  mainPain: "mainPain",
};
