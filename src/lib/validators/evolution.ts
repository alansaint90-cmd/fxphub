import { z } from "zod";

const optionalTextObject = z
  .object({
    text: z.string().optional(),
    caption: z.string().optional(),
    selectedDisplayText: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();

const fromMeSchema = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .optional()
  .transform((value) => value === true || value === "true");

const messageSchema = z
  .object({
    conversation: z.string().optional(),
    body: z.string().optional(),
    text: z.string().optional(),
    extendedTextMessage: optionalTextObject.optional(),
    imageMessage: optionalTextObject.optional(),
    videoMessage: optionalTextObject.optional(),
    documentMessage: optionalTextObject.optional(),
    buttonsResponseMessage: optionalTextObject.optional(),
    listResponseMessage: optionalTextObject.optional(),
    templateButtonReplyMessage: optionalTextObject.optional(),
    base64: z.string().optional(),
  })
  .passthrough();

const flexibleMessageSchema = z
  .union([messageSchema, z.string()])
  .transform((value) => (typeof value === "string" ? { conversation: value } : value));

export const evolutionWebhookSchema = z.object({
  body: z
    .object({
      event: z.string().optional(),
      instance: z.string().min(1).optional(),
      data: z
        .object({
          key: z
            .object({
              remoteJid: z.string().min(5),
              id: z.string().optional(),
              fromMe: fromMeSchema.default(false),
            })
            .passthrough(),
          pushName: z.string().optional(),
          messageType: z.string().min(1).default("text"),
          message: flexibleMessageSchema.default({}),
          text: z.string().optional(),
          body: z.string().optional(),
        })
        .passthrough(),
    })
    .passthrough(),
});

export type EvolutionWebhookPayload = z.infer<typeof evolutionWebhookSchema>;

const rawEvolutionWebhookSchema = z
  .object({
    event: z.string().optional(),
    instance: z.string().optional(),
    data: z.unknown().optional(),
  })
  .passthrough();

export function normalizeEvolutionWebhookPayload(rawBody: unknown): EvolutionWebhookPayload | null {
  const directPayload = evolutionWebhookSchema.safeParse({ body: rawBody });
  if (directPayload.success) return directPayload.data;

  const raw = rawEvolutionWebhookSchema.safeParse(rawBody);
  if (!raw.success) return null;

  const rawData = getFirstPayloadData(raw.data.data);
  if (!isRecord(rawData)) return null;

  const nestedMessage = isRecord(rawData.message) ? rawData.message : undefined;
  const key = getRecord(rawData.key) ?? getRecord(nestedMessage?.key);
  const remoteJid = getString(key?.remoteJid) ?? getString(rawData.remoteJid) ?? getString(rawData.sender) ?? getString(rawData.from);
  if (!remoteJid) return null;

  const normalizedPayload = evolutionWebhookSchema.safeParse({
    body: {
      event: raw.data.event,
      instance: raw.data.instance ?? getString(rawData.instance),
      data: {
        ...rawData,
        key: {
          ...(key ?? {}),
          remoteJid,
          id: getString(key?.id) ?? getString(rawData.id) ?? getString(rawData.messageId),
          fromMe: key?.fromMe ?? rawData.fromMe ?? false,
        },
        pushName: getString(rawData.pushName) ?? getString(rawData.notifyName) ?? getString(rawData.senderName),
        messageType: getString(rawData.messageType) ?? getString(rawData.type) ?? "text",
        message: nestedMessage ?? rawData.message ?? {},
        text: getString(rawData.text) ?? getString(rawData.body),
        body: getString(rawData.body),
      },
    },
  });

  return normalizedPayload.success ? normalizedPayload.data : null;
}

export function normalizeEvolutionText(payload: EvolutionWebhookPayload): string {
  const data = payload.body.data;
  const message = data.message;

  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    message.buttonsResponseMessage?.selectedDisplayText ??
    message.listResponseMessage?.title ??
    message.templateButtonReplyMessage?.selectedDisplayText ??
    message.body ??
    message.text ??
    data.text ??
    data.body ??
    ""
  );
}

export function normalizePhone(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net$/i, "").replace(/\D/g, "");
}

function getFirstPayloadData(data: unknown) {
  if (Array.isArray(data)) return data[0];
  if (isRecord(data) && Array.isArray(data.messages)) return data.messages[0];
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
