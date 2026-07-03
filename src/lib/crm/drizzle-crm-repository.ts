import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointments, conversationMessages, leads, qualificationAnswers } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { CrmRepository, LeadRecord } from "./types";

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

function toLeadRecord(row: typeof leads.$inferSelect): LeadRecord {
  return {
    id: row.id,
    whatsappJid: row.whatsappJid,
    phone: row.phone,
    pushName: row.pushName,
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
