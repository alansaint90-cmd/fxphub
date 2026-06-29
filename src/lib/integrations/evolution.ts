import { env } from "@/lib/env";

export interface WhatsAppGateway {
  sendText(input: { phoneJid: string; text: string }): Promise<void>;
}

export class EvolutionWhatsAppGateway implements WhatsAppGateway {
  async sendText(input: { phoneJid: string; text: string }): Promise<void> {
    if (!env.EVOLUTION_API_BASE_URL || !env.EVOLUTION_API_KEY || !env.EVOLUTION_INSTANCE_NAME) {
      throw new Error("Evolution API nao configurada.");
    }

    const response = await fetch(
      `${env.EVOLUTION_API_BASE_URL}/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: input.phoneJid,
          text: input.text,
          options: {
            delay: 1800,
            linkPreview: false,
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Falha ao enviar WhatsApp: ${response.status} ${body}`);
    }
  }
}
