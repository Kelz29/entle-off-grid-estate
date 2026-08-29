"use client";

import { motion } from "framer-motion";
import { MobileScrollStrip, mobileScrollSlide } from "@/components/ui/MobileScrollStrip";
import type { TestimonialsContent } from "@/lib/content/types";

export function Testimonials({ content }: { content: TestimonialsContent }) {
  return (
    <section className="border-t border-eoe-espresso/10 bg-eoe-espresso px-4 py-20 text-eoe-ivory md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-ivory/90">
              {content.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] md:text-4xl">
              {content.titleLines.map((line, i) => (
                <span key={`${line}-${i}`}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </h2>
          </div>
        </div>

        <MobileScrollStrip
          outerClassName="md:mx-0 md:overflow-visible md:pl-0"
          trackClassName="gap-4 md:grid md:w-full md:max-w-none md:grid-cols-3 md:gap-6 md:snap-none md:pr-0 md:pb-0"
        >
          {content.items.map((t, index) => (
            <motion.figure
              key={`${t.name}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.08 }}
              className={`rounded-3xl border border-eoe-ivory/12 bg-eoe-espresso/80 p-6 md:p-7 ${mobileScrollSlide} md:min-w-0`}
            >
              <blockquote className="font-display text-xl leading-relaxed tracking-[0.12em] text-eoe-ivory/90 md:text-2xl">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 text-xs uppercase tracking-[0.22em] text-eoe-ivory/90">
                {t.name} • {t.event}
              </figcaption>
            </motion.figure>
          ))}
        </MobileScrollStrip>
      </div>
    </section>
  );
}
