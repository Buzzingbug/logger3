CREATE TYPE "public"."log_event_type" AS ENUM('message.delete', 'message.update', 'message.bulk_delete', 'member.join', 'member.leave', 'member.role_add', 'member.role_remove', 'moderation.ban', 'moderation.unban', 'moderation.kick', 'moderation.timeout', 'channel.create', 'channel.update', 'channel.delete', 'role.create', 'role.update', 'role.delete', 'voice.join', 'voice.leave', 'voice.move');--> statement-breakpoint
CREATE TABLE "delivery_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_event_id" uuid NOT NULL,
	"guild_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_log_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"type" "log_event_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"channel_id" text,
	"webhook_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_settings" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"default_log_channel_id" text,
	"embed_color" integer DEFAULT 5793266 NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"icon_url" text,
	"owner_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ignored_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"type" "log_event_type" NOT NULL,
	"actor_id" text,
	"target_id" text,
	"channel_id" text,
	"message_id" text,
	"audit_log_entry_id" text,
	"confidence" text DEFAULT 'unknown' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_snapshots" (
	"message_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"author_id" text NOT NULL,
	"encrypted_content" text,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_log_event_id_log_events_id_fk" FOREIGN KEY ("log_event_id") REFERENCES "public"."log_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_log_routes" ADD CONSTRAINT "guild_log_routes_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ignored_entities" ADD CONSTRAINT "ignored_entities_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_events" ADD CONSTRAINT "log_events_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_snapshots" ADD CONSTRAINT "message_snapshots_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guild_log_routes_guild_type_idx" ON "guild_log_routes" USING btree ("guild_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "ignored_entities_unique_idx" ON "ignored_entities" USING btree ("guild_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "log_events_guild_created_idx" ON "log_events" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "log_events_guild_type_created_idx" ON "log_events" USING btree ("guild_id","type","created_at");--> statement-breakpoint
CREATE INDEX "log_events_guild_actor_created_idx" ON "log_events" USING btree ("guild_id","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "log_events_guild_target_created_idx" ON "log_events" USING btree ("guild_id","target_id","created_at");--> statement-breakpoint
CREATE INDEX "message_snapshots_guild_expires_idx" ON "message_snapshots" USING btree ("guild_id","expires_at");