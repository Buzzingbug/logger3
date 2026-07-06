export default function DashboardPage() {
  return (
    <main className="workspace">
      <header>
        <p className="eyebrow">Phase 1</p>
        <h1>Dashboard Shell</h1>
      </header>
      <section className="grid">
        <article>
          <h2>Guilds</h2>
          <p>Discord OAuth guild selection lands here.</p>
        </article>
        <article>
          <h2>Logging</h2>
          <p>Per-event routes, toggles, ignores, and previews land here.</p>
        </article>
        <article>
          <h2>Diagnostics</h2>
          <p>Permissions, queues, and delivery health land here.</p>
        </article>
      </section>
    </main>
  );
}
