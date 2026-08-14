import { createServer } from "node:http";
import {
  AuditLogEvent,
  Client,
  Events,
  Interaction,
  MessageFlags,
  type GuildMember,
  type PartialGuildMember
} from "discord.js";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { createDb, guilds, type Database } from "@logger/db";
import type { LogDeliveryJob } from "@logger/shared";
import { botConfig } from "./config.js";
import { captureLog, channelName, userTag } from "./logger.js";

const logger = pino({ name: "logger-bot" });
const redis = new Redis(botConfig.redisUrl(), { maxRetriesPerRequest: null });
export const logDeliveryQueue = new Queue<LogDeliveryJob>("log-delivery", { connection: redis });
export const db: Database = createDb();

const client = new Client({ intents: botConfig.intents, partials: botConfig.partials });

client.once(Events.ClientReady, async (readyClient) => {
  logger.info({ user: readyClient.user.tag, guilds: readyClient.guilds.cache.size }, "bot ready");

  for (const guild of readyClient.guilds.cache.values()) {
    await upsertGuild(guild.id, guild.name, guild.iconURL(), guild.ownerId);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  logger.info({ guildId: guild.id, name: guild.name }, "joined guild");
  await upsertGuild(guild.id, guild.name, guild.iconURL(), guild.ownerId);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({
      content: `Pong: ${client.ws.ping}ms`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.commandName === "dashboard") {
    await interaction.reply({ content: dashboardUrl(), flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.commandName === "config") {
    await interaction.reply({
      content: "Logger config is managed from the dashboard.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.commandName === "debug") {
    await interaction.reply({
      content: `Ready: ${client.isReady()} | Guilds: ${client.guilds.cache.size} | Shard: ${client.shard?.ids.join(",") ?? "none"}`,
      flags: MessageFlags.Ephemeral
    });
  }
});

client.on(Events.MessageDelete, async (message) => {
  if (!message.guildId || message.author?.bot) return;
  const audit = await findRecentAuditEntry(
    message.guildId,
    AuditLogEvent.MessageDelete,
    (entry) => entry.targetId === message.author?.id
  );

  await captureLog(db, logDeliveryQueue, {
    type: "message.delete",
    guildId: message.guildId,
    actorId: audit?.executorId ?? message.author?.id ?? null,
    targetId: message.author?.id ?? null,
    channelId: message.channelId,
    messageId: message.id,
    ...auditDetails(audit),
    roleIds: message.member?.roles.cache.map((role) => role.id) ?? [],
    payload: {
      author: message.author ? userTag(message.author) : "Unknown",
      content: message.partial ? null : message.content,
      attachmentCount: message.partial ? 0 : message.attachments.size
    }
  });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guildId || newMessage.author?.bot) return;
  if (oldMessage.partial || newMessage.partial) return;
  if (oldMessage.content === newMessage.content) return;

  await captureLog(db, logDeliveryQueue, {
    type: "message.update",
    guildId: newMessage.guildId,
    actorId: newMessage.author?.id ?? null,
    targetId: newMessage.author?.id ?? null,
    channelId: newMessage.channelId,
    messageId: newMessage.id,
    roleIds: newMessage.member?.roles.cache.map((role) => role.id) ?? [],
    payload: {
      author: newMessage.author ? userTag(newMessage.author) : "Unknown",
      before: oldMessage.content,
      after: newMessage.content
    }
  });
});

client.on(Events.MessageBulkDelete, async (messages, channel) => {
  const guildId = channel.guild?.id;
  if (!guildId) return;
  const audit = await findRecentAuditEntry(
    guildId,
    AuditLogEvent.MessageBulkDelete,
    (entry) => entry.extra.channel?.id === channel.id
  );

  await captureLog(db, logDeliveryQueue, {
    type: "message.bulk_delete",
    guildId,
    channelId: channel.id,
    ...auditDetails(audit),
    payload: { count: messages.size, channel: channelName(channel) }
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  await captureLog(db, logDeliveryQueue, {
    type: "member.join",
    guildId: member.guild.id,
    targetId: member.id,
    roleIds: member.roles.cache.map((role) => role.id),
    isBot: member.user.bot,
    payload: { user: userTag(member.user), createdAt: member.user.createdAt.toISOString() }
  });
});

client.on(Events.GuildMemberRemove, async (member) => {
  const kickAudit = await findRecentAuditEntry(
    member.guild.id,
    AuditLogEvent.MemberKick,
    (entry) => entry.targetId === member.id
  );
  await captureLog(db, logDeliveryQueue, {
    type: kickAudit ? "moderation.kick" : "member.leave",
    guildId: member.guild.id,
    actorId: kickAudit?.executorId ?? null,
    targetId: member.id,
    ...auditDetails(kickAudit),
    roleIds: member.roles.cache.map((role) => role.id),
    isBot: member.user?.bot ?? false,
    payload: { user: member.user ? userTag(member.user) : member.id }
  });
});

client.on(Events.GuildBanAdd, async (ban) => {
  const audit = await findRecentAuditEntry(
    ban.guild.id,
    AuditLogEvent.MemberBanAdd,
    (entry) => entry.targetId === ban.user.id
  );
  await captureLog(db, logDeliveryQueue, {
    type: "moderation.ban",
    guildId: ban.guild.id,
    actorId: audit?.executorId ?? null,
    targetId: ban.user.id,
    ...auditDetails(audit),
    isBot: ban.user.bot,
    payload: { user: userTag(ban.user), reason: ban.reason ?? audit?.reason ?? null }
  });
});

client.on(Events.GuildBanRemove, async (ban) => {
  const audit = await findRecentAuditEntry(
    ban.guild.id,
    AuditLogEvent.MemberBanRemove,
    (entry) => entry.targetId === ban.user.id
  );
  await captureLog(db, logDeliveryQueue, {
    type: "moderation.unban",
    guildId: ban.guild.id,
    actorId: audit?.executorId ?? null,
    targetId: ban.user.id,
    ...auditDetails(audit),
    isBot: ban.user.bot,
    payload: { user: userTag(ban.user), reason: audit?.reason ?? null }
  });
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  await captureRoleDiff(oldMember, newMember);
  await captureTimeoutDiff(oldMember, newMember);
});

client.on(Events.ChannelCreate, async (channel) => {
  if (!("guild" in channel)) return;
  await captureChannelLog("channel.create", channel, AuditLogEvent.ChannelCreate);
});

client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
  if (!("guild" in newChannel)) return;
  await captureChannelLog("channel.update", newChannel, AuditLogEvent.ChannelUpdate, {
    before: channelName(oldChannel),
    after: channelName(newChannel)
  });
});

client.on(Events.ChannelDelete, async (channel) => {
  if (!("guild" in channel)) return;
  await captureChannelLog("channel.delete", channel, AuditLogEvent.ChannelDelete);
});

client.on(Events.GuildRoleCreate, async (role) => {
  await captureRoleLog("role.create", role, AuditLogEvent.RoleCreate);
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
  await captureRoleLog("role.update", newRole, AuditLogEvent.RoleUpdate, {
    before: oldRole.name,
    after: newRole.name
  });
});

client.on(Events.GuildRoleDelete, async (role) => {
  await captureRoleLog("role.delete", role, AuditLogEvent.RoleDelete);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;
  const type = oldState.channelId
    ? newState.channelId
      ? "voice.move"
      : "voice.leave"
    : "voice.join";
  await captureLog(db, logDeliveryQueue, {
    type,
    guildId: newState.guild.id,
    targetId: newState.id,
    channelId: newState.channelId ?? oldState.channelId,
    roleIds: newState.member?.roles.cache.map((role) => role.id) ?? [],
    isBot: newState.member?.user.bot ?? false,
    payload: {
      user: newState.member ? userTag(newState.member.user) : newState.id,
      from: oldState.channel ? channelName(oldState.channel) : null,
      to: newState.channel ? channelName(newState.channel) : null
    }
  });
});

createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "bot", ready: client.isReady() }));
}).listen(botConfig.port, () => logger.info({ port: botConfig.port }, "health server listening"));

await client.login(botConfig.token());

async function upsertGuild(
  id: string,
  name: string,
  iconUrl: string | null,
  ownerId: string | null
) {
  await db
    .insert(guilds)
    .values({ id, name, iconUrl, ownerId })
    .onConflictDoUpdate({ target: guilds.id, set: { name, iconUrl, ownerId, leftAt: null } });
}

async function captureRoleDiff(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  const before = oldMember.roles.cache;
  const after = newMember.roles.cache;
  const audit = await findRecentAuditEntry(
    newMember.guild.id,
    AuditLogEvent.MemberRoleUpdate,
    (entry) => entry.targetId === newMember.id
  );

  for (const role of after.values()) {
    if (!before.has(role.id)) {
      await captureLog(db, logDeliveryQueue, {
        type: "member.role_add",
        guildId: newMember.guild.id,
        targetId: newMember.id,
        roleIds: [role.id],
        ...auditDetails(audit),
        isBot: newMember.user.bot,
        payload: { user: userTag(newMember.user), roleId: role.id, roleName: role.name }
      });
    }
  }

  for (const role of before.values()) {
    if (!after.has(role.id)) {
      await captureLog(db, logDeliveryQueue, {
        type: "member.role_remove",
        guildId: newMember.guild.id,
        targetId: newMember.id,
        roleIds: [role.id],
        ...auditDetails(audit),
        isBot: newMember.user.bot,
        payload: { user: userTag(newMember.user), roleId: role.id, roleName: role.name }
      });
    }
  }
}

async function captureTimeoutDiff(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
) {
  const oldUntil = oldMember.communicationDisabledUntilTimestamp ?? null;
  const newUntil = newMember.communicationDisabledUntilTimestamp ?? null;
  if (oldUntil === newUntil) return;
  const audit = await findRecentAuditEntry(
    newMember.guild.id,
    AuditLogEvent.MemberUpdate,
    (entry) => entry.targetId === newMember.id
  );

  await captureLog(db, logDeliveryQueue, {
    type: "moderation.timeout",
    guildId: newMember.guild.id,
    targetId: newMember.id,
    roleIds: newMember.roles.cache.map((role) => role.id),
    ...auditDetails(audit),
    isBot: newMember.user.bot,
    payload: {
      user: userTag(newMember.user),
      until: newUntil ? new Date(newUntil).toISOString() : null
    }
  });
}

async function captureChannelLog(
  type: "channel.create" | "channel.update" | "channel.delete",
  channel: GuildLikeChannel,
  auditType: AuditLogEvent,
  payload: Record<string, unknown> = {}
) {
  const audit = await findRecentAuditEntry(
    channel.guild.id,
    auditType,
    (entry) => entry.targetId === channel.id
  );
  await captureLog(db, logDeliveryQueue, {
    type,
    guildId: channel.guild.id,
    actorId: audit?.executorId ?? null,
    targetId: channel.id,
    channelId: channel.id,
    ...auditDetails(audit),
    payload: { channel: channelName(channel), ...payload }
  });
}

async function captureRoleLog(
  type: "role.create" | "role.update" | "role.delete",
  role: { id: string; name: string; guild: { id: string } },
  auditType: AuditLogEvent,
  payload: Record<string, unknown> = {}
) {
  const audit = await findRecentAuditEntry(
    role.guild.id,
    auditType,
    (entry) => entry.targetId === role.id
  );
  await captureLog(db, logDeliveryQueue, {
    type,
    guildId: role.guild.id,
    actorId: audit?.executorId ?? null,
    targetId: role.id,
    roleIds: [role.id],
    ...auditDetails(audit),
    payload: { role: role.name, ...payload }
  });
}

function auditDetails(audit: RecentAuditEntry | undefined) {
  return audit
    ? { auditLogEntryId: audit.id, confidence: "high" as const }
    : { auditLogEntryId: null, confidence: "unknown" as const };
}

async function findRecentAuditEntry(
  guildId: string,
  type: AuditLogEvent,
  matches: (entry: RecentAuditEntry) => boolean
) {
  const guild = await client.guilds.fetch(guildId);
  const logs = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const maximumAge = 15_000;
  return (
    logs?.entries
      .map((entry) => entry as unknown as RecentAuditEntry)
      .find((entry) => Date.now() - entry.createdTimestamp < maximumAge && matches(entry)) ??
    undefined
  );
}

type GuildLikeChannel = {
  id: string;
  name?: string | null;
  guild: { id: string };
};

type RecentAuditEntry = {
  id: string;
  executorId: string | null;
  targetId: string | null;
  reason: string | null;
  createdTimestamp: number;
  extra: { channel?: { id: string } };
};

function dashboardUrl() {
  return process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL}/dashboard`
    : "Dashboard URL is not configured yet.";
}
