ALTER TABLE "active_client_credentials" ADD COLUMN "api_key" text;--> statement-breakpoint
ALTER TABLE "active_client_credentials" ADD COLUMN "token" text;--> statement-breakpoint
CREATE TABLE "active_client_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_client_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_name" text DEFAULT 'Sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_client_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_client_documents" ADD CONSTRAINT "active_client_documents_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "active_client_notes" ADD CONSTRAINT "active_client_notes_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "active_client_history" ADD CONSTRAINT "active_client_history_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
