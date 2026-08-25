"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type NavItem = { href: string; label: string };

/** Primary nav: no Car Wash (linked from The Table, footer, mobile Browse). */
const NAV_ITEMS: NavItem[] = [
  { href: "#estate", label: "The Estate" },
  { href: "#spaces", label: "Spaces" },
  { href: "#experiences", label: "Experiences" },
  { href: "/menu", label: "Menu" },
  { href: "#booking", label: "Book" },
  { href: "#gallery", label: "Gallery" },
  { href: "#contact", label: "Contact" },
];

function resolveHref(href: string, isHome: boolean): string {
  if (href.startsWith("/") && !href.startsWith("/#")) return href;
  if (href.startsWith("#")) return isHome ? href : `/${href}`;
  return href;
}

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const bookHref = resolveHref("#booking", isHome);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4"
    >
      <div
        className={`relative flex w-full max-w-6xl items-center gap-2 rounded-full border border-eoe-espresso/10 px-3 py-2.5 text-sm tracking-[0.18em] uppercase sm:gap-3 sm:px-4 sm:py-3 lg:gap-4 lg:px-5 ${
          scrolled
            ? "bg-eoe-ivory/80 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.12)]"
            : "bg-eoe-ivory/40 backdrop-blur-sm"
        } transition-colors`}
      >
        <Link
          href="/"
          className="min-w-0 flex-1 overflow-hidden font-display text-sm font-semibold normal-case tracking-[0.08em] sm:text-base lg:flex-none lg:shrink-0 lg:overflow-visible"
        >
          <span className="block truncate lg:inline">Entle Off Grid Estate</span>
        </Link>

        <nav
          className="ml-auto hidden shrink-0 items-center gap-3 lg:flex xl:gap-5"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => {
            const href = resolveHref(item.href, isHome);
            const active = item.href === "/menu" && pathname === "/menu";
            return (
              <Link
                key={item.href}
                href={href}
                className={`whitespace-nowrap text-[10px] xl:text-[11px] ${
                  active
                    ? "text-eoe-espresso"
                    : "text-eoe-ink/90 hover:text-eoe-espresso"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <Link
            href={bookHref}
            onClick={() =>
              trackEvent(AnalyticsEvents.CtaBook, { source: "header" })
            }
            className="hidden rounded-full border border-eoe-gold/70 bg-eoe-gold/10 px-4 py-2 text-[11px] font-medium text-eoe-espresso hover:bg-eoe-gold/20 lg:inline-flex"
          >
            Book a Date
          </Link>
          <button
            type="button"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-eoe-espresso/20 px-3.5 py-2 text-[11px] font-medium text-eoe-espresso lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="site-nav-panel"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? "Close" : "Browse"}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              id="site-nav-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              aria-label="Sections"
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 flex flex-col gap-1 rounded-3xl border border-eoe-espresso/10 bg-eoe-ivory/95 p-4 shadow-lg backdrop-blur-md lg:hidden"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={resolveHref(item.href, isHome)}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full px-4 py-2.5 text-[11px] text-eoe-ink/90 hover:bg-eoe-espresso/5 hover:text-eoe-espresso"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/car-wash"
                onClick={() => {
                  setMenuOpen(false);
                  trackEvent(AnalyticsEvents.CtaCarWash, {
                    source: "header_mobile",
                  });
                }}
                className="mt-1 rounded-full border border-eoe-espresso/10 px-4 py-2.5 text-[11px] text-eoe-espresso/85 hover:bg-eoe-espresso/5"
              >
                Car wash
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
