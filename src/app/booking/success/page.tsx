"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  name: string;
  start_time: string;
  status: string;
  payment_status: string;
  payment_amount_cents?: number | null;
  invitee: { email: string };
};

function money(cents?: number | null) {
  if (!cents) return "";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}

function pretty(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  const day = d.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${day} at ${m[4]}:${m[5]}`;
}

export default function BookingSuccessPage() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paid, setPaid] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("booking");
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!id) {
        setTimedOut(true);
        return;
      }
      tries += 1;
      try {
        const res = await fetch(`/api/v1/calendly/scheduled_events/${id}`);
        if (res.ok) {
          const { resource } = await res.json();
          setBooking(resource);
          if (resource.payment_status === "paid") {
            setPaid(true);
            return;
          }
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 15) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  return (
    <Shell>
      {paid && booking ? (
        <>
          <Badge tone="ok">✓</Badge>
          <h1 className="mt-5 font-display text-3xl tracking-wide text-eoe-espresso">
            Payment received
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-eoe-espresso/80">
            Thank you, {booking.name}. Your booking for{" "}
            <span className="font-medium">{pretty(booking.start_time)}</span> is
            confirmed and your {money(booking.payment_amount_cents)} deposit is
            paid — it&apos;ll be deducted from your bill when you arrive. A
            confirmation is noted for {booking.invitee.email}.
          </p>
        </>
      ) : timedOut ? (
        <>
          <Badge tone="wait">…</Badge>
          <h1 className="mt-5 font-display text-3xl tracking-wide text-eoe-espresso">
            Confirming your payment
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-eoe-espresso/80">
            Your payment went through and we&apos;re finalising the booking.
            This can take a moment — you&apos;ll receive confirmation shortly.
          </p>
        </>
      ) : (
        <>
          <Badge tone="wait">
            <span className="animate-pulse">•</span>
          </Badge>
          <h1 className="mt-5 font-display text-3xl tracking-wide text-eoe-espresso">
            Confirming your payment…
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-eoe-espresso/80">
            Please hold on while we confirm your deposit with Yoco.
          </p>
        </>
      )}
      <HomeLink />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-eoe-ivory px-4">
      <div className="max-w-md rounded-3xl border border-eoe-espresso/10 bg-white px-8 py-10 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "wait";
}) {
  const cls =
    tone === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-eoe-ivory text-eoe-espresso/60";
  return (
    <div
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${cls}`}
    >
      {children}
    </div>
  );
}

function HomeLink() {
  return (
    <Link
      href="/#booking"
      className="mt-7 inline-flex items-center justify-center rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-ivory"
    >
      Back to the estate
    </Link>
  );
}
