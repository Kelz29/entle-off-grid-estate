"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ContentImage } from "@/components/ui/ContentImage";
import { Lightbox, type MediaItem } from "@/components/ui/Lightbox";
import type { GalleryContent, ResolvedMedia } from "@/lib/content/types";

export function Gallery({
  content,
}: {
  content: GalleryContent<ResolvedMedia>;
}) {
  const [active, setActive] = useState<MediaItem | null>(null);

  return (
    <section
      id="gallery"
      className="border-t border-eoe-espresso/10 bg-eoe-espresso px-4 py-20 text-eoe-ivory md:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-ivory/90">
              {content.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] md:text-4xl">
              {content.title}
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm leading-relaxed text-eoe-ivory/95 md:block">
            {content.intro}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {content.items.map((photo, index) => (
            <motion.button
              key={`${photo.image.src}-${index}`}
              type="button"
              onClick={() =>
                setActive({
                  type: "image",
                  src: photo.image.src,
                  caption: photo.caption,
                })
              }
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: (index % 4) * 0.05 }}
              whileHover={{ y: -4 }}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-eoe-ivory/10 focus:outline-none"
            >
              <ContentImage
                src={photo.image.src}
                fallbackSrc={photo.image.fallbackSrc}
                alt={photo.alt}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-[2200ms] group-hover:scale-105"
              />
            </motion.button>
          ))}
        </div>
      </div>

      <Lightbox item={active} onClose={() => setActive(null)} />
    </section>
  );
}
