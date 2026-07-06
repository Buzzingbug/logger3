import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { LOG_EVENT_LABELS, LOG_EVENT_TYPES } from "@logger/shared";
import { createWebDb, guildSettings, logEvents } from "../../../lib/db";
import { getSession } from "../../../lib/session";

export default async function GuildDashboardPage({
  params
}: {
  params: Promise<{ guildId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { guildId } = await params;
  const db = process.env.DATABASE_URL ? createWebDb() : null;
  const settings = db
    ? await db.query.guildSettings.findFirst({ where: eq(guildSettings.guildId, guildId) })
    : null;
  const recentLogs = db
    ? await db.query.logEvents.findMany({
        where: eq(logEvents.guildId, guildId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        limit: 20
      })
    : [];

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Server</p>
          <h1>Logger setup</h1>
          <p className="copy">Guild ID: {guildId}</p>
        </div>
        <Link className="button secondary" href="/dashboard">
          Back
        </Link>
      </header>

      <section className="grid">
        <article>
          <h2>Default Channel</h2>
          <p>
            {settings?.defaultLogChannelId
              ? `<#${settings.defaultLogChannelId}>`
              : "Not configured"}
          </p>
        </article>
        <article>
          <h2>Retention</h2>
          <p>{settings?.retentionDays ?? 30} days</p>
        </article>
        <article>
          <h2>Recent Logs</h2>
          <p>{recentLogs.length} stored events</p>
        </article>
      </section>

      <section className="eventList">
        {LOG_EVENT_TYPES.map((type) => (
          <div className="eventRow" key={type}>
            <span>{LOG_EVENT_LABELS[type]}</span>
            <strong>Ready</strong>
          </div>
        ))}
      </section>

      <section className="eventList">
        {recentLogs.map((event) => (
          <div className="eventRow" key={event.id}>
            <span>{LOG_EVENT_LABELS[event.type]}</span>
            <strong>{event.createdAt.toLocaleString()}</strong>
          </div>
        ))}
      </section>
    </main>
  );
}
