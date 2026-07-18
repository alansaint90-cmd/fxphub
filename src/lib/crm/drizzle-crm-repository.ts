import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, conversationMessages, leadForms, leads, qualificationAnswers } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { CrmRepository, LeadFormConversationContext, LeadRecord } from "./types";

const modifiedBy = env.SYSTEM_USER_ID;

export class DrizzleCrmRepository implements CrmRepository {
  async upsertLead(input: { whatsappJid: string; phone: string; pushName?: string }): Promise<LeadRecord> {
    const [lead] = await db
      .insert(leads)
      .values({
        whatsappJid: input.whatsappJid,
        phone: input.phone,
        pushName: input.pushName,
        funnelStage: "ia_atendendo",
        lastInteractionAt: new Date(),
        modifiedBy,
      })
      .onConflictDoUpdate({
        target: leads.whatsappJid,
        set: {
          pushName: input.pushName,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
          modifiedBy,
        },
      })
      .returning();

    return toLeadRecord(lead);
  }

  async getLatestLeadFormContextByPhone(phone: string): Promise<LeadFormConversationContext | null> {
    const phoneVariants = getPhoneLookupVariants(phone);
    const [formLead] = await db
      .select()
      .from(leadForms)
      .where(and(inArray(leadForms.phone, phoneVariants), eq(leadForms.isDeleted, false)))
      .orderBy(desc(leadForms.createdAt))
      .limit(1);

    const leadForm = formLead ?? (await getLatestClickedLeadForm());
    if (!leadForm) return null;

    return {
      formLeadId: leadForm.id,
      name: leadForm.name,
      businessName: leadForm.businessName,
      phone: leadForm.phone,
      city: leadForm.city,
      role: leadForm.role,
      runsPaidAds: leadForm.runsPaidAds,
      paidTrafficReason: leadForm.paidTrafficReason,
      currentDailyLeads: leadForm.currentDailyLeads,
      desiredDailyLeads: leadForm.desiredDailyLeads,
      attendanceStructure: leadForm.attendanceStructure,
      responseTime: leadForm.responseTime,
      mainChallenge: leadForm.mainChallenge,
      meetingInterest: leadForm.meetingInterest,
      diagnosticStatus: leadForm.diagnosticStatus,
      diagnosticSummary: leadForm.diagnosticSummary,
      qualificationScore: leadForm.qualificationScore,
      diagnosticAnswers: leadForm.diagnosticAnswers,
    };
  }

  async applyLeadFormContextToLead(input: {
    leadId: string;
    context: LeadFormConversationContext;
  }): Promise<LeadRecord> {
    const [lead] = await db
      .update(leads)
      .set({
        responsibleName: input.context.name,
        drivingSchoolName: input.context.businessName,
        city: input.context.city ?? undefined,
        runsPaidTraffic: input.context.runsPaidAds === "Sim, utilizamos atualmente.",
        usesCrm: input.context.attendanceStructure === "Temos automacao ou Inteligencia Artificial.",
        mainPain: input.context.mainChallenge ?? undefined,
        score: input.context.qualificationScore,
        classification: input.context.diagnosticStatus === "HOT" ? "A" : input.context.diagnosticStatus === "WARM" ? "B" : "C",
        qualificationSummary: input.context.diagnosticSummary,
        funnelStage: "qualificado",
        currentQualificationQuestion: null,
        qualificationStarted: true,
        updatedAt: new Date(),
        modifiedBy,
      })
      .where(and(eq(leads.id, input.leadId), eq(leads.isDeleted, false)))
      .returning();

    if (!lead) throw new Error("Lead nao encontrado para aplicar contexto do formulario.");
    return toLeadRecord(lead);
  }

  async saveInboundMessage(input: {
    leadId: string;
    body: string;
    messageType: string;
    providerMessageId?: string;
  }): Promise<void> {
    await db.insert(conversationMessages).values({
      leadId: input.leadId,
      direction: "inbound",
      author: "lead",
      messageType: input.messageType,
      body: input.body,
      providerMessageId: input.providerMessageId,
      modifiedBy,
    });
  }

  async saveOutboundMessage(input: { leadId: string; body: string }): Promise<void> {
    await db.insert(conversationMessages).values({
      leadId: input.leadId,
      direction: "outbound",
      author: "ia",
      messageType: "text",
      body: input.body,
      modifiedBy,
    });
  }

  async saveQualificationAnswer(input: {
    leadId: string;
    questionId: string;
    rawAnswer: string;
    parsedValue: string | number | boolean;
  }): Promise<void> {
    await db.insert(qualificationAnswers).values({
      leadId: input.leadId,
      questionId: input.questionId,
      rawAnswer: input.rawAnswer,
      parsedValue: input.parsedValue,
      modifiedBy,
    });
  }

  async updateLeadQualification(input: Parameters<CrmRepository["updateLeadQualification"]>[0]): Promise<LeadRecord> {
    const [lead] = await db
      .update(leads)
      .set({
        responsibleName: input.answers.responsibleName,
        drivingSchoolName: input.answers.drivingSchoolName,
        monthlyEnrollments: input.answers.monthlyEnrollments,
        commercialAttendants: input.answers.commercialAttendants,
        usesCrm: input.answers.usesCrm,
        runsPaidTraffic: input.answers.runsPaidTraffic,
        mainPain: input.answers.mainPain,
        city: input.answers.city,
        score: input.score,
        classification: input.classification,
        painPoints: input.painPoints,
        qualificationSummary: input.summary,
        funnelStage: input.funnelStage,
        currentQualificationQuestion: input.currentQualificationQuestion,
        updatedAt: new Date(),
        modifiedBy,
      })
      .where(and(eq(leads.id, input.leadId), eq(leads.isDeleted, false)))
      .returning();

    if (!lead) throw new Error("Lead nao encontrado para atualizacao.");
    return toLeadRecord(lead);
  }

  async setQualificationProgress(input: {
    leadId: string;
    currentQualificationQuestion: string | null;
    qualificationStarted: boolean;
  }): Promise<void> {
    await db
      .update(leads)
      .set({
        currentQualificationQuestion: input.currentQualificationQuestion,
        qualificationStarted: input.qualificationStarted,
        updatedAt: new Date(),
        modifiedBy,
      })
      .where(and(eq(leads.id, input.leadId), eq(leads.isDeleted, false)));
  }

  async setFunnelStage(input: Parameters<CrmRepository["setFunnelStage"]>[0]): Promise<void> {
    await db
      .update(leads)
      .set({
        funnelStage: input.funnelStage,
        updatedAt: new Date(),
        modifiedBy,
      })
      .where(and(eq(leads.id, input.leadId), eq(leads.isDeleted, false)));
  }

  async markMeetingScheduled(input: {
    leadId: string;
    startsAt: Date;
    endsAt: Date;
    externalEventId?: string;
  }): Promise<void> {
    await db.insert(appointments).values({
      leadId: input.leadId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      externalEventId: input.externalEventId,
      confirmationSentAt: new Date(),
      modifiedBy,
    });

    await db
      .update(leads)
      .set({
        funnelStage: "reuniao_agendada",
        updatedAt: new Date(),
        modifiedBy,
      })
      .where(and(eq(leads.id, input.leadId), eq(leads.isDeleted, false)));
  }
}

function getPhoneLookupVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const variants = new Set<string>();

  if (digits) variants.add(digits);
  if (digits.startsWith("55") && digits.length > 11) variants.add(digits.slice(2));
  if (!digits.startsWith("55") && digits.length >= 10) variants.add(`55${digits}`);
  if (digits.length > 11) variants.add(digits.slice(-11));
  if (digits.length > 10) variants.add(digits.slice(-10));

  return [...variants];
}

async function getLatestClickedLeadForm() {
  const recentWindow = new Date(Date.now() - 1000 * 60 * 60 * 4);
  const [formLead] = await db
    .select()
    .from(leadForms)
    .where(
      and(
        eq(leadForms.isDeleted, false),
        eq(leadForms.faustoContactStarted, true),
        gte(leadForms.whatsappClickedAt, recentWindow),
      ),
    )
    .orderBy(desc(leadForms.whatsappClickedAt))
    .limit(1);

  return formLead ?? null;
}

function toLeadRecord(row: typeof leads.$inferSelect): LeadRecord {
  return {
    id: row.id,
    whatsappJid: row.whatsappJid,
    phone: row.phone,
    pushName: row.pushName,
    responsibleName: row.responsibleName ?? undefined,
    drivingSchoolName: row.drivingSchoolName ?? undefined,
    monthlyEnrollments: row.monthlyEnrollments ?? undefined,
    commercialAttendants: row.commercialAttendants ?? undefined,
    usesCrm: row.usesCrm ?? undefined,
    runsPaidTraffic: row.runsPaidTraffic ?? undefined,
    mainPain: row.mainPain ?? undefined,
    city: row.city ?? undefined,
    score: row.score,
    classification: row.classification,
    painPoints: row.painPoints as LeadRecord["painPoints"],
    qualificationSummary: row.qualificationSummary,
    funnelStage: row.funnelStage,
    currentQualificationQuestion: row.currentQualificationQuestion as LeadRecord["currentQualificationQuestion"],
    qualificationStarted: row.qualificationStarted,
    aiPaused: row.aiPaused,
  };
}
