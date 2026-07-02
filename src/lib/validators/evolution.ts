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
          message: messageSchema.default({}),
          text: z.string().optional(),
          body: z.string().optional(),
        })
        .passthrough(),
    })
    .passthrough(),
});

export type EvolutionWebhookPayload = z.infer<typeof evolutionWebhookSchema>;

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
