import { NextResponse } from "next/server";
import { DrizzleCrmRepository } from "@/lib/crm/drizzle-crm-repository";
import { FaustoConversationService } from "@/lib/crm/fausto-conversation-service";
import { createCalendarGateway } from "@/lib/integrations/calendar";
import { EvolutionWhatsAppGateway } from "@/lib/integrations/evolution";
import { OpenAiMessagePlanner } from "@/lib/integrations/openai";
import {
  evolutionWebhookSchema,
  normalizeEvolutionText,
  normalizePhone,
} from "@/lib/validators/evolution";

export async function POST(request: Request) {
  const json = await request.json();
  const payload = evolutionWebhookSchema.parse({ body: json });

  if (payload.body.data.key.fromMe) {
    return NextResponse.json({ ok: true, ignored: "from_me" });
  }

  const text = normalizeEvolutionText(payload);
  if (!text.trim()) {
    return NextResponse.json({ ok: true, ignored: "empty_text" });
  }

  const crm = new DrizzleCrmRepository();
  const ai = new OpenAiMessagePlanner();
  const calendar = createCalendarGateway();
  const service = new FaustoConversationService(crm, ai, calendar);

  const result = await service.handleInbound({
    whatsappJid: payload.body.data.key.remoteJid,
    phone: normalizePhone(payload.body.data.key.remoteJid),
    pushName: payload.body.data.pushName,
    text,
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
}
