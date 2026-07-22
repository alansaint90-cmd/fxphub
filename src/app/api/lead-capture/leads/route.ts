import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leadFormEvents, leadForms, leadFormSettings } from "@/lib/db/schema";
import { env } from "@/lib/env";

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["mark_scheduled", "mark_attended", "mark_no_show", "mark_closed", "mark_lost", "reclassify"]),
  qualificationStatus: z.enum(["qualified", "unqualified"]).optional(),
  notes: z.string().trim().optional(),
});

export async function GET() {
  try {
    const [leads, settings] = await Promise.all([
      db.select().from(leadForms).where(eq(leadForms.isDeleted, false)).orderBy(desc(leadForms.createdAt)).limit(300),
      db.select().from(leadFormSettings).orderBy(desc(leadFormSettings.createdAt)).limit(1),
    ]);
    const events = await db
      .select({
        eventName: leadFormEvents.eventName,
        createdAt: leadFormEvents.createdAt,
      })
      .from(leadFormEvents)
      .orderBy(desc(leadFormEvents.createdAt))
      .limit(1000);

    return NextResponse.json({
      ok: true,
      settings: settings[0] ? toSettings(settings[0]) : null,
      events: events.map((event) => ({
        eventName: event.eventName,
        createdAt: event.createdAt.toISOString(),
      })),
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        businessName: lead.businessName,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        state: lead.state,
        monthlyEnrollments: lead.monthlyEnrollments,
        salesAttendants: lead.salesAttendants,
        usesCrm: lead.usesCrm,
        runsPaidAds: lead.runsPaidAds,
        monthlyAdSpend: lead.monthlyAdSpend,
        mainChallenge: lead.mainChallenge,
        meetingInterest: lead.meetingInterest,
        qualificationScore: lead.qualificationScore,
        qualificationStatus: lead.qualificationStatus,
        disqualificationReason: lead.disqualificationReason,
        leadStatus: lead.leadStatus,
        whatsappClicked: lead.whatsappClicked,
        faustoContactStarted: lead.faustoContactStarted,
        meetingScheduled: lead.meetingScheduled,
        meetingDate: lead.meetingDate?.toISOString() ?? null,
        meetingAttended: lead.meetingAttended,
        dealClosed: lead.dealClosed,
        source: lead.source,
        utmCampaign: lead.utmCampaign,
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        campaignId: lead.campaignId,
        adsetId: lead.adsetId,
        adId: lead.adId,
        tags: lead.tags,
        notes: lead.notes,
        diagnosticAnswers: lead.diagnosticAnswers,
        createdAt: lead.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar leads captados.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = patchSchema.parse(await request.json());
    const updates: Partial<typeof leadForms.$inferInsert> = { updatedAt: new Date(), modifiedBy: env.SYSTEM_USER_ID };

    if (input.action === "mark_scheduled") Object.assign(updates, { meetingScheduled: true, leadStatus: "Reuniao agendada" });
    if (input.action === "mark_attended") Object.assign(updates, { meetingAttended: true, leadStatus: "Reuniao realizada" });
    if (input.action === "mark_no_show") Object.assign(updates, { leadStatus: "Nao compareceu" });
    if (input.action === "mark_closed") Object.assign(updates, { dealClosed: true, leadStatus: "Fechado" });
    if (input.action === "mark_lost") Object.assign(updates, { leadStatus: "Perdido" });
    if (input.action === "reclassify" && input.qualificationStatus) {
      Object.assign(updates, {
        qualificationStatus: input.qualificationStatus,
        leadStatus: input.qualificationStatus === "qualified" ? "Qualificado" : "Nao qualificado",
      });
    }
    if (input.notes !== undefined) updates.notes = input.notes;

    await db.update(leadForms).set(updates).where(eq(leadForms.id, input.id));
    await db.insert(leadFormEvents).values({
      leadId: input.id,
      eventName: input.action,
      eventId: crypto.randomUUID(),
      eventSource: "admin_panel",
      eventData: input,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: "invalid_lead_action", issues: error.issues }, { status: 400 });
    const message = error instanceof Error ? error.message : "Erro ao atualizar lead.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function toSettings(settings: typeof leadFormSettings.$inferSelect) {
  return {
    slug: settings.slug,
    formName: settings.formName,
    title: settings.title,
    isActive: settings.isActive,
    whatsappNumber: settings.whatsappNumber,
    qualifiedMinScore: settings.qualifiedMinScore,
    metaPixelId: settings.metaPixelId,
  };
}
