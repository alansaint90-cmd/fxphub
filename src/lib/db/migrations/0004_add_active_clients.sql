CREATE TYPE "public"."active_client_stage" AS ENUM('documentos', 'onboarding', 'implantacao', 'treinamento', 'acompanhamento', 'renovacao');--> statement-breakpoint
CREATE TABLE "active_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"responsible_name" text NOT NULL,
	"phone" text,
	"email" text,
	"city" text,
	"stage" "active_client_stage" DEFAULT 'documentos' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_client_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text,
	"username" text,
	"password" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_client_credentials" ADD CONSTRAINT "active_client_credentials_client_id_active_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."active_clients"("id") ON DELETE restrict ON UPDATE restrict;
