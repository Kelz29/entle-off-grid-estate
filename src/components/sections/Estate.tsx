"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { estatePhoto } from "@/lib/media";

export function Estate() {
  return (
    <section
      id="estate"
      className="relative border-t border-eoe-espresso/10 bg-eoe-ivory px-4 py-20 md:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-60 mix-blend-soft-light" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 md:flex-row md:items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="group relative aspect-[3/4] overflow-hidden rounded-3xl bg-eoe-espresso/10 md:w-[45%]"
        >
          <Image
            src={estatePhoto.src}
            alt={estatePhoto.alt}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-[3500ms] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink/50 to-transparent" />
          <p className="absolute bottom-5 left-5 text-xs uppercase tracking-[0.24em] text-eoe-ivory/90">
            {estatePhoto.caption}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
          className="md:w-1/2"
        >
          <p className="mb-4 text-xs tracking-[0.3em] text-eoe-espresso/70">
            ABOUT THE ESTATE
          </p>
          <h2 className="font-display text-4xl tracking-[0.18em] text-eoe-espresso md:text-5xl">
            Where stillness
            <br />
            meets celebration.
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-eoe-espresso/80 md:text-base">
            Entle Off-Grid Estate is a Black-owned, privately held space for slow
            mornings, golden-hour gatherings, and evenings that taper into
            stories around the table. Powered by the sun and surrounded by open
            sky, the estate is intentionally intimate—designed for small
            weddings, private dinners, creative retreats, and curated community
            moments.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-eoe-espresso/80 md:text-base">
            Fifteen minutes from the city and a world away from it, every room,
            pathway, and tablescape is considered—from the minimalist café to the
            lawn that folds into the horizon. EOE is less a venue and more a
            feeling: quietly expensive, deeply warm, and entirely off-grid.
          </p>
          <p className="mt-8 text-xs uppercase tracking-[0.24em] text-eoe-espresso/70">
            Private estate • Off-grid café • Curated events
          </p>
        </motion.div>
      </div>
    </section>
  );
}
