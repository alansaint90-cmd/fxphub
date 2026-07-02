import { NextResponse } from "next/server";
import { z } from "zod";
import { EvolutionWhatsAppGateway } from "@/lib/integrations/evolution";

const testMessageSchema = z.object({
  phone: z.string().min(10),
  message: z.string().min(1).max(1000),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = testMessageSchema.parse(json);
    const whatsapp = new EvolutionWhatsAppGateway();

    await whatsapp.sendText({
      phoneJid: input.phone,
      text: input.message,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "invalid_test_message", issues: error.issues }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro ao enviar mensagem de teste.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
