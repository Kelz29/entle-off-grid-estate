/** Client-safe cocktail special types and defaults (no DB). */

export type CocktailSpecialConfig = {
  enabled: boolean;
  eyebrow: string;
  image_src: string;
  image_alt: string;
  cta_label: string;
  cta_href: string;
  /** Optional uploaded flyer (data URL). Overrides image_src when set. */
  image_data_url: string | null;
};

/** Public / admin JSON shape (no raw data URL in the payload). */
export type CocktailSpecialResource = {
  enabled: boolean;
  eyebrow: string;
  image_src: string;
  image_alt: string;
  cta_label: string;
  cta_href: string;
  /** Resolved flyer URL for <img src>. */
  image_url: string;
  has_upload: boolean;
};

export const DEFAULT_COCKTAIL_SPECIAL: CocktailSpecialConfig = {
  enabled: true,
  eyebrow: "Now pouring · Friday & Sunday",
  image_src: "/specials/cocktail-friday-sunday.jpg",
  image_alt:
    "Entle Café cocktail special: buy one, get 50% off your second cocktail, Friday and Sunday 12:00 to 17:00",
  cta_label: "Book a table",
  cta_href: "#booking",
  image_data_url: null,
};

export type CocktailSpecialPatch = Partial<{
  enabled: boolean;
  eyebrow: string;
  image_src: string;
  image_alt: string;
  cta_label: string;
  cta_href: string;
  image_data_url: string | null;
  clear_image_upload: boolean;
}>;

function trimStr(value: unknown, fallback: string, max = 200): string {
  if (typeof value !== "string") return fallback;
  const t = value.trim();
  return t ? t.slice(0, max) : fallback;
}

export function normalizeCocktailSpecial(
  raw: unknown
): CocktailSpecialConfig {
  const base =
    raw && typeof raw === "object"
      ? (raw as Partial<CocktailSpecialConfig>)
      : {};
  const dataUrl =
    typeof base.image_data_url === "string" &&
    base.image_data_url.startsWith("data:image/")
      ? base.image_data_url
      : null;

  return {
    enabled: base.enabled !== false,
    eyebrow: trimStr(base.eyebrow, DEFAULT_COCKTAIL_SPECIAL.eyebrow, 120),
    image_src: trimStr(
      base.image_src,
      DEFAULT_COCKTAIL_SPECIAL.image_src,
      500
    ),
    image_alt: trimStr(base.image_alt, DEFAULT_COCKTAIL_SPECIAL.image_alt, 400),
    cta_label: trimStr(
      base.cta_label,
      DEFAULT_COCKTAIL_SPECIAL.cta_label,
      80
    ),
    cta_href: trimStr(base.cta_href, DEFAULT_COCKTAIL_SPECIAL.cta_href, 300),
    image_data_url: dataUrl,
  };
}

export function toCocktailSpecialResource(
  config: CocktailSpecialConfig
): CocktailSpecialResource {
  const hasUpload = Boolean(config.image_data_url);
  const bust = hasUpload
    ? config.image_data_url!.length
    : config.image_src.length;
  return {
    enabled: config.enabled,
    eyebrow: config.eyebrow,
    image_src: config.image_src,
    image_alt: config.image_alt,
    cta_label: config.cta_label,
    cta_href: config.cta_href,
    image_url: hasUpload
      ? `/api/specials/cocktail/image?v=${bust}`
      : config.image_src,
    has_upload: hasUpload,
  };
}

export function fallbackCocktailSpecialResource(): CocktailSpecialResource {
  return toCocktailSpecialResource(DEFAULT_COCKTAIL_SPECIAL);
}
