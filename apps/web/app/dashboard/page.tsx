import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchManageableGuilds, guildIconUrl } from "../../lib/discord";
import { getSession } from "../../lib/session";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const guilds = await fetchManageableGuilds(session.accessToken);

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
        {guilds.map((guild) => {
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
        })}
      </section>
    </main>
  );
}
