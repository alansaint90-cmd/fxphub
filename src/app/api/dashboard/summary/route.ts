import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appointments, conversationMessages, leadForms, leads } from "@/lib/db/schema";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = startOfSaoPauloDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const [
      allLeads,
      todayLeadForms,
      qualifiedLeadForms,
      scheduledLeadForms,
      todayMeetings,
      nextMeetings,
      recentMessages,
    ] = await Promise.all([
      db
        .select({
          id: leads.id,
          name: leads.drivingSchoolName,
          responsibleName: leads.responsibleName,
          pushName: leads.pushName,
          city: leads.city,
          score: leads.score,
          classification: leads.classification,
          funnelStage: leads.funnelStage,
          mainPain: leads.mainPain,
          qualificationSummary: leads.qualificationSummary,
          painPoints: leads.painPoints,
          lastInteractionAt: leads.lastInteractionAt,
          updatedAt: leads.updatedAt,
        })
        .from(leads)
        .where(eq(leads.isDeleted, false))
        .orderBy(desc(leads.score), desc(leads.updatedAt))
        .limit(80),
      db
        .select({ id: leadForms.id })
        .from(leadForms)
        .where(and(eq(leadForms.isDeleted, false), gte(leadForms.createdAt, todayStart), lt(leadForms.createdAt, tomorrowStart))),
      db
        .select({ id: leadForms.id })
        .from(leadForms)
        .where(and(eq(leadForms.isDeleted, false), eq(leadForms.qualificationStatus, "qualified"))),
      db
        .select({ id: leadForms.id })
        .from(leadForms)
        .where(and(eq(leadForms.isDeleted, false), eq(leadForms.meetingScheduled, true))),
      db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.isDeleted, false),
            inArray(appointments.status, ["scheduled", "rescheduled"]),
            gte(appointments.startsAt, todayStart),
            lt(appointments.startsAt, tomorrowStart),
          ),
        ),
      db
        .select({
          startsAt: appointments.startsAt,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.isDeleted, false),
            inArray(appointments.status, ["scheduled", "rescheduled"]),
            gte(appointments.startsAt, now),
          ),
        )
        .orderBy(asc(appointments.startsAt))
        .limit(1),
      db
        .select({ leadId: conversationMessages.leadId, createdAt: conversationMessages.createdAt })
        .from(conversationMessages)
        .where(and(eq(conversationMessages.isDeleted, false), gte(conversationMessages.createdAt, sevenDaysAgo)))
        .orderBy(desc(conversationMessages.createdAt)),
    ]);

    const realLeadCount = Math.max(allLeads.length, todayLeadForms.length);
    const qualifiedCount =
      allLeads.filter((lead) => lead.classification === "A" || lead.classification === "B").length ||
      qualifiedLeadForms.length;
    const scheduledCount =
      allLeads.filter((lead) => lead.funnelStage === "reuniao_agendada").length || scheduledLeadForms.length;
    const conversionRate = realLeadCount > 0 ? Math.round((scheduledCount / realLeadCount) * 100) : 0;
    const recentLeadIds = new Set(recentMessages.map((message) => message.leadId));
    const staleLeads = allLeads.filter((lead) => {
      const lastInteraction = lead.lastInteractionAt ?? lead.updatedAt;
      return lastInteraction < sevenDaysAgo && lead.funnelStage !== "reuniao_agendada" && lead.funnelStage !== "nao_qualificado";
    });
    const prioritizedLeads = allLeads.slice(0, 5).map((lead) => ({
      id: lead.id,
      name: lead.name ?? lead.responsibleName ?? lead.pushName ?? "Lead sem nome",
      city: lead.city ?? "Cidade nao informada",
      score: lead.score,
      className: lead.classification ?? "C",
      status: formatFunnelStage(lead.funnelStage),
      pain: lead.mainPain ?? formatPainPoints(lead.painPoints) ?? lead.qualificationSummary ?? "Sem diagnostico registrado",
    }));

    return NextResponse.json({
      ok: true,
      overview: {
        leadsToday: todayLeadForms.length,
        qualified: qualifiedCount,
        nextAgenda: nextMeetings[0]?.startsAt ? formatHour(nextMeetings[0].startsAt) : "Sem agenda",
      },
      scoreCard: prioritizedLeads[0] ?? null,
      executiveMetrics: [
        { label: "Leads totais", value: String(realLeadCount) },
        { label: "Qualificados", value: String(qualifiedCount) },
        { label: "Reunioes hoje", value: String(todayMeetings.length) },
        { label: "Reunioes agendadas", value: String(scheduledCount) },
        { label: "Follow-ups pendentes", value: String(staleLeads.length) },
        { label: "Conversas 7 dias", value: String(recentLeadIds.size) },
        { label: "Sem contato +7 dias", value: String(staleLeads.length) },
        { label: "Taxa de agendamento", value: `${conversionRate}%` },
      ],
      prioritizedLeads,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard.";
    console.error("[Dashboard summary] Failed to load dashboard", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function startOfSaoPauloDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return new Date(`${year}-${month}-${day}T00:00:00-03:00`);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatHour(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatPainPoints(painPoints: string[] | null) {
  if (!painPoints?.length) return null;
  return painPoints.map((pain) => pain.replaceAll("_", " ")).join(", ");
}

function formatFunnelStage(stage: string) {
  const labels: Record<string, string> = {
    novo_lead: "Novo lead",
    ia_atendendo: "IA atendendo",
    qualificado: "Qualificado",
    agendamento_em_andamento: "Agendamento",
    reuniao_agendada: "Reuniao agendada",
    nao_qualificado: "Nao qualificado",
  };
  return labels[stage] ?? stage;
}
