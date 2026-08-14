import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchManageableGuilds, guildIconUrl, type DiscordGuild } from "../../lib/discord";
import { getSession } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let guilds: DiscordGuild[] = [];
  try {
    guilds = await fetchManageableGuilds(session.accessToken);
  } catch (error) {
    console.error("Failed to fetch guilds with session accessToken:", error);
    redirect("/api/auth/logout");
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Select a server</h1>
          <p className="copy">
            Signed in as {session.displayName}. Showing servers you can manage.
          </p>
        </div>
        <Link className="button secondary" href="/api/auth/logout">
          Logout
        </Link>
      </header>

      <section className="guildGrid">
        {guilds.length === 0 ? (
          <div className="card text-center" style={{ gridColumn: "1 / -1", padding: "3rem" }}>
            <h2>No Manageable Servers Found</h2>
            <p style={{ marginTop: "0.5rem", color: "#9ca3af" }}>
              Make sure you have &quot;Manage Server&quot; or &quot;Administrator&quot; permissions in your Discord servers.
            </p>
          </div>
        ) : (
          guilds.map((guild) => {
            const iconUrl = guildIconUrl(guild);
            return (
              <Link className="guildCard" href={`/dashboard/${guild.id}`} key={guild.id}>
                {iconUrl ? <img src={iconUrl} alt="" /> : <span>{guild.name.slice(0, 2)}</span>}
                <div>
                  <h2>{guild.name}</h2>
                  <p>{guild.owner ? "Owner" : "Manage Server"}</p>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}
