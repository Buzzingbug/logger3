import { Worker } from "bullmq";
import { EmbedBuilder, REST, Routes } from "discord.js";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import pino from "pino";
import { createDb, guildSettings, logEvents } from "@logger/db";
import {
  LOG_EVENT_COLORS,
  LOG_EVENT_LABELS,
  requiredEnv,
  type LogDeliveryJob
} from "@logger/shared";

const logger = pino({ name: "logger-worker" });
const db = createDb();
const redis = new Redis(requiredEnv("REDIS_URL"), { maxRetriesPerRequest: null });
const rest = new REST({ version: "10" }).setToken(requiredEnv("DISCORD_TOKEN"));

const worker = new Worker<LogDeliveryJob>(
  "log-delivery",
  async (job) => {
    const event = await db.query.logEvents.findFirst({
      where: eq(logEvents.id, job.data.logEventId)
    });
    if (!event) return;

    const destination = await resolveDestination(event.guildId, event.type);
    if (!destination) {
      logger.warn({ guildId: event.guildId, type: event.type }, "no log destination configured");
      return;
    }

    const embed = renderEmbed(event);
    await rest.post(Routes.channelMessages(destination), { body: { embeds: [embed.toJSON()] } });
    await db.update(logEvents).set({ deliveredAt: new Date() }).where(eq(logEvents.id, event.id));
  },
  { connection: redis, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5) }
);

worker.on("completed", (job) => logger.info({ jobId: job.id }, "delivered log"));
worker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "log delivery failed"));

function renderEmbed(event: typeof logEvents.$inferSelect) {
  const payload = event.payload as Record<string, unknown>;
  const embed = new EmbedBuilder()
    .setTitle(LOG_EVENT_LABELS[event.type])
    .setColor(LOG_EVENT_COLORS[event.type])
    .setTimestamp(event.createdAt)
    .setFooter({ text: `Event ${event.id}` });

  if (event.actorId) embed.addFields({ name: "Actor", value: `<@${event.actorId}>`, inline: true });
  if (event.targetId)
    embed.addFields({ name: "Target", value: `<@${event.targetId}>`, inline: true });
  if (event.channelId)
    embed.addFields({ name: "Channel", value: `<#${event.channelId}>`, inline: true });

  for (const [key, value] of Object.entries(payload).slice(0, 10)) {
    if (value === null || value === undefined || value === "") continue;
    embed.addFields({ name: titleCase(key), value: truncate(String(value)), inline: false });
  }

  return embed;
}

async function resolveDestination(guildId: string, type: typeof logEvents.$inferSelect.type) {
  const route = await db.query.guildLogRoutes.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.guildId, guildId), eq(table.type, type), eq(table.enabled, true))
  });
  if (route?.channelId) return route.channelId;

  const settings = await db.query.guildSettings.findFirst({
    where: eq(guildSettings.guildId, guildId)
  });
  return settings?.defaultLogChannelId ?? null;
}

function titleCase(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function truncate(value: string) {
  return value.length > 1000 ? `${value.slice(0, 997)}...` : value;
}

logger.info("worker started");
