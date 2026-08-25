"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CAR_WASH_INFO, formatZar } from "@/lib/menu";

function CarIcon({ kind }: { kind: "small" | "medium" | "large" }) {
  const w = kind === "small" ? 40 : kind === "medium" ? 48 : 56;
  const h = kind === "small" ? 18 : kind === "medium" ? 20 : 22;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 56 22"
      fill="none"
      aria-hidden
      className="text-eoe-espresso/70"
    >
      <path
        d={
          kind === "large"
            ? "M4 14h3l3-6h22l6 6h10v4H4v-4Zm8 4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm28 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
            : kind === "medium"
              ? "M6 13h3l3-5h20l5 5h9v4H6v-4Zm8 4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm24 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
              : "M10 13h2.5l2.5-4h14l4 4h7v3.5H10V13Zm7 3.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm18 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        }
        fill="currentColor"
      />
    </svg>
  );
}

const TIER_ICON: Record<string, "small" | "medium" | "large"> = {
  hatch: "small",
  sedan: "medium",
  suv: "large",
};

export function CarWash({ asPage = false }: { asPage?: boolean }) {
  const Title = asPage ? "h1" : "h2";

  return (
    <section
      id="car-wash"
      className="relative overflow-hidden bg-eoe-ivory px-4 py-16 text-eoe-ink md:px-6 md:py-20 lg:px-8"
    >
      {/* Soft clay wash behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-eoe-espresso/[0.07] to-transparent"
      />

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs tracking-[0.32em] text-eoe-espresso">
            EOE CAR WASH
          </p>
          <Title className="mt-3 font-display text-4xl tracking-[0.14em] text-eoe-espresso md:text-5xl">
            Car wash
          </Title>
          <p className="mt-3 font-display text-2xl italic tracking-wide text-eoe-espresso/80">
            {CAR_WASH_INFO.tagline}
          </p>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-eoe-ink/80 md:text-base">
            {CAR_WASH_INFO.note} A standard wash while you are at the table.
            Pre-book with your café reservation so we can hold a bay for you.
          </p>
        </motion.div>

        {/* Pricing tiers */}
        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {CAR_WASH_INFO.pricing.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.55,
                ease: "easeOut",
                delay: i * 0.06,
              }}
              className="flex flex-col items-center rounded-[1.75rem] border border-eoe-espresso/12 bg-[#faf7f4] px-5 py-8 text-center"
            >
              <CarIcon kind={TIER_ICON[tier.id] ?? "medium"} />
              <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
                {tier.detail}
              </p>
              <p className="mt-2 text-sm font-semibold tracking-wide text-eoe-ink">
                {tier.label}
              </p>
              <p className="mt-4 font-display text-4xl tracking-wide text-eoe-espresso">
                {formatZar(tier.price)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Includes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="mt-14 rounded-[2rem] border border-eoe-espresso/12 bg-eoe-espresso px-6 py-10 text-eoe-ivory md:px-10"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-eoe-ivory/65">
                Standard wash
              </p>
              <p className="mt-2 font-display text-2xl italic tracking-wide text-eoe-ivory/90">
                Includes
              </p>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-eoe-ivory/70 md:text-right">
              Every wash is finished by hand with the same care we bring to the
              table.
            </p>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAR_WASH_INFO.includes.map((item) => (
              <li key={item.title} className="border-t border-eoe-ivory/20 pt-4">
                <p className="text-sm font-medium tracking-wide">{item.title}</p>
                <p className="mt-1 text-xs text-eoe-ivory/65">{item.detail}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Reservation note + CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="mt-10 flex flex-col items-start justify-between gap-6 rounded-[1.75rem] border border-eoe-espresso/12 bg-[#faf7f4] px-6 py-7 sm:flex-row sm:items-center md:px-8"
        >
          <div className="max-w-xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
              Reservations only
            </p>
            <p className="mt-2 text-sm leading-relaxed text-eoe-ink/80">
              {CAR_WASH_INFO.reservation}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/#booking"
              className="inline-flex min-h-11 shrink-0 rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
            >
              Book café + wash
            </Link>
            <Link
              href="/menu"
              className="inline-flex min-h-11 shrink-0 rounded-full border border-eoe-espresso/25 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-espresso/5"
            >
              See the menu
            </Link>
          </div>
        </motion.div>

        <p className="mt-8 text-center font-display text-lg italic tracking-wide text-eoe-espresso/65">
          Thank you for your support.
        </p>
      </div>
    </section>
  );
}
