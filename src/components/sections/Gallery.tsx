"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const items = [
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
];

export function Gallery() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section
      id="gallery"
      className="border-t border-eoe-espresso/10 bg-eoe-espresso/95 px-2 py-20 text-eoe-ivory md:px-4"
    >
      <div className="mx-auto max-w-6xl px-2">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-ivory/70">
              GALLERY
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] md:text-4xl">
              A wall of moments.
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm leading-relaxed text-eoe-ivory/80 md:block">
            A living archive of the estate—sunrise mist, tables set for celebration, and the
            quiet in between.
          </p>
        </div>

        <div className="columns-2 gap-4 sm:columns-3 md:gap-5">
          {items.map((src) => (
            <motion.button
              key={src}
              type="button"
              onClick={() => setActive(src)}
              whileHover={{ y: -4 }}
              className="mb-4 inline-block overflow-hidden rounded-3xl border border-eoe-ivory/10 focus:outline-none"
            >
              <div className="relative h-56 w-full sm:h-72 md:h-80">
                <Image
                  src={src}
                  alt="Entle Off-Grid Estate"
                  fill
                  className="object-cover transition-transform duration-[2200ms] hover:scale-105"
                />
              </div>
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
              onClick={() => setActive(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-eoe-ivory/10 bg-eoe-ink"
              >
                <Image
                  src={active}
                  alt="Entle Off-Grid Estate detail"
                  fill
                  className="object-cover"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

