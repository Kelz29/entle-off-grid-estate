import type { Metadata } from "next";
import { DEFAULT_SITE_CONTENT } from "@/lib/content/defaults";
import type { ResolvedSiteContent } from "@/lib/content/types";

export function siteOrigin(): string {
  return (
    process.env.NEXT_LIVE_URL?.replace(/\/$/, "") ||
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function absoluteUrl(path: string, origin = siteOrigin()): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

export function ogImageUrl(
  content: ResolvedSiteContent,
  origin = siteOrigin()
): string {
  return absoluteUrl(content.site.ogImage.src, origin);
}

export function homeSeoTitle(content: ResolvedSiteContent): string {
  const custom = content.site.seoTitle.trim();
  if (custom) return custom;
  return `${content.site.name} | Café & Venue in ${content.site.city}`;
}

export function pageMetadata({
  content,
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  content: ResolvedSiteContent;
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
}): Metadata {
  const origin = siteOrigin();
  const url = absoluteUrl(path, origin);
  const image = ogImageUrl(content, origin);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_ZA",
      url,
      siteName: content.site.name,
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 1600,
          alt: content.site.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

function telE164(href: string): string {
  return href.replace(/^tel:/, "");
}

export function graphJsonLd(content: ResolvedSiteContent) {
  const origin = siteOrigin();
  const image = ogImageUrl(content, origin);
  const lat = Number(content.site.latitude);
  const lng = Number(content.site.longitude);
  const hasGeo =
    content.site.latitude.trim() !== "" &&
    content.site.longitude.trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const business: Record<string, unknown> = {
    "@type": ["LocalBusiness", "Restaurant", "EventVenue"],
    "@id": `${origin}/#business`,
    name: content.site.name,
    alternateName: "EOE",
    description: content.site.description,
    url: origin,
    telephone: telE164(content.site.phoneHref),
    image: [image],
    logo: absoluteUrl("/icon-192.png", origin),
    priceRange: "$$",
    currenciesAccepted: "ZAR",
    paymentAccepted: "Credit Card, Debit Card",
    servesCuisine: ["South African", "Café"],
    menu: `${origin}/menu`,
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      content.site.mapsQuery
    )}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: content.site.streetAddress,
      addressLocality: content.site.city,
      addressRegion: content.site.region,
      addressCountry: "ZA",
    },
    areaServed: {
      "@type": "City",
      name: content.site.city,
    },
    sameAs: content.site.instagramUrl ? [content.site.instagramUrl] : [],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Friday", "Saturday", "Sunday"],
        opens: "11:00",
        closes: "18:00",
        description:
          content.site.diningHours ??
          DEFAULT_SITE_CONTENT.site.diningHours,
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        description:
          content.site.privateFunctionsNote ??
          DEFAULT_SITE_CONTENT.site.privateFunctionsNote,
      },
    ],
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Off-grid solar estate",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Car wash",
        value: true,
      },
    ],
  };
  if (hasGeo) {
    business.geo = {
      "@type": "GeoCoordinates",
      latitude: lat,
      longitude: lng,
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      business,
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: content.site.name,
        description: content.site.description,
        inLanguage: "en-ZA",
        publisher: { "@id": `${origin}/#business` },
        potentialAction: {
          "@type": "ReserveAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${origin}/#booking`,
            actionPlatform: [
              "http://schema.org/DesktopWebPlatform",
              "http://schema.org/MobileWebPlatform",
            ],
          },
          name: "Book a table",
        },
      },
      {
        "@type": "WebPage",
        "@id": `${origin}/#webpage`,
        url: origin,
        name: homeSeoTitle(content),
        description: content.site.description,
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#business` },
        inLanguage: "en-ZA",
      },
    ],
  };
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[]
) {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path, origin),
    })),
  };
}

export function menuJsonLd(content: ResolvedSiteContent) {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `${content.menu.title} | ${content.site.name}`,
    description: content.menu.intro,
    url: `${origin}/menu`,
    hasMenuSection: content.menu.categories.map((cat) => ({
      "@type": "MenuSection",
      name: cat.label,
      hasMenuItem: cat.sections.flatMap((section) =>
        section.items.map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          description: item.description || undefined,
          offers: {
            "@type": "Offer",
            price: String(item.price),
            priceCurrency: "ZAR",
          },
        }))
      ),
    })),
  };
}

export function carWashServiceJsonLd(content: ResolvedSiteContent) {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: content.carWash.title,
    description: content.carWash.note,
    url: `${origin}/car-wash`,
    provider: { "@id": `${origin}/#business` },
    areaServed: {
      "@type": "City",
      name: content.site.city,
    },
    offers: content.carWash.pricing.map((tier) => ({
      "@type": "Offer",
      name: tier.label,
      description: tier.detail,
      price: String(tier.price),
      priceCurrency: "ZAR",
    })),
  };
}
