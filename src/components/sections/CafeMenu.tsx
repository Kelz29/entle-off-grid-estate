"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MENU_CATEGORIES,
  formatZar,
  type MenuCategory,
} from "@/lib/menu";

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
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-sm font-semibold tracking-wide text-eoe-ink md:text-[15px]">
                      {item.name}
                    </h3>
                    <span className="shrink-0 font-display text-lg tracking-wide text-eoe-espresso">
                      {formatZar(item.price)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-eoe-ink/70 md:text-sm">
                      {item.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {section.sides && (
            <p className="mt-4 border-t border-eoe-espresso/15 pt-4 text-xs leading-relaxed text-eoe-ink/75 md:text-sm">
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
      className="relative scroll-mt-28 overflow-hidden rounded-[2rem] border border-eoe-espresso/12 bg-[#faf7f4] px-5 py-10 sm:px-8 md:px-12 md:py-14"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-8 left-0 w-8 opacity-[0.18] md:w-12"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 40% 28% at 0% 22%, var(--eoe-espresso) 0%, transparent 70%), radial-gradient(ellipse 36% 32% at 0% 78%, var(--eoe-espresso) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-eoe-espresso/80">
            Café menu
          </p>
          <div className="mx-auto mt-4 flex max-w-md items-center gap-4">
            <span className="h-px flex-1 bg-eoe-espresso/25" />
            <h2 className="font-display text-3xl tracking-[0.2em] text-eoe-espresso md:text-4xl">
              {active.label.toUpperCase()}
            </h2>
            <span className="h-px flex-1 bg-eoe-espresso/25" />
          </div>
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
                className={`min-h-11 rounded-full px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] transition ${
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

        <div role="tabpanel" className="mt-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              <MenuPanel category={active} />
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-10 text-center font-display text-lg italic tracking-wide text-eoe-espresso/70">
          Prices subject to change. Ask your host about today&apos;s specials.
        </p>
      </div>
    </div>
  );
}
