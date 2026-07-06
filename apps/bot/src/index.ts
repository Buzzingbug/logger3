import { createServer } from "node:http";
import { Client, Events, Interaction, MessageFlags } from "discord.js";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { createDb } from "@logger/db";
import { botConfig } from "./config.js";

const logger = pino({ name: "logger-bot" });
const redis = new Redis(botConfig.redisUrl(), { maxRetriesPerRequest: null });
export const logDeliveryQueue = new Queue("log-delivery", { connection: redis });
export const db = createDb();

const client = new Client({ intents: botConfig.intents, partials: botConfig.partials });

client.once(Events.ClientReady, (readyClient) => {
  logger.info({ user: readyClient.user.tag, guilds: readyClient.guilds.cache.size }, "bot ready");
});

client.on(Events.GuildCreate, async (guild) => {
  logger.info({ guildId: guild.id, name: guild.name }, "joined guild");
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

  await logDeliveryQueue.add("message.delete", {
    guildId: message.guildId,
    channelId: message.channelId,
    messageId: message.id,
    authorId: message.author?.id ?? null,
    content: message.partial ? null : message.content
  });
});

createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "bot", ready: client.isReady() }));
}).listen(botConfig.port, () => logger.info({ port: botConfig.port }, "health server listening"));

await client.login(botConfig.token());

function dashboardUrl() {
  return process.env.PUBLIC_APP_URL
    ? `${process.env.PUBLIC_APP_URL}/dashboard`
    : "Dashboard URL is not configured yet.";
}
