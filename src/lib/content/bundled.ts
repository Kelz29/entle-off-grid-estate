/** Bundled `/public` files staff can assign without counting against quota. */

export type BundledMedia = {
  src: string;
  kind: "image" | "video";
  label: string;
};

export const BUNDLED_MEDIA: BundledMedia[] = [
  { src: "/outdoor/eoe.jpg", kind: "image", label: "The estate" },
  { src: "/outdoor/catching-the-sunset.jpg", kind: "image", label: "Catching the sunset" },
  { src: "/outdoor/cozy-winter.jpg", kind: "image", label: "Cozy winter" },
  { src: "/outdoor/lovely-evening.jpg", kind: "image", label: "A lovely evening" },
  { src: "/outdoor/eoe-cafe-outdoor.jpg", kind: "image", label: "Café, al fresco" },
  { src: "/indoor/sunsets.jpg", kind: "image", label: "Sunsets from inside" },
  { src: "/indoor/eoe-cafe-indoor.jpg", kind: "image", label: "The EOE Café" },
  { src: "/indoor/sunset-cake-tasting.jpg", kind: "image", label: "Sunset cake tasting" },
  { src: "/indoor/timeless-design.jpg", kind: "image", label: "Timeless design" },
  { src: "/food/one-table.jpg", kind: "image", label: "One table" },
  { src: "/menu/breakfast.jpg", kind: "image", label: "Breakfast" },
  { src: "/menu/lunch.jpg", kind: "image", label: "Lunch" },
  { src: "/menu/beans-brews.jpg", kind: "image", label: "Beans & brews" },
  { src: "/specials/cocktail-friday-sunday.jpg", kind: "image", label: "Cocktail special" },
  { src: "/brand/entle-mark.png", kind: "image", label: "Entle mark" },
  { src: "/video/slow-down.mp4", kind: "video", label: "Slow moments" },
  { src: "/video/wine-pairing.mp4", kind: "video", label: "Wine & pairing" },
  { src: "/video/birthday-65th.mp4", kind: "video", label: "Milestone birthdays" },
  { src: "/video/year-end-function.mp4", kind: "video", label: "Year end functions" },
  { src: "/video/wivesmas.mp4", kind: "video", label: "Themed gatherings" },
  { src: "/video/launch.mp4", kind: "video", label: "The estate (video)" },
];
