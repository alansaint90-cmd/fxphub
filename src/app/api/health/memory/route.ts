import { NextResponse } from "next/server";
import { ConversationBuffer } from "@/lib/integrations/redis";

export async function GET() {
  try {
    const memory = new ConversationBuffer();
    const status = await memory.ping();

    return NextResponse.json({
      ok: true,
      memory: status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        memory: "error",
        error: error instanceof Error ? error.message : "Erro desconhecido ao validar Redis.",
      },
      { status: 500 },
    );
  }
}
