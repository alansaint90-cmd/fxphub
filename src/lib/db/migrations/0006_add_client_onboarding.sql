CREATE TABLE IF NOT EXISTS "client_onboardings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "plan_name" text,
  "internal_owner_name" text,
  "status" text DEFAULT 'Aguardando inicio' NOT NULL,
  "health" text DEFAULT 'Atencao' NOT NULL,
  "contracted_at" timestamp with time zone,
  "onboarding_started_at" timestamp with time zone,
  "configuration_started_at" timestamp with time zone,
  "tests_started_at" timestamp with time zone,
  "training_at" timestamp with time zone,
  "planned_completion_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "progress" integer DEFAULT 0 NOT NULL,
  "next_recommended_action" text,
  "metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "onboarding_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "onboarding_id" uuid NOT NULL,
  "stage_key" text NOT NULL,
  "stage_name" text NOT NULL,
  "item_key" text NOT NULL,
  "label" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_required" boolean DEFAULT true NOT NULL,
  "is_completed" boolean DEFAULT false NOT NULL,
  "is_blocked" boolean DEFAULT false NOT NULL,
  "responsible_name" text,
  "due_at" timestamp with time zone,
  "notes" text,
  "document_url" text,
  "completed_at" timestamp with time zone,
  "completed_by" text,
  "block_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "onboarding_id" uuid NOT NULL,
  "form_type" text NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "completion_percent" integer DEFAULT 0 NOT NULL,
  "last_edited_by" text,
  "copied_to_ai_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_trainings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "onboarding_id" uuid NOT NULL,
  "title" text NOT NULL,
  "type" text NOT NULL,
  "scheduled_at" timestamp with time zone,
  "duration_minutes" integer,
  "fxp_owner_name" text,
  "participants" text,
  "meeting_url" text,
  "content_covered" text,
  "questions" text,
  "status" text DEFAULT 'Agendado' NOT NULL,
  "notes" text,
  "material_url" text,
  "team_trained" boolean DEFAULT false NOT NULL,
  "needs_reinforcement" boolean DEFAULT false NOT NULL,
  "new_training_needed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_pending_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "onboarding_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text,
  "responsible_name" text,
  "origin" text,
  "priority" text DEFAULT 'Media' NOT NULL,
  "due_at" timestamp with time zone,
  "status" text DEFAULT 'Aberta' NOT NULL,
  "dependency" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_quality_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "onboarding_id" uuid NOT NULL,
  "item_key" text NOT NULL,
  "label" text NOT NULL,
  "is_required" boolean DEFAULT true NOT NULL,
  "is_completed" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" text,
  "exception_justification" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_acceptance_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "onboarding_id" uuid NOT NULL,
  "client_name" text NOT NULL,
  "responsible_name" text NOT NULL,
  "accepted_at" timestamp with time zone,
  "delivered_items" text,
  "known_pending_items" text,
  "notes" text,
  "fxp_responsible_name" text,
  "client_confirmation" boolean DEFAULT false NOT NULL,
  "signed_term_url" text,
  "printable_version" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_onboardings_client_idx" ON "client_onboardings" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_onboardings_status_idx" ON "client_onboardings" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_checklist_client_idx" ON "onboarding_checklist_items" ("client_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_forms_client_type_idx" ON "client_forms" ("client_id", "form_type");
--> statement-breakpoint
ALTER TABLE "client_onboardings" ADD CONSTRAINT "client_onboardings_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "onboarding_checklist_items" ADD CONSTRAINT "onboarding_checklist_items_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "onboarding_checklist_items" ADD CONSTRAINT "onboarding_checklist_items_onboarding_id_client_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."client_onboardings"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_forms" ADD CONSTRAINT "client_forms_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_forms" ADD CONSTRAINT "client_forms_onboarding_id_client_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."client_onboardings"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_trainings" ADD CONSTRAINT "client_trainings_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_trainings" ADD CONSTRAINT "client_trainings_onboarding_id_client_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."client_onboardings"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_pending_items" ADD CONSTRAINT "client_pending_items_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_pending_items" ADD CONSTRAINT "client_pending_items_onboarding_id_client_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."client_onboardings"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_quality_checks" ADD CONSTRAINT "client_quality_checks_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_quality_checks" ADD CONSTRAINT "client_quality_checks_onboarding_id_client_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."client_onboardings"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_acceptance_terms" ADD CONSTRAINT "client_acceptance_terms_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
--> statement-breakpoint
ALTER TABLE "client_acceptance_terms" ADD CONSTRAINT "client_acceptance_terms_onboarding_id_client_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."client_onboardings"("id") ON DELETE restrict ON UPDATE restrict;
