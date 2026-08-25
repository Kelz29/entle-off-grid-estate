"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

// Shared UI for the cancel / failure return pages. On mount it releases the
// pending unpaid hold using the HMAC token issued at checkout.
export function ReleaseNotice({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const params = useParams<{ bookingId?: string }>();
  const search = useSearchParams();

  useEffect(() => {
    const idFromPath =
      typeof params.bookingId === "string" ? params.bookingId : null;
    const id = idFromPath ?? search.get("booking");
    const token = search.get("token");
    if (!id || !token) return;
    fetch("/api/bookings/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: id, token }),
    }).catch(() => {});
  }, [params.bookingId, search]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-eoe-ivory px-4">
      <div className="max-w-md rounded-3xl border border-eoe-espresso/10 bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-eoe-ivory text-2xl text-eoe-espresso/70">
          ↩
        </div>
        <h1 className="mt-5 font-display text-3xl tracking-wide text-eoe-espresso">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-eoe-ink/90">
          {message}
        </p>
        <Link
          href="/#booking"
          className="mt-7 inline-flex items-center justify-center rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
        >
          Try booking again
        </Link>
      </div>
    </main>
  );
}
