"use client";

import { motion } from "framer-motion";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

export function Contact() {
  return (
    <footer
      id="contact"
      className="border-t border-eoe-espresso/15 bg-eoe-espresso/98 px-4 pb-10 pt-16 text-eoe-ivory md:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="grid gap-10 md:grid-cols-12"
        >
          <div className="md:col-span-5">
            <p className="text-xs tracking-[0.3em] text-eoe-ivory/90">
              CONTACT
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-[0.18em] md:text-4xl">
              Visit, linger,
              <br />
              return often.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-eoe-ivory/95">
              We&apos;re a short drive from the city, but designed to feel
              worlds away. Reach out to plan your visit or private event.
            </p>
          </div>
          <div className="space-y-4 text-sm md:col-span-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Phone
              </p>
              <p className="mt-1 text-eoe-ivory">
                <a
                  href="tel:+27673662302"
                  onClick={() => trackEvent(AnalyticsEvents.ContactPhone)}
                >
                  067 366 2302
                </a>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Instagram
              </p>
              <p className="mt-1">
                <a
                  href="https://instagram.com/entle_off_grid_estate"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent(AnalyticsEvents.ContactInstagram)}
                  className="underline-offset-4 hover:underline"
                >
                  @entle_off_grid_estate
                </a>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Cafe Office Hours
              </p>
              <p className="mt-1 text-eoe-ivory">
                Mon to Fri · 8:00 to 16:30
              </p>
            </div>
          </div>
          <div className="space-y-4 text-sm md:col-span-3">
            <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
              Find us
            </p>
            <p className="text-eoe-ivory">
              182 Lakeview
              <br />
              Bloemfontein, South Africa
            </p>
            <a
              href="https://maps.google.com/?q=183+Lakeview,+Bloemfontein,+South+Africa"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent(AnalyticsEvents.ContactMaps)}
              className="block h-40 w-full overflow-hidden rounded-2xl border border-eoe-ivory/20 bg-eoe-ink/70 text-[11px] text-eoe-ivory/90 transition hover:border-eoe-gold/50"
            >
              <span className="flex h-full items-center justify-center px-4 text-center underline-offset-4 hover:underline">
                Open in Google Maps →
              </span>
            </a>
          </div>
        </motion.div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-eoe-ivory/15 pt-6 text-[11px] text-eoe-ivory/80 md:flex-row md:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <p>© {new Date().getFullYear()} Entle Off Grid Estate. All rights reserved.</p>
            <nav
              aria-label="Explore"
              className="flex flex-wrap gap-x-4 gap-y-1 uppercase tracking-[0.16em]"
            >
              <a
                href="/menu"
                onClick={() =>
                  trackEvent(AnalyticsEvents.CtaMenu, { source: "footer" })
                }
                className="hover:text-eoe-ivory hover:underline"
              >
                Menu
              </a>
              <a
                href="/car-wash"
                onClick={() =>
                  trackEvent(AnalyticsEvents.CtaCarWash, { source: "footer" })
                }
                className="hover:text-eoe-ivory hover:underline"
              >
                Car wash
              </a>
              <a
                href="/#booking"
                onClick={() =>
                  trackEvent(AnalyticsEvents.CtaBook, { source: "footer" })
                }
                className="hover:text-eoe-ivory hover:underline"
              >
                Book
              </a>
              <a
                href="/admin/login"
                onClick={() => trackEvent(AnalyticsEvents.StaffLogin)}
                className="hover:text-eoe-ivory hover:underline"
              >
                Staff
              </a>
            </nav>
          </div>
          <p>
            Developed by{" "}
            <a
              href="https://smartmacmane.co.za/"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Smart Macmane Pty Ltd
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

