"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    quote:
      "It felt like hosting our wedding inside a magazine spread—effortless, intimate, and deeply us.",
    name: "Lebo & Sandile",
    event: "Intimate wedding",
  },
  {
    quote:
      "The team understood our brand immediately. Every detail of the launch dinner felt considered.",
    name: "Amara Studio",
    event: "Brand dinner",
  },
  {
    quote:
      "There&apos;s a stillness to the estate that makes conversations slower, deeper, and more honest.",
    name: "Thandeka",
    event: "Creative retreat",
  },
];

export function Testimonials() {
  return (
    <section className="border-t border-eoe-espresso/10 bg-eoe-espresso px-4 py-20 text-eoe-ivory md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] text-eoe-ivory/70">
              TESTIMONIALS
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] md:text-4xl">
              Words from
              <br />
              our guests.
            </h2>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 md:gap-6">
          {testimonials.map((t, index) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.08 }}
              className="min-w-[260px] rounded-3xl border border-eoe-ivory/12 bg-eoe-espresso/80 p-6 md:min-w-[320px] md:p-7"
            >
              <blockquote className="font-display text-xl leading-relaxed tracking-[0.12em] text-eoe-ivory/90 md:text-2xl">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 text-xs uppercase tracking-[0.22em] text-eoe-ivory/70">
                {t.name} • {t.event}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

