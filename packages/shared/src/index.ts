export const APP_NAME = "Logger Bot";

export const LOG_EVENT_TYPES = [
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
] as const;

export type LogEventType = (typeof LOG_EVENT_TYPES)[number];

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
