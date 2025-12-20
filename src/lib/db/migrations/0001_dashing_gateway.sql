CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"admin_email" varchar(255),
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"action" varchar(50) NOT NULL,
	"changes" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"max_api_keys" integer DEFAULT 10,
	"max_users" integer DEFAULT 5,
	"shared_quotas" jsonb,
	"settings" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"shared_quotas" jsonb,
	"settings" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"response" jsonb NOT NULL,
	"model" varchar(100) NOT NULL,
	"tokens_input" integer NOT NULL,
	"tokens_output" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "response_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_provider_id_providers_id_fk";
--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "role" varchar(50) DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "model_rate_limits" jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "last_rotated_at" timestamp;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "rotation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "scopes" jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "ip_whitelist" jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "ip_blacklist" jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "hmac_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "hmac_secret" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "email_notifications_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "notification_email" varchar(255);--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "slack_webhook" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "discord_webhook" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "alert_thresholds" jsonb DEFAULT '{"requestsPerDay":[80,90],"tokensPerDay":[80,90],"monthlySpend":[80,90]}'::jsonb;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "cache_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "cache_ttl_seconds" integer DEFAULT 300;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "failover_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "max_retries" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_admin_id_idx" ON "audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_type_idx" ON "audit_logs" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_id_idx" ON "audit_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_composite_idx" ON "audit_logs" USING btree ("resource_type","resource_id","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_is_active_idx" ON "organizations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_is_active_idx" ON "projects" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "response_cache_key_idx" ON "response_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE INDEX "response_cache_expires_at_idx" ON "response_cache" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_id_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_id_idx" ON "api_keys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "expires_at_idx" ON "api_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "providers_priority_idx" ON "providers" USING btree ("priority");