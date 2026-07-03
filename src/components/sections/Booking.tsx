"use client";

import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { motion } from "framer-motion";
import type { Space } from "@/lib/bookings";

export function Booking() {
  const [date, setDate] = useState<Date | null>(null);
  const [space, setSpace] = useState<Space>("Cafe");
  const [eventType, setEventType] = useState("");
  const [guests, setGuests] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        date: date.toISOString().slice(0, 10),
        space,
        eventType,
        guests: Number(guests),
        name,
        email,
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Unable to create booking.");
      }

      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="booking"
      className="border-t border-eoe-espresso/10 bg-eoe-ivory px-4 py-20 md:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-espresso/70">
              ONLINE BOOKING
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] text-eoe-espresso md:text-4xl">
              Reserve your date,
              <br />
              we&apos;ll hold the rest.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-eoe-espresso/80">
              Select your date, space, and event details. A booking deposit of
              <span className="font-semibold"> R480</span> secures your slot.
            </p>
          </div>
          <div className="rounded-2xl bg-eoe-espresso px-5 py-4 text-xs text-eoe-ivory/80 md:max-w-xs">
            <p className="font-semibold uppercase tracking-[0.26em] text-eoe-ivory">
              Booking Key
            </p>
            <p className="mt-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" />{" "}
              Available
            </p>
            <p className="mt-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" /> Few
              spots left
            </p>
            <p className="mt-1">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-400 align-middle" />{" "}
              Reserved
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="rounded-3xl border border-eoe-espresso/10 bg-white p-0 shadow-sm overflow-hidden"
          >
            <div className="booking-calendar h-full">
              <DatePicker selected={date} onChange={(d) => setDate(d)} inline />
            </div>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="rounded-3xl border border-eoe-espresso/10 bg-white p-6 shadow-sm md:p-7"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
                  Selected date
                </label>
                <p className="text-sm text-eoe-espresso">
                  {date ? date.toLocaleDateString() : "Choose a date on the calendar"}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
                  Space
                </label>
                <select
                  value={space}
                  onChange={(e) => setSpace(e.target.value as Space)}
                  className="w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/40 px-4 py-2.5 text-sm outline-none"
                >
                  <option value="Cafe">The Cafe</option>
                  <option value="Venue">The Venue</option>
                  <option value="Garden">The Garden</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
                  Event type
                </label>
                <input
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="Brunch, wedding, strategy session..."
                  className="w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/40 px-4 py-2.5 text-sm outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
                  Guest count
                </label>
                <input
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  type="number"
                  min={1}
                  className="w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/40 px-4 py-2.5 text-sm outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/40 px-4 py-2.5 text-sm outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-eoe-espresso/70">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full rounded-full border border-eoe-espresso/20 bg-eoe-ivory/40 px-4 py-2.5 text-sm outline-none"
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-eoe-espresso/10 pt-5 text-xs text-eoe-espresso/70">
              <p>
                A R480 deposit is required to confirm your booking. You&apos;ll
                receive a payment link and confirmation via email.
              </p>
              <button
                type="submit"
                disabled={!date || submitting}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:cursor-not-allowed disabled:bg-eoe-espresso/40"
              >
                {submitting
                  ? "Processing..."
                  : submitted
                  ? "Requested"
                  : "Request Booking & Deposit Link"}
              </button>
              {submitted && (
                <p className="text-[11px] text-emerald-600">
                  Thank you. We&apos;ll confirm availability and send payment
                  details shortly.
                </p>
              )}
              {error && (
                <p className="text-[11px] text-rose-600">
                  {error}
                </p>
              )}
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}

