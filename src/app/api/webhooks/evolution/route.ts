import { NextResponse } from "next/server";
import { DrizzleCrmRepository } from "@/lib/crm/drizzle-crm-repository";
import { FaustoConversationService } from "@/lib/crm/fausto-conversation-service";
import { createCalendarGateway } from "@/lib/integrations/calendar";
import { EvolutionWhatsAppGateway } from "@/lib/integrations/evolution";
import { OpenAiMessagePlanner } from "@/lib/integrations/openai";
import { ConversationBuffer } from "@/lib/integrations/redis";
import { getRuntimeIntegrationSettings } from "@/lib/integrations/settings";
import {
  evolutionWebhookSchema,
  normalizeEvolutionText,
  normalizePhone,
} from "@/lib/validators/evolution";

export async function GET() {
  const settings = await getRuntimeIntegrationSettings();

  return NextResponse.json({
    ok: true,
    route: "/api/webhooks/evolution",
    databaseConfigured: Boolean(settings.DATABASE_URL),
    evolutionConfigured: Boolean(
      settings.EVOLUTION_API_BASE_URL && settings.EVOLUTION_API_KEY && settings.EVOLUTION_INSTANCE_NAME,
    ),
    redisConfigured: Boolean(settings.REDIS_URL),
    openAiConfigured: Boolean(settings.OPENAI_API_KEY),
    calendarConfigured: true,
    calendarMode: "internal",
  });
}

export async function POST(request: Request) {
  let stage = "start";

  try {
    stage = "auth";
    const settings = await getRuntimeIntegrationSettings();
    const webhookSecret = settings.EVOLUTION_WEBHOOK_SECRET;

    if (webhookSecret) {
      const receivedSecret = request.headers.get("x-fausto-webhook-secret");
      if (receivedSecret !== webhookSecret) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    stage = "parse_json";
    const json = await request.json();
    stage = "validate_payload";
    const parsedPayload = evolutionWebhookSchema.safeParse({ body: json });

    if (!parsedPayload.success) {
      return NextResponse.json({
        ok: true,
        ignored: "unsupported_evolution_event",
        event: typeof json?.event === "string" ? json.event : undefined,
      });
    }

    const payload = parsedPayload.data;

    stage = "ignore_from_me";
    if (payload.body.data.key.fromMe) {
      return NextResponse.json({ ok: true, ignored: "from_me" });
    }

    stage = "extract_text";
    const text = normalizeEvolutionText(payload);
    if (!text.trim()) {
      return NextResponse.json({ ok: true, ignored: "empty_text" });
    }

    stage = "buffer";
    const buffer = new ConversationBuffer();
    const buffered = await buffer.appendAndCollect(
      payload.body.data.key.remoteJid,
      text,
      payload.body.data.key.id,
    );

    if (!buffered.shouldProcess) {
      return NextResponse.json({ ok: true, ignored: "buffer_waiting_for_latest_message" });
    }

    stage = "crm_and_ai";
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
      stage = "send_whatsapp";
      const whatsapp = new EvolutionWhatsAppGateway();
      const messages = result.messages ?? [{ text: result.response }];
      for (const message of messages) {
        if (message.delayMs) await sleep(message.delayMs);
        await whatsapp.sendText({
          phoneJid: payload.body.data.key.remoteJid,
          text: message.text,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido no webhook Evolution.";
    console.error("[Evolution webhook]", { stage, message, error });
    return NextResponse.json({ ok: false, stage, error: message }, { status: 500 });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
