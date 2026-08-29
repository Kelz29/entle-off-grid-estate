"use client";

import { motion } from "framer-motion";
import { ContentImage } from "@/components/ui/ContentImage";
import type { EstateContent, ResolvedMedia } from "@/lib/content/types";

export function Estate({ content }: { content: EstateContent<ResolvedMedia> }) {
  return (
    <section
      id="estate"
      className="relative overflow-x-clip border-t border-eoe-espresso/10 bg-eoe-ivory px-4 py-20 md:px-6 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-60 mix-blend-soft-light" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 md:flex-row md:items-center md:gap-10 lg:gap-12">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="group relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-eoe-espresso/10 md:w-[45%] md:shrink-0"
        >
          <ContentImage
            src={content.image.src}
            fallbackSrc={content.image.fallbackSrc}
            alt={content.alt}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-[3500ms] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink/50 to-transparent" />
          <p className="absolute bottom-5 left-5 text-xs uppercase tracking-[0.24em] text-eoe-ivory/90">
            {content.caption}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
          className="min-w-0 md:flex-1"
        >
          <p className="mb-4 text-xs tracking-[0.3em] text-eoe-espresso">
            {content.eyebrow}
          </p>
          <h2 className="font-display text-4xl tracking-[0.18em] text-eoe-espresso md:text-5xl">
            {content.titleLines.map((line, i) => (
              <span key={`${line}-${i}`}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
          {content.paragraphs.map((p, i) => (
            <p
              key={i}
              className={`text-sm leading-relaxed text-eoe-ink/90 md:text-base ${
                i === 0 ? "mt-6" : "mt-4"
              }`}
            >
              {p}
            </p>
          ))}
          <p className="mt-8 text-xs uppercase tracking-[0.24em] text-eoe-espresso">
            {content.footer}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
