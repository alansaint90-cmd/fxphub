import { describe, expect, it } from "vitest";
import { evolutionWebhookSchema, normalizeEvolutionText, normalizePhone } from "../src/lib/validators/evolution";

describe("evolution webhook validator", () => {
  it("accepts conversation text payloads", () => {
    const payload = evolutionWebhookSchema.parse({
      body: {
        event: "messages.upsert",
        instance: "fxphub",
        data: {
          key: {
            remoteJid: "5571999999999@s.whatsapp.net",
            id: "message-id",
            fromMe: false,
          },
          pushName: "Lead Teste",
          messageType: "conversation",
          message: {
            conversation: "Ola, tenho interesse",
          },
        },
      },
    });

    expect(normalizeEvolutionText(payload)).toBe("Ola, tenho interesse");
    expect(normalizePhone(payload.body.data.key.remoteJid)).toBe("5571999999999");
  });

  it("accepts extended text and string fromMe payloads", () => {
    const payload = evolutionWebhookSchema.parse({
      body: {
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "5571888888888@s.whatsapp.net",
            fromMe: "false",
          },
          message: {
            extendedTextMessage: {
              text: "Quero saber mais",
            },
          },
        },
      },
    });

    expect(payload.body.data.key.fromMe).toBe(false);
    expect(payload.body.data.messageType).toBe("text");
    expect(normalizeEvolutionText(payload)).toBe("Quero saber mais");
  });

  it("rejects events that do not contain a whatsapp message key", () => {
    const payload = evolutionWebhookSchema.safeParse({
      body: {
        event: "connection.update",
        instance: "fxphub",
        data: {
          state: "open",
        },
      },
    });

    expect(payload.success).toBe(false);
  });
});
