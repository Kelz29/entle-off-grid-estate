"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const spaces = [
  {
    title: "The Cafe",
    description: "Indoor eatery for slow brunches, work sessions, and intimate dates.",
    capacity: "Up to 40 seated",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "The Venue",
    description: "A considered space for private celebrations, brand gatherings, and retreats.",
    capacity: "Up to 80 seated / 120 cocktail",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "The Garden",
    description: "Outdoor lawns that spill into the horizon—perfect for ceremonies and sundowners.",
    capacity: "Flexible lawn layouts",
    image:
      "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=1200&q=80",
  },
];

export function Spaces() {
  return (
    <section
      id="spaces"
      className="border-t border-eoe-espresso/10 bg-eoe-ivory px-4 py-20 md:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-baseline justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-espresso/70">
              SPACES
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] text-eoe-espresso md:text-4xl">
              Rooms for every
              <br />
              kind of gathering.
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm leading-relaxed text-eoe-espresso/80 md:block">
            Choose from our cafe, venue hall, or open garden. Each space can be
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
              className="group relative min-w-[260px] overflow-hidden rounded-3xl border border-eoe-espresso/10 bg-eoe-ivory"
            >
              <div className="relative h-64 overflow-hidden">
                <Image
                  src={space.image}
                  alt={space.title}
                  fill
                  className="object-cover transition-transform duration-[2200ms] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-eoe-espresso/70 via-transparent to-transparent opacity-80" />
              </div>
              <div className="flex flex-col gap-3 px-5 pb-6 pt-5">
                <h3 className="font-display text-lg tracking-[0.18em] text-eoe-espresso">
                  {space.title}
                </h3>
                <p className="text-xs uppercase tracking-[0.22em] text-eoe-espresso/60">
                  {space.capacity}
                </p>
                <p className="text-sm leading-relaxed text-eoe-espresso/80">
                  {space.description}
                </p>
                <div className="mt-3">
                  <a
                    href="#booking"
                    className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:text-eoe-gold"
                  >
                    Enquire
                    <span className="ml-2 h-px w-6 bg-eoe-espresso/50 group-hover:w-10 group-hover:bg-eoe-gold transition-all" />
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

