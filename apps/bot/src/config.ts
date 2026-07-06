import { GatewayIntentBits, Partials } from "discord.js";
import { requiredEnv } from "@logger/shared";

export const botConfig = {
  token: () => requiredEnv("DISCORD_TOKEN"),
  clientId: () => requiredEnv("DISCORD_CLIENT_ID"),
  redisUrl: () => requiredEnv("REDIS_URL"),
  port: Number(process.env.PORT ?? 3001),
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildScheduledEvents
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User
  ]
};
