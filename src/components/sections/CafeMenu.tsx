"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  MENU_CATEGORIES,
  formatZar,
  type MenuCategory,
} from "@/lib/menu";
import { ENTLE_MARK_SRC } from "@/components/ui/EntleMark";

function MenuPanel({ category }: { category: MenuCategory }) {
  return (
    <div className="space-y-12">
      {category.sections.map((section) => (
        <div key={section.id}>
          {section.accent ? (
            <p className="font-display text-2xl italic tracking-wide text-eoe-espresso/80">
              {section.accent}
            </p>
          ) : section.id.endsWith("-mains") ||
            section.title === "Breakfast" ||
            section.title === "Lunch" ? null : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-eoe-espresso">
              {section.title}
            </p>
          )}

          {section.items.length > 0 && (
            <ul className="mt-4 divide-y divide-eoe-espresso/10">
              {section.items.map((item) => (
                <li key={item.name} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3 sm:gap-4">
                    <h3 className="min-w-0 flex-1 break-words text-sm font-semibold tracking-wide text-eoe-ink md:text-[15px]">
                      {item.name}
                    </h3>
                    <span className="shrink-0 font-display text-lg tracking-wide text-eoe-espresso">
                      {formatZar(item.price)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-1.5 max-w-2xl break-words text-xs leading-relaxed text-eoe-ink/70 md:text-sm">
                      {item.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {section.sides && (
            <p className="mt-4 break-words border-t border-eoe-espresso/15 pt-4 text-xs leading-relaxed text-eoe-ink/75 md:text-sm">
              {section.sides}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function CafeMenu({
  initialTab = "breakfast",
}: {
  initialTab?: MenuCategory["id"];
}) {
  const [tab, setTab] = useState<MenuCategory["id"]>(initialTab);
  const active =
    MENU_CATEGORIES.find((c) => c.id === tab) ?? MENU_CATEGORIES[0];

  return (
    <div
      id="cafe-menu"
      className="relative w-full max-w-full scroll-mt-28 overflow-x-clip overflow-y-visible rounded-[2rem] border border-eoe-espresso/12 bg-[#faf7f4] px-4 py-10 sm:px-8 md:px-12 md:py-14"
    >
      {/* Soft atmospheric wash — balanced L/R so the panel doesn’t feel shifted */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-10 inset-x-0 opacity-[0.12] md:opacity-[0.16]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 28% 36% at 0% 28%, var(--eoe-espresso) 0%, transparent 72%), radial-gradient(ellipse 26% 34% at 100% 72%, var(--eoe-espresso) 0%, transparent 72%)",
        }}
      />

      {/* Letterpress watermark — clipped, centered, no layout bleed */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[44%] aspect-square w-[min(70%,18rem)] -translate-x-1/2 -translate-y-1/2 opacity-[0.12] sm:w-[min(58%,24rem)] sm:-rotate-[6deg] sm:opacity-[0.13] md:top-[46%] md:w-[min(50%,30rem)] md:opacity-[0.14]">
          <Image
            src={ENTLE_MARK_SRC}
            alt=""
            fill
            sizes="(max-width: 640px) 70vw, 400px"
            className="object-contain"
            priority={false}
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#faf7f4_90%)]" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-3xl">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-eoe-espresso/80">
            Café menu
          </p>

          <div className="mx-auto mt-4 flex max-w-md items-center gap-3 sm:gap-4">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-eoe-espresso/30" />
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10">
              <Image
                src={ENTLE_MARK_SRC}
                alt=""
                width={40}
                height={40}
                className="opacity-55"
                aria-hidden
              />
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-eoe-espresso/30" />
          </div>

          <h2 className="mt-3 font-display text-[1.65rem] tracking-[0.14em] text-eoe-espresso sm:text-3xl sm:tracking-[0.2em] md:text-4xl">
            {active.label.toUpperCase()}
          </h2>
        </div>

        <div
          role="tablist"
          aria-label="Menu sections"
          className="mt-8 flex flex-wrap justify-center gap-2"
        >
          {MENU_CATEGORIES.map((c) => {
            const selected = c.id === tab;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(c.id)}
                className={`min-h-11 rounded-full px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] transition sm:px-5 sm:text-[11px] sm:tracking-[0.2em] ${
                  selected
                    ? "bg-eoe-espresso text-eoe-ivory"
                    : "border border-eoe-espresso/20 text-eoe-espresso hover:bg-eoe-espresso/5"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" className="mt-10 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="min-w-0"
            >
              <MenuPanel category={active} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 px-1">
          <span
            aria-hidden
            className="relative block h-7 w-7 opacity-30 sm:h-8 sm:w-8"
          >
            <Image
              src={ENTLE_MARK_SRC}
              alt=""
              fill
              sizes="32px"
              className="object-contain"
            />
          </span>
          <p className="text-center font-display text-base italic tracking-wide text-eoe-espresso/70 sm:text-lg">
            Prices subject to change. Ask your host about today&apos;s specials.
          </p>
        </div>
      </div>
    </div>
  );
}
