import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const modifiedBy = process.env.SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000000";

if (!databaseUrl) {
  console.error("DATABASE_URL nao encontrado. Execute dentro do container/app com as variaveis de producao.");
  process.exit(1);
}

const superAdmins = [
  { name: "Allan Nascimento", identifier: "fxpagenciadigital@outlook.com" },
  { name: "Gabriela Nascimento", identifier: "gabrielanascimento" },
  { name: "Ita Silva", identifier: "itasilva" },
  { name: "Derek Nascimento", identifier: "dereknascimento" },
];

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`
      do $$
      begin
        if not exists (select 1 from pg_type where typname = 'role') then
          create type role as enum ('super_admin', 'admin', 'operador', 'visualizador');
        end if;
      end $$;
    `;

    await tx`
      create table if not exists app_users (
        id uuid primary key default gen_random_uuid() not null,
        name text not null,
        email text not null,
        role role default 'operador' not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    for (const admin of superAdmins) {
      const identifier = admin.identifier.toLowerCase();
      const existing = await tx`
        select id
        from app_users
        where lower(email) = ${identifier}
        order by created_at asc
        limit 1;
      `;

      if (existing.length > 0) {
        await tx`
          update app_users
          set
            name = ${admin.name},
            role = 'super_admin',
            updated_at = now(),
            deleted_at = null,
            is_deleted = false,
            modified_by = ${modifiedBy}
          where id = ${existing[0].id};
        `;
      } else {
        await tx`
          insert into app_users (name, email, role, modified_by)
          values (${admin.name}, ${identifier}, 'super_admin', ${modifiedBy});
        `;
      }
    }
  });

  console.log(`Super admins garantidos: ${superAdmins.map((admin) => admin.identifier).join(", ")}`);
} finally {
  await sql.end();
}
