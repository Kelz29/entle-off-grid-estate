"use client";

import { useCallback, useEffect, useMemo, useState, cloneElement, isValidElement } from "react";
import DatePicker from "react-datepicker";
import { AnimatePresence, motion } from "framer-motion";
import {
  CAR_TYPES,
  carWashMinimumCents,
  isCarWashService,
  MAX_CARS_PER_SESSION,
  type CarTypeId,
} from "@/lib/calendly/car-wash";
import {
  bookingDepositCents,
  PLATFORM_FEE_CENTS,
} from "@/lib/calendly/pricing";
import {
  emailError,
  normalizeEmail,
  phoneError,
} from "@/lib/contact-validation";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";
import {
  bookingPhoneOnly,
  BOOKING_PHONE,
  BOOKING_PHONE_HREF,
} from "@/lib/booking-config";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1";
const DEFAULT_CAR_TYPE: CarTypeId = "sedan";

function money(cents: number) {
  if (!cents) return "Free";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}

function resizeCarTypes(prev: CarTypeId[], count: number): CarTypeId[] {
  const n = Math.min(MAX_CARS_PER_SESSION, Math.max(1, count));
  if (prev.length === n) return prev;
  if (prev.length > n) return prev.slice(0, n);
  return [
    ...prev,
    ...Array.from({ length: n - prev.length }, () => DEFAULT_CAR_TYPE),
  ];
}

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
  start_time: string;
  scheduling_url: string;
  invitees_remaining: number;
};

type Step = "service" | "slot" | "details";

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
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    phone?: string;
  }>({});
  const [carTypes, setCarTypes] = useState<CarTypeId[]>([DEFAULT_CAR_TYPE]);
  const [specialRequest, setSpecialRequest] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seatWarn, setSeatWarn] = useState<{
    remaining: number;
    requested: number;
  } | null>(null);
  // Non-refundable deposit notice shown before handing off to Yoco.
  const [confirmPay, setConfirmPay] = useState(false);
  const [callToBook, setCallToBook] = useState(false);
  const phoneOnly = bookingPhoneOnly();

  useEffect(() => {
    if (!confirmPay && !seatWarn && !callToBook) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmPay) setConfirmPay(false);
      if (seatWarn) setSeatWarn(null);
      if (callToBook) setCallToBook(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmPay, seatWarn, callToBook]);

  const guestCount = Math.max(1, Math.trunc(Number(guests)) || 1);
  const needsCars = isCarWashService(service?.slug);
  const washMinimum = needsCars ? carWashMinimumCents(carTypes) : 0;
  const depositTotal = service
    ? bookingDepositCents({
        priceCents: service.price_cents,
        guests: guestCount,
        serviceSlug: service.slug,
        carTypes: needsCars ? carTypes : null,
      })
    : 0;

  // Load event types.
  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/calendly/event_types?business_id=${BUSINESS_ID}&active=true`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Unable to load bookable spaces."
          );
        }
        return data;
      })
      .then((data) => {
        if (!alive) return;
        setServices(data.collection ?? []);
        setServicesError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setServicesError(
          err instanceof Error ? err.message : "Unable to load bookable spaces."
        );
      });
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

    const nextErrors: { email?: string; phone?: string } = {};
    const emailIssue = emailError(email);
    if (emailIssue) nextErrors.email = emailIssue;
    const phoneIssue = phoneError(phone);
    if (phoneIssue) nextErrors.phone = phoneIssue;
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.phone) {
      setError("Please fix the highlighted fields.");
      return;
    }

    // Café slots are shared — don't let the party exceed the seats left.
    if (!service.exclusive && guestCount > slot.invitees_remaining) {
      setSeatWarn({
        remaining: slot.invitees_remaining,
        requested: guestCount,
      });
      return;
    }

    if (needsCars && (carTypes.length < 1 || carTypes.length > MAX_CARS_PER_SESSION)) {
      setError(`Please choose between 1 and ${MAX_CARS_PER_SESSION} cars.`);
      return;
    }
    setError(null);
    if (phoneOnly) {
      trackEvent(AnalyticsEvents.BookingDetailsOpened, {
        service: service.name,
        mode: "phone_only",
      });
      setCallToBook(true);
      return;
    }
    setConfirmPay(true);
    trackEvent(AnalyticsEvents.BookingPayIntent, {
      service: service.name,
      guests: guestCount,
      amount_cents: depositTotal,
    });
  };

  const startCheckout = async () => {
    if (!service || !slot) return;
    setConfirmPay(false);
    setSubmitting(true);
    setError(null);
    trackEvent(AnalyticsEvents.BookingCheckoutStarted, {
      service: service.name,
      guests: guestCount,
      amount_cents: depositTotal,
    });

    // Reserve the slot + create a Yoco checkout, then hand off to Yoco's
    // hosted payment page. Confirmation happens on return via webhook.
    try {
      const res = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: service.uri,
          start_time: slot.start_time,
          invitee: {
            name,
            email: normalizeEmail(email),
            phone: phone.trim() || undefined,
          },
          guests: guestCount,
          ...(needsCars ? { car_types: carTypes } : {}),
          special_request: specialRequest.trim() || undefined,
        }),
      });
      if (res.status === 409) {
        trackEvent(AnalyticsEvents.BookingCheckoutFailed, {
          reason: "slot_taken",
          service: service.name,
        });
        setError("That time was just taken. Please pick another slot.");
        setStep("slot");
        if (service && date) loadSlots(service, date);
        setSubmitting(false);
        return;
      }
      if (res.status === 429) {
        trackEvent(AnalyticsEvents.BookingCheckoutFailed, {
          reason: "rate_limited",
          service: service.name,
        });
        setError("Too many attempts. Please wait a moment and try again.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        trackEvent(AnalyticsEvents.BookingCheckoutFailed, {
          reason: "checkout_error",
          status: res.status,
          service: service.name,
        });
        throw new Error(body.detail ?? "Unable to start payment.");
      }
      const { redirectUrl } = await res.json();
      if (!redirectUrl || typeof redirectUrl !== "string") {
        trackEvent(AnalyticsEvents.BookingCheckoutFailed, {
          reason: "missing_redirect",
          service: service.name,
        });
        throw new Error("Unable to start payment.");
      }
      trackEvent(AnalyticsEvents.BookingRedirectYoco, {
        service: service.name,
        guests: guestCount,
        amount_cents: depositTotal,
      });
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
          <p className="text-xs tracking-[0.3em] text-eoe-espresso">
            ONLINE BOOKING
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-[0.18em] text-eoe-espresso md:text-4xl">
            Pick a space, pick a time.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-eoe-ink/90">
            {phoneOnly ? (
              <>
                Choose an experience and time below, then{" "}
                <span className="font-medium text-eoe-espresso">
                  call us to confirm
                </span>
                . Online card payment is under maintenance. Bookings run{" "}
                <span className="font-medium text-eoe-espresso">
                  Friday to Sunday, 11:00 to 18:00
                </span>
                .
              </>
            ) : (
              <>
                Choose an experience, select an available slot, and we&apos;ll hold
                it for you. Bookings run{" "}
                <span className="font-medium text-eoe-espresso">
                  Friday to Sunday, 11:00 to 18:00
                </span>
                . A R100 per guest deposit secures your slot and comes off your
                bill on the day, plus a R30 platform fee. Cafe with car wash adds
                the wash minimum for each car by type.
              </>
            )}
          </p>
          {phoneOnly && (
            <p className="mt-3 max-w-md rounded-2xl border border-eoe-espresso/15 bg-eoe-espresso/5 px-4 py-3 text-sm text-eoe-espresso">
              Call{" "}
              <a
                href={BOOKING_PHONE_HREF}
                onClick={() => trackEvent(AnalyticsEvents.ContactPhone)}
                className="font-semibold underline underline-offset-2"
              >
                {BOOKING_PHONE}
              </a>{" "}
              to book — have your chosen date, time, and guest count ready.
            </p>
          )}
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
              <p className="text-[11px] uppercase tracking-[0.26em] text-eoe-ivory/80">
                Entle Off Grid Estate
              </p>
              <h3 className="mt-3 font-display text-2xl tracking-wide">
                {service ? service.name : "Select an experience"}
              </h3>
              {service && (
                <>
                  <p className="mt-4 flex items-center gap-2 text-sm text-eoe-ivory/95">
                    <span aria-hidden>🕑</span> {service.duration} min
                  </p>
                  <p className="mt-1 flex items-start gap-2 text-sm text-eoe-ivory/95">
                    <span aria-hidden>💳</span>
                    <span>
                      {money(service.price_cents)} deposit per guest
                      {needsCars && washMinimum > 0 && (
                        <span className="block text-xs text-eoe-ivory/75">
                          + {money(washMinimum)} car wash minimum
                        </span>
                      )}
                      <span className="block text-xs text-eoe-ivory/75">
                        Non refundable, comes off your bill on arrival.
                      </span>
                    </span>
                  </p>
                  {service.location && (
                    <p className="mt-1 flex items-start gap-2 text-sm text-eoe-ivory/95">
                      <span aria-hidden>📍</span> {service.location}
                    </p>
                  )}
                  {dateLabel && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-eoe-ivory/95">
                      <span aria-hidden>📅</span> {dateLabel}
                    </p>
                  )}
                  {slot && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-eoe-ivory/95">
                      <span aria-hidden>⏰</span> {wallTime(slot.start_time)}
                    </p>
                  )}
                  <p className="mt-6 text-xs leading-relaxed text-eoe-ivory/80">
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
                    setCarTypes([DEFAULT_CAR_TYPE]);
                    setError(null);
                    setStep("slot");
                    trackEvent(AnalyticsEvents.BookingExperienceSelected, {
                      service: s.name,
                      slug: s.slug,
                      price_cents: s.price_cents,
                    });
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
                  onSelectSlot={(s) => {
                    setSlot(s);
                    trackEvent(AnalyticsEvents.BookingSlotSelected, {
                      service: service.name,
                      start_time: s.start_time,
                    });
                  }}
                  onBack={() => {
                    setStep("service");
                    setSlot(null);
                  }}
                  onNext={() => {
                    setStep("details");
                    trackEvent(AnalyticsEvents.BookingDetailsOpened, {
                      service: service.name,
                    });
                  }}
                />
              )}

              {step === "details" && service && slot && (
                <form onSubmit={handleSubmit} className="max-w-xl">
                  <button
                    type="button"
                    onClick={() => setStep("slot")}
                    className="mb-5 text-xs uppercase tracking-[0.22em] text-eoe-espresso/80 hover:text-eoe-espresso"
                  >
                    ← Back
                  </button>
                  <h4 className="font-display text-xl tracking-wide text-eoe-espresso">
                    Your details
                  </h4>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field id="booking-name" label="Full name" span2>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className={inputCls}
                      />
                    </Field>
                    <Field
                      id="booking-email"
                      label="Email"
                      error={fieldErrors.email}
                    >
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (fieldErrors.email) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              email: undefined,
                            }));
                          }
                        }}
                        onBlur={() => {
                          const msg = emailError(email);
                          setFieldErrors((prev) => ({
                            ...prev,
                            email: msg ?? undefined,
                          }));
                        }}
                        required
                        aria-invalid={Boolean(fieldErrors.email)}
                        className={inputCls}
                      />
                    </Field>
                    <Field
                      id="booking-phone"
                      label="Phone (optional)"
                      error={fieldErrors.phone}
                    >
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (fieldErrors.phone) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              phone: undefined,
                            }));
                          }
                        }}
                        onBlur={() => {
                          const msg = phoneError(phone);
                          setFieldErrors((prev) => ({
                            ...prev,
                            phone: msg ?? undefined,
                          }));
                        }}
                        maxLength={20}
                        placeholder="e.g. 067 366 2302"
                        aria-invalid={Boolean(fieldErrors.phone)}
                        className={inputCls}
                      />
                    </Field>
                    <Field id="booking-guests" label="Guests">
                      <input
                        type="number"
                        min={1}
                        value={guests}
                        onChange={(e) => setGuests(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    {needsCars && (
                      <>
                        <Field
                          id="booking-cars"
                          label={`Cars to wash (max ${MAX_CARS_PER_SESSION})`}
                        >
                          <input
                            type="number"
                            min={1}
                            max={MAX_CARS_PER_SESSION}
                            value={carTypes.length}
                            onChange={(e) => {
                              const n = Math.trunc(Number(e.target.value)) || 1;
                              setCarTypes((prev) => resizeCarTypes(prev, n));
                            }}
                            required
                            className={inputCls}
                          />
                        </Field>
                        {carTypes.map((typeId, i) => (
                          <Field
                            key={i}
                            id={`booking-car-type-${i}`}
                            label={`Car ${i + 1} type`}
                            span2={carTypes.length === 1}
                          >
                            <select
                              value={typeId}
                              onChange={(e) => {
                                const next = e.target.value as CarTypeId;
                                setCarTypes((prev) =>
                                  prev.map((t, idx) => (idx === i ? next : t))
                                );
                              }}
                              className={inputCls}
                              required
                            >
                              {CAR_TYPES.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label} (from {money(t.min_cents)})
                                </option>
                              ))}
                            </select>
                          </Field>
                        ))}
                      </>
                    )}
                    <Field id="booking-special" label="Special request (optional)" span2>
                      <textarea
                        value={specialRequest}
                        onChange={(e) => setSpecialRequest(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Anniversary, birthday, proposal, flowers, dietary needs…"
                        className={`${inputCls} rounded-2xl`}
                      />
                    </Field>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-6 inline-flex items-center justify-center rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:cursor-not-allowed disabled:bg-eoe-espresso/40"
                  >
                    {phoneOnly
                      ? "Continue — call to confirm"
                      : submitting
                        ? "Redirecting to Yoco…"
                        : `Pay ${money(depositTotal)} deposit & confirm`}
                  </button>
                  <p className="mt-3 text-[11px] text-eoe-espresso/70">
                    {phoneOnly ? (
                      <>
                        Pick your slot above, then call{" "}
                        <a
                          href={BOOKING_PHONE_HREF}
                          onClick={() => trackEvent(AnalyticsEvents.ContactPhone)}
                          className="font-medium text-eoe-espresso underline underline-offset-2"
                        >
                          {BOOKING_PHONE}
                        </a>{" "}
                        with your name, party size, and any special requests.
                      </>
                    ) : (
                      <>
                        Your {money(depositTotal)} total (
                        {money(service.price_cents)} × {guestCount}{" "}
                        {guestCount === 1 ? "guest" : "guests"}
                        {needsCars && washMinimum > 0
                          ? ` + ${money(washMinimum)} car wash minimum`
                          : ""}
                        {` + ${money(PLATFORM_FEE_CENTS)} platform fee`}
                        ). The deposit portion comes off your bill on arrival.
                        You&apos;ll be taken to Yoco&apos;s secure checkout. Test
                        card 4111 1111 1111 1111, any future expiry &amp; CVV.
                      </>
                    )}
                  </p>
                  {error && (
                    <p className="mt-3 text-[12px] text-rose-600" role="alert" aria-live="polite">
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Non-refundable deposit notice — shown before redirecting to Yoco */}
      <AnimatePresence>
        {confirmPay && service && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-pay-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmPay(false)}
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl" aria-hidden>
                💳
              </div>
              <h4
                id="confirm-pay-title"
                className="mt-4 font-display text-2xl tracking-wide text-eoe-espresso"
              >
                Before you pay
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-eoe-ink/85">
                Your{" "}
                <span className="font-semibold text-eoe-espresso">
                  {money(depositTotal)}
                </span>{" "}
                total ({money(service.price_cents)} × {guestCount}{" "}
                {guestCount === 1 ? "guest" : "guests"}
                {needsCars && washMinimum > 0
                  ? ` + ${money(washMinimum)} car wash`
                  : ""}
                {` + ${money(PLATFORM_FEE_CENTS)} platform fee`}) includes a{" "}
                <span className="font-semibold text-eoe-espresso">
                  non refundable
                </span>{" "}
                deposit that comes off your bill on arrival.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={startCheckout}
                  className="rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
                >
                  I understand. Pay {money(depositTotal)}
                </button>
                <button
                  onClick={() => setConfirmPay(false)}
                  className="rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-ivory"
                >
                  Go back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call to confirm — while online checkout is paused */}
      <AnimatePresence>
        {callToBook && service && slot && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-to-book-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCallToBook(false)}
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
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-eoe-espresso/10 text-2xl"
                aria-hidden
              >
                📞
              </div>
              <h4
                id="call-to-book-title"
                className="mt-4 font-display text-2xl tracking-wide text-eoe-espresso"
              >
                Call to confirm
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-eoe-ink/85">
                Online payment is being set up. Call us with the details below
                and we&apos;ll secure your booking.
              </p>
              <ul className="mt-4 space-y-1.5 text-left text-sm text-eoe-espresso">
                <li>
                  <span className="text-eoe-espresso/70">Experience · </span>
                  {service.name}
                </li>
                {dateLabel && (
                  <li>
                    <span className="text-eoe-espresso/70">Date · </span>
                    {dateLabel}
                  </li>
                )}
                <li>
                  <span className="text-eoe-espresso/70">Time · </span>
                  {wallTime(slot.start_time)}
                </li>
                <li>
                  <span className="text-eoe-espresso/70">Guests · </span>
                  {guestCount}
                </li>
                {name.trim() && (
                  <li>
                    <span className="text-eoe-espresso/70">Name · </span>
                    {name.trim()}
                  </li>
                )}
              </ul>
              <div className="mt-6 flex flex-col gap-2">
                <a
                  href={BOOKING_PHONE_HREF}
                  onClick={() => {
                    trackEvent(AnalyticsEvents.ContactPhone, {
                      source: "booking_phone_only",
                    });
                    setCallToBook(false);
                  }}
                  className="rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
                >
                  Call {BOOKING_PHONE}
                </a>
                <button
                  type="button"
                  onClick={() => setCallToBook(false)}
                  className="rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-ivory"
                >
                  Go back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {seatWarn && slot && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seat-warn-title"
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl" aria-hidden>
                ☕
              </div>
              <h4
                id="seat-warn-title"
                className="mt-4 font-display text-2xl tracking-wide text-eoe-espresso"
              >
                Almost full
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-eoe-ink/85">
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
  id,
  label,
  children,
  span2,
  error,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  span2?: boolean;
  error?: string;
}) {
  const control = isValidElement(children)
    ? cloneElement(
        children as React.ReactElement<{
          id?: string;
          "aria-describedby"?: string;
        }>,
        {
          id,
          ...(error ? { "aria-describedby": `${id}-error` } : {}),
        }
      )
    : children;
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso"
      >
        {label}
      </label>
      {control}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-[11px] text-rose-600"
          role="alert"
        >
          {error}
        </p>
      )}
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
                <span className="block text-xs text-eoe-espresso/80">
                  {s.duration} min · {money(s.price_cents)} per guest {" "}
                  {isCarWashService(s.slug) ? " + car wash" : ""}
                </span>
              </span>
            </span>
            <span className="text-eoe-espresso/40 transition group-hover:translate-x-1">
              →
            </span>
          </button>
        ))}
        {services.length === 0 && !error && (
          <p className="text-sm text-eoe-espresso/80">Loading experiences…</p>
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
        className="mb-5 text-xs uppercase tracking-[0.22em] text-eoe-espresso/80 hover:text-eoe-espresso"
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
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-eoe-espresso">
            {date ? "Available times" : "Select a date"}
          </p>
          {date && loading && (
            <p className="text-sm text-eoe-espresso/80">Loading…</p>
          )}
          {date && !loading && slots.length === 0 && (
            <p className="text-sm text-eoe-espresso/80">
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
