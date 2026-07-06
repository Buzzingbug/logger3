import type { Client } from "discord.js";
import { logEvents, type createDb } from "@logger/db";
import type { LogDeliveryJob, LogEventType, LogPayload } from "@logger/shared";
import type { Queue } from "bullmq";

type Db = ReturnType<typeof createDb>;

export type CaptureLogInput = {
  type: LogEventType;
  guildId: string;
  actorId?: string | null;
  targetId?: string | null;
  channelId?: string | null;
  messageId?: string | null;
  payload?: LogPayload;
};

export async function captureLog(db: Db, queue: Queue<LogDeliveryJob>, input: CaptureLogInput) {
  const [event] = await db
    .insert(logEvents)
    .values({
      guildId: input.guildId,
      type: input.type,
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      channelId: input.channelId ?? null,
      messageId: input.messageId ?? null,
      payload: input.payload ?? {}
    })
    .returning({ id: logEvents.id });

  if (!event) throw new Error("Failed to create log event");

  await queue.add(
    input.type,
    { logEventId: event.id, guildId: input.guildId },
    { attempts: 5, backoff: { type: "exponential", delay: 3000 } }
  );
  return event.id;
}

export function userTag(user: { id: string; tag?: string | null; username?: string | null }) {
  return user.tag ?? user.username ?? user.id;
}

export function channelName(channel: { id: string; name?: string | null }) {
  return channel.name ? `#${channel.name}` : channel.id;
}

export function botUserId(client: Client) {
  return client.user?.id ?? null;
}
