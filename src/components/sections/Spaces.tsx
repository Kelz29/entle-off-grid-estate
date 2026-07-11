"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { spaces } from "@/lib/media";

export function Spaces() {
  return (
    <section
      id="spaces"
      className="border-t border-eoe-espresso/10 bg-eoe-ivory px-4 py-20 md:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-baseline justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-espresso/70">SPACES</p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] text-eoe-espresso md:text-4xl">
              Rooms for every
              <br />
              kind of gathering.
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm leading-relaxed text-eoe-espresso/80 md:block">
            Choose from our café, venue, or open garden. Each space can be
            tailored with our in-house styling partners and preferred suppliers.
          </p>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible">
          {spaces.map((space, index) => (
            <motion.article
              key={space.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.08 }}
              className="group relative min-w-[260px] overflow-hidden rounded-3xl border border-eoe-espresso/10"
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src={space.src}
                  alt={space.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 80vw"
                  className="object-cover transition-transform duration-[2200ms] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink/85 via-eoe-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 text-eoe-ivory">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-gold">
                    {space.capacity}
                  </p>
                  <h3 className="font-display text-2xl tracking-[0.16em]">
                    {space.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-eoe-ivory/85">
                    {space.blurb}
                  </p>
                  <a
                    href="#booking"
                    className="mt-2 inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:text-eoe-gold"
                  >
                    Enquire
                    <span className="ml-2 h-px w-6 bg-eoe-ivory/50 transition-all group-hover:w-10 group-hover:bg-eoe-gold" />
                  </a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
