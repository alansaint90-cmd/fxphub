import Redis from "ioredis";
import postgres from "postgres";

const confirmClear = process.env.CONFIRM_CLEAR_CONVERSATIONS === "true";
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const modifiedBy = process.env.SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000000";

if (!confirmClear) {
  console.error("Set CONFIRM_CLEAR_CONVERSATIONS=true para limpar o estado de conversas.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("DATABASE_URL nao encontrado. Execute no ambiente que aponta para o banco correto.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.begin(async (tx) => {
    const messages = await tx`
      update conversation_messages
      set is_deleted = true,
          deleted_at = now(),
          updated_at = now(),
          modified_by = ${modifiedBy}
      where is_deleted = false
      returning id
    `;

    const answers = await tx`
      update qualification_answers
      set is_deleted = true,
          deleted_at = now(),
          updated_at = now(),
          modified_by = ${modifiedBy}
      where is_deleted = false
      returning id
    `;

    const appointments = await tx`
      update appointments
      set status = 'cancelled',
          is_deleted = true,
          deleted_at = now(),
          updated_at = now(),
          modified_by = ${modifiedBy}
      where is_deleted = false
      returning id
    `;

    const leads = await tx`
      update leads
      set responsible_name = null,
          driving_school_name = null,
          city = null,
          monthly_enrollments = null,
          commercial_attendants = null,
          uses_crm = null,
          runs_paid_traffic = null,
          main_pain = null,
          score = 0,
          classification = null,
          pain_points = '[]'::jsonb,
          qualification_summary = null,
          funnel_stage = 'novo_lead',
          current_qualification_question = null,
          qualification_started = false,
          ai_paused = false,
          last_interaction_at = null,
          updated_at = now(),
          modified_by = ${modifiedBy}
      where is_deleted = false
      returning id
    `;

    console.log("Banco limpo com soft-delete/reset:");
    console.log(`- mensagens arquivadas: ${messages.count}`);
    console.log(`- respostas arquivadas: ${answers.count}`);
    console.log(`- agendamentos cancelados/arquivados: ${appointments.count}`);
    console.log(`- leads resetados: ${leads.count}`);
  });
} finally {
  await sql.end({ timeout: 5 });
}

if (redisUrl) {
  const redis = new Redis(redisUrl);
  try {
    let cursor = "0";
    let deletedKeys = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "conversation-buffer:*", "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deletedKeys += await redis.del(...keys);
      }
    } while (cursor !== "0");

    console.log(`- buffers Redis apagados: ${deletedKeys}`);
  } finally {
    redis.disconnect();
  }
} else {
  console.log("- Redis nao configurado; memoria em Redis nao foi limpa.");
}
