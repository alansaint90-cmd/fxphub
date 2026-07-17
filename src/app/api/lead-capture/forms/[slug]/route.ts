import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leadFormEvents, leadForms, leadFormSettings } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { onlyDigits, scoreLeadCapture } from "@/lib/lead-capture/scoring";

const paramsSchema = z.object({ slug: z.string().trim().min(2) });
const submitSchema = z.object({
  name: z.string().trim().min(2),
  businessName: z.string().trim().min(2),
  phone: z.string().trim().min(10),
  email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  state: z.string().trim().optional().or(z.literal("")),
  role: z.string().trim().min(2),
  paidTraffic: z.string().trim().min(2),
  paidTrafficReason: z.string().trim().optional().or(z.literal("")),
  currentDailyLeads: z.string().trim().min(2),
  desiredDailyLeads: z.string().trim().min(2),
  attendanceStructure: z.string().trim().min(2),
  monthlyEnrollments: z.coerce.number().int().min(0).optional().default(0),
  salesAttendants: z.coerce.number().int().min(0).optional().default(0),
  usesCrm: z.string().trim().optional().or(z.literal("")),
  runsPaidAds: z.string().trim().optional().or(z.literal("")),
  monthlyAdSpend: z.coerce.number().int().min(0).optional(),
  mainChallenge: z.string().trim().min(2),
  responseTime: z.string().trim().min(2),
  wantsWhatsappAutomation: z.string().trim().optional().or(z.literal("")),
  strategyOpenness: z.string().trim().min(2),
  meetingInterest: z.string().trim().min(2),
  preferredMeetingPeriod: z.string().trim().optional(),
  contactAuthorized: z.boolean(),
  privacyPolicyAccepted: z.boolean(),
  tracking: z.record(z.string(), z.string().optional()).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = paramsSchema.parse(await context.params);
  const settings = await getSettings(slug);
  await db.insert(leadFormEvents).values({
    eventName: "PageView",
    eventId: crypto.randomUUID(),
    eventSource: "public_form",
    eventData: { slug, url: request.url },
  });
  return NextResponse.json({ ok: true, settings: publicSettings(settings) });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = paramsSchema.parse(await context.params);
    const settings = await getSettings(slug);
    if (!settings.isActive) return NextResponse.json({ ok: false, error: "form_inactive" }, { status: 403 });

    const input = submitSchema.parse(await request.json());
    if (!input.privacyPolicyAccepted || !input.contactAuthorized) {
      return NextResponse.json({ ok: false, error: "consent_required" }, { status: 400 });
    }

    const score = scoreLeadCapture(
      {
        name: input.name,
        businessName: input.businessName,
        phone: input.phone,
        role: input.role,
        paidTraffic: input.paidTraffic,
        paidTrafficReason: input.paidTrafficReason,
        currentDailyLeads: input.currentDailyLeads,
        desiredDailyLeads: input.desiredDailyLeads,
        attendanceStructure: input.attendanceStructure,
        mainChallenge: input.mainChallenge,
        responseTime: input.responseTime,
        strategyOpenness: input.strategyOpenness,
        meetingInterest: input.meetingInterest,
      },
      settings.qualifiedMinScore,
    );

    const headers = request.headers;
    const [lead] = await db
      .insert(leadForms)
      .values({
        name: input.name,
        businessName: input.businessName,
        phone: onlyDigits(input.phone),
        email: input.email || undefined,
        city: input.city || null,
        state: input.state || null,
        role: input.role,
        paidTrafficReason: input.paidTrafficReason || null,
        currentDailyLeads: input.currentDailyLeads,
        desiredDailyLeads: input.desiredDailyLeads,
        attendanceStructure: input.attendanceStructure,
        strategyOpenness: input.strategyOpenness,
        diagnosticStatus: score.diagnosticStatus,
        diagnosticSummary: score.summary,
        diagnosticAnswers: {
          nome: input.name,
          empresa: input.businessName,
          cargo: input.role,
          trafegoPago: input.paidTraffic,
          motivoMudanca: input.paidTrafficReason,
          leadsAtuais: input.currentDailyLeads,
          leadsDesejados: input.desiredDailyLeads,
          estruturaAtendimento: input.attendanceStructure,
          tempoResposta: input.responseTime,
          principalDesafio: input.mainChallenge,
          aberturaNovaEstrategia: input.strategyOpenness,
          interesseReuniao: input.meetingInterest,
          leadScore: score.score,
          leadStatus: score.diagnosticStatus,
        },
        monthlyEnrollments: input.monthlyEnrollments,
        salesAttendants: input.salesAttendants,
        usesCrm: input.usesCrm || null,
        runsPaidAds: input.paidTraffic,
        monthlyAdSpend: input.monthlyAdSpend,
        mainChallenge: input.mainChallenge,
        responseTime: input.responseTime,
        wantsWhatsappAutomation: input.wantsWhatsappAutomation || "Nao informado",
        meetingInterest: input.meetingInterest,
        preferredMeetingPeriod: input.preferredMeetingPeriod,
        contactAuthorized: input.contactAuthorized,
        privacyPolicyAccepted: input.privacyPolicyAccepted,
        qualificationScore: score.score,
        qualificationStatus: score.status,
        disqualificationReason: score.status === "unqualified" ? score.reason : null,
        leadStatus: score.diagnosticStatus,
        source: input.tracking?.utm_source || "formulario_publico",
        utmSource: input.tracking?.utm_source,
        utmMedium: input.tracking?.utm_medium,
        utmCampaign: input.tracking?.utm_campaign,
        utmContent: input.tracking?.utm_content,
        utmTerm: input.tracking?.utm_term,
        campaignId: input.tracking?.campaign_id,
        adsetId: input.tracking?.adset_id,
        adId: input.tracking?.ad_id,
        fbclid: input.tracking?.fbclid,
        fbc: input.tracking?.fbc,
        fbp: input.tracking?.fbp,
        ipAddress: headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: headers.get("user-agent"),
        landingPageUrl: input.tracking?.landing_page_url,
        tags: score.tags,
        notes: score.summary,
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .returning();

    const eventId = crypto.randomUUID();
    await db.insert(leadFormEvents).values([
      {
        leadId: lead.id,
        eventName: "Lead",
        eventId,
        eventSource: "public_form",
        eventData: { score: score.score, status: score.status, diagnosticStatus: score.diagnosticStatus, slug },
      },
      {
        leadId: lead.id,
        eventName: score.status === "qualified" ? "QualifiedLead" : "UnqualifiedLead",
        eventId: crypto.randomUUID(),
        eventSource: "qualification",
        eventData: { reason: score.reason, summary: score.summary },
      },
    ]);

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      qualificationStatus: score.status,
      score: score.score,
      diagnosticStatus: score.diagnosticStatus,
      diagnosticSummary: score.summary,
      reason: score.reason,
      whatsappUrl: score.status === "qualified" ? buildWhatsappUrl(settings.whatsappNumber, input) : null,
      settings: publicSettings(settings),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_form", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Erro ao enviar formulario.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function getSettings(slug: string) {
  const [settings] = await db.select().from(leadFormSettings).where(eq(leadFormSettings.slug, slug));
  if (settings) return settings;
  const [created] = await db
    .insert(leadFormSettings)
    .values({
      slug,
      formName: "Diagnostico Autoescola",
      whatsappNumber: process.env.WHATSAPP_DEFAULT_NUMBER,
      privacyPolicyUrl: process.env.PRIVACY_POLICY_URL,
      modifiedBy: env.SYSTEM_USER_ID,
    })
    .returning();
  return created;
}

function publicSettings(settings: typeof leadFormSettings.$inferSelect) {
  return {
    formName: settings.formName,
    slug: settings.slug,
    title: settings.title,
    description: settings.description,
    isActive: settings.isActive,
    qualifiedMinScore: settings.qualifiedMinScore,
    instagramUrl: settings.instagramUrl,
    privacyPolicyUrl: settings.privacyPolicyUrl,
    metaPixelId: settings.metaPixelId,
    whatsappConfigured: Boolean(settings.whatsappNumber),
  };
}

function buildWhatsappUrl(phone: string | null, input: z.infer<typeof submitSchema>) {
  const target = onlyDigits(phone || process.env.WHATSAPP_DEFAULT_NUMBER || "");
  if (!target) return null;
  const text = `Ola, Fausto! Acabei de concluir o diagnostico da FXP. Meu nome e ${input.name} e sou da ${input.businessName}. Gostaria de continuar minha analise e entender qual estrategia pode ser aplicada na minha autoescola.`;
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}
