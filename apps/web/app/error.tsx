"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container center">
      <div className="card text-center">
        <h1>Something went wrong</h1>
        <p>{error.message || "An unexpected error occurred."}</p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
