"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";
import {
  fallbackCocktailSpecialResource,
  type CocktailSpecialResource,
} from "@/lib/cocktail-special-shared";

const SHOW_DELAY_MS = 1600;

function isLocalPublicPath(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//");
}

/**
 * Soft “invitation” reveal for the café cocktail special.
 * Config comes from /api/specials/cocktail (admin-editable).
 * Shows on home load / refresh only — no persistent reopen chip.
 */
export function CocktailSpecial() {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [config, setConfig] = useState<CocktailSpecialResource | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/specials/cocktail", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { resource?: CocktailSpecialResource };
        if (cancelled) return;
        if (data.resource) setConfig(data.resource);
        else setConfig(fallbackCocktailSpecialResource());
      } catch {
        if (!cancelled) setConfig(fallbackCocktailSpecialResource());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config?.enabled) return;
    const delay = reduceMotion ? 400 : SHOW_DELAY_MS;
    const t = window.setTimeout(() => {
      setOpen(true);
      trackEvent(AnalyticsEvents.SpecialShown, { kind: "cocktail" });
    }, delay);
    return () => window.clearTimeout(t);
  }, [config, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trackEvent(AnalyticsEvents.SpecialDismissed, { kind: "cocktail" });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    trackEvent(AnalyticsEvents.SpecialDismissed, { kind: "cocktail" });
  };

  if (!config?.enabled) return null;

  const imageUrl = config.image_url || config.image_src;
  const useNextImage = isLocalPublicPath(imageUrl);

  return (
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
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 md:p-8"
        >
          <motion.button
            type="button"
            aria-label="Close special"
            onClick={dismiss}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-default border-0 bg-[#2a1a12]/55 backdrop-blur-[6px]"
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(154,101,82,0.35)_0%,transparent_60%)]"
          />

          <motion.div
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 36, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 20, scale: 0.98 }
            }
            transition={{
              duration: reduceMotion ? 0.2 : 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative z-10 flex max-h-[min(100dvh,100svh)] w-full max-w-[min(100%,380px)] flex-col sm:max-w-[min(100%,420px)] md:max-w-[440px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id={titleId}
              className="mb-2 shrink-0 text-center text-[10px] uppercase tracking-[0.28em] text-eoe-ivory/85 sm:mb-3 sm:tracking-[0.32em]"
            >
              {config.eyebrow}
            </p>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.45)] ring-1 ring-eoe-ivory/20 sm:rounded-[1.75rem]">
              {useNextImage ? (
                <Image
                  src={imageUrl}
                  alt={config.image_alt}
                  width={1080}
                  height={1350}
                  priority
                  className="mx-auto h-auto max-h-[min(68dvh,72svh)] w-full object-contain object-center sm:max-h-[min(70dvh,74svh)] md:max-h-[min(72dvh,640px)]"
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 420px, 440px"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- API-served / remote flyer
                <img
                  src={imageUrl}
                  alt={config.image_alt}
                  width={1080}
                  height={1350}
                  className="mx-auto h-auto max-h-[min(68dvh,72svh)] w-full object-contain object-center sm:max-h-[min(70dvh,74svh)] md:max-h-[min(72dvh,640px)]"
                />
              )}
            </div>

            <div className="mt-3 flex shrink-0 flex-col gap-2 sm:mt-4 sm:flex-row sm:justify-center sm:gap-2.5">
              <a
                href={config.cta_href || "#booking"}
                onClick={() => {
                  dismiss();
                  trackEvent(AnalyticsEvents.CtaBook, {
                    source: "cocktail_special",
                  });
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-eoe-gold px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory hover:bg-eoe-gold/90 sm:flex-none sm:px-6 sm:tracking-[0.2em]"
              >
                {config.cta_label}
              </a>
              <button
                ref={closeRef}
                type="button"
                onClick={dismiss}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-eoe-ivory/35 px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory/90 hover:bg-eoe-ivory/10 sm:flex-none sm:px-6 sm:tracking-[0.2em]"
              >
                Keep browsing
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
