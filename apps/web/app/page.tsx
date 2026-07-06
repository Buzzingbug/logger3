import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Discord Logger</p>
        <h1>Server logging built for serious communities.</h1>
        <p className="copy">
          Configure logs, retention, ignored entities, and diagnostics from one dashboard.
        </p>
        <div className="actions">
          <Link href="/dashboard">Open Dashboard</Link>
          <Link href="/login">Discord Login</Link>
        </div>
      </section>
    </main>
  );
}
