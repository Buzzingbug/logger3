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

export type LogPayload = Record<string, unknown>;

export type LogDeliveryJob = {
  logEventId: string;
  guildId: string;
};

export const LOG_EVENT_LABELS: Record<LogEventType, string> = {
  "message.delete": "Message Deleted",
  "message.update": "Message Edited",
  "message.bulk_delete": "Messages Bulk Deleted",
  "member.join": "Member Joined",
  "member.leave": "Member Left",
  "member.role_add": "Role Added",
  "member.role_remove": "Role Removed",
  "moderation.ban": "Member Banned",
  "moderation.unban": "Member Unbanned",
  "moderation.kick": "Member Kicked",
  "moderation.timeout": "Member Timed Out",
  "channel.create": "Channel Created",
  "channel.update": "Channel Updated",
  "channel.delete": "Channel Deleted",
  "role.create": "Role Created",
  "role.update": "Role Updated",
  "role.delete": "Role Deleted",
  "voice.join": "Voice Joined",
  "voice.leave": "Voice Left",
  "voice.move": "Voice Moved"
};

export const LOG_EVENT_COLORS: Record<LogEventType, number> = {
  "message.delete": 0xef4444,
  "message.update": 0xf59e0b,
  "message.bulk_delete": 0xdc2626,
  "member.join": 0x22c55e,
  "member.leave": 0x64748b,
  "member.role_add": 0x3b82f6,
  "member.role_remove": 0x94a3b8,
  "moderation.ban": 0xb91c1c,
  "moderation.unban": 0x22c55e,
  "moderation.kick": 0xf97316,
  "moderation.timeout": 0xeab308,
  "channel.create": 0x14b8a6,
  "channel.update": 0x38bdf8,
  "channel.delete": 0xef4444,
  "role.create": 0x8b5cf6,
  "role.update": 0xa78bfa,
  "role.delete": 0xef4444,
  "voice.join": 0x22c55e,
  "voice.leave": 0x64748b,
  "voice.move": 0x38bdf8
};

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
