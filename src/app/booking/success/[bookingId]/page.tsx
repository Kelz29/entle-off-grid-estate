"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

const REDIRECT_SECONDS = 15;
const HOME_HREF = "/#booking";

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
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const bookingId =
    typeof params.bookingId === "string" ? params.bookingId : "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [paid, setPaid] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const trackedOutcome = useRef(false);

  const settled = paid || timedOut;

  useEffect(() => {
    if (!bookingId) {
      setTimedOut(true);
      return;
    }
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const poll = async () => {
      tries += 1;
      try {
        // Ask the server to confirm with Yoco (covers localhost without a
        // reachable webhook). Idempotent once the booking is paid.
        await fetch("/api/bookings/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });

        const res = await fetch(
          `/api/v1/calendly/scheduled_events/${encodeURIComponent(bookingId)}`
        );
        if (res.ok) {
          const { resource } = await res.json();
          if (cancelled) return;
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
        if (!cancelled) setTimedOut(true);
        return;
      }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bookingId]);

  // After any terminal status, count down then return to the site.
  useEffect(() => {
    if (!settled) return;
    if (!trackedOutcome.current) {
      trackedOutcome.current = true;
      if (paid) {
        trackEvent(AnalyticsEvents.BookingPaymentReceived, {
          amount_cents: booking?.payment_amount_cents ?? null,
        });
      } else {
        trackEvent(AnalyticsEvents.BookingPaymentPending);
      }
    }
    setSecondsLeft(REDIRECT_SECONDS);
    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(tick);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [settled, paid, booking?.payment_amount_cents]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    router.replace(HOME_HREF);
  }, [secondsLeft, router]);

  return (
    <Shell>
      {paid && booking ? (
        <>
          <Badge tone="ok">✓</Badge>
          <h1 className="mt-5 font-display text-3xl tracking-wide text-eoe-espresso">
            Payment received
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-eoe-ink/90">
            Thank you, {booking.name}. Your booking for{" "}
            <span className="font-medium">{pretty(booking.start_time)}</span> is
            confirmed and your {money(booking.payment_amount_cents)} deposit is
            paid. It&apos;ll be deducted from your bill when you arrive. A
            confirmation is noted for {booking.invitee.email}.
          </p>
        </>
      ) : timedOut ? (
        <>
          <Badge tone="wait">…</Badge>
          <h1 className="mt-5 font-display text-3xl tracking-wide text-eoe-espresso">
            Confirming your payment
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-eoe-ink/90">
            Your payment went through and we&apos;re finalising the booking.
            This can take a moment. You&apos;ll receive confirmation shortly.
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
          <p className="mt-3 text-sm leading-relaxed text-eoe-ink/90">
            Please hold on while we confirm your deposit with Yoco.
          </p>
        </>
      )}
      {settled && secondsLeft != null && (
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
          Returning to the site in {secondsLeft} seconds
        </p>
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
    tone === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-eoe-ivory text-eoe-espresso/80";
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
      href={HOME_HREF}
      className="mt-7 inline-flex items-center justify-center rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-ivory"
    >
      Back to the estate
    </Link>
  );
}
