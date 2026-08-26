"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { hero } from "@/lib/media";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReducedMotion(mq.matches);
      const v = videoRef.current;
      if (!v) return;
      if (mq.matches) {
        v.pause();
      } else {
        void v.play().catch(() => {});
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col justify-end overflow-hidden bg-eoe-ink text-eoe-ink"
    >
      <div className="pointer-events-none absolute inset-0">
        <Image
          src={hero.poster}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {!reducedMotion && (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={hero.video}
            poster={hero.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink/85 via-eoe-ink/35 to-eoe-ink/30" />
        <div
          className="absolute inset-0 opacity-20 mix-blend-soft-light"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col justify-end px-4 pb-20 pt-32 md:px-6 lg:px-8">
        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="mb-4 text-xs tracking-[0.28em] text-eoe-ivory/85 sm:tracking-[0.35em]"
        >
          OFF GRID ESTATE • SOUTH AFRICA
        </motion.p>

        <motion.h1
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.05 }}
          className="max-w-full font-display text-[clamp(2.4rem,11vw,6.5rem)] leading-[0.9] tracking-[0.1em] text-eoe-ivory sm:tracking-[0.12em] md:text-[6.5vw]"
        >
          An escape <br />that feels <br />like home
        </motion.h1>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
          className="mt-5 max-w-xl font-display text-xl tracking-[0.08em] text-eoe-ivory/90 sm:text-2xl md:text-3xl"
        >
          Entle Off Grid Estate
        </motion.p>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.25 }}
          className="mt-4 max-w-xl text-sm text-eoe-ivory/85 md:text-base"
        >
          <p>
            A private estate, off-grid café, and considered venue for gatherings
            that feel both intimate and quietly cinematic.
          </p>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.35 }}
          className="mt-8 flex max-w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
        >
          <a
            href="#booking"
            onClick={() =>
              trackEvent(AnalyticsEvents.CtaBook, { source: "hero" })
            }
            className="inline-flex items-center justify-center rounded-full border border-eoe-gold bg-eoe-gold px-5 py-3 text-center text-[11px] font-semibold tracking-[0.18em] text-eoe-ivory hover:bg-eoe-gold/90 sm:px-6 sm:text-xs sm:tracking-[0.22em]"
          >
            BOOK A DATE
          </a>
          <a
            href="#estate"
            onClick={() =>
              trackEvent(AnalyticsEvents.CtaExplore, { source: "hero" })
            }
            className="inline-flex items-center justify-center rounded-full border border-eoe-ivory/40 px-5 py-3 text-center text-[11px] font-semibold tracking-[0.18em] text-eoe-ivory/90 hover:bg-eoe-ivory/5 sm:px-6 sm:text-xs sm:tracking-[0.22em]"
          >
            EXPLORE THE ESTATE
          </a>
        </motion.div>
      </div>
    </section>
  );
}
