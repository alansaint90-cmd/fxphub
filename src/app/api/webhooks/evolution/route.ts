import { NextResponse } from "next/server";
import { DrizzleCrmRepository } from "@/lib/crm/drizzle-crm-repository";
import { FaustoConversationService } from "@/lib/crm/fausto-conversation-service";
import { createCalendarGateway } from "@/lib/integrations/calendar";
import { EvolutionWhatsAppGateway } from "@/lib/integrations/evolution";
import { OpenAiMessagePlanner } from "@/lib/integrations/openai";
import { ConversationBuffer } from "@/lib/integrations/redis";
import { env } from "@/lib/env";
import {
  evolutionWebhookSchema,
  normalizeEvolutionText,
  normalizePhone,
} from "@/lib/validators/evolution";
import { ZodError } from "zod";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/webhooks/evolution",
    evolutionConfigured: Boolean(env.EVOLUTION_API_BASE_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE_NAME),
    redisConfigured: Boolean(env.REDIS_URL),
    openAiConfigured: Boolean(env.OPENAI_API_KEY),
    calendarConfigured: Boolean(env.GOOGLE_CALENDAR_ID && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY),
  });
}

export async function POST(request: Request) {
  try {
    if (env.EVOLUTION_WEBHOOK_SECRET) {
      const receivedSecret = request.headers.get("x-fausto-webhook-secret");
      if (receivedSecret !== env.EVOLUTION_WEBHOOK_SECRET) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    const json = await request.json();
    const payload = evolutionWebhookSchema.parse({ body: json });

    if (payload.body.data.key.fromMe) {
      return NextResponse.json({ ok: true, ignored: "from_me" });
    }

    const text = normalizeEvolutionText(payload);
    if (!text.trim()) {
      return NextResponse.json({ ok: true, ignored: "empty_text" });
    }

    const buffer = new ConversationBuffer();
    const buffered = await buffer.appendAndCollect(
      payload.body.data.key.remoteJid,
      text,
      payload.body.data.key.id,
    );

    if (!buffered.shouldProcess) {
      return NextResponse.json({ ok: true, ignored: "buffer_waiting_for_latest_message" });
    }

    const crm = new DrizzleCrmRepository();
    const ai = new OpenAiMessagePlanner();
    const calendar = createCalendarGateway();
    const service = new FaustoConversationService(crm, ai, calendar);

    const result = await service.handleInbound({
      whatsappJid: payload.body.data.key.remoteJid,
      phone: normalizePhone(payload.body.data.key.remoteJid),
      pushName: payload.body.data.pushName,
      text: buffered.text,
      messageType: payload.body.data.messageType,
      providerMessageId: payload.body.data.key.id,
    });

    if (result.shouldSend) {
      const whatsapp = new EvolutionWhatsAppGateway();
      await whatsapp.sendText({
        phoneJid: payload.body.data.key.remoteJid,
        text: result.response,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_evolution_payload", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido no webhook Evolution.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
