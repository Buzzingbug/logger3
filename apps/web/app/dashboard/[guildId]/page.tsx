import Link from "next/link";
import { redirect } from "next/navigation";
import { LOG_EVENT_TYPES } from "@logger/shared";
import { getSession } from "../../../lib/session";

export default async function GuildDashboardPage({
  params
}: {
  params: Promise<{ guildId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { guildId } = await params;

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
          <h2>Routes</h2>
          <p>Channel routing controls land here next.</p>
        </article>
        <article>
          <h2>Ignored entities</h2>
          <p>Role, user, channel, bot, and webhook ignores land here next.</p>
        </article>
        <article>
          <h2>Diagnostics</h2>
          <p>Permission checks and queue health land here next.</p>
        </article>
      </section>

      <section className="eventList">
        {LOG_EVENT_TYPES.map((type) => (
          <div className="eventRow" key={type}>
            <span>{type}</span>
            <strong>Enabled</strong>
          </div>
        ))}
      </section>
    </main>
  );
}
