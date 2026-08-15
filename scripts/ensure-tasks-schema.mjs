import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL nao encontrado. Execute no ambiente que aponta para o banco correto.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists app_tasks (
        id uuid primary key default gen_random_uuid() not null,
        title text not null,
        description text,
        responsible_name text not null,
        priority text default 'Media' not null,
        due_date text not null,
        category text default 'Comercial' not null,
        status text default 'A Fazer' not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`create index if not exists app_tasks_status_idx on app_tasks (status);`;
    await tx`create index if not exists app_tasks_responsible_idx on app_tasks (responsible_name);`;
    await tx`create index if not exists app_tasks_due_date_idx on app_tasks (due_date);`;
  });

  console.log("Tabela app_tasks garantida.");
} finally {
  await sql.end();
}
