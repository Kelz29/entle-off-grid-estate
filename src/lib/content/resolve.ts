import { DEFAULT_SITE_CONTENT } from "./defaults";
import type {
  CarWashContent,
  CarWashInclude,
  CarWashTier,
  ContactContent,
  CtaLink,
  EstateContent,
  ExperiencesContent,
  FoodContent,
  GalleryContent,
  GalleryItem,
  HeroContent,
  MediaRef,
  MenuCategoryContent,
  MenuItemContent,
  MenuPageContent,
  MenuSectionContent,
  NavContent,
  NavItem,
  ReelItem,
  ResolvedMedia,
  ResolvedSiteContent,
  SiteContent,
  SiteContentOverlay,
  SiteDetails,
  SiteSectionKey,
  SpaceItem,
  SpacesContent,
  TestimonialsContent,
  TestimonialItem,
} from "./types";
import { SITE_SECTION_KEYS } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function trimStr(
  value: unknown,
  fallback: string,
  max: number,
  allowEmpty = false
): string {
  if (typeof value !== "string") return fallback;
  const t = value.trim();
  if (!t && !allowEmpty) return fallback;
  return t.slice(0, max);
}

function asObj(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function strList(
  value: unknown,
  fallback: string[],
  maxItems: number,
  maxLen: number
): string[] {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const out = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
  return out.length > 0 ? out : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cta(raw: unknown, fallback: CtaLink, labelMax = 80): CtaLink {
  const o = asObj(raw);
  return {
    label: trimStr(o.label, fallback.label, labelMax),
    href: trimStr(o.href, fallback.href, 300),
  };
}

function navItems(raw: unknown, fallback: NavItem[]): NavItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  const out: NavItem[] = [];
  for (const item of raw.slice(0, 16)) {
    const o = asObj(item);
    const href = trimStr(o.href, "", 300, true);
    const label = trimStr(o.label, "", 80, true);
    if (!href || !label) continue;
    out.push({ href, label });
  }
  return out.length > 0 ? out : fallback;
}

export function normalizeMedia(raw: unknown, fallbackSrc: string): MediaRef {
  const fb = fallbackSrc.startsWith("/") ? fallbackSrc : `/${fallbackSrc}`;
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("/api/media/")) {
    return { source: "default", src: raw.slice(0, 500) };
  }
  const o = asObj(raw);
  if (o.source === "upload" && typeof o.id === "string" && UUID_RE.test(o.id)) {
    const fallback =
      typeof o.fallbackSrc === "string" && o.fallbackSrc.startsWith("/")
        ? o.fallbackSrc.slice(0, 500)
        : fb;
    return { source: "upload", id: o.id, fallbackSrc: fallback };
  }
  if (typeof o.src === "string" && o.src.startsWith("/") && !o.src.startsWith("/api/media/")) {
    return { source: "default", src: o.src.slice(0, 500) };
  }
  return { source: "default", src: fb };
}

export function resolveMedia(ref: MediaRef): ResolvedMedia {
  if (ref.source === "upload") {
    return {
      source: "upload",
      id: ref.id,
      src: `/api/media/${ref.id}`,
      fallbackSrc: ref.fallbackSrc,
    };
  }
  return { source: "default", src: ref.src, fallbackSrc: ref.src };
}

function media(raw: unknown, fallbackSrc: string): ResolvedMedia {
  return resolveMedia(normalizeMedia(raw, fallbackSrc));
}

function fallbackSrcOf(ref: MediaRef): string {
  return ref.source === "upload" ? ref.fallbackSrc : ref.src;
}

function siteDetails(
  raw: unknown,
  d: SiteDetails<MediaRef>
): SiteDetails<ResolvedMedia> {
  const o = asObj(raw);
  return {
    name: trimStr(o.name, d.name, 120),
    seoTitle: trimStr(o.seoTitle, d.seoTitle, 70),
    description: trimStr(o.description, d.description, 400),
    ogImage: media(o.ogImage, fallbackSrcOf(d.ogImage)),
    phone: trimStr(o.phone, d.phone, 40),
    phoneHref: trimStr(o.phoneHref, d.phoneHref, 80),
    instagramHandle: trimStr(o.instagramHandle, d.instagramHandle, 80),
    instagramUrl: trimStr(o.instagramUrl, d.instagramUrl, 300),
    streetAddress: trimStr(o.streetAddress, d.streetAddress, 120),
    city: trimStr(o.city, d.city, 80),
    region: trimStr(o.region, d.region, 80),
    country: trimStr(o.country, d.country, 80),
    mapsQuery: trimStr(o.mapsQuery, d.mapsQuery, 300),
    latitude: trimStr(o.latitude, d.latitude, 24, true),
    longitude: trimStr(o.longitude, d.longitude, 24, true),
    officeHours: trimStr(o.officeHours, d.officeHours, 120),
    diningHours: trimStr(o.diningHours, d.diningHours, 120),
    privateFunctionsNote: trimStr(
      o.privateFunctionsNote,
      d.privateFunctionsNote,
      200
    ),
    copyrightName: trimStr(o.copyrightName, d.copyrightName, 120),
    developerName: trimStr(o.developerName, d.developerName, 120),
    developerUrl: trimStr(o.developerUrl, d.developerUrl, 300),
  };
}

function nav(raw: unknown, d: NavContent): NavContent {
  const o = asObj(raw);
  return {
    brandName: trimStr(o.brandName, d.brandName, 120),
    bookCta: trimStr(o.bookCta, d.bookCta, 40),
    items: navItems(o.items, d.items),
  };
}

function hero(raw: unknown, d: HeroContent<MediaRef>): HeroContent<ResolvedMedia> {
  const o = asObj(raw);
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    titleLines: strList(o.titleLines, d.titleLines, 6, 80),
    subtitle: trimStr(o.subtitle, d.subtitle, 120),
    body: trimStr(o.body, d.body, 600),
    primaryCta: cta(o.primaryCta, d.primaryCta),
    secondaryCta: cta(o.secondaryCta, d.secondaryCta),
    video: media(o.video, fallbackSrcOf(d.video)),
    poster: media(o.poster, fallbackSrcOf(d.poster)),
  };
}

function estate(
  raw: unknown,
  d: EstateContent<MediaRef>
): EstateContent<ResolvedMedia> {
  const o = asObj(raw);
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    titleLines: strList(o.titleLines, d.titleLines, 6, 80),
    paragraphs: strList(o.paragraphs, d.paragraphs, 8, 1200),
    footer: trimStr(o.footer, d.footer, 200),
    image: media(o.image, fallbackSrcOf(d.image)),
    caption: trimStr(o.caption, d.caption, 120),
    alt: trimStr(o.alt, d.alt, 200),
  };
}

function spaceItem(raw: unknown, d: SpaceItem<MediaRef>): SpaceItem<ResolvedMedia> {
  const o = asObj(raw);
  return {
    title: trimStr(o.title, d.title, 80),
    capacity: trimStr(o.capacity, d.capacity, 80),
    blurb: trimStr(o.blurb, d.blurb, 400),
    image: media(o.image, fallbackSrcOf(d.image)),
    caption: trimStr(o.caption, d.caption, 120),
    alt: trimStr(o.alt, d.alt, 200),
  };
}

function spaces(
  raw: unknown,
  d: SpacesContent<MediaRef>
): SpacesContent<ResolvedMedia> {
  const o = asObj(raw);
  const itemsRaw = Array.isArray(o.items) ? o.items : null;
  const items =
    itemsRaw && itemsRaw.length > 0
      ? itemsRaw.slice(0, 12).map((item, i) =>
          spaceItem(item, d.items[i] ?? d.items[0])
        )
      : d.items.map((item) => spaceItem(undefined, item));
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    titleLines: strList(o.titleLines, d.titleLines, 6, 80),
    intro: trimStr(o.intro, d.intro, 400),
    enquireLabel: trimStr(o.enquireLabel, d.enquireLabel, 40),
    items,
  };
}

function reelItem(raw: unknown, d: ReelItem<MediaRef>): ReelItem<ResolvedMedia> {
  const o = asObj(raw);
  return {
    video: media(o.video, fallbackSrcOf(d.video)),
    poster: media(o.poster, fallbackSrcOf(d.poster)),
    title: trimStr(o.title, d.title, 80),
    blurb: trimStr(o.blurb, d.blurb, 200),
  };
}

function experiences(
  raw: unknown,
  d: ExperiencesContent<MediaRef>
): ExperiencesContent<ResolvedMedia> {
  const o = asObj(raw);
  const itemsRaw = Array.isArray(o.items) ? o.items : null;
  const items =
    itemsRaw && itemsRaw.length > 0
      ? itemsRaw.slice(0, 12).map((item, i) =>
          reelItem(item, d.items[i] ?? d.items[0])
        )
      : d.items.map((item) => reelItem(undefined, item));
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    titleLines: strList(o.titleLines, d.titleLines, 6, 80),
    intro: trimStr(o.intro, d.intro, 400),
    items,
  };
}

function food(raw: unknown, d: FoodContent<MediaRef>): FoodContent<ResolvedMedia> {
  const o = asObj(raw);
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    titleLines: strList(o.titleLines, d.titleLines, 6, 80),
    body: trimStr(o.body, d.body, 600),
    tags: strList(o.tags, d.tags, 8, 40),
    menuCta: cta(o.menuCta, d.menuCta),
    carWashCta: cta(o.carWashCta, d.carWashCta),
    image: media(o.image, fallbackSrcOf(d.image)),
    alt: trimStr(o.alt, d.alt, 200),
    credit: trimStr(o.credit, d.credit, 80, true),
  };
}

function galleryItem(
  raw: unknown,
  d: GalleryItem<MediaRef>
): GalleryItem<ResolvedMedia> {
  const o = asObj(raw);
  return {
    image: media(o.image, fallbackSrcOf(d.image)),
    caption: trimStr(o.caption, d.caption, 120),
    alt: trimStr(o.alt, d.alt, 200),
  };
}

function gallery(
  raw: unknown,
  d: GalleryContent<MediaRef>
): GalleryContent<ResolvedMedia> {
  const o = asObj(raw);
  const itemsRaw = Array.isArray(o.items) ? o.items : null;
  const items =
    itemsRaw && itemsRaw.length > 0
      ? itemsRaw.slice(0, 24).map((item, i) =>
          galleryItem(item, d.items[i] ?? d.items[0])
        )
      : d.items.map((item) => galleryItem(undefined, item));
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    title: trimStr(o.title, d.title, 80),
    intro: trimStr(o.intro, d.intro, 400),
    items,
  };
}

function testimonials(raw: unknown, d: TestimonialsContent): TestimonialsContent {
  const o = asObj(raw);
  const itemsRaw = Array.isArray(o.items) ? o.items : null;
  const items: TestimonialItem[] =
    itemsRaw && itemsRaw.length > 0
      ? itemsRaw.slice(0, 12).map((item, i) => {
          const t = asObj(item);
          const fb = d.items[i] ?? d.items[0];
          return {
            quote: trimStr(t.quote, fb.quote, 600),
            name: trimStr(t.name, fb.name, 80),
            event: trimStr(t.event, fb.event, 80),
          };
        })
      : d.items;
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    titleLines: strList(o.titleLines, d.titleLines, 6, 80),
    items,
  };
}

function contact(raw: unknown, d: ContactContent): ContactContent {
  const o = asObj(raw);
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    titleLines: strList(o.titleLines, d.titleLines, 6, 80),
    body: trimStr(o.body, d.body, 600),
    mapsCta: trimStr(o.mapsCta, d.mapsCta, 80),
    footerNav: navItems(o.footerNav, d.footerNav),
  };
}

function menuItem(raw: unknown, fallback?: MenuItemContent): MenuItemContent {
  const o = asObj(raw);
  return {
    name: trimStr(o.name, fallback?.name ?? "Item", 120),
    price: num(o.price, fallback?.price ?? 0, 0, 100000),
    description: trimStr(o.description, fallback?.description ?? "", 400, true),
  };
}

function menuSection(
  raw: unknown,
  fallback: MenuSectionContent
): MenuSectionContent {
  const o = asObj(raw);
  const itemsRaw = Array.isArray(o.items) ? o.items : null;
  const items =
    itemsRaw != null
      ? itemsRaw.slice(0, 40).map((item, i) => menuItem(item, fallback.items[i]))
      : fallback.items;
  return {
    id: trimStr(o.id, fallback.id, 80),
    title: trimStr(o.title, fallback.title, 80),
    accent: trimStr(o.accent, fallback.accent, 80, true),
    sides: trimStr(o.sides, fallback.sides, 800, true),
    items,
  };
}

function menuCategory(
  raw: unknown,
  fallback: MenuCategoryContent
): MenuCategoryContent {
  const o = asObj(raw);
  const sectionsRaw = Array.isArray(o.sections) ? o.sections : null;
  const sections =
    sectionsRaw && sectionsRaw.length > 0
      ? sectionsRaw.slice(0, 12).map((section, i) =>
          menuSection(section, fallback.sections[i] ?? fallback.sections[0])
        )
      : fallback.sections;
  return {
    id: trimStr(o.id, fallback.id, 40),
    label: trimStr(o.label, fallback.label, 80),
    sections,
  };
}

function menuPage(raw: unknown, d: MenuPageContent): MenuPageContent {
  const o = asObj(raw);
  const catsRaw = Array.isArray(o.categories) ? o.categories : null;
  const categories =
    catsRaw && catsRaw.length > 0
      ? catsRaw.slice(0, 8).map((cat, i) =>
          menuCategory(cat, d.categories[i] ?? d.categories[0])
        )
      : d.categories;
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    title: trimStr(o.title, d.title, 80),
    intro: trimStr(o.intro, d.intro, 400),
    footerNote: trimStr(o.footerNote, d.footerNote, 200),
    reserveCta: cta(o.reserveCta, d.reserveCta),
    carWashCta: cta(o.carWashCta, d.carWashCta),
    categories,
  };
}

function carWashTier(raw: unknown, fallback: CarWashTier): CarWashTier {
  const o = asObj(raw);
  return {
    id: trimStr(o.id, fallback.id, 40),
    label: trimStr(o.label, fallback.label, 80),
    detail: trimStr(o.detail, fallback.detail, 80),
    price: num(o.price, fallback.price, 0, 100000),
  };
}

function carWashInclude(raw: unknown, fallback: CarWashInclude): CarWashInclude {
  const o = asObj(raw);
  return {
    title: trimStr(o.title, fallback.title, 80),
    detail: trimStr(o.detail, fallback.detail, 200),
  };
}

function carWash(raw: unknown, d: CarWashContent): CarWashContent {
  const o = asObj(raw);
  const pricingRaw = Array.isArray(o.pricing) ? o.pricing : null;
  const includesRaw = Array.isArray(o.includes) ? o.includes : null;
  return {
    eyebrow: trimStr(o.eyebrow, d.eyebrow, 80),
    title: trimStr(o.title, d.title, 80),
    tagline: trimStr(o.tagline, d.tagline, 120),
    note: trimStr(o.note, d.note, 600),
    reservation: trimStr(o.reservation, d.reservation, 400),
    includesEyebrow: trimStr(o.includesEyebrow, d.includesEyebrow, 80),
    includesTitle: trimStr(o.includesTitle, d.includesTitle, 80),
    includesIntro: trimStr(o.includesIntro, d.includesIntro, 400),
    reservationEyebrow: trimStr(o.reservationEyebrow, d.reservationEyebrow, 80),
    bookCta: cta(o.bookCta, d.bookCta),
    menuCta: cta(o.menuCta, d.menuCta),
    thanks: trimStr(o.thanks, d.thanks, 120),
    pricing:
      pricingRaw && pricingRaw.length > 0
        ? pricingRaw.slice(0, 8).map((tier, i) =>
            carWashTier(tier, d.pricing[i] ?? d.pricing[0])
          )
        : d.pricing,
    includes:
      includesRaw && includesRaw.length > 0
        ? includesRaw.slice(0, 12).map((item, i) =>
            carWashInclude(item, d.includes[i] ?? d.includes[0])
          )
        : d.includes,
  };
}

function parseOverlay(raw: unknown): SiteContentOverlay {
  const o = asObj(raw);
  const out: SiteContentOverlay = {};
  for (const key of SITE_SECTION_KEYS) {
    if (key in o) out[key] = o[key];
  }
  return out;
}

/**
 * Deep-merge overlay onto code defaults. Never throws; bad keys fall back.
 */
export function resolveSiteContent(raw: unknown): ResolvedSiteContent {
  const overlay = parseOverlay(raw);
  const d = DEFAULT_SITE_CONTENT;
  return {
    site: siteDetails(overlay.site, d.site),
    nav: nav(overlay.nav, d.nav),
    hero: hero(overlay.hero, d.hero),
    estate: estate(overlay.estate, d.estate),
    spaces: spaces(overlay.spaces, d.spaces),
    experiences: experiences(overlay.experiences, d.experiences),
    food: food(overlay.food, d.food),
    gallery: gallery(overlay.gallery, d.gallery),
    testimonials: testimonials(overlay.testimonials, d.testimonials),
    contact: contact(overlay.contact, d.contact),
    menu: menuPage(overlay.menu, d.menu),
    carWash: carWash(overlay.carWash, d.carWash),
  };
}

/** Keep only known section keys; drop everything else. */
export function sanitizeOverlay(raw: unknown): SiteContentOverlay {
  return parseOverlay(raw);
}

export function mergeOverlay(
  current: unknown,
  patch: SiteContentOverlay,
  reset: SiteSectionKey[] = []
): SiteContentOverlay {
  const base = parseOverlay(current);
  for (const key of reset) {
    delete base[key];
  }
  for (const key of SITE_SECTION_KEYS) {
    if (key in patch && patch[key] !== undefined) {
      base[key] = patch[key];
    }
  }
  return base;
}

export function isSiteSectionKey(value: unknown): value is SiteSectionKey {
  return (
    typeof value === "string" &&
    (SITE_SECTION_KEYS as readonly string[]).includes(value)
  );
}

/** Walk overlay JSON and collect uploaded media ids still referenced. */
export function collectUploadIds(value: unknown, ids: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectUploadIds(item, ids);
    return ids;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.source === "upload" && typeof o.id === "string" && UUID_RE.test(o.id)) {
      ids.add(o.id);
    }
    for (const v of Object.values(o)) collectUploadIds(v, ids);
  }
  return ids;
}

/** Replace upload refs for a deleted asset with their bundled fallback. */
export function revertUploadInOverlay(value: unknown, id: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => revertUploadInOverlay(item, id));
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.source === "upload" && o.id === id) {
      const fallback =
        typeof o.fallbackSrc === "string" && o.fallbackSrc.startsWith("/")
          ? o.fallbackSrc
          : "/outdoor/eoe.jpg";
      return { source: "default", src: fallback };
    }
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      next[k] = revertUploadInOverlay(v, id);
    }
    return next;
  }
  return value;
}

export function overlayFromResolvedSection(
  key: SiteSectionKey,
  resolved: ResolvedSiteContent
): unknown {
  const section = resolved[key];
  return stripResolvedMedia(section);
}

function stripResolvedMedia(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripResolvedMedia);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (
      (o.source === "default" || o.source === "upload") &&
      typeof o.fallbackSrc === "string"
    ) {
      if (o.source === "upload" && typeof o.id === "string") {
        return {
          source: "upload",
          id: o.id,
          fallbackSrc: o.fallbackSrc,
        } satisfies MediaRef;
      }
      const src =
        typeof o.src === "string" && !String(o.src).startsWith("/api/media/")
          ? o.src
          : o.fallbackSrc;
      return { source: "default", src } satisfies MediaRef;
    }
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) next[k] = stripResolvedMedia(v);
    return next;
  }
  return value;
}

export type { SiteContent };
