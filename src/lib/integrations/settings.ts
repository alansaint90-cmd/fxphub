import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrationSettings } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const integrationSettingKeys = [
  "SYSTEM_USER_ID",
  "MINIMUM_SCORE_TO_SCHEDULE",
  "NODE_ENV",
  "NEXT_TELEMETRY_DISABLED",
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EVOLUTION_API_BASE_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE_NAME",
  "EVOLUTION_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "REDIS_URL",
  "MESSAGE_BUFFER_QUIET_MS",
  "MESSAGE_BUFFER_TTL_SECONDS",
  "GOOGLE_CALENDAR_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_TIME_ZONE",
] as const;

export type IntegrationSettingKey = (typeof integrationSettingKeys)[number];

const secretKeys = new Set<IntegrationSettingKey>([
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EVOLUTION_API_KEY",
  "EVOLUTION_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "REDIS_URL",
  "GOOGLE_PRIVATE_KEY",
]);

const runtimeEnvValues: Partial<Record<IntegrationSettingKey, string | undefined>> = {
  SYSTEM_USER_ID: env.SYSTEM_USER_ID,
  MINIMUM_SCORE_TO_SCHEDULE: process.env.MINIMUM_SCORE_TO_SCHEDULE,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED,
  DATABASE_URL: process.env.DATABASE_URL,
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  EVOLUTION_API_BASE_URL: env.EVOLUTION_API_BASE_URL,
  EVOLUTION_API_KEY: env.EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE_NAME: env.EVOLUTION_INSTANCE_NAME,
  EVOLUTION_WEBHOOK_SECRET: env.EVOLUTION_WEBHOOK_SECRET,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  OPENAI_MODEL: env.OPENAI_MODEL,
  REDIS_URL: env.REDIS_URL,
  MESSAGE_BUFFER_QUIET_MS: String(env.MESSAGE_BUFFER_QUIET_MS),
  MESSAGE_BUFFER_TTL_SECONDS: String(env.MESSAGE_BUFFER_TTL_SECONDS),
  GOOGLE_CALENDAR_ID: env.GOOGLE_CALENDAR_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY: env.GOOGLE_PRIVATE_KEY,
  GOOGLE_TIME_ZONE: env.GOOGLE_TIME_ZONE,
};

export interface PublicIntegrationSetting {
  key: IntegrationSettingKey;
  value: string;
  isSecret: boolean;
  hasValue: boolean;
}

export async function getPublicIntegrationSettings(): Promise<PublicIntegrationSetting[]> {
  const rows = await db
    .select()
    .from(integrationSettings)
    .where(inArray(integrationSettings.key, [...integrationSettingKeys]));

  return integrationSettingKeys.map((key) => {
    const row = rows.find((setting) => setting.key === key);
    const isSecret = secretKeys.has(key);
    const value = row?.value ?? "";

    return {
      key,
      value: isSecret ? "" : value,
      isSecret,
      hasValue: Boolean(value),
    };
  });
}

export async function saveIntegrationSettings(values: Partial<Record<IntegrationSettingKey, string>>) {
  const existingRows = await db
    .select()
    .from(integrationSettings)
    .where(inArray(integrationSettings.key, [...integrationSettingKeys]));

  const existingByKey = new Map(existingRows.map((row) => [row.key, row]));

  for (const key of integrationSettingKeys) {
    const rawValue = values[key];
    if (rawValue === undefined) continue;

    const value = rawValue.trim();
    const isSecret = secretKeys.has(key);
    const existing = existingByKey.get(key);

    if (!value && isSecret && existing?.value) continue;
    if (!value) continue;

    await db
      .insert(integrationSettings)
      .values({
        key,
        value,
        isSecret,
        modifiedBy: env.SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: integrationSettings.key,
        set: {
          value,
          isSecret,
          updatedAt: new Date(),
          modifiedBy: env.SYSTEM_USER_ID,
        },
      });
  }

  return getPublicIntegrationSettings();
}

export async function getRuntimeIntegrationSettings() {
  const rows = await db
    .select()
    .from(integrationSettings)
    .where(inArray(integrationSettings.key, [...integrationSettingKeys]));
  const savedValues = new Map(rows.map((row) => [row.key, row.value]));

  return integrationSettingKeys.reduce<Record<IntegrationSettingKey, string | undefined>>((settings, key) => {
    settings[key] = savedValues.get(key) || runtimeEnvValues[key];
    return settings;
  }, {} as Record<IntegrationSettingKey, string | undefined>);
}

export function isSecretIntegrationKey(key: IntegrationSettingKey) {
  return secretKeys.has(key);
}

export function isIntegrationSettingKey(key: string): key is IntegrationSettingKey {
  return (integrationSettingKeys as readonly string[]).includes(key);
}
