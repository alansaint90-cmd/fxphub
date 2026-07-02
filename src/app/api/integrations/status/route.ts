import { NextResponse } from "next/server";
import { getRuntimeIntegrationSettings } from "@/lib/integrations/settings";

export async function GET() {
  const settings = await getRuntimeIntegrationSettings();

  return NextResponse.json({
    ok: true,
    databaseConfigured: Boolean(settings.DATABASE_URL),
    supabaseConfigured: Boolean(settings.SUPABASE_URL && settings.SUPABASE_SERVICE_ROLE_KEY),
    evolutionConfigured: Boolean(
      settings.EVOLUTION_API_BASE_URL && settings.EVOLUTION_API_KEY && settings.EVOLUTION_INSTANCE_NAME,
    ),
    openAiConfigured: Boolean(settings.OPENAI_API_KEY),
    redisConfigured: Boolean(settings.REDIS_URL),
    calendarConfigured: Boolean(
      settings.GOOGLE_CALENDAR_ID && settings.GOOGLE_SERVICE_ACCOUNT_EMAIL && settings.GOOGLE_PRIVATE_KEY,
    ),
    webhookUrl: "/api/webhooks/evolution",
  });
}
