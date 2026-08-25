"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeAdminNext } from "@/lib/safe-next";

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeAdminNext(search.get("next"));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Login failed"
        );
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-eoe-ivory px-4">
      <div className="w-full max-w-md rounded-3xl border border-eoe-espresso/10 bg-white px-8 py-10 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-eoe-espresso">
          Management
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-[0.12em] text-eoe-ink">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-eoe-ink">
          Access bookings, seats, and guest requests for Entle Off Grid Estate.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="admin-username"
              className="mb-1 block text-xs uppercase tracking-[0.2em] text-eoe-espresso"
            >
              Username
            </label>
            <input
              id="admin-username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/50 px-4 py-2.5 text-sm text-eoe-ink outline-none focus:border-eoe-espresso"
              required
            />
          </div>
          <div>
            <label
              htmlFor="admin-password"
              className="mb-1 block text-xs uppercase tracking-[0.2em] text-eoe-espresso"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/50 px-4 py-2.5 text-sm text-eoe-ink outline-none focus:border-eoe-espresso"
              required
            />
          </div>

          {error && (
            <p
              className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
