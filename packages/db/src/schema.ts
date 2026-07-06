import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const logEventType = pgEnum("log_event_type", [
  "message.delete",
  "message.update",
  "message.bulk_delete",
  "member.join",
  "member.leave",
  "member.role_add",
  "member.role_remove",
  "moderation.ban",
  "moderation.unban",
  "moderation.kick",
  "moderation.timeout",
  "channel.create",
  "channel.update",
  "channel.delete",
  "role.create",
  "role.update",
  "role.delete",
  "voice.join",
  "voice.leave",
  "voice.move"
]);

export const guilds = pgTable("guilds", {
  id: text("id").primaryKey(),
  name: text("name"),
  iconUrl: text("icon_url"),
  ownerId: text("owner_id"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  leftAt: timestamp("left_at", { withTimezone: true })
});

export const guildSettings = pgTable("guild_settings", {
  guildId: text("guild_id")
    .primaryKey()
    .references(() => guilds.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(true).notNull(),
  defaultLogChannelId: text("default_log_channel_id"),
  embedColor: integer("embed_color").default(0x5865f2).notNull(),
  retentionDays: integer("retention_days").default(30).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const guildLogRoutes = pgTable(
  "guild_log_routes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    type: logEventType("type").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    channelId: text("channel_id"),
    webhookId: text("webhook_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    guildTypeIdx: uniqueIndex("guild_log_routes_guild_type_idx").on(table.guildId, table.type)
  })
);

export const ignoredEntities = pgTable(
  "ignored_entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ignoredUniqueIdx: uniqueIndex("ignored_entities_unique_idx").on(
      table.guildId,
      table.entityType,
      table.entityId
    )
  })
);

export const logEvents = pgTable(
  "log_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    type: logEventType("type").notNull(),
    actorId: text("actor_id"),
    targetId: text("target_id"),
    channelId: text("channel_id"),
    messageId: text("message_id"),
    auditLogEntryId: text("audit_log_entry_id"),
    confidence: text("confidence").default("unknown").notNull(),
    payload: jsonb("payload").default({}).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    guildCreatedIdx: index("log_events_guild_created_idx").on(table.guildId, table.createdAt),
    guildTypeCreatedIdx: index("log_events_guild_type_created_idx").on(
      table.guildId,
      table.type,
      table.createdAt
    ),
    guildActorCreatedIdx: index("log_events_guild_actor_created_idx").on(
      table.guildId,
      table.actorId,
      table.createdAt
    ),
    guildTargetCreatedIdx: index("log_events_guild_target_created_idx").on(
      table.guildId,
      table.targetId,
      table.createdAt
    )
  })
);

export const messageSnapshots = pgTable(
  "message_snapshots",
  {
    messageId: text("message_id").primaryKey(),
    guildId: text("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    authorId: text("author_id").notNull(),
    encryptedContent: text("encrypted_content"),
    attachmentCount: integer("attachment_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    snapshotGuildExpiresIdx: index("message_snapshots_guild_expires_idx").on(
      table.guildId,
      table.expiresAt
    )
  })
);

export const deliveryJobs = pgTable("delivery_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  logEventId: uuid("log_event_id")
    .notNull()
    .references(() => logEvents.id, { onDelete: "cascade" }),
  guildId: text("guild_id").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
