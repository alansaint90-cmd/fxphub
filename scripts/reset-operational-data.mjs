import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const modifiedBy = process.env.SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000000";

if (process.env.CONFIRM_RESET_OPERATIONAL_DATA !== "true") {
  console.error("Set CONFIRM_RESET_OPERATIONAL_DATA=true para zerar os dados operacionais.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("DATABASE_URL nao encontrado. Execute no ambiente que aponta para o banco correto.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function tableExists(tx, tableName) {
  const result = await tx`select to_regclass(${tableName}) as table_name;`;
  return Boolean(result[0]?.table_name);
}

async function softResetTable(tx, tableName, query) {
  if (!(await tableExists(tx, tableName))) {
    return { table: tableName, affected: 0, skipped: true };
  }

  const result = await query();
  return { table: tableName, affected: result.count ?? 0, skipped: false };
}

try {
  const resetAt = new Date();
  const results = [];

  await sql.begin(async (tx) => {
    results.push(
      await softResetTable(tx, "conversation_messages", () =>
        tx`
          update conversation_messages
          set
            is_deleted = true,
            deleted_at = ${resetAt},
            updated_at = ${resetAt},
            modified_by = ${modifiedBy}
          where is_deleted = false;
        `,
      ),
    );

    results.push(
      await softResetTable(tx, "appointments", () =>
        tx`
          update appointments
          set
            status = 'cancelled',
            is_deleted = true,
            deleted_at = ${resetAt},
            updated_at = ${resetAt},
            modified_by = ${modifiedBy}
          where is_deleted = false;
        `,
      ),
    );

    results.push(
      await softResetTable(tx, "leads", () =>
        tx`
          update leads
          set
            ai_paused = true,
            is_deleted = true,
            deleted_at = ${resetAt},
            updated_at = ${resetAt},
            modified_by = ${modifiedBy}
          where is_deleted = false;
        `,
      ),
    );

    results.push(
      await softResetTable(tx, "lead_forms", () =>
        tx`
          update lead_forms
          set
            meeting_scheduled = false,
            is_deleted = true,
            deleted_at = ${resetAt},
            updated_at = ${resetAt},
            modified_by = ${modifiedBy}
          where is_deleted = false;
        `,
      ),
    );
  });

  for (const result of results) {
    const status = result.skipped ? "ignorada" : `${result.affected} registros zerados`;
    console.log(`${result.table}: ${status}`);
  }
} finally {
  await sql.end();
}
