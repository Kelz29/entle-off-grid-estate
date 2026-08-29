/** Site CMS types. Overlay in MySQL uses MediaRef; public pages use ResolvedMedia. */

export type MediaKind = "image" | "video";

export type MediaRef =
  | { source: "default"; src: string }
  | { source: "upload"; id: string; fallbackSrc: string };

export type ResolvedMedia = {
  source: "default" | "upload";
  src: string;
  fallbackSrc: string;
  id?: string;
};

export type CtaLink = { label: string; href: string };
export type NavItem = { href: string; label: string };

export type SpaceItem<M = MediaRef> = {
  title: string;
  capacity: string;
  blurb: string;
  image: M;
  caption: string;
  alt: string;
};

export type ReelItem<M = MediaRef> = {
  video: M;
  poster: M;
  title: string;
  blurb: string;
};

export type GalleryItem<M = MediaRef> = {
  image: M;
  caption: string;
  alt: string;
};

export type TestimonialItem = {
  quote: string;
  name: string;
  event: string;
};

export type MenuItemContent = {
  name: string;
  price: number;
  description: string;
};

export type MenuSectionContent = {
  id: string;
  title: string;
  accent: string;
  items: MenuItemContent[];
  sides: string;
};

export type MenuCategoryContent = {
  id: string;
  label: string;
  sections: MenuSectionContent[];
};

export type CarWashTier = {
  id: string;
  label: string;
  detail: string;
  price: number;
};

export type CarWashInclude = {
  title: string;
  detail: string;
};

export type SiteDetails<M = MediaRef> = {
  name: string;
  seoTitle: string;
  description: string;
  ogImage: M;
  phone: string;
  phoneHref: string;
  instagramHandle: string;
  instagramUrl: string;
  streetAddress: string;
  city: string;
  region: string;
  country: string;
  mapsQuery: string;
  latitude: string;
  longitude: string;
  officeHours: string;
  /** Café table reservations (online widget). */
  diningHours: string;
  /** Private functions Mon–Thu — call to book. */
  privateFunctionsNote: string;
  copyrightName: string;
  developerName: string;
  developerUrl: string;
};

export type NavContent = {
  brandName: string;
  bookCta: string;
  items: NavItem[];
};

export type HeroContent<M = MediaRef> = {
  eyebrow: string;
  titleLines: string[];
  subtitle: string;
  body: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  video: M;
  poster: M;
};

export type EstateContent<M = MediaRef> = {
  eyebrow: string;
  titleLines: string[];
  paragraphs: string[];
  footer: string;
  image: M;
  caption: string;
  alt: string;
};

export type SpacesContent<M = MediaRef> = {
  eyebrow: string;
  titleLines: string[];
  intro: string;
  enquireLabel: string;
  items: SpaceItem<M>[];
};

export type ExperiencesContent<M = MediaRef> = {
  eyebrow: string;
  titleLines: string[];
  intro: string;
  items: ReelItem<M>[];
};

export type FoodContent<M = MediaRef> = {
  eyebrow: string;
  titleLines: string[];
  body: string;
  tags: string[];
  menuCta: CtaLink;
  carWashCta: CtaLink;
  image: M;
  alt: string;
  credit: string;
};

export type GalleryContent<M = MediaRef> = {
  eyebrow: string;
  title: string;
  intro: string;
  items: GalleryItem<M>[];
};

export type TestimonialsContent = {
  eyebrow: string;
  titleLines: string[];
  items: TestimonialItem[];
};

export type ContactContent = {
  eyebrow: string;
  titleLines: string[];
  body: string;
  mapsCta: string;
  footerNav: NavItem[];
};

export type MenuPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  footerNote: string;
  reserveCta: CtaLink;
  carWashCta: CtaLink;
  categories: MenuCategoryContent[];
};

export type CarWashContent = {
  eyebrow: string;
  title: string;
  tagline: string;
  note: string;
  reservation: string;
  includesEyebrow: string;
  includesTitle: string;
  includesIntro: string;
  reservationEyebrow: string;
  bookCta: CtaLink;
  menuCta: CtaLink;
  thanks: string;
  pricing: CarWashTier[];
  includes: CarWashInclude[];
};

export type SiteContentDoc<M = MediaRef> = {
  site: SiteDetails<M>;
  nav: NavContent;
  hero: HeroContent<M>;
  estate: EstateContent<M>;
  spaces: SpacesContent<M>;
  experiences: ExperiencesContent<M>;
  food: FoodContent<M>;
  gallery: GalleryContent<M>;
  testimonials: TestimonialsContent;
  contact: ContactContent;
  menu: MenuPageContent;
  carWash: CarWashContent;
};

export type SiteContent = SiteContentDoc<MediaRef>;
export type ResolvedSiteContent = SiteContentDoc<ResolvedMedia>;

export const SITE_SECTION_KEYS = [
  "site",
  "nav",
  "hero",
  "estate",
  "spaces",
  "experiences",
  "food",
  "gallery",
  "testimonials",
  "contact",
  "menu",
  "carWash",
] as const;

export type SiteSectionKey = (typeof SITE_SECTION_KEYS)[number];

export type SiteContentOverlay = Partial<{
  [K in SiteSectionKey]: unknown;
}>;

export type MediaAssetRow = {
  id: string;
  business_id: number;
  kind: MediaKind;
  original_name: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  created_at: string;
};

export type MediaAssetBlob = MediaAssetRow & { data: Buffer };
