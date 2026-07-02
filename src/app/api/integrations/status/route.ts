import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    evolutionConfigured: Boolean(env.EVOLUTION_API_BASE_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE_NAME),
    openAiConfigured: Boolean(env.OPENAI_API_KEY),
    redisConfigured: Boolean(env.REDIS_URL),
    calendarConfigured: Boolean(env.GOOGLE_CALENDAR_ID && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY),
    webhookUrl: "/api/webhooks/evolution",
  });
}
