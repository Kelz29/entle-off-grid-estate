"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ResolvedSiteContent } from "@/lib/content/types";
import { MediaLibrary } from "./MediaLibrary";
import { ServicesEditor } from "./ServicesEditor";
import {
  CarWashForm,
  ContactForm,
  EstateForm,
  ExperiencesForm,
  FoodForm,
  GalleryForm,
  HeroForm,
  MenuForm,
  NavForm,
  SiteDetailsForm,
  SpacesForm,
  TestimonialsForm,
} from "./SectionForms";

const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then((r) => r.json());

type Tab = "media" | "site" | "home" | "menu" | "carWash" | "services";

const TABS: { id: Tab; label: string; shortLabel?: string }[] = [
  { id: "media", label: "Media" },
  { id: "site", label: "Site" },
  { id: "home", label: "Home" },
  { id: "menu", label: "Menu" },
  { id: "carWash", label: "Car wash", shortLabel: "Wash" },
  { id: "services", label: "Bookings copy", shortLabel: "Bookings" },
];

export function ContentPanel() {
  const { data, error, isLoading, mutate } = useSWR<{
    resource: ResolvedSiteContent;
  }>("/api/admin/content", fetcher);
  const [tab, setTab] = useState<Tab>("media");
  const resource = data?.resource;

  function onSaved(next: ResolvedSiteContent) {
    void mutate({ resource: next }, { revalidate: false });
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm leading-relaxed text-eoe-espresso/80">
        Edit the public website without a deploy. Uploaded files use the 150 MB
        library; the original photos stay as fallbacks if an upload is missing.
      </p>
      <div className="sticky top-0 z-10 -mx-3 bg-eoe-ivory/95 py-2 backdrop-blur sm:-mx-4 md:-mx-8">
        <div className="flex gap-2 overflow-x-auto px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-4 md:px-8 [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-11 shrink-0 rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.16em] sm:px-4 ${
                tab === t.id
                  ? "bg-eoe-espresso text-eoe-ivory"
                  : "border border-eoe-espresso/20 text-eoe-espresso hover:bg-eoe-ivory"
              }`}
            >
              <span className="sm:hidden">{t.shortLabel ?? t.label}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "media" && <MediaLibrary />}

      {tab !== "media" && tab !== "services" && isLoading && (
        <p className="text-sm text-eoe-espresso/70">Loading site copy…</p>
      )}
      {tab !== "media" && tab !== "services" && error && (
        <p className="text-sm text-red-700">Could not load site content.</p>
      )}

      {tab === "site" && resource && (
        <div className="space-y-6">
          <SiteDetailsForm resource={resource} onSaved={onSaved} />
          <NavForm resource={resource} onSaved={onSaved} />
        </div>
      )}

      {tab === "home" && resource && (
        <div className="space-y-6">
          <HeroForm resource={resource} onSaved={onSaved} />
          <EstateForm resource={resource} onSaved={onSaved} />
          <SpacesForm resource={resource} onSaved={onSaved} />
          <ExperiencesForm resource={resource} onSaved={onSaved} />
          <FoodForm resource={resource} onSaved={onSaved} />
          <GalleryForm resource={resource} onSaved={onSaved} />
          <TestimonialsForm resource={resource} onSaved={onSaved} />
          <ContactForm resource={resource} onSaved={onSaved} />
        </div>
      )}

      {tab === "menu" && resource && (
        <MenuForm resource={resource} onSaved={onSaved} />
      )}

      {tab === "carWash" && resource && (
        <CarWashForm resource={resource} onSaved={onSaved} />
      )}

      {tab === "services" && <ServicesEditor />}
    </div>
  );
}
