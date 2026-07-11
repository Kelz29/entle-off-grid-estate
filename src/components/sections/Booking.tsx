"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { AnimatePresence, motion } from "framer-motion";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1";

type EventType = {
  uri: string;
  name: string;
  slug: string;
  duration: number;
  color: string;
  description_plain: string;
  price_cents: number;
  location: string | null;
  exclusive: boolean;
  capacity: number;
};

type AvailableTime = {
  start_time: string; // zoned ISO, e.g. "2026-07-04T08:00:00+02:00"
  scheduling_url: string;
  invitees_remaining: number; // seats left (shared) or 1 (exclusive)
};

type Step = "service" | "slot" | "details";

function money(cents: number) {
  if (!cents) return "Free";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}

// The venue only takes bookings Fri–Sun; grey out Mon–Thu in the calendar.
// getDay(): Sun=0 … Sat=6 → open on Fri(5), Sat(6), Sun(0).
function isOpenDay(d: Date) {
  return [0, 5, 6].includes(d.getDay());
}

// Pull the wall-clock time straight from a zoned ISO string (already in the
// venue's timezone) — "2026-07-04T08:00:00+02:00" → "08:00".
function wallTime(iso: string) {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : iso;
}

export function Booking() {
  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<EventType[]>([]);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [service, setService] = useState<EventType | null>(null);

  const [date, setDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<AvailableTime[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<AvailableTime | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState("2");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seatWarn, setSeatWarn] = useState<{
    remaining: number;
    requested: number;
  } | null>(null);

  // Load event types.
  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/calendly/event_types?business_id=${BUSINESS_ID}&active=true`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setServices(data.collection ?? []);
      })
      .catch(() => alive && setServicesError("Unable to load bookable spaces."));
    return () => {
      alive = false;
    };
  }, []);

  // Fetch available times for the chosen date + service.
  const loadSlots = useCallback(
    async (svc: EventType, day: Date) => {
      setSlotsLoading(true);
      setSlots([]);
      setSlot(null);
      try {
        const start = new Date(day);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const url =
          `/api/v1/calendly/event_type_available_times` +
          `?event_type=${encodeURIComponent(svc.uri)}` +
          `&start_time=${encodeURIComponent(start.toISOString())}` +
          `&end_time=${encodeURIComponent(end.toISOString())}`;
        const res = await fetch(url);
        const data = await res.json();
        setSlots(res.ok ? data.collection ?? [] : []);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (service && date) loadSlots(service, date);
  }, [service, date, loadSlots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !slot) return;

    // Café slots are shared — don't let the party exceed the seats left.
    const wanted = Number(guests) || 1;
    if (!service.exclusive && wanted > slot.invitees_remaining) {
      setSeatWarn({ remaining: slot.invitees_remaining, requested: wanted });
      return;
    }

    setSubmitting(true);
    setError(null);

    // Reserve the slot + create a Yoco checkout, then hand off to Yoco's
    // hosted payment page. Confirmation happens on return via webhook.
    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: service.uri,
          start_time: slot.start_time,
          invitee: { name, email, phone: phone || undefined },
          guests: Number(guests) || 1,
          notes: notes || undefined,
        }),
      });
      if (res.status === 409) {
        setError("That time was just taken. Please pick another slot.");
        setStep("slot");
        if (service && date) loadSlots(service, date);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Unable to start payment.");
      }
      const { redirectUrl } = await res.json();
      window.location.href = redirectUrl; // → Yoco hosted checkout
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const dateLabel = useMemo(
    () =>
      date
        ? date.toLocaleDateString("en-ZA", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : null,
    [date]
  );

  return (
    <section
      id="booking"
      className="border-t border-eoe-espresso/10 bg-eoe-ivory px-4 py-20 md:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="text-xs tracking-[0.3em] text-eoe-espresso/70">
            ONLINE BOOKING
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-[0.18em] text-eoe-espresso md:text-4xl">
            Pick a space, pick a time.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-eoe-espresso/80">
            Choose an experience, select an available slot, and we&apos;ll hold
            it for you — Calendly-style. Bookings run{" "}
            <span className="font-medium text-eoe-espresso">
              Friday–Sunday, 11:00–18:00
            </span>
            . A R150 deposit secures your slot and comes off your bill on the
            day.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="overflow-hidden rounded-3xl border border-eoe-espresso/10 bg-white shadow-sm"
        >
          <div className="grid md:grid-cols-[300px_1fr]">
            {/* Left rail — selection summary (Calendly style) */}
            <aside className="border-b border-eoe-espresso/10 bg-eoe-espresso px-6 py-7 text-eoe-ivory md:border-b-0 md:border-r">
              <p className="text-[11px] uppercase tracking-[0.26em] text-eoe-ivory/60">
                Entle Off-Grid Estate
              </p>
              <h3 className="mt-3 font-display text-2xl tracking-wide">
                {service ? service.name : "Select an experience"}
              </h3>
              {service && (
                <>
                  <p className="mt-4 flex items-center gap-2 text-sm text-eoe-ivory/80">
                    <span aria-hidden>🕑</span> {service.duration} min
                  </p>
                  <p className="mt-1 flex items-start gap-2 text-sm text-eoe-ivory/80">
                    <span aria-hidden>💳</span>
                    <span>
                      {money(service.price_cents)} deposit
                      <span className="block text-xs text-eoe-ivory/55">
                        Goes towards your bill on arrival
                      </span>
                    </span>
                  </p>
                  {service.location && (
                    <p className="mt-1 flex items-start gap-2 text-sm text-eoe-ivory/80">
                      <span aria-hidden>📍</span> {service.location}
                    </p>
                  )}
                  {dateLabel && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-eoe-ivory/80">
                      <span aria-hidden>📅</span> {dateLabel}
                    </p>
                  )}
                  {slot && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-eoe-ivory/80">
                      <span aria-hidden>⏰</span> {wallTime(slot.start_time)}
                    </p>
                  )}
                  <p className="mt-6 text-xs leading-relaxed text-eoe-ivory/60">
                    {service.description_plain}
                  </p>
                </>
              )}
            </aside>

            {/* Right panel — step content */}
            <div className="px-6 py-7 md:px-8">
              {step === "service" && (
                <ServiceStep
                  services={services}
                  error={servicesError}
                  onPick={(s) => {
                    setService(s);
                    setStep("slot");
                  }}
                />
              )}

              {step === "slot" && service && (
                <SlotStep
                  date={date}
                  onDate={setDate}
                  slots={slots}
                  loading={slotsLoading}
                  selected={slot}
                  onSelectSlot={setSlot}
                  onBack={() => {
                    setStep("service");
                    setSlot(null);
                  }}
                  onNext={() => setStep("details")}
                />
              )}

              {step === "details" && service && slot && (
                <form onSubmit={handleSubmit} className="max-w-xl">
                  <button
                    type="button"
                    onClick={() => setStep("slot")}
                    className="mb-5 text-xs uppercase tracking-[0.22em] text-eoe-espresso/60 hover:text-eoe-espresso"
                  >
                    ← Back
                  </button>
                  <h4 className="font-display text-xl tracking-wide text-eoe-espresso">
                    Your details
                  </h4>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Full name" span2>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Phone (optional)">
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={20}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Guests">
                      <input
                        type="number"
                        min={1}
                        value={guests}
                        onChange={(e) => setGuests(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Notes (optional)" span2>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Anything we should know?"
                        className={`${inputCls} rounded-2xl`}
                      />
                    </Field>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-6 inline-flex items-center justify-center rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:cursor-not-allowed disabled:bg-eoe-espresso/40"
                  >
                    {submitting
                      ? "Redirecting to Yoco…"
                      : `Pay ${money(service.price_cents)} deposit & confirm`}
                  </button>
                  <p className="mt-3 text-[11px] text-eoe-espresso/50">
                    Your {money(service.price_cents)} deposit secures the
                    booking and is deducted from your bill when you arrive.
                    You&apos;ll be taken to Yoco&apos;s secure checkout — test
                    card 4111 1111 1111 1111, any future expiry &amp; CVV.
                  </p>
                  {error && (
                    <p className="mt-3 text-[12px] text-rose-600">{error}</p>
                  )}
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {seatWarn && slot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSeatWarn(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-eoe-ink/45 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-eoe-espresso/10 bg-white p-7 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
                ☕
              </div>
              <h4 className="mt-4 font-display text-2xl tracking-wide text-eoe-espresso">
                Almost full
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-eoe-espresso/75">
                The {wallTime(slot.start_time)} sitting has only{" "}
                <span className="font-semibold text-eoe-espresso">
                  {seatWarn.remaining} seat
                  {seatWarn.remaining === 1 ? "" : "s"}
                </span>{" "}
                left, but you&apos;ve asked for {seatWarn.requested}. Trim your
                party a little, or pick another time.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setGuests(String(seatWarn.remaining));
                    setSeatWarn(null);
                  }}
                  className="rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
                >
                  Book {seatWarn.remaining} seat
                  {seatWarn.remaining === 1 ? "" : "s"} instead
                </button>
                <button
                  onClick={() => {
                    setSeatWarn(null);
                    setStep("slot");
                  }}
                  className="rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-ivory"
                >
                  Choose another time
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const inputCls =
  "w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/40 px-4 py-2.5 text-sm text-eoe-espresso outline-none focus:border-eoe-espresso/50";

function Field({
  label,
  children,
  span2,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
        {label}
      </label>
      {children}
    </div>
  );
}

function ServiceStep({
  services,
  error,
  onPick,
}: {
  services: EventType[];
  error: string | null;
  onPick: (s: EventType) => void;
}) {
  return (
    <div>
      <h4 className="font-display text-xl tracking-wide text-eoe-espresso">
        Choose an experience
      </h4>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-5 grid gap-3">
        {services.map((s) => (
          <button
            key={s.uri}
            onClick={() => onPick(s)}
            className="group flex items-center justify-between rounded-2xl border border-eoe-espresso/12 px-5 py-4 text-left transition hover:border-eoe-espresso/40 hover:bg-eoe-ivory/50"
          >
            <span className="flex items-center gap-3">
              <span
                className="h-8 w-1.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span>
                <span className="block text-sm font-medium text-eoe-espresso">
                  {s.name}
                </span>
                <span className="block text-xs text-eoe-espresso/60">
                  {s.duration} min · {money(s.price_cents)}
                </span>
              </span>
            </span>
            <span className="text-eoe-espresso/40 transition group-hover:translate-x-1">
              →
            </span>
          </button>
        ))}
        {services.length === 0 && !error && (
          <p className="text-sm text-eoe-espresso/60">Loading experiences…</p>
        )}
      </div>
    </div>
  );
}

function SlotStep({
  date,
  onDate,
  slots,
  loading,
  selected,
  onSelectSlot,
  onBack,
  onNext,
}: {
  date: Date | null;
  onDate: (d: Date | null) => void;
  slots: AvailableTime[];
  loading: boolean;
  selected: AvailableTime | null;
  onSelectSlot: (s: AvailableTime) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 text-xs uppercase tracking-[0.22em] text-eoe-espresso/60 hover:text-eoe-espresso"
      >
        ← Back
      </button>
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="booking-calendar">
          <DatePicker
            selected={date}
            onChange={onDate}
            minDate={new Date()}
            filterDate={isOpenDay}
            inline
          />
        </div>
        <div className="min-w-[160px]">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
            {date ? "Available times" : "Select a date"}
          </p>
          {date && loading && (
            <p className="text-sm text-eoe-espresso/60">Loading…</p>
          )}
          {date && !loading && slots.length === 0 && (
            <p className="text-sm text-eoe-espresso/60">
              No times available on this day.
            </p>
          )}
          <div className="grid max-h-[280px] grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-3">
            {slots.map((s) => {
              const active = selected?.start_time === s.start_time;
              return (
                <button
                  key={s.start_time}
                  onClick={() => onSelectSlot(s)}
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    active
                      ? "border-eoe-espresso bg-eoe-espresso text-eoe-ivory"
                      : "border-eoe-espresso/20 text-eoe-espresso hover:border-eoe-espresso/50"
                  }`}
                >
                  {wallTime(s.start_time)}
                </button>
              );
            })}
          </div>
          {selected && (
            <button
              onClick={onNext}
              className="mt-5 inline-flex items-center justify-center rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
