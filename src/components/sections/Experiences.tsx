"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const experiences = [
  {
    title: "Sunday Brunch Club",
    date: "Selected Sundays",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Private Dinners",
    date: "By appointment",
    image:
      "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Creative Retreats",
    date: "Seasonal",
    image:
      "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Brand & Content Shoots",
    date: "Weekdays",
    image:
      "https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?auto=format&fit=crop&w=1200&q=80",
  },
];

export function Experiences() {
  return (
    <section
      id="experiences"
      className="border-t border-eoe-espresso/10 bg-eoe-espresso/95 px-4 py-20 text-eoe-ivory md:px-6 lg:px-8"
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
            From brunch series and chef&apos;s tables to pop-ups and creative
            residencies, the estate is a canvas for experiences that feel
            deeply personal.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-12">
          {experiences.map((exp, index) => (
            <motion.article
              key={exp.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.06 }}
              className={`group relative overflow-hidden rounded-3xl border border-eoe-ivory/8 bg-eoe-ink/60 ${
                index === 0
                  ? "md:col-span-7 md:row-span-2"
                  : "md:col-span-5 md:row-span-1"
              }`}
            >
              <div className="relative h-64 md:h-full">
                <Image
                  src={exp.image}
                  alt={exp.title}
                  fill
                  className="object-cover transition-transform duration-[2500ms] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-eoe-ink via-eoe-ink/40 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-eoe-ivory/70">
                  {exp.date}
                </p>
                <h3 className="font-display text-xl tracking-[0.18em]">
                  {exp.title}
                </h3>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

