"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col justify-end overflow-hidden bg-eoe-ivory text-eoe-ink"
    >
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=1600&q=80"
          alt="Misty South African landscape around an off-grid estate"
          fill
          priority
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink/70 via-eoe-ink/30 to-transparent" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-4 pb-20 pt-32 md:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="mb-4 text-xs tracking-[0.35em] text-eoe-ivory/70"
        >
          OFF-GRID ESTATE • SOUTH AFRICA
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.05 }}
          className="font-display text-[10vw] leading-[0.9] tracking-[0.22em] text-eoe-ivory md:text-[7vw]"
        >
          An escape
          <br />
          that feels
          <br />
          like home
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          className="mt-6 max-w-xl text-sm text-eoe-ivory/80 md:text-base"
        >
          <p>
            A private estate, off-grid cafe, and considered venue for gatherings
            that feel both intimate and quietly cinematic.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center gap-4"
        >
          <a
            href="#booking"
            className="rounded-full border border-eoe-gold bg-eoe-gold px-6 py-3 text-xs font-semibold tracking-[0.22em] text-eoe-espresso hover:bg-eoe-gold/90"
          >
            BOOK A DATE
          </a>
          <a
            href="#estate"
            className="rounded-full border border-eoe-ivory/40 px-6 py-3 text-xs font-semibold tracking-[0.22em] text-eoe-ivory/90 hover:bg-eoe-ivory/5"
          >
            EXPLORE THE ESTATE
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
          className="mt-16 flex items-center justify-between text-[11px] text-eoe-ivory/70"
        >
          <p>Mon–Sun 8:00–16:30 • 067 366 2302</p>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">Scroll</span>
            <span className="h-px w-10 bg-eoe-ivory/40" />
            <span className="h-6 w-px bg-eoe-ivory/60 animate-bounce" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

