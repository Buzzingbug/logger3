import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";
export type Database = PostgresJsDatabase<typeof schema>;

export function createDb(databaseUrl = process.env.DATABASE_URL): Database {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}

export async function initDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return;
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql.unsafe(`
      DO $$ BEGIN
        CREATE TYPE "public"."log_event_type" AS ENUM('message.delete', 'message.update', 'message.bulk_delete', 'member.join', 'member.leave', 'member.role_add', 'member.role_remove', 'moderation.ban', 'moderation.unban', 'moderation.kick', 'moderation.timeout', 'channel.create', 'channel.update', 'channel.delete', 'role.create', 'role.update', 'role.delete', 'voice.join', 'voice.leave', 'voice.move');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "guilds" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text,
        "icon_url" text,
        "owner_id" text,
        "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
        "left_at" timestamp with time zone
      );

      CREATE TABLE IF NOT EXISTS "guild_settings" (
        "guild_id" text PRIMARY KEY NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
        "enabled" boolean DEFAULT true NOT NULL,
        "default_log_channel_id" text,
        "embed_color" integer DEFAULT 5793266 NOT NULL,
        "retention_days" integer DEFAULT 30 NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "guild_log_routes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "guild_id" text NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
        "type" "log_event_type" NOT NULL,
        "enabled" boolean DEFAULT true NOT NULL,
        "channel_id" text,
        "webhook_id" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "log_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "guild_id" text NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
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

      CREATE TABLE IF NOT EXISTS "delivery_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "log_event_id" uuid NOT NULL REFERENCES "log_events"("id") ON DELETE cascade,
        "guild_id" text NOT NULL,
        "attempts" integer DEFAULT 0 NOT NULL,
        "last_error" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "ignored_entities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "guild_id" text NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
        "entity_type" text NOT NULL,
        "entity_id" text NOT NULL,
        "reason" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "message_snapshots" (
        "message_id" text PRIMARY KEY NOT NULL,
        "guild_id" text NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
        "channel_id" text NOT NULL,
        "author_id" text NOT NULL,
        "encrypted_content" text,
        "attachment_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "expires_at" timestamp with time zone NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "guild_log_routes_guild_type_idx" ON "guild_log_routes" ("guild_id","type");
      CREATE UNIQUE INDEX IF NOT EXISTS "ignored_entities_unique_idx" ON "ignored_entities" ("guild_id","entity_type","entity_id");
      CREATE INDEX IF NOT EXISTS "log_events_guild_created_idx" ON "log_events" ("guild_id","created_at");
      CREATE INDEX IF NOT EXISTS "log_events_guild_type_created_idx" ON "log_events" ("guild_id","type","created_at");
      CREATE INDEX IF NOT EXISTS "log_events_guild_actor_created_idx" ON "log_events" ("guild_id","actor_id","created_at");
      CREATE INDEX IF NOT EXISTS "log_events_guild_target_created_idx" ON "log_events" ("guild_id","target_id","created_at");
      CREATE INDEX IF NOT EXISTS "message_snapshots_guild_expires_idx" ON "message_snapshots" ("guild_id","expires_at");
    `);
  } catch (err) {
    console.error("Database initialization notice:", err);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
