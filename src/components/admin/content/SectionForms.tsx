"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  ResolvedSiteContent,
  SiteSectionKey,
} from "@/lib/content/types";
import { overlayFromResolvedSection } from "@/lib/content/resolve";
import { DEFAULT_SITE_CONTENT } from "@/lib/content/defaults";
import {
  Card,
  LinesField,
  NumberField,
  RowActions,
  SaveBar,
  TextArea,
  TextField,
  moveItem,
} from "./fields";
import { MediaPicker } from "./MediaPicker";

async function patchContent(body: unknown) {
  const res = await fetch("/api/admin/content", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.detail ?? "Could not save");
  return d as { resource: ResolvedSiteContent };
}

function useSection<K extends SiteSectionKey>(
  key: K,
  resource: ResolvedSiteContent,
  onSaved: (next: ResolvedSiteContent) => void
) {
  const [draft, setDraft] = useState(resource);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(resource);
  }, [resource]);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const data = overlayFromResolvedSection(key, draft);
      const out = await patchContent({ section: key, data });
      onSaved(out.resource);
      setMsg("Saved ✓");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("Reset this section to the original website copy?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await patchContent({ reset: [key] });
      onSaved(out.resource);
      setMsg("Reset to default ✓");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not reset");
    } finally {
      setBusy(false);
    }
  }

  return { draft, setDraft, busy, msg, save, reset };
}

export function SiteDetailsForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "site",
    resource,
    onSaved
  );
  const s = draft.site;
  const set = (patch: Partial<typeof s>) =>
    setDraft({ ...draft, site: { ...s, ...patch } });
  return (
    <Card
      title="Site details"
      hint="Name, search listing, phone, address, hours, and Instagram."
      collapsible
      defaultOpen
    >
      <TextField label="Name" value={s.name} onChange={(name) => set({ name })} />
      <TextField
        label="Search title"
        value={s.seoTitle}
        onChange={(seoTitle) => set({ seoTitle })}
        maxLength={70}
      />
      <TextArea
        label="Search description"
        value={s.description}
        onChange={(description) => set({ description })}
        maxLength={400}
      />
      <MediaPicker
        label="Share image"
        value={s.ogImage}
        onChange={(ogImage) => set({ ogImage })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Phone" value={s.phone} onChange={(phone) => set({ phone })} />
        <TextField
          label="Phone link"
          value={s.phoneHref}
          onChange={(phoneHref) => set({ phoneHref })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Instagram handle"
          value={s.instagramHandle}
          onChange={(instagramHandle) => set({ instagramHandle })}
        />
        <TextField
          label="Instagram URL"
          value={s.instagramUrl}
          onChange={(instagramUrl) => set({ instagramUrl })}
        />
      </div>
      <TextField
        label="Street address"
        value={s.streetAddress}
        onChange={(streetAddress) => set({ streetAddress })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="City" value={s.city} onChange={(city) => set({ city })} />
        <TextField
          label="Province / region"
          value={s.region}
          onChange={(region) => set({ region })}
        />
      </div>
      <TextField label="Country" value={s.country} onChange={(country) => set({ country })} />
      <TextField
        label="Maps search"
        value={s.mapsQuery}
        onChange={(mapsQuery) => set({ mapsQuery })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Latitude (optional)"
          value={s.latitude}
          onChange={(latitude) => set({ latitude })}
          placeholder="-29.0852"
        />
        <TextField
          label="Longitude (optional)"
          value={s.longitude}
          onChange={(longitude) => set({ longitude })}
          placeholder="26.1596"
        />
      </div>
      <TextField
        label="Office hours"
        value={s.officeHours}
        onChange={(officeHours) => set({ officeHours })}
      />
      <TextField
        label="Café dining (online booking)"
        value={s.diningHours ?? DEFAULT_SITE_CONTENT.site.diningHours}
        onChange={(diningHours) => set({ diningHours })}
      />
      <TextArea
        label="Private functions note"
        value={
          s.privateFunctionsNote ??
          DEFAULT_SITE_CONTENT.site.privateFunctionsNote
        }
        onChange={(privateFunctionsNote) => set({ privateFunctionsNote })}
        maxLength={200}
      />
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function NavForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "nav",
    resource,
    onSaved
  );
  const n = draft.nav;
  return (
    <Card title="Navigation" hint="Header brand and links." collapsible defaultOpen={false}>
      <TextField
        label="Brand"
        value={n.brandName}
        onChange={(brandName) => setDraft({ ...draft, nav: { ...n, brandName } })}
      />
      <TextField
        label="Book button"
        value={n.bookCta}
        onChange={(bookCta) => setDraft({ ...draft, nav: { ...n, bookCta } })}
      />
      {n.items.map((item, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-eoe-espresso/10 p-3 sm:grid-cols-2">
          <TextField
            label="Label"
            value={item.label}
            onChange={(label) => {
              const items = n.items.map((it, idx) =>
                idx === i ? { ...it, label } : it
              );
              setDraft({ ...draft, nav: { ...n, items } });
            }}
          />
          <TextField
            label="Link"
            value={item.href}
            onChange={(href) => {
              const items = n.items.map((it, idx) =>
                idx === i ? { ...it, href } : it
              );
              setDraft({ ...draft, nav: { ...n, items } });
            }}
          />
          <RowActions
            onUp={() =>
              setDraft({ ...draft, nav: { ...n, items: moveItem(n.items, i, -1) } })
            }
            onDown={() =>
              setDraft({ ...draft, nav: { ...n, items: moveItem(n.items, i, 1) } })
            }
            onRemove={() =>
              setDraft({
                ...draft,
                nav: { ...n, items: n.items.filter((_, idx) => idx !== i) },
              })
            }
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setDraft({
            ...draft,
            nav: { ...n, items: [...n.items, { href: "#", label: "New" }] },
          })
        }
        className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso"
      >
        + Add link
      </button>
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function HeroForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "hero",
    resource,
    onSaved
  );
  const h = draft.hero;
  const set = (patch: Partial<typeof h>) =>
    setDraft({ ...draft, hero: { ...h, ...patch } });
  return (
    <Card title="Hero" collapsible>
      <TextField label="Eyebrow" value={h.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
      <LinesField label="Headline" value={h.titleLines} onChange={(titleLines) => set({ titleLines })} />
      <TextField label="Subtitle" value={h.subtitle} onChange={(subtitle) => set({ subtitle })} />
      <TextArea label="Body" value={h.body} onChange={(body) => set({ body })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Primary button"
          value={h.primaryCta.label}
          onChange={(label) => set({ primaryCta: { ...h.primaryCta, label } })}
        />
        <TextField
          label="Primary link"
          value={h.primaryCta.href}
          onChange={(href) => set({ primaryCta: { ...h.primaryCta, href } })}
        />
        <TextField
          label="Secondary button"
          value={h.secondaryCta.label}
          onChange={(label) => set({ secondaryCta: { ...h.secondaryCta, label } })}
        />
        <TextField
          label="Secondary link"
          value={h.secondaryCta.href}
          onChange={(href) => set({ secondaryCta: { ...h.secondaryCta, href } })}
        />
      </div>
      <MediaPicker label="Poster" value={h.poster} onChange={(poster) => set({ poster })} />
      <MediaPicker
        label="Video"
        kind="video"
        value={h.video}
        onChange={(video) => set({ video })}
      />
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function EstateForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "estate",
    resource,
    onSaved
  );
  const e = draft.estate;
  const set = (patch: Partial<typeof e>) =>
    setDraft({ ...draft, estate: { ...e, ...patch } });
  return (
    <Card title="Estate" collapsible defaultOpen={false}>
      <TextField label="Eyebrow" value={e.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
      <LinesField label="Headline" value={e.titleLines} onChange={(titleLines) => set({ titleLines })} />
      <LinesField
        label="Paragraphs"
        value={e.paragraphs}
        onChange={(paragraphs) => set({ paragraphs })}
      />
      <TextField label="Footer line" value={e.footer} onChange={(footer) => set({ footer })} />
      <MediaPicker label="Photo" value={e.image} onChange={(image) => set({ image })} />
      <TextField label="Caption" value={e.caption} onChange={(caption) => set({ caption })} />
      <TextField label="Alt text" value={e.alt} onChange={(alt) => set({ alt })} />
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function SpacesForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "spaces",
    resource,
    onSaved
  );
  const s = draft.spaces;
  const setItems = (items: typeof s.items) =>
    setDraft({ ...draft, spaces: { ...s, items } });
  return (
    <Card title="Spaces" collapsible defaultOpen={false}>
      <TextField
        label="Eyebrow"
        value={s.eyebrow}
        onChange={(eyebrow) => setDraft({ ...draft, spaces: { ...s, eyebrow } })}
      />
      <LinesField
        label="Headline"
        value={s.titleLines}
        onChange={(titleLines) => setDraft({ ...draft, spaces: { ...s, titleLines } })}
      />
      <TextArea
        label="Intro"
        value={s.intro}
        onChange={(intro) => setDraft({ ...draft, spaces: { ...s, intro } })}
      />
      {s.items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-eoe-espresso/10 p-3">
          <TextField
            label="Title"
            value={item.title}
            onChange={(title) =>
              setItems(s.items.map((it, idx) => (idx === i ? { ...it, title } : it)))
            }
          />
          <TextField
            label="Capacity"
            value={item.capacity}
            onChange={(capacity) =>
              setItems(s.items.map((it, idx) => (idx === i ? { ...it, capacity } : it)))
            }
          />
          <TextArea
            label="Blurb"
            value={item.blurb}
            onChange={(blurb) =>
              setItems(s.items.map((it, idx) => (idx === i ? { ...it, blurb } : it)))
            }
          />
          <MediaPicker
            label="Photo"
            value={item.image}
            onChange={(image) =>
              setItems(s.items.map((it, idx) => (idx === i ? { ...it, image } : it)))
            }
          />
          <RowActions
            onUp={() => setItems(moveItem(s.items, i, -1))}
            onDown={() => setItems(moveItem(s.items, i, 1))}
            onRemove={() => setItems(s.items.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function ExperiencesForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "experiences",
    resource,
    onSaved
  );
  const e = draft.experiences;
  const setItems = (items: typeof e.items) =>
    setDraft({ ...draft, experiences: { ...e, items } });
  return (
    <Card title="Experiences" collapsible defaultOpen={false}>
      <TextField
        label="Eyebrow"
        value={e.eyebrow}
        onChange={(eyebrow) => setDraft({ ...draft, experiences: { ...e, eyebrow } })}
      />
      <LinesField
        label="Headline"
        value={e.titleLines}
        onChange={(titleLines) => setDraft({ ...draft, experiences: { ...e, titleLines } })}
      />
      <TextArea
        label="Intro"
        value={e.intro}
        onChange={(intro) => setDraft({ ...draft, experiences: { ...e, intro } })}
      />
      {e.items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-eoe-espresso/10 p-3">
          <TextField
            label="Title"
            value={item.title}
            onChange={(title) =>
              setItems(e.items.map((it, idx) => (idx === i ? { ...it, title } : it)))
            }
          />
          <TextField
            label="Blurb"
            value={item.blurb}
            onChange={(blurb) =>
              setItems(e.items.map((it, idx) => (idx === i ? { ...it, blurb } : it)))
            }
          />
          <MediaPicker
            label="Poster"
            value={item.poster}
            onChange={(poster) =>
              setItems(e.items.map((it, idx) => (idx === i ? { ...it, poster } : it)))
            }
          />
          <MediaPicker
            label="Video"
            kind="video"
            value={item.video}
            onChange={(video) =>
              setItems(e.items.map((it, idx) => (idx === i ? { ...it, video } : it)))
            }
          />
          <RowActions
            onUp={() => setItems(moveItem(e.items, i, -1))}
            onDown={() => setItems(moveItem(e.items, i, 1))}
            onRemove={() => setItems(e.items.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function FoodForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "food",
    resource,
    onSaved
  );
  const f = draft.food;
  const set = (patch: Partial<typeof f>) =>
    setDraft({ ...draft, food: { ...f, ...patch } });
  return (
    <Card title="The Table" collapsible defaultOpen={false}>
      <TextField label="Eyebrow" value={f.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
      <LinesField label="Headline" value={f.titleLines} onChange={(titleLines) => set({ titleLines })} />
      <TextArea label="Body" value={f.body} onChange={(body) => set({ body })} />
      <LinesField label="Tags" value={f.tags} onChange={(tags) => set({ tags })} />
      <MediaPicker label="Photo" value={f.image} onChange={(image) => set({ image })} />
      <TextField label="Credit" value={f.credit} onChange={(credit) => set({ credit })} />
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function GalleryForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "gallery",
    resource,
    onSaved
  );
  const g = draft.gallery;
  const setItems = (items: typeof g.items) =>
    setDraft({ ...draft, gallery: { ...g, items } });
  return (
    <Card title="Gallery" collapsible defaultOpen={false}>
      <TextField
        label="Eyebrow"
        value={g.eyebrow}
        onChange={(eyebrow) => setDraft({ ...draft, gallery: { ...g, eyebrow } })}
      />
      <TextField
        label="Title"
        value={g.title}
        onChange={(title) => setDraft({ ...draft, gallery: { ...g, title } })}
      />
      <TextArea
        label="Intro"
        value={g.intro}
        onChange={(intro) => setDraft({ ...draft, gallery: { ...g, intro } })}
      />
      {g.items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-eoe-espresso/10 p-3">
          <MediaPicker
            label="Photo"
            value={item.image}
            onChange={(image) =>
              setItems(g.items.map((it, idx) => (idx === i ? { ...it, image } : it)))
            }
          />
          <TextField
            label="Caption"
            value={item.caption}
            onChange={(caption) =>
              setItems(g.items.map((it, idx) => (idx === i ? { ...it, caption } : it)))
            }
          />
          <RowActions
            onUp={() => setItems(moveItem(g.items, i, -1))}
            onDown={() => setItems(moveItem(g.items, i, 1))}
            onRemove={() => setItems(g.items.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setItems([
            ...g.items,
            {
              image: g.items[0]?.image ?? {
                source: "default",
                src: "/outdoor/eoe.jpg",
                fallbackSrc: "/outdoor/eoe.jpg",
              },
              caption: "New photo",
              alt: "Estate photo",
            },
          ])
        }
        className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso"
      >
        + Add photo
      </button>
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function TestimonialsForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "testimonials",
    resource,
    onSaved
  );
  const t = draft.testimonials;
  const setItems = (items: typeof t.items) =>
    setDraft({ ...draft, testimonials: { ...t, items } });
  return (
    <Card title="Testimonials" collapsible defaultOpen={false}>
      <LinesField
        label="Headline"
        value={t.titleLines}
        onChange={(titleLines) =>
          setDraft({ ...draft, testimonials: { ...t, titleLines } })
        }
      />
      {t.items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-eoe-espresso/10 p-3">
          <TextArea
            label="Quote"
            value={item.quote}
            onChange={(quote) =>
              setItems(t.items.map((it, idx) => (idx === i ? { ...it, quote } : it)))
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Name"
              value={item.name}
              onChange={(name) =>
                setItems(t.items.map((it, idx) => (idx === i ? { ...it, name } : it)))
              }
            />
            <TextField
              label="Occasion"
              value={item.event}
              onChange={(event) =>
                setItems(t.items.map((it, idx) => (idx === i ? { ...it, event } : it)))
              }
            />
          </div>
          <RowActions
            onUp={() => setItems(moveItem(t.items, i, -1))}
            onDown={() => setItems(moveItem(t.items, i, 1))}
            onRemove={() => setItems(t.items.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function ContactForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "contact",
    resource,
    onSaved
  );
  const c = draft.contact;
  const set = (patch: Partial<typeof c>) =>
    setDraft({ ...draft, contact: { ...c, ...patch } });
  return (
    <Card
      title="Contact footer"
      hint="Phone and address live under Site details. Hours shown here come from Site details (office, dining, private functions)."
      collapsible
      defaultOpen={false}
    >
      <TextField label="Eyebrow" value={c.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
      <LinesField label="Headline" value={c.titleLines} onChange={(titleLines) => set({ titleLines })} />
      <TextArea label="Body" value={c.body} onChange={(body) => set({ body })} />
      <TextField label="Maps button" value={c.mapsCta} onChange={(mapsCta) => set({ mapsCta })} />
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function MenuForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "menu",
    resource,
    onSaved
  );
  const m = draft.menu;
  return (
    <Card
      title="Café menu"
      hint="Display only — the booking widget still charges the per-guest deposit."
      collapsible
      defaultOpen
    >
      <TextField
        label="Page title"
        value={m.title}
        onChange={(title) => setDraft({ ...draft, menu: { ...m, title } })}
      />
      <TextArea
        label="Intro"
        value={m.intro}
        onChange={(intro) => setDraft({ ...draft, menu: { ...m, intro } })}
      />
      {m.categories.map((cat, ci) => (
        <div key={cat.id} className="space-y-3 rounded-xl border border-eoe-espresso/10 p-3">
          <TextField
            label="Category"
            value={cat.label}
            onChange={(label) => {
              const categories = m.categories.map((c, i) =>
                i === ci ? { ...c, label } : c
              );
              setDraft({ ...draft, menu: { ...m, categories } });
            }}
          />
          {cat.sections.map((section, si) => (
            <div key={section.id} className="space-y-2 rounded-xl bg-eoe-ivory p-3">
              <TextField
                label="Section"
                value={section.title}
                onChange={(title) => {
                  const categories = m.categories.map((c, i) => {
                    if (i !== ci) return c;
                    return {
                      ...c,
                      sections: c.sections.map((s, j) =>
                        j === si ? { ...s, title } : s
                      ),
                    };
                  });
                  setDraft({ ...draft, menu: { ...m, categories } });
                }}
              />
              {section.items.map((item, ii) => (
                <div key={ii} className="grid gap-2 sm:grid-cols-[1fr_80px]">
                  <TextField
                    label="Dish"
                    value={item.name}
                    onChange={(name) => {
                      const categories = m.categories.map((c, i) => {
                        if (i !== ci) return c;
                        return {
                          ...c,
                          sections: c.sections.map((s, j) => {
                            if (j !== si) return s;
                            return {
                              ...s,
                              items: s.items.map((it, k) =>
                                k === ii ? { ...it, name } : it
                              ),
                            };
                          }),
                        };
                      });
                      setDraft({ ...draft, menu: { ...m, categories } });
                    }}
                  />
                  <NumberField
                    label="Price (R)"
                    value={item.price}
                    onChange={(price) => {
                      const categories = m.categories.map((c, i) => {
                        if (i !== ci) return c;
                        return {
                          ...c,
                          sections: c.sections.map((s, j) => {
                            if (j !== si) return s;
                            return {
                              ...s,
                              items: s.items.map((it, k) =>
                                k === ii ? { ...it, price } : it
                              ),
                            };
                          }),
                        };
                      });
                      setDraft({ ...draft, menu: { ...m, categories } });
                    }}
                  />
                  <div className="sm:col-span-2">
                    <TextArea
                      label="Description"
                      value={item.description}
                      onChange={(description) => {
                        const categories = m.categories.map((c, i) => {
                          if (i !== ci) return c;
                          return {
                            ...c,
                            sections: c.sections.map((s, j) => {
                              if (j !== si) return s;
                              return {
                                ...s,
                                items: s.items.map((it, k) =>
                                  k === ii ? { ...it, description } : it
                                ),
                              };
                            }),
                          };
                        });
                        setDraft({ ...draft, menu: { ...m, categories } });
                      }}
                    />
                  </div>
                </div>
              ))}
              {section.sides !== undefined && (
                <TextArea
                  label="Sides line"
                  value={section.sides}
                  onChange={(sides) => {
                    const categories = m.categories.map((c, i) => {
                      if (i !== ci) return c;
                      return {
                        ...c,
                        sections: c.sections.map((s, j) =>
                          j === si ? { ...s, sides } : s
                        ),
                      };
                    });
                    setDraft({ ...draft, menu: { ...m, categories } });
                  }}
                />
              )}
            </div>
          ))}
        </div>
      ))}
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}

export function CarWashForm({
  resource,
  onSaved,
}: {
  resource: ResolvedSiteContent;
  onSaved: (next: ResolvedSiteContent) => void;
}) {
  const { draft, setDraft, busy, msg, save, reset } = useSection(
    "carWash",
    resource,
    onSaved
  );
  const c = draft.carWash;
  const set = (patch: Partial<typeof c>) =>
    setDraft({ ...draft, carWash: { ...c, ...patch } });
  return (
    <Card
      title="Car wash"
      hint="Tier prices here are what guests pay at checkout. Keep them in rands."
      collapsible
      defaultOpen
    >
      <TextField label="Eyebrow" value={c.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
      <TextField label="Title" value={c.title} onChange={(title) => set({ title })} />
      <TextField label="Tagline" value={c.tagline} onChange={(tagline) => set({ tagline })} />
      <TextArea label="Note" value={c.note} onChange={(note) => set({ note })} />
      <TextArea
        label="Reservation note"
        value={c.reservation}
        onChange={(reservation) => set({ reservation })}
      />
      {c.pricing.map((tier, i) => (
        <div key={tier.id} className="grid gap-2 rounded-xl border border-eoe-espresso/10 p-3 sm:grid-cols-3">
          <TextField
            label="Label"
            value={tier.label}
            onChange={(label) =>
              set({
                pricing: c.pricing.map((t, idx) =>
                  idx === i ? { ...t, label } : t
                ),
              })
            }
          />
          <TextField
            label="Detail"
            value={tier.detail}
            onChange={(detail) =>
              set({
                pricing: c.pricing.map((t, idx) =>
                  idx === i ? { ...t, detail } : t
                ),
              })
            }
          />
          <NumberField
            label="Price (R)"
            value={tier.price}
            onChange={(price) =>
              set({
                pricing: c.pricing.map((t, idx) =>
                  idx === i ? { ...t, price } : t
                ),
              })
            }
          />
        </div>
      ))}
      {c.includes.map((item, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-2">
          <TextField
            label="Include"
            value={item.title}
            onChange={(title) =>
              set({
                includes: c.includes.map((it, idx) =>
                  idx === i ? { ...it, title } : it
                ),
              })
            }
          />
          <TextField
            label="Detail"
            value={item.detail}
            onChange={(detail) =>
              set({
                includes: c.includes.map((it, idx) =>
                  idx === i ? { ...it, detail } : it
                ),
              })
            }
          />
        </div>
      ))}
      <SaveBar busy={busy} msg={msg} onSave={save} onReset={reset} />
    </Card>
  );
}
