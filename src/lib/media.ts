// Central manifest of the estate's own portrait photography & video.
// Captions come from the original filenames (they were lovely).

export type Photo = { src: string; caption: string; alt: string };
export type Reel = { src: string; poster: string; title: string; blurb: string };

export const hero = {
  video: "/video/slow-down.mp4",
  poster: "/outdoor/eoe.jpg",
};

export const estatePhoto: Photo = {
  src: "/outdoor/catching-the-sunset.jpg",
  caption: "Catching the sunset",
  alt: "Guests catching the sunset at Entle Off-Grid Estate",
};

export const spaces: (Photo & { title: string; capacity: string; blurb: string })[] = [
  {
    title: "The Café",
    capacity: "Up to 40 seated",
    blurb: "Timeless interiors, open views and a carefully selected wine list.",
    src: "/indoor/timeless-design.jpg",
    caption: "Timeless design & selected wines",
    alt: "Café interior with open views at Entle Off-Grid Estate",
  },
  {
    title: "The Venue",
    capacity: "Up to 80 seated · 120 cocktail",
    blurb: "A warm, candle-lit space for celebrations that run into the evening.",
    src: "/outdoor/cozy-winter.jpg",
    caption: "Cozy winter evenings",
    alt: "Cozy candle-lit winter evening at the estate",
  },
  {
    title: "The Garden",
    capacity: "Flexible lawn layouts",
    blurb: "Open lawns and big skies that fold into golden-hour ceremonies.",
    src: "/outdoor/lovely-evening.jpg",
    caption: "A lovely evening outdoors",
    alt: "Outdoor lawn at golden hour",
  },
];

export const foodPhoto: Photo = {
  src: "/food/one-table.jpg",
  caption: "One table. Endless flavours.",
  alt: "A shared table laid with food at Entle Off-Grid Estate",
};

export const reels: Reel[] = [
  {
    src: "/video/wine-pairing.mp4",
    poster: "/indoor/timeless-design.jpg",
    title: "Wine & pairing",
    blurb: "An unhurried tasting led by our team.",
  },
  {
    src: "/video/birthday-65th.mp4",
    poster: "/indoor/sunset-cake-tasting.jpg",
    title: "Milestone birthdays",
    blurb: "Mommy B's 65th surprise celebration.",
  },
  {
    src: "/video/year-end-function.mp4",
    poster: "/outdoor/cozy-winter.jpg",
    title: "Year-end functions",
    blurb: "Send the year off in style.",
  },
  {
    src: "/video/wivesmas.mp4",
    poster: "/indoor/sunsets.jpg",
    title: "Themed gatherings",
    blurb: "Wivesmas, for beautiful queens.",
  },
  {
    src: "/video/slow-down.mp4",
    poster: "/outdoor/lovely-evening.jpg",
    title: "Slow moments",
    blurb: "A chance to slow down & reset.",
  },
  {
    src: "/video/launch.mp4",
    poster: "/outdoor/eoe.jpg",
    title: "The estate",
    blurb: "A beautiful venue, 15 min from the city.",
  },
];

export const gallery: Photo[] = [
  { src: "/outdoor/eoe.jpg", caption: "Entle Off-Grid Estate", alt: "The estate" },
  {
    src: "/indoor/sunsets.jpg",
    caption: "Sunsets from inside",
    alt: "Sunset seen from the café interior",
  },
  {
    src: "/indoor/eoe-cafe-indoor.jpg",
    caption: "The EOE Café",
    alt: "Inside the EOE café",
  },
  {
    src: "/outdoor/catching-the-sunset.jpg",
    caption: "Catching the sunset",
    alt: "Golden hour on the lawn",
  },
  {
    src: "/indoor/sunset-cake-tasting.jpg",
    caption: "Sunset cake tasting",
    alt: "Cake tasting at sunset",
  },
  {
    src: "/outdoor/eoe-cafe-outdoor.jpg",
    caption: "The café, al fresco",
    alt: "Outdoor café seating",
  },
  {
    src: "/indoor/timeless-design.jpg",
    caption: "Timeless design",
    alt: "Interior design detail",
  },
  {
    src: "/outdoor/lovely-evening.jpg",
    caption: "A lovely evening",
    alt: "Evening on the estate grounds",
  },
];
