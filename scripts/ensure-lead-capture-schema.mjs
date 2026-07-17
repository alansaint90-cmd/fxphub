import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL nao encontrado.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists lead_forms (
        id uuid primary key default gen_random_uuid() not null,
        name text not null,
        business_name text not null,
        phone text not null,
        email text,
        city text,
        state text,
        monthly_enrollments integer default 0 not null,
        sales_attendants integer default 0 not null,
        uses_crm text,
        crm_name text,
        runs_paid_ads text,
        monthly_ad_spend integer,
        main_challenge text,
        response_time text,
        wants_whatsapp_automation text,
        meeting_interest text not null,
        preferred_meeting_period text,
        contact_authorized boolean default false not null,
        privacy_policy_accepted boolean default false not null,
        qualification_score integer default 0 not null,
        qualification_status text default 'unqualified' not null,
        disqualification_reason text,
        lead_status text default 'Formulario concluido' not null,
        whatsapp_clicked boolean default false not null,
        whatsapp_clicked_at timestamp with time zone,
        fausto_contact_started boolean default false not null,
        meeting_scheduled boolean default false not null,
        meeting_date timestamp with time zone,
        meeting_attended boolean default false not null,
        deal_closed boolean default false not null,
        deal_value integer,
        source text,
        utm_source text,
        utm_medium text,
        utm_campaign text,
        utm_content text,
        utm_term text,
        campaign_id text,
        adset_id text,
        ad_id text,
        fbclid text,
        fbc text,
        fbp text,
        ip_address text,
        user_agent text,
        landing_page_url text,
        notes text,
        tags jsonb default '[]'::jsonb not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists lead_form_events (
        id uuid primary key default gen_random_uuid() not null,
        lead_id uuid,
        event_name text not null,
        event_id text not null,
        event_source text default 'form' not null,
        event_data jsonb default '{}'::jsonb not null,
        created_at timestamp with time zone default now() not null
      );
    `;

    await tx`
      create table if not exists lead_form_settings (
        id uuid primary key default gen_random_uuid() not null,
        form_name text default 'Diagnostico Autoescola' not null,
        slug text default 'diagnostico-autoescola' not null,
        title text default 'Diagnostico comercial para autoescolas' not null,
        description text,
        is_active boolean default true not null,
        whatsapp_instance_id text,
        whatsapp_number text,
        qualified_message text,
        unqualified_message text,
        qualified_min_score integer default 50 not null,
        instagram_url text,
        privacy_policy_url text,
        meta_pixel_id text,
        meta_capi_token text,
        meta_test_event_code text,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null,
        deleted_at timestamp with time zone,
        is_deleted boolean default false not null,
        modified_by uuid not null
      );
    `;

    await tx`
      create table if not exists lead_qualification_rules (
        id uuid primary key default gen_random_uuid() not null,
        field_name text not null,
        operator text not null,
        field_value text not null,
        score integer default 0 not null,
        classification_action text,
        is_active boolean default true not null,
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
        if not exists (select 1 from pg_constraint where conname = 'lead_form_events_lead_id_lead_forms_id_fk') then
          alter table lead_form_events
          add constraint lead_form_events_lead_id_lead_forms_id_fk
          foreign key (lead_id) references lead_forms(id) on delete restrict on update restrict;
        end if;
      end $$;
    `;

    await tx`create index if not exists lead_forms_status_idx on lead_forms(qualification_status, lead_status);`;
    await tx`create index if not exists lead_forms_phone_idx on lead_forms(phone);`;
    await tx`create index if not exists lead_forms_campaign_idx on lead_forms(utm_campaign);`;
    await tx`create index if not exists lead_form_events_lead_idx on lead_form_events(lead_id);`;
    await tx`create unique index if not exists lead_form_settings_slug_idx on lead_form_settings(slug);`;
  });

  console.log("Schema de captacao de leads garantido com sucesso.");
} finally {
  await sql.end({ timeout: 5 });
}
