import type { CalendarGateway } from "@/lib/integrations/calendar";
import type { AiMessagePlanner } from "@/lib/integrations/openai";
import { leadCaptureWhatsappStartMessage } from "@/lib/lead-capture/whatsapp";
import { faustoSystemPrompt } from "@/lib/qualification/fausto-prompt";
import { parseAnswer } from "@/lib/qualification/parser";
import { getNextQuestion, qualificationQuestions } from "@/lib/qualification/questions";
import { calculateQualification } from "@/lib/qualification/scoring";
import type { QualificationAnswerSet, QualificationQuestionId } from "@/lib/qualification/types";
import { extractRequestedHours, isAvailabilityRequest, isScheduleRejection, matchesSlot } from "./scheduling";
import type { CrmRepository, LeadRecord } from "./types";

interface OutboundMessage {
  text: string;
  delayMs?: number;
}

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

  async handleInbound(input: HandleInboundInput): Promise<{ response: string; shouldSend: boolean; messages?: OutboundMessage[] }> {
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

    if (isDiagnosticFormTrigger(input.text)) {
      const context = await this.crm.getLatestLeadFormContextByPhone(input.phone);
      if (!context) {
        const response = [
          "Recebi sua mensagem do diagnostico, mas ainda nao encontrei seus dados do formulario.",
          "Pode concluir o diagnostico novamente ou me informar o nome da autoescola para eu continuar?",
        ].join("\n");
        await this.crm.saveOutboundMessage({ leadId: lead.id, body: response });
        return { response, shouldSend: true };
      }

      const contextualizedLead = await this.crm.applyLeadFormContextToLead({ leadId: lead.id, context });
      const messages = this.startPaidTrafficIdentityFlow(contextualizedLead);
      await Promise.all(
        messages.map((message) => this.crm.saveOutboundMessage({ leadId: contextualizedLead.id, body: message.text })),
      );
      return { response: messages.map((message) => message.text).join("\n\n"), shouldSend: true, messages };
    }

    const shouldSplitIdentityConfirmation = shouldConfirmDiagnosticIdentity(lead) && isIdentityConfirmed(input.text);
    const shouldUseStrictDraft = lead.funnelStage === "agendamento_em_andamento" || shouldConfirmDiagnosticIdentity(lead);
    const draft = await this.buildDraftResponse(lead, input.text);
    const response = shouldUseStrictDraft
      ? draft
      : await this.ai.polishResponse({
          systemPrompt: faustoSystemPrompt,
          userContext: JSON.stringify({ lead, latestMessage: input.text }),
          draft,
        });

    const shouldSplitMeetingConfirmation = response.startsWith("Reuniao confirmada.");
    const messages =
      shouldSplitIdentityConfirmation || shouldSplitMeetingConfirmation
        ? splitIntoWhatsAppMessages(response)
        : [{ text: response }];
    await Promise.all(messages.map((message) => this.crm.saveOutboundMessage({ leadId: lead.id, body: message.text })));
    return { response, shouldSend: true, messages: messages.length > 1 ? messages : undefined };
  }

  private startPaidTrafficIdentityFlow(lead: LeadRecord): OutboundMessage[] {
    const leadName = lead.responsibleName?.trim() || lead.pushName?.trim() || "voce";
    const schoolName = lead.drivingSchoolName?.trim() || "sua autoescola";

    return [
      { text: "Ja recebi o seu diagnostico por aqui." },
      { text: `Falo com ${leadName} da ${schoolName}, certo?`, delayMs: 5000 },
    ];
  }

  private async buildDraftResponse(lead: LeadRecord, text: string): Promise<string> {
    if (lead.funnelStage === "agendamento_em_andamento") {
      return this.tryScheduleMeeting(lead, text);
    }

    if (shouldConfirmDiagnosticIdentity(lead)) {
      return this.handleDiagnosticIdentityConfirmation(lead, text);
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

  private async handleDiagnosticIdentityConfirmation(lead: LeadRecord, text: string): Promise<string> {
    if (isIdentityDenied(text)) {
      return "Sem problema. Me informe seu nome e o nome da autoescola para eu corrigir e continuar.";
    }

    if (!isIdentityConfirmed(text)) {
      const leadName = lead.responsibleName?.trim() || lead.pushName?.trim() || "voce";
      const schoolName = lead.drivingSchoolName?.trim() || "sua autoescola";
      return `So para confirmar: falo com ${leadName} da ${schoolName}, certo?`;
    }

    await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });

    const firstName = lead.responsibleName?.trim().split(/\s+/)[0] || lead.pushName?.trim().split(/\s+/)[0] || "";
    const greeting = firstName ? `Perfeito, ${firstName}.` : "Perfeito.";

    return [
      `${greeting} Eu sou o Fausto, da assessoria FXP. Somos um hub de solucoes digitais e de IA para autoescolas.`,
      `Ajudamos autoescolas a atrair mais interessados pelo WhatsApp e transformar oportunidades em matriculas.`,
      "Posso te agendar com o nosso time para uma demonstracao rapida sobre como conseguimos implementar a estrategia de trafego pago e IA aplicada em sua autoescola.",
      "Seria interessante pra voce?",
    ].join("\n");
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
    const requestedHours = extractRequestedHours(text);
    const slots = await this.calendar.getAvailableSlots({ preferredHours: requestedHours });
    const availabilityRequest = isAvailabilityRequest(text);

    if (availabilityRequest) {
      const preferredSlots = requestedHours.length
        ? slots.filter((slot) => requestedHours.includes(slot.startsAt.getHours()))
        : [];

      if (preferredSlots.length > 0) {
        return `Consultei a agenda e tenho ${formatSlotOptions(preferredSlots)}. Qual desses prefere?`;
      }

      return `Nesse horario nao tenho vaga livre. Tenho ${formatSlotOptions(slots)}. Algum desses funciona?`;
    }

    const selectedSlot = slots.find((slot) => matchesSlot(text, slot));

    if (!selectedSlot) {
      if (isScheduleRejection(text)) {
        if (isConversationClosed(text)) {
          return "Tudo bem. Vou deixar seu contato salvo para retomarmos em outro momento.";
        }

        return "Sem problema. Me diga qual dia e horario voce prefere que eu consulto a agenda.";
      }

      if (hasSchedulingObjection(text)) {
        return "Claro. Qual e a sua duvida? Te respondo de forma objetiva para vermos se faz sentido agendar.";
      }

      return `Consultei a agenda e tenho ${formatSlotOptions(slots)}. Qual desses fica melhor?`;
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
      "Na demonstracao vamos mostrar como resolver o desejo urgente com trafego pago.",
      "2 horas antes mandaremos a mensagem de lembrete da reuniao. Ate breve!",
    ].join("\n");
  }
}

function formatSlotOptions(slots: { label: string }[]) {
  const options = slots.slice(0, 3).map((slot) => slot.label);
  if (options.length === 0) return "nenhum horario livre no momento";
  return options.join(", ");
}

function splitIntoWhatsAppMessages(response: string): OutboundMessage[] {
  return response
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      text,
      delayMs: index === 0 ? undefined : text.startsWith("Seria interessante") ? 2000 : 1200,
    }));
}

function isConversationClosed(text: string) {
  const normalizedText = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return /\b(nao quero mais|obrigado|obrigada)\b/.test(normalizedText);
}

function hasSchedulingObjection(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(nao|tenho duvida|duvida|depende|quanto custa|qual valor|preco|valor|como funciona|explica|me explica|nao entendi)\b/.test(
    normalizedText,
  );
}

function shouldConfirmDiagnosticIdentity(lead: LeadRecord) {
  return (
    lead.funnelStage === "qualificado" &&
    lead.qualificationStarted &&
    Boolean(lead.responsibleName || lead.pushName) &&
    Boolean(lead.drivingSchoolName)
  );
}

function isIdentityConfirmed(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(sim|certo|correto|isso|exato|ok|confirmo|confirmado|sou eu|esta certo|ta certo)\b/.test(
    normalizedText,
  );
}

function isIdentityDenied(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(nao|errado|incorreto|nao sou|nao e|esta errado|ta errado)\b/.test(normalizedText);
}

function isDiagnosticFormTrigger(text: string) {
  return normalizeForIntent(text) === normalizeForIntent(leadCaptureWhatsappStartMessage);
}

function normalizeForIntent(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAnswerSet(lead: LeadRecord): QualificationAnswerSet {
  return {
    responsibleName: lead.responsibleName,
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
  responsibleName: "responsibleName",
  drivingSchoolName: "drivingSchoolName",
  monthlyEnrollments: "monthlyEnrollments",
  commercialAttendants: "commercialAttendants",
  usesCrm: "usesCrm",
  runsPaidTraffic: "runsPaidTraffic",
  city: "city",
  mainPain: "mainPain",
};
