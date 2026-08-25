"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { foodPhoto } from "@/lib/media";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

/** Home teaser for The Table — full menu lives on /menu. */
export function Food() {
  return (
    <section
      id="food"
      className="border-t border-eoe-espresso/10 bg-eoe-ivory px-4 py-20 md:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="order-2 md:order-1"
          >
            <p className="text-xs tracking-[0.3em] text-eoe-espresso">
              THE TABLE
            </p>
            <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-[0.12em] text-eoe-espresso md:text-5xl">
              One table.
              <br />
              Endless flavours.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-eoe-ink/90 md:text-base">
              Breakfast through lunch, coffee in between. Seasonal plates,
              careful coffee, and a kitchen that leads with what is fresh and
              local. Settle in and let the afternoon stretch.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.22em] text-eoe-espresso">
              <span className="rounded-full border border-eoe-espresso/15 px-4 py-2">
                Breakfast
              </span>
              <span className="rounded-full border border-eoe-espresso/15 px-4 py-2">
                Lunch
              </span>
              <span className="rounded-full border border-eoe-espresso/15 px-4 py-2">
                Beans &amp; Brews
              </span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/menu"
                onClick={() =>
                  trackEvent(AnalyticsEvents.CtaMenu, { source: "food" })
                }
                className="inline-flex rounded-full border border-eoe-gold bg-eoe-gold px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-gold/90"
              >
                View the menu
              </Link>
              <Link
                href="/car-wash"
                onClick={() =>
                  trackEvent(AnalyticsEvents.CtaCarWash, { source: "food" })
                }
                className="inline-flex rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-espresso/5"
              >
                Car wash while you dine
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="group relative order-1 mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-eoe-espresso/10 md:order-2"
          >
            <Image
              src={foodPhoto.src}
              alt={foodPhoto.alt}
              fill
              sizes="(min-width: 768px) 40vw, 90vw"
              className="object-cover transition-transform duration-[3000ms] group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink/40 to-transparent" />
            <p className="absolute bottom-5 left-5 text-[10px] uppercase tracking-[0.24em] text-eoe-ivory/95">
              @funkiie_k
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
