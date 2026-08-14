import Link from "next/link";
import { redirect } from "next/navigation";
import { getDiscordOAuthUrl } from "../../lib/discord";
import { createOAuthState } from "../../lib/session";

export default async function LoginPage() {
  const missingVars: string[] = [];

  if (!process.env.DISCORD_CLIENT_ID) missingVars.push("DISCORD_CLIENT_ID");
  if (!process.env.DISCORD_CLIENT_SECRET) missingVars.push("DISCORD_CLIENT_SECRET");
  if (!process.env.DISCORD_REDIRECT_URI) missingVars.push("DISCORD_REDIRECT_URI");
  if (!process.env.SESSION_SECRET) missingVars.push("SESSION_SECRET");

  if (missingVars.length === 0) {
    const state = await createOAuthState();
    redirect(getDiscordOAuthUrl(state));
  }

  return (
    <main className="container center">
      <div className="card text-center" style={{ maxWidth: "560px", margin: "2rem auto" }}>
        <h2>Discord OAuth Configuration Required</h2>
        <p style={{ marginTop: "0.5rem", color: "#9ca3af" }}>
          The dashboard requires the following environment variables to be configured in your Railway web service:
        </p>
        <ul style={{ textAlign: "left", margin: "1.5rem auto", maxWidth: "400px", listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {missingVars.map((v) => (
            <li key={v} style={{ color: "#f87171", fontFamily: "monospace", fontSize: "0.9rem" }}>
              ❌ {v}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          <Link href="/" className="btn btn-secondary">
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
