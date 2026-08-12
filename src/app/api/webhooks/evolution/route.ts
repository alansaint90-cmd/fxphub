import { NextResponse } from "next/server";
import { DrizzleCrmRepository } from "@/lib/crm/drizzle-crm-repository";
import { FaustoConversationService } from "@/lib/crm/fausto-conversation-service";
import { createCalendarGateway } from "@/lib/integrations/calendar";
import { EvolutionWhatsAppGateway } from "@/lib/integrations/evolution";
import { OpenAiMessagePlanner } from "@/lib/integrations/openai";
import { ConversationBuffer } from "@/lib/integrations/redis";
import { getRuntimeIntegrationSettings } from "@/lib/integrations/settings";
import {
  normalizeEvolutionWebhookPayload,
  normalizeEvolutionText,
  normalizePhone,
} from "@/lib/validators/evolution";

export const runtime = "nodejs";

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
    const payload = normalizeEvolutionWebhookPayload(json);

    if (!payload) {
      return NextResponse.json({
        ok: true,
        ignored: "unsupported_evolution_event",
        event: typeof json?.event === "string" ? json.event : undefined,
      });
    }

    stage = "ignore_from_me";
    if (payload.body.data.key.fromMe) {
      return NextResponse.json({ ok: true, ignored: "from_me" });
    }

    stage = "extract_text";
    const text = normalizeEvolutionText(payload);
    const messageType = payload.body.data.messageType;
    const ai = new OpenAiMessagePlanner();
    const transcribedAudio =
      !text.trim() && isAudioMessageType(messageType)
        ? await transcribeIncomingAudio(json, ai, settings)
        : "";
    const messageBody = text.trim() || transcribedAudio || (isMediaMessageType(messageType) ? `[${messageType} recebido]` : "");
    if (!messageBody.trim()) {
      return NextResponse.json({ ok: true, ignored: "empty_text" });
    }

    stage = "buffer";
    const buffer = new ConversationBuffer();
    const buffered = await buffer.appendAndCollect(
      payload.body.data.key.remoteJid,
      messageBody,
      payload.body.data.key.id,
    );

    if (!buffered.shouldProcess) {
      return NextResponse.json({ ok: true, ignored: "buffer_waiting_for_latest_message" });
    }

    stage = "crm_and_ai";
    const crm = new DrizzleCrmRepository();
    const calendar = createCalendarGateway();
    const service = new FaustoConversationService(crm, ai, calendar);

    const result = await service.handleInbound({
      whatsappJid: payload.body.data.key.remoteJid,
      phone: normalizePhone(payload.body.data.key.remoteJid),
      pushName: payload.body.data.pushName,
      text: buffered.text,
      messageType,
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

function isMediaMessageType(messageType: string) {
  return /image|video|document|audio|sticker|media/i.test(messageType);
}

function isAudioMessageType(messageType: string) {
  return /audio|ptt/i.test(messageType);
}

type RuntimeSettings = Awaited<ReturnType<typeof getRuntimeIntegrationSettings>>;

async function transcribeIncomingAudio(
  rawPayload: unknown,
  ai: OpenAiMessagePlanner,
  settings: RuntimeSettings,
) {
  const audio = await extractIncomingAudio(rawPayload, settings);
  if (!audio) return "";

  const transcript = await ai.transcribeAudio(audio);
  return transcript ?? "";
}

async function extractIncomingAudio(rawPayload: unknown, settings: RuntimeSettings) {
  const mimeType = findFirstString(rawPayload, [
    ["body", "data", "message", "audioMessage", "mimetype"],
    ["body", "data", "message", "audioMessage", "mimeType"],
    ["body", "data", "message", "mimetype"],
    ["body", "data", "message", "mimeType"],
    ["data", "message", "audioMessage", "mimetype"],
    ["data", "message", "audioMessage", "mimeType"],
    ["data", "message", "mimetype"],
    ["data", "message", "mimeType"],
  ]) ?? "audio/ogg";

  const base64 = findFirstString(rawPayload, [
    ["body", "data", "message", "base64"],
    ["body", "data", "message", "audioMessage", "base64"],
    ["data", "message", "base64"],
    ["data", "message", "audioMessage", "base64"],
    ["message", "base64"],
    ["message", "audioMessage", "base64"],
  ]);

  if (base64) {
    const data = decodeBase64Audio(base64);
    if (data) {
      return {
        data,
        filename: audioFilename(mimeType),
        mimeType,
      };
    }
  }

  const mediaUrl = findFirstString(rawPayload, [
    ["body", "data", "message", "audioMessage", "url"],
    ["body", "data", "message", "mediaUrl"],
    ["body", "data", "message", "url"],
    ["body", "data", "mediaUrl"],
    ["data", "message", "audioMessage", "url"],
    ["data", "message", "mediaUrl"],
    ["data", "message", "url"],
    ["data", "mediaUrl"],
  ]);

  if (!mediaUrl) return null;

  try {
    const response = await fetch(mediaUrl, {
      headers: settings.EVOLUTION_API_KEY ? { apikey: settings.EVOLUTION_API_KEY } : undefined,
    });
    if (!response.ok) return null;

    const responseMimeType = response.headers.get("content-type") ?? mimeType;
    const data = new Uint8Array(await response.arrayBuffer());
    if (!data.length) return null;

    return {
      data,
      filename: audioFilename(responseMimeType),
      mimeType: responseMimeType,
    };
  } catch {
    return null;
  }
}

function decodeBase64Audio(input: string) {
  try {
    const cleanInput = input.includes(",") ? input.split(",").pop() ?? "" : input;
    const buffer = Buffer.from(cleanInput, "base64");
    return buffer.length ? new Uint8Array(buffer) : null;
  } catch {
    return null;
  }
}

function audioFilename(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.includes("mpeg") || mime.includes("mp3")) return "audio.mp3";
  if (mime.includes("mp4") || mime.includes("m4a")) return "audio.m4a";
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("webm")) return "audio.webm";
  return "audio.ogg";
}

function findFirstString(input: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = getStringPath(input, path);
    if (value) return value;
  }
  return null;
}

function getStringPath(input: unknown, path: string[]) {
  let current: unknown = input;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" && current.trim() ? current.trim() : null;
}
