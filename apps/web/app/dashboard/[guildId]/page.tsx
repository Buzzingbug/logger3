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

      <form className="configForm" action={saveSettings}>
        <label>
          Default log channel ID
          <input
            name="defaultLogChannelId"
            defaultValue={settings?.defaultLogChannelId ?? ""}
            placeholder="123456789012345678"
          />
        </label>
        <label>
          Retention days
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
                placeholder="Optional channel ID"
              />
            </div>
          );
        })}
        <button className="button" type="submit">
          Save Routes
        </button>
      </form>

      <section className="ignorePanel">
        <form className="configForm" action={addIgnoreRule}>
          <label>
            Ignore type
            <select name="entityType" defaultValue="user">
              {IGNORED_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entity ID
            <input name="entityId" placeholder="User, role, or channel ID. Use * for bots." />
          </label>
          <label>
            Reason
            <input name="reason" placeholder="Optional note" />
          </label>
          <button className="button" type="submit">
            Add Ignore Rule
          </button>
        </form>

        <div className="eventList">
          {ignored.length === 0 ? (
            <div className="eventRow">
              <span>No ignore rules yet</span>
              <strong>Active capture</strong>
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
