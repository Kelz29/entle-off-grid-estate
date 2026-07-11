"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { reels } from "@/lib/media";
import { HoverVideo } from "@/components/ui/HoverVideo";
import { Lightbox, type MediaItem } from "@/components/ui/Lightbox";

export function Experiences() {
  const [active, setActive] = useState<MediaItem | null>(null);

  return (
    <section
      id="experiences"
      className="border-t border-eoe-espresso/10 bg-eoe-espresso px-4 py-20 text-eoe-ivory md:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-ivory/70">
              EXPERIENCES
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] md:text-4xl">
              Gatherings that linger
              <br />
              long after they end.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-eoe-ivory/80">
            From wine pairings and milestone birthdays to year-end functions and
            themed celebrations—tap a reel to watch the estate come alive.
          </p>
        </div>
      </div>

      {/* Reels — horizontal scroll of portrait videos */}
      <div className="mx-auto max-w-[1400px]">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5">
          {reels.map((reel, index) => (
            <motion.button
              key={reel.src}
              type="button"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.05 }}
              onClick={() => setActive({ type: "video", src: reel.src, caption: reel.title })}
              className="group relative w-[220px] shrink-0 snap-start text-left sm:w-[250px] md:w-[280px]"
            >
              <HoverVideo
                src={reel.src}
                poster={reel.poster}
                alt={reel.title}
                className="aspect-[9/16] rounded-3xl border border-eoe-ivory/10"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink/90 via-eoe-ink/10 to-eoe-ink/10" />
                <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-eoe-ivory/15 text-sm text-eoe-ivory backdrop-blur-sm transition group-hover:bg-eoe-gold group-hover:text-eoe-ivory">
                  ▶
                </span>
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-xl tracking-[0.14em]">
                    {reel.title}
                  </h3>
                  <p className="mt-1 text-xs text-eoe-ivory/75">{reel.blurb}</p>
                </div>
              </HoverVideo>
            </motion.button>
          ))}
        </div>
      </div>

      <Lightbox item={active} onClose={() => setActive(null)} />
    </section>
  );
}
