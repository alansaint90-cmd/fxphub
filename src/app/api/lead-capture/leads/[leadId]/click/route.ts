import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { leadFormEvents, leadForms } from "@/lib/db/schema";
import { env } from "@/lib/env";

const paramsSchema = z.object({ leadId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = paramsSchema.parse(await context.params);
    await db
      .update(leadForms)
      .set({
        whatsappClicked: true,
        whatsappClickedAt: new Date(),
        faustoContactStarted: true,
        leadStatus: "Encaminhado ao WhatsApp",
        updatedAt: new Date(),
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .where(eq(leadForms.id, leadId));

    await db.insert(leadFormEvents).values({
      leadId,
      eventName: "Contact",
      eventId: crypto.randomUUID(),
      eventSource: "whatsapp_button",
      eventData: { userAgent: request.headers.get("user-agent") },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: "invalid_lead" }, { status: 400 });
    const message = error instanceof Error ? error.message : "Erro ao registrar clique.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
