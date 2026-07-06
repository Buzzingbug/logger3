export default function LoginPage() {
  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  const redirectUri = process.env.DISCORD_REDIRECT_URI ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds"
  });

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Login</p>
        <h1>Discord OAuth Required</h1>
        <p className="copy">Connect Discord to manage servers where you have permission.</p>
        <div className="actions">
          <a href={`https://discord.com/oauth2/authorize?${params.toString()}`}>Continue with Discord</a>
        </div>
      </section>
    </main>
  );
}
