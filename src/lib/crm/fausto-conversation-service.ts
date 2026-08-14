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

    if (!activeFlow && isSdrConversationState(lead.currentQualificationQuestion) && !lead.qualificationStarted) {
      return { response: "", shouldSend: false };
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

    const shouldSplitMeetingConfirmation = response.startsWith("Reunião confirmada.");
    const shouldSplitObjectionResponse = response.includes("\n\nFicou claro?");
    const shouldSplitTiagoInterestQuestion = response.includes("\n\nIsso seria interessante para você?");
    const shouldSplitTiagoProductionConfirmation = response.startsWith(
      "Pronto, já encaminhei para nosso especialista",
    );
    const shouldSplitTiagoMaterialsReview = response.startsWith(
      "Recebi os prints e já organizei as suas informações.",
    );
    const shouldSplitDemoQuestion =
      (lead.currentQualificationQuestion === "demoQuestion" && response.includes("\n")) ||
      response.includes("\n\nQuer testar outra pergunta?") ||
      response.includes("\n\n1. Quanto custa para tirar a primeira habilitação?");
    const messages =
      shouldSplitIdentityConfirmation ||
      shouldSplitMeetingConfirmation ||
      shouldSplitObjectionResponse ||
      shouldSplitTiagoInterestQuestion ||
      shouldSplitTiagoProductionConfirmation ||
      shouldSplitTiagoMaterialsReview ||
      shouldSplitDemoQuestion
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
      { text: "Olá! Sou Allan Nascimento, agente comercial da Assessoria FXP para autoescolas." },
      {
        text: "Vou fazer algumas perguntas rápidas para entender seu cenário e, se fizer sentido, te conduzir para uma demonstração.",
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
        "Olá! Sou Alan Nascimento, assistente da Assessoria FXP.",
        "Você veio pela campanha do Tiago César. Vou te explicar rapidinho como funciona.",
        "Nós criamos uma versão demonstrativa do seu site sem compromisso e enviamos para você avaliar.",
        "Você só paga depois de aprovar.",
        "Para começarmos, preciso que você me envie aqui:",
        "1. Um print do seu Instagram",
        "2. Um print do seu Perfil da Empresa no Google",
        "Com essas informações conseguimos entender melhor sua empresa e preparar a demonstração.",
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
        "Olá! Vou entender rápido se o fxphub faz sentido para sua autoescola.",
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

    if (isIdentityQuestion(currentQuestion.id) && isMediaPlaceholder(text)) {
      return currentQuestion.id === "responsibleName"
        ? "Recebi o áudio, mas para registrar certinho me envie seu nome por escrito."
        : "Recebi o áudio, mas para registrar certinho me envie o nome da sua autoescola por escrito.";
    }

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

      if (nextQuestion) return buildQuestionPrompt(nextQuestion.id, nextAnswers, nextQuestion.prompt);

      return this.finishQualification(lead, nextAnswers);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Não consegui registrar essa resposta.";
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

    if (text.trim() && !isIdentityConfirmed(text)) {
      return this.handleDemoQuestion(lead, text);
    }

    return (
      qualificationQuestions.find((question) => question.id === "demoQuestion")?.prompt ??
      "Pode mandar uma pergunta que um cliente faria no WhatsApp da sua autoescola."
    );
  }

  private async handleDemoQuestion(lead: LeadRecord, text: string): Promise<string> {
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);
    const isSecondDemoQuestion = wasAskedToTestAnotherQuestion(latestOutbound) && !isNoMoreDemoTest(text, latestOutbound);

    if (isDemoInviteAccepted(text, latestOutbound)) {
      await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });
      const slots = await this.calendar.getAvailableSlots();
      return `Perfeito. Consultei a agenda e tenho ${formatSlotOptions(slots)}. Qual desses fica melhor para uma demonstração de aproximadamente 15 minutos?`;
    }

    if (isNoMoreDemoTest(text, latestOutbound)) {
      return buildDemoInvite(lead);
    }

    if (isNoMoreDemoDoubt(text, latestOutbound)) {
      return buildDemoInvite(lead);
    }

    if (isDrivingExperienceReply(text, latestOutbound)) {
      return buildDemoResponseClosing(buildDrivingPlanResponse(text), lead, isSecondDemoQuestion);
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
      return buildDemoResponseClosing(buildAutoSchoolDemoResponse(text), lead, isSecondDemoQuestion);
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

      return "Só para confirmar: os materiais recebidos são o print do Instagram e o print do Perfil da Empresa no Google. É isso mesmo?";
    }

    if (currentState === "tiagoProduction") {
      if (isHowLongQuestion(text)) {
        return "Já colocamos sua demonstração em produção. Assim que estiver pronta, enviaremos o vídeo por aqui para você avaliar.";
      }

      if (isApprovalLike(text)) {
        return "Perfeito. Vou avisar a equipe que você aprovou a proposta para seguirmos com os próximos passos de publicação.";
      }

      return "Sua demonstração está em produção. Assim que estiver pronta, enviaremos o vídeo por aqui para você avaliar.";
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

        return "Recebi o print e organizei como Instagram da empresa. É isso mesmo?\n\nAgora só preciso do print do Perfil da Empresa no Google.";
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

      return "Perfeito! Já recebi o Instagram.\n\nAgora só preciso do print do seu Perfil da Empresa no Google para conseguirmos preparar a demonstração.";
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

      return "Perfeito! Já recebi o Google.\n\nAgora só preciso do print do Instagram da sua empresa.";
    }

    if (isHowLongQuestion(text)) {
      return "Assim que recebermos os dois prints, colocamos sua demonstração em produção e enviamos o vídeo por aqui para você avaliar.";
    }

    if (isTiagoPricingQuestion(text)) {
      return "Pela campanha do Tiago César, a criação do site sai de R$ 497 por R$ 297. Você só paga depois de ver e aprovar. A partir do segundo mês, fica R$ 49/mês para manutenção e estrutura.\n\nIsso seria interessante para você?";
    }

    return "Para eu seguir com sua demonstração, preciso dos dois materiais: um print do Instagram da empresa e um print do Perfil da Empresa no Google.";
  }

  private async confirmTiagoMaterialsForReview(lead: LeadRecord): Promise<string> {
    await this.crm.setQualificationProgress({
      leadId: lead.id,
      currentQualificationQuestion: "tiagoAwaitingConfirmation",
      qualificationStarted: true,
    });

    return [
      "Recebi os prints e já organizei as suas informações.",
      "Vou usar esses materiais para preparar a demonstração do seu site. Está tudo certo?",
    ].join("\n");
  }

  private async confirmTiagoMaterialsComplete(lead: LeadRecord): Promise<string> {
    await this.crm.setQualificationProgress({
      leadId: lead.id,
      currentQualificationQuestion: "tiagoProduction",
      qualificationStarted: true,
    });

    return [
      "Pronto, já encaminhei para nosso especialista que vai criar o modelo do seu site para eu te enviar.",
      "Vamos utilizar essas informações para preparar uma versão demonstrativa do site da sua empresa.",
      "Daqui a pouco enviaremos aqui no WhatsApp um vídeo mostrando como ficou a proposta do seu novo site.",
      "E como você veio através do Tiago César, você tem acesso à condição especial da campanha:",
      "Criação do site de R$ 497 por R$ 297.",
      "Você só paga depois de ver e aprovar o site.",
      "A partir do segundo mês, fica apenas R$ 49/mês para manutenção e estrutura do site.",
      "Primeiro você vê como ficou. Se gostar e aprovar, seguimos com a publicação.",
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
      const leadName = lead.responsibleName?.trim() || lead.pushName?.trim() || "você";
      const schoolName = lead.drivingSchoolName?.trim() || "sua autoescola";
      return `Só para confirmar: falo com ${leadName} da ${schoolName}, certo?`;
    }

    await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });

    const firstName = lead.responsibleName?.trim().split(/\s+/)[0] || lead.pushName?.trim().split(/\s+/)[0] || "";
    const greeting = firstName ? `Perfeito, ${firstName}.` : "Perfeito.";

    return [
      `${greeting} Eu sou Allan Nascimento, da assessoria FXP. Somos um hub de soluções digitais e de IA para autoescolas.`,
      `Ajudamos autoescolas a atrair mais interessados pelo WhatsApp e transformar oportunidades em matrículas.`,
      "Posso te agendar com o nosso time para uma demonstração rápida sobre como a gestão de tráfego pago, com apoio de IA, pode ser aplicada em sua autoescola.",
      "Seria interessante pra você?",
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
    const pain = answers.mainPain ? `Pelo que você comentou sobre ${answers.mainPain},` : "Pelo seu contexto,";
    return [
      `${pain} vale te mostrar isso de forma pratica.`,
      `Tenho ${options}. Qual horário prefere para uma demonstração rápida?`,
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
      startsWithNormalized(latestOutbound, "Só confirmando: posso marcar sua reunião para")
    ) {
      const confirmationSlots = await this.calendar.getAvailableSlots({
        preferredHours: extractRequestedHours(latestOutbound ?? ""),
        preferredWeekdays: extractRequestedWeekdays(latestOutbound ?? ""),
      });
      pendingConfirmationSlot = findPendingConfirmationSlot(latestOutbound, confirmationSlots);
    }

    if (pendingConfirmationSlot && isIdentityDenied(text)) {
      return "Sem problema. Qual dia e horário você prefere que eu consulte na agenda?";
    }

    if (pendingConfirmationSlot && (isScheduleConfirmation(text) || matchesSlot(text, pendingConfirmationSlot))) {
      return this.createConfirmedMeeting(lead, pendingConfirmationSlot);
    }

    const selectedSlot = slots.find((slot) => matchesSlot(text, slot));

    if (selectedSlot) {
      return `Só confirmando: posso marcar sua reunião para ${selectedSlot.label}?`;
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

      return `Nesse horário não tenho vaga livre. Tenho ${formatSlotOptions(slots, { preserveOrder: hasPreferredSchedule })}. Algum desses funciona?`;
    }

    if (isScheduleRejection(text)) {
      if (isConversationClosed(text)) {
        return "Tudo bem. Vou deixar seu contato salvo para retomarmos em outro momento.";
      }

      return "Sem problema. Me diga qual dia e horário você prefere que eu consulto a agenda.";
    }

    const objectionResponse = getSchedulingObjectionResponse(text);
    if (objectionResponse) {
      return objectionResponse;
    }

    if (isQuestionLike(text)) {
      return "Claro. Me diga sua dúvida que eu respondo de forma objetiva e depois seguimos para o melhor horário da demonstração.";
    }

    return `Consultei a agenda e tenho ${formatSlotOptions(slots, { preserveOrder: hasPreferredSchedule })}. Qual desses fica melhor?`;
  }

  private async handleScheduledMeetingChange(lead: LeadRecord, text: string): Promise<string> {
    const latestOutbound = await this.crm.getLatestOutboundMessage(lead.id);

    if (isGreetingOnly(text)) {
      return buildOpenHelpResponse(lead);
    }

    if (startsWithNormalized(latestOutbound, "Só confirmando: posso cancelar sua reunião") && isIdentityConfirmed(text)) {
      await this.crm.cancelUpcomingMeeting({ leadId: lead.id });
      return "Reuniao cancelada. Reagende a qualquer momento entrando em contato por aqui. A FXP agradece!";
    }

    if (startsWithNormalized(latestOutbound, "Só confirmando: posso consultar novos horários") && isIdentityConfirmed(text)) {
      await this.crm.setFunnelStage({ leadId: lead.id, funnelStage: "agendamento_em_andamento" });
      const slots = await this.calendar.getAvailableSlots({
        preferredHours: extractRequestedHours(text),
        preferredWeekdays: extractRequestedWeekdays(text),
      });
      return `Certo. Consultei a agenda e tenho ${formatSlotOptions(slots, { preserveOrder: true })}. Qual desses fica melhor?`;
    }

    if (isCancellationRequest(text)) {
      return "Só confirmando: posso cancelar sua reunião agendada?";
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
      return "Claro. Me diga sua dúvida que eu respondo de forma objetiva. Se quiser remarcar ou cancelar depois, eu também consulto a agenda para você.";
    }

    return "Claro. Posso tirar alguma dúvida, remarcar ou cancelar seu agendamento. Como posso ajudar?";
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
      "Reunião confirmada.",
      "Na demonstração, vamos mostrar como sua autoescola pode usar o tráfego pago para gerar uma entrada constante de novos interessados em tirar a CNH e aumentar as oportunidades de matrícula.",
      "2 horas antes mandaremos a mensagem de lembrete da reunião. Até breve!",
    ].join("\n");
  }
}

function formatSlotOptions(slots: { startsAt?: Date; label: string }[], options: { preserveOrder?: boolean } = {}) {
  const selectedSlots = options.preserveOrder ? slots.slice(0, 4) : selectBalancedDaySlots(slots);
  const labels = selectedSlots.map((slot) => slot.label);
  if (labels.length === 0) return "nenhum horário livre no momento";
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
  if (!startsWithNormalized(latestOutbound, "Só confirmando: posso marcar sua reunião para")) return null;
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

  if (isMediaPlaceholder(text) && normalizedText.includes("audio")) {
    return [
      "Recebi seu áudio.",
      "Para eu responder com precisão nesta demonstração, me envie a mesma pergunta em texto.",
      "Na implantação real, o áudio pode ser tratado conforme a configuração definida para a sua operação.",
    ].join("\n");
  }

  if (/\b(o que voce faz|o que vc faz|voce faz o que|qual sua funcao|para que serve)\b/.test(normalizedText)) {
    return [
      "Eu consigo atender os clientes da autoescola pelo WhatsApp 24 horas por dia.",
      "Respondo dúvidas, envio informações, identifico o interesse do cliente e ajudo a conduzir o atendimento até a matrícula.",
      "Também consigo entender mensagens de texto, áudios e imagens.",
    ].join("\n");
  }

  if (/\b(voce e uma ia|vc e uma ia|e ia|inteligencia artificial|robo|bot|chatbot)\b/.test(normalizedText)) {
    return [
      "Sim. Nesta demonstração eu sou uma Inteligência Artificial especializada em atendimento para autoescolas.",
      "A ideia é você testar comigo exatamente como seus clientes conversariam no WhatsApp.",
      "Pode tentar me fazer uma pergunta de cliente agora.",
    ].join("\n");
  }

  if (/\b(como funciona|na minha autoescola|minha autoescola|personalizar|configurar)\b/.test(normalizedText)) {
    return [
      "O agente é configurado com as informações da sua própria autoescola.",
      "Valores, categorias, horários, formas de pagamento, serviços, regras e principais dúvidas dos seus clientes ficam cadastrados na base de atendimento.",
      "Assim, ele responde usando as informações reais do seu negócio.",
    ].join("\n");
  }

  if (/\b(24 horas|fora do horario|final de semana|domingo|madrugada|noite)\b/.test(normalizedText)) {
    return [
      "Sim. O atendimento pode continuar mesmo fora do horário comercial.",
      "Se alguém chamar à noite, no final de semana ou em um momento em que sua equipe não está disponível, o lead não precisa ficar esperando.",
      "Isso ajuda a manter a velocidade de resposta e evita perder oportunidades por demora.",
    ].join("\n");
  }

  if (/\b(audio|áudio|voz|mandar audio|responde audio)\b/.test(normalizedText)) {
    return [
      "Sim. Pode inclusive mandar um áudio aqui para testar.",
      "O sistema consegue interpretar o conteúdo e responder de acordo com o que a pessoa perguntou.",
    ].join("\n");
  }

  if (/\b(foto|imagem|print)\b/.test(normalizedText)) {
    return [
      "Sim. Dependendo da configuração, o agente consegue interpretar imagens relacionadas ao atendimento.",
      "Por exemplo: prints, documentos, propostas ou outras imagens que façam parte do processo definido pela autoescola.",
    ].join("\n");
  }

  if (/\b(quanto tempo|demora|prazo|aulas|prova|exame)\b/.test(normalizedText)) {
    return [
      "O prazo pode variar de acordo com cada aluno e com o andamento das etapas.",
      "Posso te explicar rapidinho como funciona todo o processo. 😊",
    ].join("\n");
  }

  if (/\b(carro.*moto|moto.*carro|carro e moto|categoria ab|as duas|duas juntas)\b/.test(normalizedText)) {
    return [
      "Sim! Trabalhamos com habilitação para carro e moto. 🚗🏍️",
      "Você quer fazer apenas uma categoria ou as duas juntas?",
    ].join("\n");
  }

  if (/\b(documento|documentos|preciso levar)\b/.test(normalizedText)) {
    return [
      "É bem simples. 😊",
      "Normalmente você vai precisar de RG, CPF e comprovante de residência.",
      "Se quiser, também posso te explicar como funciona o processo para começar.",
    ].join("\n");
  }

  if (/\b(parcel|cartao|pix|entrada|forma de pagamento|pagar)\b/.test(normalizedText)) {
    return [
      "Sim! Temos opções de pagamento parcelado. 💳",
      "As condições podem variar conforme a categoria escolhida.",
      "Qual habilitação você pretende tirar?",
    ].join("\n");
  }

  if (/\b(trabalho o dia todo|a noite|noite|sabado|sábado|fim de semana)\b/.test(normalizedText)) {
    return [
      "Entendi! 👍",
      "Temos opções de horários pensadas justamente para quem trabalha durante o dia.",
      "Você teria preferência por noite ou sábado?",
    ].join("\n");
  }

  if (/\b(horario|horarios|funciona|aulas teoricas|aulas praticas|manhã|manha|tarde)\b/.test(normalizedText)) {
    return [
      "Temos diferentes opções de horários para facilitar sua rotina.",
      "Você prefere fazer as aulas pela manhã, tarde ou noite?",
    ].join("\n");
  }

  if (/\b(adicionar moto|adicao de moto|adição de moto|ja tenho habilitacao de carro|já tenho habilitação de carro|tenho carro.*moto)\b/.test(normalizedText)) {
    return [
      "Sim, você pode fazer a adição da categoria de moto. 🏍️",
      "Posso verificar as condições para você.",
      "Sua CNH está válida atualmente?",
    ].join("\n");
  }

  if (/\b(cnh venceu|cnh vencida|renovacao|renovação|renovar)\b/.test(normalizedText)) {
    return [
      "Sim, podemos te orientar sobre o processo de renovação. 😊",
      "Há quanto tempo sua CNH está vencida?",
    ].join("\n");
  }

  if (/\b(matricula|matrícula|inscricao|inscrição|inscrever|fechar|começar|comecar)\b/.test(normalizedText)) {
    return [
      "Perfeito! 🙌 Vamos começar.",
      "Primeiro preciso de algumas informações rápidas para orientar sua matrícula.",
      "Qual é o seu nome?",
    ].join("\n");
  }

  if (/\b(onde|endereco|endereço|localizacao|localização|fica|abre|fecha|atendimento)\b/.test(normalizedText)) {
    return [
      "Posso te ajudar com isso. 😊",
      "Me diga seu bairro ou melhor horário de atendimento que eu direciono para a unidade responsável.",
      "Na implantação real, eu usaria o endereço e os horários da sua própria autoescola.",
    ].join("\n");
  }

  if (/\b(valor|preco|preço|quanto custa|primeira habilitacao|primeira habilitação|habilitacao|habilitação|cnh)\b/.test(normalizedText)) {
    return [
      "Claro! 😊 O valor depende da categoria que você deseja.",
      "Você pretende tirar habilitação para carro, moto ou carro + moto?",
    ].join("\n");
  }

  if (/\b(humano|atendente|funcionaria|funcionario|assumir|responder pessoalmente)\b/.test(normalizedText)) {
    return [
      "A ideia não é impedir sua equipe de atender.",
      "O agente pode cuidar do primeiro contato e das dúvidas repetitivas, principalmente fora do horário.",
      "Quando precisar de uma pessoa, o atendimento pode seguir para sua equipe.",
    ].join("\n");
  }

  if (/\b(errar|responder errado|medo|informacao errada|nao sabe)\b/.test(normalizedText)) {
    return [
      "Essa é justamente uma parte importante da configuração.",
      "O agente recebe uma base com as informações e regras específicas da sua autoescola.",
      "Quando não tiver informação suficiente, a orientação é não inventar e encaminhar para confirmação humana.",
    ].join("\n");
  }

  if (/\b(caro|preco alto|sem dinheiro|vou pensar|tenho agencia|nao preciso|prefiro humano)\b/.test(normalizedText)) {
    return [
      "Entendo. A proposta não é empurrar uma ferramenta, e sim mostrar onde ela pode economizar tempo e organizar o atendimento.",
      "Principalmente em dúvidas repetitivas, velocidade de resposta e oportunidades que poderiam ficar sem acompanhamento.",
      "Se quiser, você pode testar aqui uma situação real que acontece no WhatsApp da sua autoescola.",
    ].join("\n");
  }

  return [
    "Entendi. Para te ajudar melhor, me diga se você quer tirar a primeira CNH, adicionar uma categoria ou apenas tirar uma dúvida sobre o processo.",
    "Assim eu organizo seu atendimento e encaminho para o próximo passo.",
    "Na implantação real, essa resposta seria ajustada com as informações da sua autoescola.",
  ].join("\n");
}

function buildPersonalizationExplanation(lead: LeadRecord) {
  const firstName = lead.responsibleName?.trim().split(/\s+/)[0] || lead.pushName?.trim().split(/\s+/)[0] || "";
  const schoolName = lead.drivingSchoolName?.trim() || "sua autoescola";
  const namePrefix = firstName ? `Exatamente, ${firstName}.` : "Exatamente.";

  return [
    `${namePrefix} Aqui estamos usando apenas um exemplo para você testar o comportamento do agente.`,
    `Quando implementamos na ${schoolName}, o agente é treinado com as informações reais da sua empresa: preços, endereço, horários, categorias, formas de pagamento, documentos, promoções e demais detalhes do atendimento.`,
    "Ou seja, ele passa a responder usando o contexto da sua própria autoescola.",
    buildDemoInvite(lead),
  ].join("\n");
}

function buildDemoInvite(lead: LeadRecord) {
  const schoolName = sanitizeDisplayName(lead.drivingSchoolName) || "sua autoescola";
  return `Posso te mostrar como podemos implementar isso no WhatsApp da ${schoolName} em uma demonstração gratuita de aproximadamente 15 minutos?`;
}

function buildDemoResponseClosing(response: string, lead: LeadRecord, shouldInviteToMeeting: boolean) {
  if (shouldInviteToMeeting) {
    return `${response}\n\n${buildDemoInvite(lead)}`;
  }

  return `${response}\n\nQuer testar outra pergunta?`;
}

function buildQuestionPrompt(
  questionId: ConversationQuestionId,
  answers: QualificationAnswerSet,
  fallbackPrompt: string,
) {
  if (questionId === "drivingSchoolName") {
    const firstName = String(answers.responsibleName ?? "").trim().split(/\s+/)[0];
    return firstName ? `Prazer, ${firstName}! Como é o nome da sua autoescola?` : fallbackPrompt;
  }

  return fallbackPrompt;
}

function buildDrivingPlanResponse(text: string) {
  const normalizedText = normalizeForIntent(text);
  const hasExperience =
    /\b(ja|já|tenho|sei|alguma|nocao|noção|dirijo|dirigir|experiencia|experiência|pratica|prática)\b/.test(
      normalizedText,
    ) && !/\b(nao|não|nunca|zero|iniciante|sem)\b/.test(normalizedText);

  if (hasExperience) {
    return [
      "📌 Para quem já tem alguma noção de direção, o Plano Básico costuma fazer mais sentido.",
      "✅ Categoria AB: 2 aulas de carro + 2 aulas de moto.",
      "💰 À vista: R$ 640,00.",
      "💳 A prazo: R$ 715,00.",
      "Na sua autoescola, eu responderia com os valores e condições reais cadastrados na sua base.",
    ].join("\n");
  }

  return [
    "📌 Para quem ainda não tem experiência, eu indicaria o Plano Avançado.",
    "✅ Categoria AB: 4 aulas de carro + 4 aulas de moto.",
    "💰 À vista: R$ 1.280,00.",
    "💳 A prazo: R$ 1.415,00.",
    "Na sua autoescola, eu responderia com os valores e condições reais cadastrados na sua base.",
  ].join("\n");
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
    normalizedLatest.includes("posso te mostrar") ||
    normalizedLatest.includes("quer testar outra pergunta");

  return inviteWasSent && isScheduleConfirmation(text);
}

function isNoMoreDemoDoubt(text: string, latestOutbound: string | null) {
  const normalizedText = normalizeForIntent(text);
  const normalizedLatest = normalizeForIntent(latestOutbound ?? "");
  const wasAskedForDoubt =
    normalizedLatest.includes("tem alguma duvida") ||
    normalizedLatest.includes("ficou claro");

  return (
    wasAskedForDoubt &&
    /\b(nao|sem duvida|ficou claro|claro|entendi|ok|certo|pode seguir)\b/.test(normalizedText)
  );
}

function wasAskedToTestAnotherQuestion(latestOutbound: string | null) {
  const normalizedLatest = normalizeForIntent(latestOutbound ?? "");
  return normalizedLatest.includes("quer testar outra pergunta");
}

function isNoMoreDemoTest(text: string, latestOutbound: string | null) {
  const normalizedText = normalizeForIntent(text);
  return (
    wasAskedToTestAnotherQuestion(latestOutbound) &&
    /\b(nao|não|sem|chega|ja deu|já deu|pode seguir)\b/.test(normalizedText) &&
    !hasDemoQuestionIntent(normalizedText)
  );
}

function isDrivingExperienceReply(text: string, latestOutbound: string | null) {
  const normalizedText = normalizeForIntent(text);
  const normalizedLatest = normalizeForIntent(latestOutbound ?? "");
  const wasAskedExperience =
    normalizedLatest.includes("voce e iniciante") ||
    normalizedLatest.includes("alguma nocao de direcao");

  return (
    wasAskedExperience &&
    /\b(iniciante|zero|nunca|nao|sem|ja|tenho|sei|alguma|nocao|dirijo|dirigir|experiencia|pratica)\b/.test(
      normalizedText,
    )
  );
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

  if (isSdrConversationState(lead.currentQualificationQuestion) && isSdrLatestOutbound(latestOutbound)) {
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

function isSdrConversationState(value: ConversationQuestionId | null) {
  return (
    value === "responsibleName" ||
    value === "drivingSchoolName" ||
    value === "demoConsent" ||
    value === "demoQuestion"
  );
}

function isSdrLatestOutbound(latestOutbound: string | null) {
  const normalizedLatest = normalizeForIntent(latestOutbound ?? "");
  if (!normalizedLatest) return false;

  return (
    normalizedLatest.includes("allan nascimento") ||
    normalizedLatest.includes("com quem eu falo") ||
    normalizedLatest.includes("como e o nome da sua autoescola") ||
    normalizedLatest.includes("teste rapido") ||
    normalizedLatest.includes("agora faca uma pergunta") ||
    normalizedLatest.includes("voce pode escolher uma das perguntas") ||
    normalizedLatest.includes("pode comecar") ||
    normalizedLatest.includes("quer testar outra pergunta") ||
    normalizedLatest.includes("pode mandar um texto") ||
    normalizedLatest.includes("como o agente poderia se comportar") ||
    normalizedLatest.includes("tem alguma duvida sobre como isso funcionaria") ||
    normalizedLatest.includes("voce e iniciante") ||
    normalizedLatest.includes("alguma nocao de direcao") ||
    normalizedLatest.includes("posso te mostrar como podemos implementar isso no whatsapp")
  );
}

function hasDemoQuestionIntent(normalizedText: string) {
  return /\b(documento|documentos|parcel|pagamento|pagar|quanto custa|valor|preco|preço|habilitacao|habilitação|cnh|matricula|matrícula|horario|horários|horario|aula|carro|moto|renovacao|renovação|vencida|vencido|começar|comecar|interesse)\b/.test(
    normalizedText,
  );
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
  return `${greeting} Como posso ajudar? Posso tirar alguma dúvida, remarcar ou cancelar seu agendamento.`;
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
  const confirmationParts = normalizedText
    .split(/\s+(?:e\s+)?|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    /^(s|sim|quero sim|pode|pode sim|sim pode|pode marcar|pode agendar|confirmo|confirmado|ok|certo|isso|fechado|ta certo|esta certo)[!. ]*$/.test(
      normalizedText,
    ) ||
    /\b(sim|quero sim|pode sim|pode marcar|pode agendar|confirmo|confirmado|fechado)\b/.test(normalizedText) ||
    confirmationParts.some((part) => /^(s|sim|pode|ok|certo|isso|fechado)$/.test(part))
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

function isIdentityQuestion(questionId: ConversationQuestionId) {
  return questionId === "responsibleName" || questionId === "drivingSchoolName";
}

function isMediaPlaceholder(text: string | null | undefined) {
  return /^\[(?:image|video|document|audio|sticker|media)[^\]]*recebido\]$/i.test(text?.trim() ?? "");
}

function sanitizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || isMediaPlaceholder(trimmed)) return "";
  return trimmed;
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
