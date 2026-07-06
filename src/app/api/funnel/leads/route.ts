import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { FunnelStage } from "@/lib/qualification/types";

const kanbanStageSchema = z.enum(["novo", "ia", "qualificado", "agendamento", "nao_qualificado"]);

const updateLeadStageSchema = z.object({
  leadId: z.string().uuid(),
  stage: kanbanStageSchema,
});

const funnelToKanbanStage: Record<FunnelStage, z.infer<typeof kanbanStageSchema>> = {
  novo_lead: "novo",
  ia_atendendo: "ia",
  qualificado: "qualificado",
  agendamento_em_andamento: "agendamento",
  reuniao_agendada: "agendamento",
  nao_qualificado: "nao_qualificado",
};

const kanbanToFunnelStage: Record<z.infer<typeof kanbanStageSchema>, FunnelStage> = {
  novo: "novo_lead",
  ia: "ia_atendendo",
  qualificado: "qualificado",
  agendamento: "agendamento_em_andamento",
  nao_qualificado: "nao_qualificado",
};

export async function GET() {
  try {
    const funnelLeads = await db
      .select({
        id: leads.id,
        phone: leads.phone,
        pushName: leads.pushName,
        responsibleName: leads.responsibleName,
        drivingSchoolName: leads.drivingSchoolName,
        city: leads.city,
        score: leads.score,
        classification: leads.classification,
        painPoints: leads.painPoints,
        mainPain: leads.mainPain,
        qualificationSummary: leads.qualificationSummary,
        funnelStage: leads.funnelStage,
        aiPaused: leads.aiPaused,
        updatedAt: leads.updatedAt,
        lastInteractionAt: leads.lastInteractionAt,
      })
      .from(leads)
      .where(eq(leads.isDeleted, false))
      .orderBy(desc(leads.lastInteractionAt), desc(leads.updatedAt))
      .limit(80);

    return NextResponse.json({
      ok: true,
      leads: funnelLeads.map((lead) => ({
        id: lead.id,
        name: lead.drivingSchoolName ?? lead.responsibleName ?? lead.pushName ?? lead.phone,
        city: lead.city ?? "Cidade nao informada",
        score: lead.score,
        className: lead.classification ?? "C",
        pain: lead.mainPain ?? formatPainPoints(lead.painPoints) ?? lead.qualificationSummary ?? "Qualificacao em andamento",
        owner: lead.aiPaused ? "Humano" : "Fausto IA",
        stage: funnelToKanbanStage[lead.funnelStage],
        updatedAt: lead.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar funil.";
    console.error("[Funnel leads] Failed to load leads", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = updateLeadStageSchema.parse(await request.json());
    const [lead] = await db
      .update(leads)
      .set({
        funnelStage: kanbanToFunnelStage[input.stage],
        updatedAt: new Date(),
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .where(and(eq(leads.id, input.leadId), eq(leads.isDeleted, false)))
      .returning({
        id: leads.id,
        funnelStage: leads.funnelStage,
      });

    if (!lead) {
      return NextResponse.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      lead: {
        id: lead.id,
        stage: funnelToKanbanStage[lead.funnelStage],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_funnel_stage", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao atualizar funil.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function formatPainPoints(painPoints: string[] | null) {
  if (!painPoints?.length) return null;
  return painPoints.map((pain) => pain.replaceAll("_", " ")).join(", ");
}
