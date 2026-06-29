import { z } from "zod";

const messageSchema = z.object({
  conversation: z.string().optional(),
  extendedTextMessage: z
    .object({
      text: z.string().optional(),
    })
    .optional(),
  base64: z.string().optional(),
});

export const evolutionWebhookSchema = z.object({
  body: z.object({
    instance: z.string().min(1),
    data: z.object({
      key: z.object({
        remoteJid: z.string().min(5),
        id: z.string().optional(),
        fromMe: z.boolean().default(false),
      }),
      pushName: z.string().optional(),
      messageType: z.string().min(1),
      message: messageSchema.default({}),
    }),
  }),
});

export type EvolutionWebhookPayload = z.infer<typeof evolutionWebhookSchema>;

export function normalizeEvolutionText(payload: EvolutionWebhookPayload): string {
  const message = payload.body.data.message;
  return message.conversation ?? message.extendedTextMessage?.text ?? "";
}

export function normalizePhone(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net$/i, "").replace(/\D/g, "");
}
