"use client";

import { motion } from "framer-motion";
import Image from "next/image";

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
          className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-eoe-espresso/10 md:w-1/2"
        >
          <Image
            src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80"
            alt="Minimalist cafe interior at an off-grid estate"
            fill
            className="object-cover transition-transform duration-[3500ms] hover:scale-105"
          />
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
            Entle Off-Grid Estate is a Black-owned, privately held space for
            slow mornings, golden-hour gatherings, and evenings that taper into
            stories around the table. Powered by the sun and surrounded by open
            sky, the estate is intentionally intimate—designed for small
            weddings, private dinners, creative retreats, and curated community
            moments.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-eoe-espresso/80 md:text-base">
            Every room, pathway, and tablescape is considered. From the
            minimalist cafe to the lawn that folds into the horizon, EOE is less
            a venue and more a feeling: quietly expensive, deeply warm, and
            entirely off-grid.
          </p>
          <p className="mt-8 text-xs uppercase tracking-[0.24em] text-eoe-espresso/70">
            Private estate • Off-grid cafe • Curated events
          </p>
        </motion.div>
      </div>
    </section>
  );
}

