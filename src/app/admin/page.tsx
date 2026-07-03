"use client";

import useSWR from "swr";
import type { Booking } from "@/lib/bookings";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminPage() {
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  const { data, error, isLoading } = useSWR(
    token ? `/api/bookings/admin?token=${token}` : null,
    fetcher
  );

  const bookings: Booking[] = data?.bookings ?? [];

  return (
    <main className="min-h-screen bg-eoe-ink px-4 py-16 text-eoe-ivory md:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl tracking-[0.18em]">
          Admin · Bookings
        </h1>
        <p className="mt-3 text-sm text-eoe-ivory/70">
          Lightweight, provider-agnostic view of all booking requests and payment
          states. Plug into Supabase or your preferred database without changing
          this UI.
        </p>

        {!token && (
          <p className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Set <code className="text-xs">NEXT_PUBLIC_ADMIN_TOKEN</code> in your
            environment to enable the admin view.
          </p>
        )}

        {error && (
          <p className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Failed to load bookings.
          </p>
        )}

        {isLoading && (
          <p className="mt-6 text-sm text-eoe-ivory/70">Loading bookings…</p>
        )}

        <div className="mt-8 space-y-4">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-eoe-ivory/12 bg-eoe-ink/60 px-5 py-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/70">
                    {b.date} · {b.space}
                  </p>
                  <p className="mt-1 font-medium text-eoe-ivory">
                    {b.eventType} · {b.guests} guests
                  </p>
                  <p className="mt-1 text-xs text-eoe-ivory/70">
                    {b.name} · {b.email}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p>
                    Status:{" "}
                    <span className="font-semibold uppercase">
                      {b.status}
                    </span>
                  </p>
                  <p className="mt-1">
                    Payment:{" "}
                    <span className="font-semibold">
                      {b.paymentStatus ?? "unpaid"}
                    </span>{" "}
                    ({b.paymentProvider ?? "manual"})
                  </p>
                </div>
              </div>
            </div>
          ))}

          {!isLoading && bookings.length === 0 && (
            <p className="text-sm text-eoe-ivory/60">
              No bookings yet. Once guests request dates, you&apos;ll see them
              here.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

