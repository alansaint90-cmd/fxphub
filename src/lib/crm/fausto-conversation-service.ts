import type { CalendarGateway } from "@/lib/integrations/calendar";
import type { AiMessagePlanner } from "@/lib/integrations/openai";
import { faustoSystemPrompt } from "@/lib/qualification/fausto-prompt";
import { parseAnswer } from "@/lib/qualification/parser";
import { getNextQuestion, qualificationQuestions } from "@/lib/qualification/questions";
import { calculateQualification } from "@/lib/qualification/scoring";
import type { ConversationQuestionId, QualificationAnswerSet, QualificationQuestionId } from "@/lib/qualification/types";
import { getSchedulingObjectionResponse } from "./objections";
import {
  extractRequestedHours,
  extractRequestedDates,
  extractRequestedWeekdays,
  getSaoPauloWeekdayNumber,
  isAvailabilityRequest,
  isCancellationRequest,
  isRescheduleRequest,
  isScheduleRejection,
  matchesRequestedDate,
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

    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);
    const activeFlow = getActiveConversationFlow(lead, latestOutbound);

    if (!activeFlow && isAgentTestTrigger(input.text)) {
      const messages = await this.startSdrTestFlow(lead);
      for (const message of messages) {
        await this.crm.saveOutboundMessage({ leadId: lead.id, body: message.text });
      }
      return { response: messages.map((message) => message.text).join("\n\n"), shouldSend: true, messages };
    }

    if (!activeFlow && isTiagoSiteCampaignTrigger(input.text)) {
      const messages = await this.startTiagoSiteCampaignFlow(lead);
      for (const message of messages) {
        await this.crm.saveOutboundMessage({ leadId: lead.id, body: message.text });
      }
      return { response: messages.map((message) => message.text).join("\n\n"), shouldSend: true, messages };
    }

    if (!activeFlow && shouldKeepHumanOnly(lead)) {
      return { response: "", shouldSend: false };
    }

    const shouldSplitIdentityConfirmation = shouldConfirmDiagnosticIdentity(lead) && isIdentityConfirmed(input.text);
    const shouldUseStrictDraft =
      lead.funnelStage === "agendamento_em_andamento" ||
      lead.funnelStage === "reuniao_agendada" ||
      lead.currentQualificationQuestion === "demoConsent" ||
      lead.currentQualificationQuestion === "demoQuestion" ||
      isTiagoSiteCampaignState(lead.currentQualificationQuestion) ||
      activeFlow === "tiago_sites" ||
      activeFlow === "sdr_test" ||
      shouldConfirmDiagnosticIdentity(lead);
    const draft = await this.buildDraftResponse(lead, input.text, input.messageType, latestOutbound);
    const response = shouldUseStrictDraft
      ? draft
      : await this.ai.polishResponse({
          systemPrompt: faustoSystemPrompt,
          userContext: JSON.stringify({ lead, latestMessage: input.text }),
          draft,
        });

    const shouldSplitMeetingConfirmation = response.startsWith("Reuniao confirmada.");
    const shouldSplitObjectionResponse = response.includes("\n\nFicou claro?");
    const shouldSplitTiagoInterestQuestion = response.includes("\n\nIsso seria interessante para voce?");
    const shouldSplitTiagoProductionConfirmation = response.startsWith(
      "Pronto, ja encaminhei para nosso especialista",
    );
    const messages =
      shouldSplitIdentityConfirmation ||
      shouldSplitMeetingConfirmation ||
      shouldSplitObjectionResponse ||
      shouldSplitTiagoInterestQuestion ||
      shouldSplitTiagoProductionConfirmation
        ? splitIntoWhatsAppMessages(response)
        : [{ text: response }];
    for (const message of messages) {
      await this.crm.saveOutboundMessage({ leadId: lead.id, body: message.text });
    }
    return { response, shouldSend: true, messages: messages.length > 1 ? messages : undefined };
  }

  private async startSdrTestFlow(lead: LeadRecord): Promise<OutboundMessage[]> {
    const firstQuestion = qualificationQuestions[0];
    await this.crm.setQualificationProgress({
      leadId: lead.id,
      currentQualificationQuestion: firstQuestion.id,
      qualificationStarted: true,
    });

    return [
      { text: "Ola! Sou Allan Nascimento, agente comercial da Assessoria FXP para autoescolas." },
      {
        text: "Vou fazer algumas perguntas rapidas para entender seu cenario e, se fizer sentido, te conduzir para uma demonstracao.",
        delayMs: 1200,
      },
      { text: firstQuestion.prompt, delayMs: 1200 },
    ];
  }

  private async startTiagoSiteCampaignFlow(lead: LeadRecord): Promise<OutboundMessage[]> {
    await this.crm.setQualificationProgress({
      leadId: lead.id,
      currentQualificationQuestion: "tiagoMaterials",
      qualificationStarted: true,
    });

    return splitIntoWhatsAppMessages(
      [
        "Ola! Sou Alan Nascimento, assistente da Assessoria FXP.",
        "Voce veio pela campanha do Tiago Cesar. Vou te explicar rapidinho como funciona.",
        "Nos criamos uma versao demonstrativa do seu site sem compromisso e enviamos para voce avaliar.",
        "Voce so paga depois de aprovar.",
        "Para comecarmos, preciso que voce me envie aqui:",
        "1. Um print do seu Instagram",
        "2. Um print do seu Perfil da Empresa no Google",
        "Com essas informacoes conseguimos entender melhor sua empresa e preparar a demonstracao.",
        "Pode mandar agora 👇",
      ].join("\n"),
    );
  }

  private async buildDraftResponse(
    lead: LeadRecord,
    text: string,
    messageType = "text",
    latestOutbound: string | null = null,
  ): Promise<string> {
    if (lead.funnelStage === "reuniao_agendada") {
      return this.handleScheduledMeetingChange(lead, text);
    }

    if (lead.funnelStage === "agendamento_em_andamento") {
      return this.tryScheduleMeeting(lead, text);
    }

    if (shouldConfirmDiagnosticIdentity(lead)) {
      return this.handleDiagnosticIdentityConfirmation(lead, text);
    }

    if (isTiagoSiteCampaignState(lead.currentQualificationQuestion) || isTiagoLatestOutbound(latestOutbound)) {
      return this.handleTiagoSiteCampaign(lead, text, messageType, latestOutbound);
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

    if (currentQuestion.id === "demoConsent") {
      return this.handleDemoConsent(lead, text);
    }

    if (currentQuestion.id === "demoQuestion") {
      return this.handleDemoQuestion(lead, text);
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

  private async handleDemoConsent(lead: LeadRecord, text: string): Promise<string> {
    await this.crm.saveQualificationAnswer({
      leadId: lead.id,
      questionId: "demoConsent",
      rawAnswer: text,
      parsedValue: text,
    });

    if (isIdentityDenied(text)) {
      return "Sem problema. Se preferir, posso te explicar em poucas linhas como o agente funciona antes do teste.";
    }

    await this.crm.setQualificationProgress({
      leadId: lead.id,
      currentQualificationQuestion: "demoQuestion",
      qualificationStarted: true,
    });

    return (
      qualificationQuestions.find((question) => question.id === "demoQuestion")?.prompt ??
      "Pode mandar uma pergunta que um cliente faria no WhatsApp da sua autoescola."
    );
  }

  private async handleDemoQuestion(lead: LeadRecord, text: string): Promise<string> {
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);

    if (isDemoInviteAccepted(text, latestOutbound)) {
      await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });
      const slots = await this.calendar.getAvailableSlots();
      return `Perfeito. Consultei a agenda e tenho ${formatSlotOptions(slots)}. Qual desses fica melhor para uma demonstracao de aproximadamente 15 minutos?`;
    }

    await this.crm.saveQualificationAnswer({
      leadId: lead.id,
      questionId: "demoQuestion",
      rawAnswer: text,
      parsedValue: text,
    });

    if (isPersonalizationObjection(text)) {
      return buildPersonalizationExplanation(lead);
    }

    if (isQuestionLike(text) || text.trim().length > 0) {
      return `${buildAutoSchoolDemoResponse(text)}\n\n${buildDemoInvite(lead)}`;
    }

    return "Pode mandar uma pergunta que um aluno normalmente faria para sua autoescola no WhatsApp.";
  }

  private async handleTiagoSiteCampaign(
    lead: LeadRecord,
    text: string,
    messageType: string,
    latestOutbound: string | null,
  ): Promise<string> {
    const currentState = inferTiagoState(lead.currentQualificationQuestion, latestOutbound);

    if (currentState === "tiagoAwaitingConfirmation") {
      if (isIdentityConfirmed(text)) {
        return this.confirmTiagoMaterialsComplete(lead);
      }

      if (isIdentityDenied(text)) {
        return "Sem problema. Me envie por escrito o nome da empresa e os links do Instagram e do Perfil da Empresa no Google, se tiver.";
      }

      return "So para confirmar: os materiais recebidos sao o print do Instagram e o print do Perfil da Empresa no Google. E isso mesmo?";
    }

    if (currentState === "tiagoProduction") {
      if (isHowLongQuestion(text)) {
        return "Ja colocamos sua demonstracao em producao. Assim que estiver pronta, enviaremos o video por aqui para voce avaliar.";
      }

      if (isApprovalLike(text)) {
        return "Perfeito. Vou avisar a equipe que voce aprovou a proposta para seguirmos com os proximos passos de publicacao.";
      }

      return "Sua demonstracao esta em producao. Assim que estiver pronta, enviaremos o video por aqui para voce avaliar.";
    }

    if ((currentState === "tiagoNeedsGoogle" || currentState === "tiagoNeedsInstagram") && isIdentityDenied(text)) {
      return "Sem problema. Me envie por escrito o nome da empresa e os links do Instagram e do Perfil da Empresa no Google, se tiver.";
    }

    if (currentState === "tiagoMaterials" && countReceivedMediaMarkers(text) >= 2) {
      await this.crm.saveQualificationAnswer({
        leadId: lead.id,
        questionId: "tiagoNeedsGoogle",
        rawAnswer: text || messageType,
        parsedValue: "instagram_recebido",
      });
      await this.crm.saveQualificationAnswer({
        leadId: lead.id,
        questionId: "tiagoNeedsInstagram",
        rawAnswer: text || messageType,
        parsedValue: "google_recebido",
      });
      return this.confirmTiagoMaterialsForReview(lead);
    }

    const receivedMaterial = detectTiagoMaterial(text, messageType);
    const material =
      receivedMaterial === "unknown_file" && currentState === "tiagoNeedsGoogle"
        ? "google"
        : receivedMaterial === "unknown_file" && currentState === "tiagoNeedsInstagram"
          ? "instagram"
          : receivedMaterial;

    if (material === "unknown_file") {
      if (currentState === "tiagoMaterials") {
        await this.crm.saveQualificationAnswer({
          leadId: lead.id,
          questionId: "tiagoNeedsGoogle",
          rawAnswer: text || messageType,
          parsedValue: "instagram_recebido_sem_legenda",
        });
        await this.crm.setQualificationProgress({
          leadId: lead.id,
          currentQualificationQuestion: "tiagoNeedsGoogle",
          qualificationStarted: true,
        });

        return "Recebi o print e organizei como Instagram da empresa. E isso mesmo?\n\nAgora so preciso do print do Perfil da Empresa no Google.";
      }

      return "Recebi o print. Para eu organizar certo, ele e do Instagram ou do Perfil da Empresa no Google?";
    }

    if (material === "instagram") {
      await this.crm.saveQualificationAnswer({
        leadId: lead.id,
        questionId: "tiagoNeedsGoogle",
        rawAnswer: text || messageType,
        parsedValue: "instagram_recebido",
      });

      if (currentState === "tiagoNeedsInstagram") {
        return this.confirmTiagoMaterialsForReview(lead);
      }

      await this.crm.setQualificationProgress({
        leadId: lead.id,
        currentQualificationQuestion: "tiagoNeedsGoogle",
        qualificationStarted: true,
      });

      return "Perfeito! Ja recebi o Instagram.\n\nAgora so preciso do print do seu Perfil da Empresa no Google para conseguirmos preparar a demonstracao.";
    }

    if (material === "google") {
      await this.crm.saveQualificationAnswer({
        leadId: lead.id,
        questionId: "tiagoNeedsInstagram",
        rawAnswer: text || messageType,
        parsedValue: "google_recebido",
      });

      if (currentState === "tiagoNeedsGoogle") {
        return this.confirmTiagoMaterialsForReview(lead);
      }

      await this.crm.setQualificationProgress({
        leadId: lead.id,
        currentQualificationQuestion: "tiagoNeedsInstagram",
        qualificationStarted: true,
      });

      return "Perfeito! Ja recebi o Google.\n\nAgora so preciso do print do Instagram da sua empresa.";
    }

    if (isHowLongQuestion(text)) {
      return "Assim que recebermos os dois prints, colocamos sua demonstracao em producao e enviamos o video por aqui para voce avaliar.";
    }

    if (isTiagoPricingQuestion(text)) {
      return "Pela campanha do Tiago Cesar, a criacao do site sai de R$ 497 por R$ 297. Voce so paga depois de ver e aprovar. A partir do segundo mes, fica R$ 49/mes para manutencao e estrutura.\n\nIsso seria interessante para voce?";
    }

    return "Para eu seguir com sua demonstracao, preciso dos dois materiais: um print do Instagram da empresa e um print do Perfil da Empresa no Google.";
  }

  private async confirmTiagoMaterialsForReview(lead: LeadRecord): Promise<string> {
    await this.crm.setQualificationProgress({
      leadId: lead.id,
      currentQualificationQuestion: "tiagoAwaitingConfirmation",
      qualificationStarted: true,
    });

    return [
      "Recebi os prints e organizei assim:",
      "Instagram da empresa: recebido.",
      "Perfil da Empresa no Google: recebido.",
      "Vou usar esses materiais para preparar a demonstracao do site.",
      "E isso mesmo?",
    ].join("\n");
  }

  private async confirmTiagoMaterialsComplete(lead: LeadRecord): Promise<string> {
    await this.crm.setQualificationProgress({
      leadId: lead.id,
      currentQualificationQuestion: "tiagoProduction",
      qualificationStarted: true,
    });

    return [
      "Pronto, ja encaminhei para nosso especialista que vai estar criando o modelo do seu site para eu te enviar.",
      "Vamos utilizar essas informacoes para preparar uma versao demonstrativa do site da sua empresa.",
      "Daqui a pouco enviaremos aqui no WhatsApp um video mostrando como ficou a proposta do seu novo site.",
      "E como voce veio atraves do Tiago Cesar, voce tem acesso a condicao especial da campanha:",
      "Criacao do site de R$ 497 por R$ 297.",
      "Voce so paga depois de ver e aprovar o site.",
      "A partir do segundo mes, fica apenas R$ 49/mes para manutencao e estrutura do site.",
      "Primeiro voce ve como ficou. Se gostar e aprovar, seguimos com a publicacao.",
    ].join("\n");
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
      `${greeting} Eu sou Allan Nascimento, da assessoria FXP. Somos um hub de solucoes digitais e de IA para autoescolas.`,
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
    const requestedDates = extractRequestedDates(text);
    const requestedWeekdays = extractRequestedWeekdays(text);
    const slots = await this.calendar.getAvailableSlots({
      preferredHours: requestedHours,
      preferredWeekdays: requestedWeekdays,
    });
    const availabilityRequest = isAvailabilityRequest(text);
    const hasPreferredSchedule = requestedHours.length > 0 || requestedWeekdays.length > 0 || requestedDates.length > 0;
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);
    let pendingConfirmationSlot = findPendingConfirmationSlot(latestOutbound, slots);
    if (
      !pendingConfirmationSlot &&
      isScheduleConfirmation(text) &&
      startsWithNormalized(latestOutbound, "So confirmando: posso marcar sua reuniao para")
    ) {
      const confirmationSlots = await this.calendar.getAvailableSlots({
        preferredHours: extractRequestedHours(latestOutbound ?? ""),
        preferredWeekdays: extractRequestedWeekdays(latestOutbound ?? ""),
      });
      pendingConfirmationSlot = findPendingConfirmationSlot(latestOutbound, confirmationSlots);
    }

    if (pendingConfirmationSlot && isIdentityDenied(text)) {
      return "Sem problema. Qual dia e horario voce prefere que eu consulte na agenda?";
    }

    if (pendingConfirmationSlot && (isScheduleConfirmation(text) || matchesSlot(text, pendingConfirmationSlot))) {
      return this.createConfirmedMeeting(lead, pendingConfirmationSlot);
    }

    const selectedSlot = slots.find((slot) => matchesSlot(text, slot));

    if (selectedSlot) {
      return `So confirmando: posso marcar sua reuniao para ${selectedSlot.label}?`;
    }

    if (availabilityRequest) {
      const preferredSlots = slots.filter((slot) => {
        const matchesHour =
          requestedHours.length === 0 || requestedHours.some((hour) => matchesSlot(`${hour} horas`, slot));
        const matchesWeekday =
          requestedWeekdays.length === 0 || requestedWeekdays.includes(getSaoPauloWeekdayNumber(slot.startsAt));
        const matchesDate =
          requestedDates.length === 0 || requestedDates.some((requestedDate) => matchesRequestedDate(slot.startsAt, requestedDate));
        return matchesHour && matchesWeekday && matchesDate;
      });

      if (preferredSlots.length > 0) {
        return `Consultei a agenda e tenho ${formatSlotOptions(preferredSlots)}. Qual desses prefere?`;
      }

      return `Nesse horario nao tenho vaga livre. Tenho ${formatSlotOptions(slots, { preserveOrder: hasPreferredSchedule })}. Algum desses funciona?`;
    }

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

  private async handleScheduledMeetingChange(lead: LeadRecord, text: string): Promise<string> {
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);

    if (isGreetingOnly(text)) {
      return buildOpenHelpResponse(lead);
    }

    if (startsWithNormalized(latestOutbound, "So confirmando: posso cancelar sua reuniao") && isIdentityConfirmed(text)) {
      await this.crm.cancelUpcomingMeeting({ leadId: lead.id });
      return "Reuniao cancelada. Reagende a qualquer momento entrando em contato por aqui. A FXP agradece!";
    }

    if (startsWithNormalized(latestOutbound, "So confirmando: posso consultar novos horarios") && isIdentityConfirmed(text)) {
      await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });
      const slots = await this.calendar.getAvailableSlots({
        preferredHours: extractRequestedHours(text),
        preferredWeekdays: extractRequestedWeekdays(text),
      });
      return `Certo. Consultei a agenda e tenho ${formatSlotOptions(slots, { preserveOrder: true })}. Qual desses fica melhor?`;
    }

    if (isCancellationRequest(text)) {
      return "So confirmando: posso cancelar sua reuniao agendada?";
    }

    if (isRescheduleRequest(text) || isAvailabilityRequest(text)) {
      await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });
      const slots = await this.calendar.getAvailableSlots({
        preferredHours: extractRequestedHours(text),
        preferredWeekdays: extractRequestedWeekdays(text),
      });
      return `Certo. Vou consultar novos horarios para substituir seu agendamento atual. Tenho ${formatSlotOptions(slots, { preserveOrder: true })}. Qual desses fica melhor?`;
    }

    const objectionResponse = getSchedulingObjectionResponse(text);
    if (objectionResponse) return objectionResponse;

    if (isQuestionLike(text)) {
      return "Claro. Me diga qual ponto voce quer esclarecer que eu respondo de forma objetiva.";
    }

    return "Claro. Posso tirar alguma duvida, remarcar ou cancelar seu agendamento. Como posso ajudar?";
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
  if (!startsWithNormalized(latestOutbound, "So confirmando: posso marcar sua reuniao para")) return null;
  return slots.find((slot) => latestOutbound?.includes(slot.label)) ?? null;
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

function buildAutoSchoolDemoResponse(text: string) {
  const normalizedText = normalizeForIntent(text);

  if (/\b(valor|preco|quanto custa|categoria a|categoria b|habilitacao|cnh)\b/.test(normalizedText)) {
    return [
      "Exemplo de resposta do agente:",
      "Claro! Para te orientar certinho, voce busca primeira habilitacao, adicao de categoria ou mudanca de categoria?",
      "Com essa informacao eu ja te direciono para o plano mais adequado e posso chamar a equipe se precisar.",
    ].join("\n");
  }

  if (/\b(parcel|cartao|pix|entrada|forma de pagamento|pagar)\b/.test(normalizedText)) {
    return [
      "Exemplo de resposta do agente:",
      "Sim, a autoescola pode trabalhar com opcoes de pagamento. Me diga qual categoria voce quer fazer para eu te passar a melhor orientacao.",
    ].join("\n");
  }

  if (/\b(documento|documentos|preciso levar|matricula)\b/.test(normalizedText)) {
    return [
      "Exemplo de resposta do agente:",
      "Para iniciar, normalmente sao solicitados documento com foto, CPF, comprovante de residencia e dados de contato.",
      "Posso te encaminhar para a equipe confirmar os detalhes e proximos passos.",
    ].join("\n");
  }

  if (/\b(horario|funciona|abre|fecha|atendimento|onde|endereco|localizacao|fica)\b/.test(normalizedText)) {
    return [
      "Exemplo de resposta do agente:",
      "Posso te ajudar com isso. Me informe seu bairro ou melhor horario de atendimento que eu direciono a conversa para a unidade responsavel.",
    ].join("\n");
  }

  if (/\b(quanto tempo|demora|prazo|aulas|prova|exame)\b/.test(normalizedText)) {
    return [
      "Exemplo de resposta do agente:",
      "O prazo pode variar conforme categoria, agenda de aulas e etapas do Detran.",
      "Me diga se e primeira habilitacao ou adicao de categoria para eu te orientar melhor.",
    ].join("\n");
  }

  return [
    "Exemplo de resposta do agente:",
    "Entendi. Para te ajudar melhor, me diga se voce quer tirar a primeira CNH, adicionar uma categoria ou apenas tirar uma duvida sobre o processo.",
    "Assim eu organizo seu atendimento e encaminho para o proximo passo.",
  ].join("\n");
}

function buildPersonalizationExplanation(lead: LeadRecord) {
  const firstName = lead.responsibleName?.trim().split(/\s+/)[0] || lead.pushName?.trim().split(/\s+/)[0] || "";
  const schoolName = lead.drivingSchoolName?.trim() || "sua autoescola";
  const namePrefix = firstName ? `Exatamente, ${firstName}.` : "Exatamente.";

  return [
    `${namePrefix} Aqui estamos usando apenas um exemplo para voce testar o comportamento do agente.`,
    `Quando implementamos na ${schoolName}, o agente e treinado com as informacoes reais da sua empresa: precos, endereco, horarios, categorias, formas de pagamento, documentos, promocoes e demais detalhes do atendimento.`,
    "Ou seja, ele passa a responder usando o contexto da sua propria autoescola.",
    buildDemoInvite(lead),
  ].join("\n");
}

function buildDemoInvite(lead: LeadRecord) {
  const schoolName = lead.drivingSchoolName?.trim() || "sua autoescola";
  return `Posso te mostrar como podemos implementar isso no WhatsApp da ${schoolName} em uma demonstracao gratuita de aproximadamente 15 minutos?`;
}

function isPersonalizationObjection(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(meu preco nao|preco nao|valor errado|nao e esse|nao funciona assim|endereco e outro|horario diferente|dados errados|informacao errada)\b/.test(
    normalizedText,
  );
}

function isDemoInviteAccepted(text: string, latestOutbound: string | null) {
  const normalizedLatest = normalizeForIntent(latestOutbound ?? "");
  const inviteWasSent =
    normalizedLatest.includes("demonstracao gratuita") ||
    normalizedLatest.includes("implementar isso no whatsapp") ||
    normalizedLatest.includes("posso te mostrar");

  return inviteWasSent && isScheduleConfirmation(text);
}

function isTiagoSiteCampaignState(value: ConversationQuestionId | null) {
  return (
    value === "tiagoMaterials" ||
    value === "tiagoNeedsInstagram" ||
    value === "tiagoNeedsGoogle" ||
    value === "tiagoAwaitingConfirmation" ||
    value === "tiagoProduction"
  );
}

function getActiveConversationFlow(lead: LeadRecord, latestOutbound: string | null): "tiago_sites" | "sdr_test" | null {
  if (isTiagoSiteCampaignState(lead.currentQualificationQuestion) || isTiagoLatestOutbound(latestOutbound)) {
    return "tiago_sites";
  }

  if (
    lead.currentQualificationQuestion === "responsibleName" ||
    lead.currentQualificationQuestion === "drivingSchoolName" ||
    lead.currentQualificationQuestion === "demoConsent" ||
    lead.currentQualificationQuestion === "demoQuestion"
  ) {
    return "sdr_test";
  }

  return null;
}

function inferTiagoState(currentState: ConversationQuestionId | null, latestOutbound: string | null): ConversationQuestionId | null {
  if (isTiagoSiteCampaignState(currentState)) return currentState;

  const normalizedLatest = normalizeForIntent(latestOutbound ?? "");
  if (!normalizedLatest) return currentState;

  if (normalizedLatest.includes("e isso mesmo")) return "tiagoAwaitingConfirmation";
  if (normalizedLatest.includes("site ja esta em producao") || normalizedLatest.includes("demonstracao esta em producao")) {
    return "tiagoProduction";
  }
  if (normalizedLatest.includes("so preciso do print do seu perfil da empresa no google")) return "tiagoNeedsGoogle";
  if (normalizedLatest.includes("so preciso do print do instagram")) return "tiagoNeedsInstagram";
  if (normalizedLatest.includes("pode mandar agora") || normalizedLatest.includes("print do seu instagram")) return "tiagoMaterials";

  return currentState;
}

function isTiagoLatestOutbound(latestOutbound: string | null) {
  return isTiagoSiteCampaignState(inferTiagoState(null, latestOutbound));
}

function isTiagoSiteCampaignTrigger(text: string) {
  const normalizedText = normalizeForIntent(text);
  const mentionsTiago = /\btiago (cesar|cezar)\b/.test(normalizedText);
  const mentionsInstagram = /\b(instagram|insta)\b/.test(normalizedText);
  const mentionsSite = /\b(site|pagina|landing page|presenca digital)\b/.test(normalizedText);

  return (
    mentionsTiago &&
    mentionsInstagram &&
    (mentionsSite ||
      normalizedText.includes("criar para minha empresa") ||
      normalizedText.includes("gostaria de criar") ||
      normalizedText.includes("vim pela campanha"))
  );
}

function detectTiagoMaterial(text: string, messageType: string): "instagram" | "google" | "unknown_file" | null {
  const normalizedText = normalizeForIntent(text);
  const normalizedType = normalizeForIntent(messageType);
  const hasMedia =
    /image|imagem|video|document|documento|media|sticker|arquivo|audio/.test(normalizedType) ||
    /\b(print|screenshot|foto|imagem|arquivo|anexo)\b/.test(normalizedText);

  if (/\b(instagram|insta|perfil do instagram|print do instagram)\b/.test(normalizedText)) return "instagram";
  if (/\b(google|perfil da empresa|empresa no google|google meu negocio|google business|maps|mapa)\b/.test(normalizedText)) {
    return "google";
  }

  return hasMedia ? "unknown_file" : null;
}

function countReceivedMediaMarkers(text: string) {
  return (text.match(/\[(?:image|video|document|audio|sticker|media)[^\]]*recebido\]/gi) ?? []).length;
}

function isHowLongQuestion(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(quanto tempo|demora|prazo|quando fica pronto|quando sai|previsao)\b/.test(normalizedText);
}

function isTiagoPricingQuestion(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(preco|valor|quanto custa|custa quanto|mensalidade|pagar|pagamento|manutencao)\b/.test(normalizedText);
}

function isApprovalLike(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(gostei|aprovei|aprovado|pode publicar|vamos seguir|fechado|quero sim|ficou bom)\b/.test(normalizedText);
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

function isScheduleConfirmation(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /^(s|sim|pode|pode sim|sim pode|pode marcar|pode agendar|confirmo|confirmado|ok|certo|isso|fechado|ta certo|esta certo)[!. ]*$/.test(
    normalizedText,
  );
}

function isIdentityDenied(text: string) {
  const normalizedText = normalizeForIntent(text);
  return /\b(nao|errado|incorreto|nao sou|nao e|esta errado|ta errado)\b/.test(normalizedText);
}

function isAgentTestTrigger(text: string) {
  const normalizedText = normalizeForIntent(text);
  const compactText = normalizedText.replace(/[^\p{L}\p{N}]+/gu, " ");
  return /\bquero testar\b/.test(compactText) && /\bagente de ia\b/.test(compactText) && /\bwhats ?app\b/.test(compactText);
}

function startsWithNormalized(value: string | null | undefined, prefix: string) {
  if (!value) return false;
  return normalizeForIntent(value).startsWith(normalizeForIntent(prefix));
}

function normalizeForIntent(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”"']/g, "")
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
