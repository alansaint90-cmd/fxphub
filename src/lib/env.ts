import { z } from "zod";

const fallbackSystemUserId = "00000000-0000-0000-0000-000000000000";
const uuidSchema = z.string().trim().uuid();

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://dev:dev@localhost:5432/fausto_dev"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  REDIS_URL: z.string().url().optional(),
  MESSAGE_BUFFER_QUIET_MS: z.coerce.number().int().min(0).default(2500),
  MESSAGE_BUFFER_TTL_SECONDS: z.coerce.number().int().min(10).default(60),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  EVOLUTION_API_BASE_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().min(1).optional(),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).optional(),
  EVOLUTION_WEBHOOK_SECRET: z.string().min(1).optional(),
  SYSTEM_USER_ID: z
    .preprocess((value) => (typeof value === "string" ? value.trim() : value), uuidSchema)
    .catch(fallbackSystemUserId),
});

export const env = envSchema.parse(process.env);
