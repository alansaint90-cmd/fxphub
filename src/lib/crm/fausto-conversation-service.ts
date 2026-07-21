import type { CalendarGateway } from "@/lib/integrations/calendar";
import type { AiMessagePlanner } from "@/lib/integrations/openai";
import { leadCaptureWhatsappStartMessage } from "@/lib/lead-capture/whatsapp";
import { faustoSystemPrompt } from "@/lib/qualification/fausto-prompt";
import { parseAnswer } from "@/lib/qualification/parser";
import { getNextQuestion, qualificationQuestions } from "@/lib/qualification/questions";
import { calculateQualification } from "@/lib/qualification/scoring";
import type { QualificationAnswerSet, QualificationQuestionId } from "@/lib/qualification/types";
import { getSchedulingObjectionResponse } from "./objections";
import {
  extractRequestedHours,
  extractRequestedWeekdays,
  isAvailabilityRequest,
  isCancellationRequest,
  isRescheduleRequest,
  isScheduleRejection,
  matchesSlot,
} from "./scheduling";
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

    const diagnosticFormTrigger = isDiagnosticFormTrigger(input.text);

    if (diagnosticFormTrigger) {
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

    if (shouldKeepHumanOnly(lead)) {
      return { response: "", shouldSend: false };
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
    const shouldSplitObjectionResponse = response.includes("\n\nFicou claro?");
    const messages =
      shouldSplitIdentityConfirmation || shouldSplitMeetingConfirmation || shouldSplitObjectionResponse
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
    if (lead.funnelStage === "reuniao_agendada") {
      return this.handleScheduledMeetingChange(lead, text);
    }

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
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);
    if (isGreetingOnly(text) && latestOutbound && !latestOutbound.startsWith("Falo com ")) {
      return buildOpenHelpResponse(lead);
    }

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
      "Posso te agendar com o nosso time para uma demonstracao rapida sobre como a gestao de trafego pago, com apoio de IA, pode ser aplicada em sua autoescola.",
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
    const options = formatSlotOptions(slots);
    const pain = answers.mainPain ? `Pelo que voce comentou sobre ${answers.mainPain},` : "Pelo seu contexto,";
    return [
      `${pain} vale te mostrar isso de forma pratica.`,
      `Tenho ${options}. Qual horario prefere para uma demonstracao rapida?`,
    ].join("\n");
  }

  private async tryScheduleMeeting(lead: LeadRecord, text: string): Promise<string> {
    const requestedHours = extractRequestedHours(text);
    const requestedWeekdays = extractRequestedWeekdays(text);
    const slots = await this.calendar.getAvailableSlots({
      preferredHours: requestedHours,
      preferredWeekdays: requestedWeekdays,
    });
    const availabilityRequest = isAvailabilityRequest(text);
    const hasPreferredSchedule = requestedHours.length > 0 || requestedWeekdays.length > 0;
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);
    const pendingConfirmationSlot = findPendingConfirmationSlot(latestOutbound, slots);

    if (pendingConfirmationSlot && isIdentityDenied(text)) {
      return "Sem problema. Qual dia e horario voce prefere que eu consulte na agenda?";
    }

    if (pendingConfirmationSlot && (isIdentityConfirmed(text) || matchesSlot(text, pendingConfirmationSlot))) {
      return this.createConfirmedMeeting(lead, pendingConfirmationSlot);
    }

    if (availabilityRequest) {
      const preferredSlots = requestedHours.length
        ? slots.filter((slot) => requestedHours.some((hour) => matchesSlot(`${hour} horas`, slot)))
        : [];

      if (preferredSlots.length > 0) {
        return `Consultei a agenda e tenho ${formatSlotOptions(preferredSlots)}. Qual desses prefere?`;
      }

      return `Nesse horario nao tenho vaga livre. Tenho ${formatSlotOptions(slots, { preserveOrder: hasPreferredSchedule })}. Algum desses funciona?`;
    }

    const selectedSlot = slots.find((slot) => matchesSlot(text, slot));

    if (!selectedSlot) {
      if (isScheduleRejection(text)) {
        if (isConversationClosed(text)) {
          return "Tudo bem. Vou deixar seu contato salvo para retomarmos em outro momento.";
        }

        return "Sem problema. Me diga qual dia e horario voce prefere que eu consulto a agenda.";
      }

      const objectionResponse = getSchedulingObjectionResponse(text);
      if (objectionResponse) {
        return objectionResponse;
      }

      if (isQuestionLike(text)) {
        return "Entendi sua pergunta. Me diga exatamente qual ponto voce quer esclarecer que eu respondo de forma objetiva antes de seguir para a agenda.";
      }

      return `Consultei a agenda e tenho ${formatSlotOptions(slots, { preserveOrder: hasPreferredSchedule })}. Qual desses fica melhor?`;
    }

    return `So confirmando: posso marcar sua reuniao para ${selectedSlot.label}?`;
  }

  private async handleScheduledMeetingChange(lead: LeadRecord, text: string): Promise<string> {
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);

    if (isGreetingOnly(text)) {
      return buildOpenHelpResponse(lead);
    }

    if (latestOutbound?.startsWith("So confirmando: posso cancelar sua reuniao") && isIdentityConfirmed(text)) {
      await this.crm.cancelUpcomingMeeting({ leadId: lead.id });
      return "Reuniao cancelada. Reagende a qualquer momento entrando em contato por aqui. A FXP agradece!";
    }

    if (latestOutbound?.startsWith("So confirmando: posso consultar novos horarios") && isIdentityConfirmed(text)) {
      await this.crm.cancelUpcomingMeeting({ leadId: lead.id });
      await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });
      const slots = await this.calendar.getAvailableSlots({
        preferredHours: extractRequestedHours(text),
        preferredWeekdays: extractRequestedWeekdays(text),
      });
      return `Perfeito. Consultei a agenda e tenho ${formatSlotOptions(slots, { preserveOrder: true })}. Qual desses fica melhor?`;
    }

    if (isCancellationRequest(text)) {
      return "So confirmando: posso cancelar sua reuniao agendada?";
    }

    if (isRescheduleRequest(text) || isAvailabilityRequest(text)) {
      return "So confirmando: posso consultar novos horarios e substituir seu agendamento atual?";
    }

    const objectionResponse = getSchedulingObjectionResponse(text);
    if (objectionResponse) return objectionResponse;

    return "Sua reuniao segue confirmada. Se quiser remarcar ou cancelar, me avise por aqui que eu consulto a agenda.";
  }

  private async createConfirmedMeeting(lead: LeadRecord, selectedSlot: { startsAt: Date; endsAt: Date }) {
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
      "Na demonstracao, vamos mostrar como sua autoescola pode usar o trafego pago para gerar uma entrada constante de novos interessados em tirar a CNH e aumentar as oportunidades de matricula.",
      "2 horas antes mandaremos a mensagem de lembrete da reuniao. Ate breve!",
    ].join("\n");
  }
}

function formatSlotOptions(slots: { startsAt?: Date; label: string }[], options: { preserveOrder?: boolean } = {}) {
  const selectedSlots = options.preserveOrder ? slots.slice(0, 4) : selectBalancedDaySlots(slots);
  const labels = selectedSlots.map((slot) => slot.label);
  if (labels.length === 0) return "nenhum horario livre no momento";
  return labels.join(", ");
}

function selectBalancedDaySlots(slots: { startsAt?: Date; label: string }[]) {
  const datedSlots = slots.filter((slot): slot is { startsAt: Date; label: string } => slot.startsAt instanceof Date);
  if (datedSlots.length === 0) return slots.slice(0, 4);

  const todayKey = formatSaoPauloDateKey(new Date());
  const groups = new Map<string, { startsAt: Date; label: string }[]>();
  for (const slot of datedSlots) {
    const dayKey = formatSaoPauloDateKey(slot.startsAt);
    if (dayKey === todayKey) continue;
    groups.set(dayKey, [...(groups.get(dayKey) ?? []), slot]);
  }

  const selected: { startsAt: Date; label: string }[] = [];
  for (const daySlots of groups.values()) {
    selected.push(...daySlots.slice(0, 2));
    if (selected.length >= 4) break;
  }

  return selected.length > 0 ? selected.slice(0, 4) : slots.slice(0, 4);
}

function formatSaoPauloDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function findPendingConfirmationSlot(
  latestOutbound: string | null,
  slots: { startsAt: Date; endsAt: Date; label: string }[],
) {
  if (!latestOutbound?.startsWith("So confirmando: posso marcar sua reuniao para ")) return null;
  return slots.find((slot) => latestOutbound.includes(slot.label)) ?? null;
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

function isGreetingOnly(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|e ai|eai|tudo bem|td bem)[!.? ]*$/.test(normalizedText);
}

function isQuestionLike(text: string) {
  const normalizedText = normalizeForIntent(text);
  return (
    text.includes("?") ||
    /\b(o que|como|qual|quais|quando|quanto|quantos|quantas|quem|onde|porque|por que|duvida|explica|me explica|nao entendi|entendi nao|sera que|funciona|vale a pena)\b/.test(
      normalizedText,
    )
  );
}

function buildOpenHelpResponse(lead: LeadRecord) {
  const firstName = lead.responsibleName?.trim().split(/\s+/)[0] || lead.pushName?.trim().split(/\s+/)[0] || "";
  const greeting = firstName ? `Oi, ${firstName}.` : "Oi.";
  return `${greeting} Como posso ajudar? Posso tirar alguma duvida, remarcar ou cancelar seu agendamento.`;
}

function shouldConfirmDiagnosticIdentity(lead: LeadRecord) {
  return (
    lead.funnelStage === "qualificado" &&
    lead.qualificationStarted &&
    Boolean(lead.responsibleName || lead.pushName) &&
    Boolean(lead.drivingSchoolName)
  );
}

function shouldKeepHumanOnly(lead: LeadRecord) {
  return !lead.qualificationStarted && lead.funnelStage === "ia_atendendo";
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
