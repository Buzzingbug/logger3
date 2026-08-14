import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  IGNORED_ENTITY_TYPES,
  LOG_EVENT_LABELS,
  LOG_EVENT_TYPES,
  type IgnoredEntityType
} from "@logger/shared";
import {
  createWebDb,
  guildLogRoutes,
  guildSettings,
  ignoredEntities,
  logEvents
} from "../../../lib/db";
import { getSession } from "../../../lib/session";
import { getGuildDiagnostics } from "../../../lib/bot-discord";

export const dynamic = "force-dynamic";

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
  const routes = db
    ? await db.query.guildLogRoutes.findMany({ where: eq(guildLogRoutes.guildId, guildId) })
    : [];
  const ignored = db
    ? await db.query.ignoredEntities.findMany({
        where: eq(ignoredEntities.guildId, guildId),
        orderBy: (table, { asc }) => [asc(table.entityType), asc(table.entityId)]
      })
    : [];
  const recentLogs = db
    ? await db.query.logEvents.findMany({
        where: eq(logEvents.guildId, guildId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        limit: 20
      })
    : [];

  async function saveSettings(formData: FormData) {
    "use server";
    await requireSession();
    const writeDb = createWebDb();
    const defaultLogChannelId = cleanSnowflake(formData.get("defaultLogChannelId"));
    const retentionDays = clamp(Number(formData.get("retentionDays") ?? 30), 1, 365);

    await writeDb
      .insert(guildSettings)
      .values({ guildId, defaultLogChannelId, retentionDays })
      .onConflictDoUpdate({
        target: guildSettings.guildId,
        set: { defaultLogChannelId, retentionDays, updatedAt: new Date() }
      });

    revalidatePath(`/dashboard/${guildId}`);
  }

  async function saveRoutes(formData: FormData) {
    "use server";
    await requireSession();
    const writeDb = createWebDb();

    for (const type of LOG_EVENT_TYPES) {
      const enabled = formData.get(`${type}:enabled`) === "on";
      const channelId = cleanSnowflake(formData.get(`${type}:channelId`));
      await writeDb
        .insert(guildLogRoutes)
        .values({ guildId, type, enabled, channelId })
        .onConflictDoUpdate({
          target: [guildLogRoutes.guildId, guildLogRoutes.type],
          set: { enabled, channelId, updatedAt: new Date() }
        });
    }

    revalidatePath(`/dashboard/${guildId}`);
  }

  async function addIgnoreRule(formData: FormData) {
    "use server";
    await requireSession();
    const writeDb = createWebDb();
    const entityType = cleanIgnoreType(formData.get("entityType"));
    const entityId = cleanIgnoredEntityId(entityType, formData.get("entityId"));
    const reason = cleanReason(formData.get("reason"));

    if (!entityType || !entityId) return;

    await writeDb
      .insert(ignoredEntities)
      .values({ guildId, entityType, entityId, reason })
      .onConflictDoUpdate({
        target: [ignoredEntities.guildId, ignoredEntities.entityType, ignoredEntities.entityId],
        set: { reason }
      });

    revalidatePath(`/dashboard/${guildId}`);
  }

  async function removeIgnoreRule(formData: FormData) {
    "use server";
    await requireSession();
    const writeDb = createWebDb();
    const entityType = cleanIgnoreType(formData.get("entityType"));
    const entityId = cleanIgnoredEntityId(entityType, formData.get("entityId"));

    if (!entityType || !entityId) return;

    await writeDb
      .delete(ignoredEntities)
      .where(eq(ignoredEntities.id, String(formData.get("ignoreId") ?? "")));

    revalidatePath(`/dashboard/${guildId}`);
  }

  const routeMap = new Map(routes.map((route) => [route.type, route]));
  const diagnosticChannelIds = [
    settings?.defaultLogChannelId,
    ...routes.filter((route) => route.enabled).map((route) => route.channelId)
  ];
  const diagnostics = await getGuildDiagnostics(guildId, diagnosticChannelIds);
  const botInviteUrl = process.env.DISCORD_CLIENT_ID
    ? `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guildId}&disable_guild_select=true`
    : null;

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Server Configuration</p>
          <h1>Server Logger Dashboard</h1>
          <p className="copy">Guild ID: {guildId}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {botInviteUrl && (
            <a
              href={botInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button"
              style={{ background: "#5865F2", color: "#fff" }}
            >
              {diagnostics.botPresent ? "Re-authorize Bot" : "➕ Invite Bot to Server"}
            </a>
          )}
          <Link className="button secondary" href="/dashboard">
            Back to Servers
          </Link>
        </div>
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
          <h2>Retention Period</h2>
          <p>{settings?.retentionDays ?? 30} days</p>
        </article>
        <article>
          <h2>Stored Audit Logs</h2>
          <p>{recentLogs.length} recent events</p>
        </article>
      </section>

      <section className="diagnostics" aria-label="Bot diagnostics">
        <div>
          <p className="eyebrow">Bot Diagnostics</p>
          <h2>{diagnostics.state === "ready" ? "🟢 Ready to log events" : "🟡 Needs setup attention"}</h2>
        </div>
        <div className="diagnosticChecks">
          <DiagnosticCheck label="Bot is in this server" passed={diagnostics.botPresent} />
          <DiagnosticCheck
            label="View Audit Log permission"
            passed={diagnostics.auditLog}
            unavailable={diagnostics.auditLog === null}
          />
          {diagnostics.channels.map((channel) => (
            <DiagnosticCheck
              key={channel.id}
              label={`Log channel ${channel.id}`}
              passed={channel.canView && channel.canSend && channel.canEmbed}
            />
          ))}
        </div>
      </section>

      <h2 style={{ marginTop: "2rem" }}>⚙️ General Settings</h2>
      <form className="configForm" action={saveSettings}>
        <label>
          Default Log Channel ID (Discord Snowflake)
          <input
            name="defaultLogChannelId"
            defaultValue={settings?.defaultLogChannelId ?? ""}
            placeholder="e.g. 123456789012345678"
          />
        </label>
        <label>
          Log Retention (Days)
          <input
            name="retentionDays"
            type="number"
            min="1"
            max="365"
            defaultValue={settings?.retentionDays ?? 30}
          />
        </label>
        <button className="button" type="submit">
          Save Settings
        </button>
      </form>

      <h2 style={{ marginTop: "2rem" }}>📋 Event Logging Routes</h2>
      <form className="eventList" action={saveRoutes}>
        {LOG_EVENT_TYPES.map((type) => {
          const route = routeMap.get(type);
          return (
            <div className="routeRow" key={type}>
              <label className="toggleLine">
                <input
                  name={`${type}:enabled`}
                  type="checkbox"
                  defaultChecked={route?.enabled ?? true}
                />
                <span>{LOG_EVENT_LABELS[type]}</span>
              </label>
              <input
                name={`${type}:channelId`}
                defaultValue={route?.channelId ?? ""}
                placeholder="Optional specific channel ID (overrides default)"
              />
            </div>
          );
        })}
        <button className="button" type="submit" style={{ margin: "1rem 0" }}>
          Save Event Routes
        </button>
      </form>

      <h2 style={{ marginTop: "2rem" }}>🚫 Ignored Entities (Ignore Users/Bots/Channels/Roles)</h2>
      <section className="ignorePanel">
        <form className="configForm" action={addIgnoreRule}>
          <label>
            Ignore Entity Type
            <select name="entityType" defaultValue="user">
              {IGNORED_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entity Discord ID
            <input name="entityId" placeholder="User, role, or channel ID. Use * for all bots." />
          </label>
          <label>
            Reason
            <input name="reason" placeholder="e.g. Music bot spam" />
          </label>
          <button className="button" type="submit">
            Add Ignore Rule
          </button>
        </form>

        <div className="eventList">
          {ignored.length === 0 ? (
            <div className="eventRow">
              <span>No ignored entities configured</span>
              <strong>Active capture on all entities</strong>
            </div>
          ) : (
            ignored.map((entry) => (
              <form className="ignoreRow" action={removeIgnoreRule} key={entry.id}>
                <input name="ignoreId" type="hidden" value={entry.id} />
                <input name="entityType" type="hidden" value={entry.entityType} />
                <input name="entityId" type="hidden" value={entry.entityId} />
                <span>{entry.entityType}</span>
                <span>{entry.entityId}</span>
                <span>{entry.reason ?? "No reason"}</span>
                <button className="button secondary" type="submit">
                  Remove
                </button>
              </form>
            ))
          )}
        </div>
      </section>

      <h2 style={{ marginTop: "2rem" }}>📜 Recent Stored Logs Stream</h2>
      <section className="eventList">
        {recentLogs.length === 0 ? (
          <div className="eventRow">
            <span>No log events recorded yet</span>
            <strong>Listening for Discord events...</strong>
          </div>
        ) : (
          recentLogs.map((event) => (
            <div className="eventRow" key={event.id}>
              <span>{LOG_EVENT_LABELS[event.type]}</span>
              <strong>{event.createdAt.toLocaleString()}</strong>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
}

function cleanSnowflake(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return /^\d{15,25}$/.test(text) ? text : null;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function cleanIgnoreType(value: FormDataEntryValue | null): IgnoredEntityType | null {
  return IGNORED_ENTITY_TYPES.find((type) => type === value) ?? null;
}

function cleanIgnoredEntityId(
  entityType: IgnoredEntityType | null,
  value: FormDataEntryValue | null
) {
  const text = String(value ?? "").trim();
  if (!entityType) return null;
  if (entityType === "bot") return text === "*" ? "*" : null;
  return /^\d{15,25}$/.test(text) ? text : null;
}

function cleanReason(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text.slice(0, 200) : null;
}

function DiagnosticCheck({
  label,
  passed,
  unavailable = false
}: {
  label: string;
  passed: boolean | null;
  unavailable?: boolean;
}) {
  const status = unavailable ? "Not checked" : passed ? "Ready" : "Action needed";
  return (
    <div className="diagnosticCheck">
      <span>{label}</span>
      <strong className={passed ? "ok" : "warn"}>{status}</strong>
    </div>
  );
}
