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
      create table if not exists client_onboardings (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        plan_name text,
        internal_owner_name text,
        status text default 'Aguardando inicio' not null,
        health text default 'Atencao' not null,
        contracted_at timestamp with time zone,
        onboarding_started_at timestamp with time zone,
        configuration_started_at timestamp with time zone,
        tests_started_at timestamp with time zone,
        training_at timestamp with time zone,
        planned_completion_at timestamp with time zone,
        completed_at timestamp with time zone,
        progress integer default 0 not null,
        next_recommended_action text,
        metrics jsonb default '{}'::jsonb not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists onboarding_checklist_items (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        onboarding_id uuid not null,
        stage_key text not null,
        stage_name text not null,
        item_key text not null,
        label text not null,
        sort_order integer default 0 not null,
        is_required boolean default true not null,
        is_completed boolean default false not null,
        is_blocked boolean default false not null,
        responsible_name text,
        due_at timestamp with time zone,
        notes text,
        document_url text,
        completed_at timestamp with time zone,
        completed_by text,
        block_reason text,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists client_forms (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        onboarding_id uuid not null,
        form_type text not null,
        data jsonb default '{}'::jsonb not null,
        completion_percent integer default 0 not null,
        last_edited_by text,
        copied_to_ai_at timestamp with time zone,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists client_trainings (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        onboarding_id uuid not null,
        title text not null,
        type text not null,
        scheduled_at timestamp with time zone,
        duration_minutes integer,
        fxp_owner_name text,
        participants text,
        meeting_url text,
        content_covered text,
        questions text,
        status text default 'Agendado' not null,
        notes text,
        material_url text,
        team_trained boolean default false not null,
        needs_reinforcement boolean default false not null,
        new_training_needed boolean default false not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists client_pending_items (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        onboarding_id uuid not null,
        title text not null,
        description text,
        category text,
        responsible_name text,
        origin text,
        priority text default 'Media' not null,
        due_at timestamp with time zone,
        status text default 'Aberta' not null,
        dependency text,
        notes text,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists client_quality_checks (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        onboarding_id uuid not null,
        item_key text not null,
        label text not null,
        is_required boolean default true not null,
        is_completed boolean default false not null,
        completed_at timestamp with time zone,
        completed_by text,
        exception_justification text,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists client_acceptance_terms (
        id uuid primary key default gen_random_uuid() not null,
        client_id uuid not null,
        onboarding_id uuid not null,
        client_name text not null,
        responsible_name text not null,
        accepted_at timestamp with time zone,
        delivered_items text,
        known_pending_items text,
        notes text,
        fxp_responsible_name text,
        client_confirmation boolean default false not null,
        signed_term_url text,
        printable_version text,
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

        if not exists (select 1 from pg_constraint where conname = 'client_onboardings_client_id_active_clients_id_fk') then
          alter table client_onboardings
          add constraint client_onboardings_client_id_active_clients_id_fk
          foreign key (client_id) references active_clients(id) on delete restrict on update restrict;
        end if;
      end $$;
    `;

    for (const table of [
      "onboarding_checklist_items",
      "client_forms",
      "client_trainings",
      "client_pending_items",
      "client_quality_checks",
      "client_acceptance_terms",
    ]) {
      await tx.unsafe(`
        do $$
        begin
          if not exists (select 1 from pg_constraint where conname = '${table}_client_id_active_clients_id_fk') then
            alter table ${table}
            add constraint ${table}_client_id_active_clients_id_fk
            foreign key (client_id) references active_clients(id) on delete restrict on update restrict;
          end if;

          if not exists (select 1 from pg_constraint where conname = '${table}_onboarding_id_client_onboardings_id_fk') then
            alter table ${table}
            add constraint ${table}_onboarding_id_client_onboardings_id_fk
            foreign key (onboarding_id) references client_onboardings(id) on delete restrict on update restrict;
          end if;
        end $$;
      `);
    }

    await tx`create index if not exists client_onboardings_client_idx on client_onboardings(client_id);`;
    await tx`create index if not exists client_onboardings_status_idx on client_onboardings(status);`;
    await tx`create index if not exists onboarding_checklist_client_idx on onboarding_checklist_items(client_id);`;
    await tx`create unique index if not exists client_forms_client_type_idx on client_forms(client_id, form_type);`;
    await tx`create index if not exists client_pending_items_due_idx on client_pending_items(due_at);`;
  });

  console.log("Schema de clientes ativos garantido com sucesso.");
} finally {
  await sql.end({ timeout: 5 });
}
