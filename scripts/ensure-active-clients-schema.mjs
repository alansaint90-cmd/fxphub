import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL nao encontrado. Execute dentro do container/app com as variaveis de producao.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`
      do $$
      begin
        if not exists (select 1 from pg_type where typname = 'active_client_stage') then
          create type active_client_stage as enum (
            'documentos',
            'onboarding',
            'implantacao',
            'treinamento',
            'acompanhamento',
            'renovacao'
          );
        end if;
      end $$;
    `;

    await tx`
      create table if not exists active_clients (
        id uuid primary key default gen_random_uuid() not null,
        company_name text not null,
        responsible_name text not null,
        phone text,
        email text,
        city text,
        stage active_client_stage default 'documentos' not null,
        notes text,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists active_client_credentials (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        label text not null,
        url text,
        username text,
        password text,
        notes text,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`alter table active_client_credentials add column if not exists api_key text;`;
    await tx`alter table active_client_credentials add column if not exists token text;`;

    await tx`
      create table if not exists active_client_documents (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        name text not null,
        type text not null,
        description text,
        file_url text,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists active_client_notes (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        body text not null,
        author_name text default 'Sistema' not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists active_client_history (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        action text not null,
        description text not null,
        metadata jsonb default '{}'::jsonb not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      do $$
      begin
        if not exists (select 1 from pg_constraint where conname = 'active_client_credentials_client_id_active_clients_id_fk') then
          alter table active_client_credentials
          add constraint active_client_credentials_client_id_active_clients_id_fk
          foreign key (client_id) references active_clients(id) on delete restrict on update restrict;
        end if;

        if not exists (select 1 from pg_constraint where conname = 'active_client_documents_client_id_active_clients_id_fk') then
          alter table active_client_documents
          add constraint active_client_documents_client_id_active_clients_id_fk
          foreign key (client_id) references active_clients(id) on delete restrict on update restrict;
        end if;

        if not exists (select 1 from pg_constraint where conname = 'active_client_notes_client_id_active_clients_id_fk') then
          alter table active_client_notes
          add constraint active_client_notes_client_id_active_clients_id_fk
          foreign key (client_id) references active_clients(id) on delete restrict on update restrict;
        end if;

        if not exists (select 1 from pg_constraint where conname = 'active_client_history_client_id_active_clients_id_fk') then
          alter table active_client_history
          add constraint active_client_history_client_id_active_clients_id_fk
          foreign key (client_id) references active_clients(id) on delete restrict on update restrict;
        end if;
      end $$;
    `;
  });

  console.log("Schema de clientes ativos garantido com sucesso.");
} finally {
  await sql.end({ timeout: 5 });
}
