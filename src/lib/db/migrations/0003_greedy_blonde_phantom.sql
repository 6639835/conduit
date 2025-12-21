CREATE TABLE "api_key_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admins" DROP CONSTRAINT "admins_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "provider_selection_strategy" varchar(30) DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "totp_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "cost_multiplier" numeric(10, 2) DEFAULT '1.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_key_providers" ADD CONSTRAINT "api_key_providers_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_providers" ADD CONSTRAINT "api_key_providers_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_providers_unique_pair" ON "api_key_providers" USING btree ("api_key_id","provider_id");--> statement-breakpoint
CREATE INDEX "api_key_providers_api_key_id_idx" ON "api_key_providers" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_key_providers_provider_id_idx" ON "api_key_providers" USING btree ("provider_id");--> statement-breakpoint
-- Data migration: Populate junction table from existing API keys
INSERT INTO "api_key_providers" ("api_key_id", "provider_id", "priority", "is_active", "created_at")
SELECT "id", "provider_id", 0, true, NOW()
FROM "api_keys"
WHERE "provider_id" IS NOT NULL;