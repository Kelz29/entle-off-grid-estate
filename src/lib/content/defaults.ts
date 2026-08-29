import {
  estatePhoto,
  foodPhoto,
  gallery,
  hero,
  reels,
  spaces,
} from "@/lib/media";
import { CAR_WASH_INFO, MENU_CATEGORIES } from "@/lib/menu";
import type { MediaRef, SiteContent } from "./types";

function img(src: string): MediaRef {
  return { source: "default", src };
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  site: {
    name: "Entle Off Grid Estate",
    seoTitle: "Entle Off Grid Estate | Café & Venue in Bloemfontein",
    description:
      "Off-grid café, event venue, and private estate in Bloemfontein. Dine Friday to Sunday; private functions Monday to Thursday — call to book.",
    ogImage: img("/outdoor/eoe.jpg"),
    phone: "067 366 2302",
    phoneHref: "tel:+27673662302",
    instagramHandle: "@entle_off_grid_estate",
    instagramUrl: "https://instagram.com/entle_off_grid_estate",
    streetAddress: "182 Lakeview",
    city: "Bloemfontein",
    region: "Free State",
    country: "South Africa",
    mapsQuery: "182 Lakeview, Bloemfontein, South Africa",
    latitude: "",
    longitude: "",
    officeHours: "Mon to Fri · 8:00 to 16:30",
    diningHours: "Friday to Sunday, 11:00 to 18:00",
    privateFunctionsNote:
      "Private functions available Monday to Thursday — call to book.",
    copyrightName: "Entle Off Grid Estate",
    developerName: "Smart Macmane Pty Ltd",
    developerUrl: "https://smartmacmane.co.za/",
  },
  nav: {
    brandName: "Entle Off Grid Estate",
    bookCta: "Book a Date",
    items: [
      { href: "#estate", label: "The Estate" },
      { href: "#spaces", label: "Spaces" },
      { href: "#experiences", label: "Experiences" },
      { href: "/menu", label: "Menu" },
      { href: "#booking", label: "Book" },
      { href: "#gallery", label: "Gallery" },
      { href: "#contact", label: "Contact" },
    ],
  },
  hero: {
    eyebrow: "BLOEMFONTEIN • SOUTH AFRICA",
    titleLines: ["An escape", "that feels", "like home"],
    subtitle: "Entle Off Grid Estate",
    body: "A private estate, off-grid café, and considered venue for gatherings that feel both intimate and quietly cinematic.",
    primaryCta: { label: "BOOK A DATE", href: "#booking" },
    secondaryCta: { label: "EXPLORE THE ESTATE", href: "#estate" },
    video: img(hero.video),
    poster: img(hero.poster),
  },
  estate: {
    eyebrow: "ABOUT THE ESTATE",
    titleLines: ["Where stillness", "meets celebration."],
    paragraphs: [
      "Entle Off Grid Estate is a Black owned, privately held space for slow mornings, golden hour gatherings, and evenings that taper into stories around the table. Powered by the sun and surrounded by open sky, the estate is intentionally intimate, designed for small weddings, private dinners, creative retreats, and curated community moments.",
      "Every room, pathway, and tablescape is considered. From the minimalist cafe to the lawn that folds into the horizon, EOE is less a venue and more a feeling: quietly expensive, deeply warm, and entirely off grid.",
    ],
    footer: "Private estate • Off grid cafe • Curated events",
    image: img(estatePhoto.src),
    caption: estatePhoto.caption,
    alt: estatePhoto.alt,
  },
  spaces: {
    eyebrow: "SPACES",
    titleLines: ["Spaces for every", "kind of gathering."],
    intro:
      "Choose from our cafe, venue hall, or open garden. Each space can be tailored with our in house styling partners and preferred suppliers.",
    enquireLabel: "Enquire",
    items: spaces.map((space) => ({
      title: space.title,
      capacity: space.capacity,
      blurb: space.blurb,
      image: img(space.src),
      caption: space.caption,
      alt: space.alt,
    })),
  },
  experiences: {
    eyebrow: "EXPERIENCES",
    titleLines: ["Gatherings that linger", "long after they end."],
    intro:
      "From brunch series and chef's tables to pop ups and creative residencies, the estate is a canvas for experiences that feel deeply personal.",
    items: reels.map((reel) => ({
      video: img(reel.src),
      poster: img(reel.poster),
      title: reel.title,
      blurb: reel.blurb,
    })),
  },
  food: {
    eyebrow: "THE TABLE",
    titleLines: ["One table.", "Endless flavours."],
    body: "Breakfast through lunch, coffee in between. Seasonal plates, careful coffee, and a kitchen that leads with what is fresh and local. Settle in and let the afternoon stretch.",
    tags: ["Breakfast", "Lunch", "Beans & Brews"],
    menuCta: { label: "View the menu", href: "/menu" },
    carWashCta: { label: "Car wash while you dine", href: "/car-wash" },
    image: img(foodPhoto.src),
    alt: foodPhoto.alt,
    credit: "@funkiie_k",
  },
  gallery: {
    eyebrow: "GALLERY",
    title: "A wall of moments.",
    intro:
      "A living archive of the estate: sunrise mist, tables set for celebration, and the quiet in between.",
    items: gallery.map((photo) => ({
      image: img(photo.src),
      caption: photo.caption,
      alt: photo.alt,
    })),
  },
  testimonials: {
    eyebrow: "TESTIMONIALS",
    titleLines: ["Words from", "our guests."],
    items: [
      {
        quote:
          "It felt like hosting our wedding inside a magazine spread: effortless, intimate, and deeply us.",
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
          "There's a stillness to the estate that makes conversations slower, deeper, and more honest.",
        name: "Thandeka",
        event: "Creative retreat",
      },
    ],
  },
  contact: {
    eyebrow: "CONTACT",
    titleLines: ["Visit, linger,", "return often."],
    body: "We're a short drive from the city, but designed to feel worlds away. Reach out to plan your visit or private event.",
    mapsCta: "Open in Google Maps →",
    footerNav: [
      { href: "/menu", label: "Menu" },
      { href: "/car-wash", label: "Car wash" },
      { href: "/#booking", label: "Book" },
      { href: "/admin/login", label: "Staff" },
    ],
  },
  menu: {
    eyebrow: "THE TABLE",
    title: "Café menu",
    intro:
      "Breakfast through lunch, coffee in between. Ask your host about today's specials.",
    footerNote:
      "Prices subject to change. Ask your host about today's specials.",
    reserveCta: { label: "Reserve a table", href: "/#booking" },
    carWashCta: { label: "Car wash while you dine", href: "/car-wash" },
    categories: MENU_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      sections: cat.sections.map((section) => ({
        id: section.id,
        title: section.title,
        accent: section.accent ?? "",
        sides: section.sides ?? "",
        items: section.items.map((item) => ({
          name: item.name,
          price: item.price,
          description: item.description ?? "",
        })),
      })),
    })),
  },
  carWash: {
    eyebrow: "EOE CAR WASH",
    title: "Car wash",
    tagline: CAR_WASH_INFO.tagline,
    note: `${CAR_WASH_INFO.note} A standard wash while you are at the table. Pre-book with your café reservation so we can hold a bay for you.`,
    reservation: CAR_WASH_INFO.reservation,
    includesEyebrow: "Standard wash",
    includesTitle: "Includes",
    includesIntro:
      "Every wash is finished by hand with the same care we bring to the table.",
    reservationEyebrow: "Reservations only",
    bookCta: { label: "Book café + wash", href: "/#booking" },
    menuCta: { label: "See the menu", href: "/menu" },
    thanks: "Thank you for your support.",
    pricing: CAR_WASH_INFO.pricing.map((tier) => ({
      id: tier.id,
      label: tier.label,
      detail: tier.detail,
      price: tier.price,
    })),
    includes: CAR_WASH_INFO.includes.map((item) => ({
      title: item.title,
      detail: item.detail,
    })),
  },
};
