"use client";

import { motion } from "framer-motion";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";
import { DEFAULT_SITE_CONTENT } from "@/lib/content/defaults";
import type {
  ContactContent,
  ResolvedMedia,
  SiteDetails,
} from "@/lib/content/types";

export function Contact({
  content,
  site,
}: {
  content: ContactContent;
  site: SiteDetails<ResolvedMedia>;
}) {
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(site.mapsQuery)}`;

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
            <p className="mt-5 text-sm leading-relaxed text-eoe-ivory/95">
              {content.body}
            </p>
          </div>
          <div className="space-y-4 text-sm md:col-span-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Phone
              </p>
              <p className="mt-1 text-eoe-ivory">
                <a
                  href={site.phoneHref}
                  onClick={() => trackEvent(AnalyticsEvents.ContactPhone)}
                >
                  {site.phone}
                </a>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Instagram
              </p>
              <p className="mt-1">
                <a
                  href={site.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackEvent(AnalyticsEvents.ContactInstagram)}
                  className="underline-offset-4 hover:underline"
                >
                  {site.instagramHandle}
                </a>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Café office hours
              </p>
              <p className="mt-1 text-eoe-ivory">{site.officeHours}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Café dining
              </p>
              <p className="mt-1 text-eoe-ivory">
                {site.diningHours ??
                  DEFAULT_SITE_CONTENT.site.diningHours}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
                Private functions
              </p>
              <p className="mt-1 text-eoe-ivory">
                {site.privateFunctionsNote ??
                  DEFAULT_SITE_CONTENT.site.privateFunctionsNote}{" "}
                <a
                  href={site.phoneHref}
                  onClick={() => trackEvent(AnalyticsEvents.ContactPhone)}
                  className="underline underline-offset-2"
                >
                  {site.phone}
                </a>
              </p>
            </div>
          </div>
          <div className="space-y-4 text-sm md:col-span-3">
            <p className="text-xs uppercase tracking-[0.22em] text-eoe-ivory/80">
              Find us
            </p>
            <p className="text-eoe-ivory">
              {site.streetAddress}
              <br />
              {site.city}, {site.country}
            </p>
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent(AnalyticsEvents.ContactMaps)}
              className="block h-40 w-full overflow-hidden rounded-2xl border border-eoe-ivory/20 bg-eoe-ink/70 text-[11px] text-eoe-ivory/90 transition hover:border-eoe-gold/50"
            >
              <span className="flex h-full items-center justify-center px-4 text-center underline-offset-4 hover:underline">
                {content.mapsCta}
              </span>
            </a>
          </div>
        </motion.div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-eoe-ivory/15 pt-6 text-[11px] text-eoe-ivory/80 md:flex-row md:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <p>
              © {new Date().getFullYear()} {site.copyrightName}. All rights
              reserved.
            </p>
            <nav
              aria-label="Explore"
              className="flex flex-wrap gap-x-4 gap-y-1 uppercase tracking-[0.16em]"
            >
              {content.footerNav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (item.href.includes("menu")) {
                      trackEvent(AnalyticsEvents.CtaMenu, { source: "footer" });
                    } else if (item.href.includes("car-wash")) {
                      trackEvent(AnalyticsEvents.CtaCarWash, {
                        source: "footer",
                      });
                    } else if (item.href.includes("booking")) {
                      trackEvent(AnalyticsEvents.CtaBook, { source: "footer" });
                    } else if (item.href.includes("admin")) {
                      trackEvent(AnalyticsEvents.StaffLogin);
                    }
                  }}
                  className="hover:text-eoe-ivory hover:underline"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <p>
            Developed by{" "}
            <a
              href={site.developerUrl}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {site.developerName}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
