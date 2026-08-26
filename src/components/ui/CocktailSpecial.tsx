"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

const STORAGE_KEY = "eoe-cocktail-special-seen";
const IMAGE_SRC = "/specials/cocktail-friday-sunday.jpg";
const SHOW_DELAY_MS = 1600;

/**
 * Soft “invitation” reveal for the café cocktail special.
 * Shows once per browser session after the hero settles; a quiet corner
 * mark can reopen it.
 */
export function CocktailSpecial() {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") {
        setSeen(true);
        setReady(true);
        return;
      }
    } catch {
      /* private mode */
    }

    const delay = reduceMotion ? 400 : SHOW_DELAY_MS;
    const t = window.setTimeout(() => {
      setReady(true);
      setOpen(true);
      trackEvent(AnalyticsEvents.SpecialShown, { kind: "cocktail" });
    }, delay);
    return () => window.clearTimeout(t);
  }, [reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      setSeen(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      trackEvent(AnalyticsEvents.SpecialDismissed, { kind: "cocktail" });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markSeen = () => {
    setSeen(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    setOpen(false);
    markSeen();
    trackEvent(AnalyticsEvents.SpecialDismissed, { kind: "cocktail" });
  };

  const reopen = () => {
    setOpen(true);
    trackEvent(AnalyticsEvents.SpecialReopened, { kind: "cocktail" });
  };

  if (!ready) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.45 }}
            className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          >
            {/* Warm clay veil */}
            <motion.button
              type="button"
              aria-label="Close special"
              onClick={dismiss}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-default border-0 bg-[#2a1a12]/55 backdrop-blur-[6px]"
            />

            {/* Soft radial glow behind the poster */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(154,101,82,0.35)_0%,transparent_60%)]"
            />

            <motion.div
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 48, scale: 0.96, rotate: -0.6 }
              }
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 28, scale: 0.97 }
              }
              transition={{
                duration: reduceMotion ? 0.2 : 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative z-10 mx-3 mb-3 w-full max-w-[min(92vw,420px)] sm:mb-0"
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id={titleId}
                className="mb-3 text-center text-[10px] uppercase tracking-[0.32em] text-eoe-ivory/85"
              >
                Now pouring · Friday &amp; Sunday
              </p>

              <div className="relative overflow-hidden rounded-[1.75rem] shadow-[0_28px_80px_rgba(0,0,0,0.45)] ring-1 ring-eoe-ivory/20">
                <Image
                  src={IMAGE_SRC}
                  alt="Entle Café cocktail special: buy one, get 50% off your second cocktail, Friday and Sunday 12:00 to 17:00"
                  width={1080}
                  height={1350}
                  priority
                  className="h-auto w-full object-cover"
                  sizes="(max-width: 480px) 92vw, 420px"
                />
              </div>

              <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
                <a
                  href="#booking"
                  onClick={() => {
                    dismiss();
                    trackEvent(AnalyticsEvents.CtaBook, {
                      source: "cocktail_special",
                    });
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-eoe-gold px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-eoe-ivory hover:bg-eoe-gold/90"
                >
                  Book a table
                </a>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={dismiss}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-eoe-ivory/35 px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-eoe-ivory/90 hover:bg-eoe-ivory/10"
                >
                  Keep browsing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiet reopen mark after first dismiss */}
      <AnimatePresence>
        {seen && !open && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
            onClick={reopen}
            aria-label="View cocktail special"
            className="fixed bottom-5 left-4 z-40 flex items-center gap-2.5 rounded-full border border-eoe-espresso/15 bg-eoe-ivory/90 py-2 pl-2 pr-4 shadow-[0_12px_40px_rgba(42,26,18,0.14)] backdrop-blur-md hover:border-eoe-espresso/30 sm:bottom-6 sm:left-6"
          >
            <span className="relative h-10 w-10 overflow-hidden rounded-full">
              <Image
                src={IMAGE_SRC}
                alt=""
                fill
                sizes="40px"
                className="object-cover object-[50%_35%]"
              />
            </span>
            <span className="text-left">
              <span className="block text-[9px] uppercase tracking-[0.22em] text-eoe-espresso/70">
                Café special
              </span>
              <span className="block font-display text-sm tracking-wide text-eoe-espresso">
                50% on 2nd
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
