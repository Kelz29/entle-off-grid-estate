import { query } from "@/lib/db";
import type { BusinessRow } from "@/lib/calendly/types";
import {
  normalizeCocktailSpecial,
  type CocktailSpecialConfig,
  type CocktailSpecialPatch,
} from "@/lib/cocktail-special-shared";

export type {
  CocktailSpecialConfig,
  CocktailSpecialPatch,
  CocktailSpecialResource,
} from "@/lib/cocktail-special-shared";
export {
  DEFAULT_COCKTAIL_SPECIAL,
  fallbackCocktailSpecialResource,
  normalizeCocktailSpecial,
  toCocktailSpecialResource,
} from "@/lib/cocktail-special-shared";

const MAX_IMAGE_BYTES = 1_500_000;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function parseSettings(raw: unknown): BusinessRow["settings"] {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as BusinessRow["settings"];
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") {
    return raw as BusinessRow["settings"];
  }
  return {};
}

function trimStr(value: unknown, fallback: string, max = 200): string {
  if (typeof value !== "string") return fallback;
  const t = value.trim();
  return t ? t.slice(0, max) : fallback;
}

export async function getCocktailSpecial(
  businessId: number
): Promise<CocktailSpecialConfig> {
  const { rows } = await query<{ settings: unknown }>(
    `SELECT settings FROM businesses WHERE id = $1 AND is_active = true`,
    [businessId]
  );
  const settings = parseSettings(rows[0]?.settings);
  return normalizeCocktailSpecial(settings.cocktail_special);
}

export async function updateCocktailSpecial(
  businessId: number,
  patch: CocktailSpecialPatch
): Promise<CocktailSpecialConfig | null> {
  const { rows } = await query<{ settings: unknown }>(
    `SELECT settings FROM businesses WHERE id = $1`,
    [businessId]
  );
  if (!rows[0]) return null;

  const settings = parseSettings(rows[0].settings);
  const current = normalizeCocktailSpecial(settings.cocktail_special);
  const next: CocktailSpecialConfig = { ...current };

  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  if (patch.eyebrow !== undefined) {
    next.eyebrow = trimStr(patch.eyebrow, current.eyebrow, 120);
  }
  if (patch.image_src !== undefined) {
    next.image_src = trimStr(patch.image_src, current.image_src, 500);
  }
  if (patch.image_alt !== undefined) {
    next.image_alt = trimStr(patch.image_alt, current.image_alt, 400);
  }
  if (patch.cta_label !== undefined) {
    next.cta_label = trimStr(patch.cta_label, current.cta_label, 80);
  }
  if (patch.cta_href !== undefined) {
    next.cta_href = trimStr(patch.cta_href, current.cta_href, 300);
  }
  if (patch.clear_image_upload) {
    next.image_data_url = null;
  } else if (patch.image_data_url !== undefined) {
    if (
      patch.image_data_url === null ||
      (typeof patch.image_data_url === "string" &&
        patch.image_data_url.startsWith("data:image/"))
    ) {
      next.image_data_url = patch.image_data_url;
    }
  }

  const merged = {
    ...settings,
    cocktail_special: next,
  };

  const { rowCount } = await query(
    `UPDATE businesses SET settings = $2 WHERE id = $1`,
    [businessId, JSON.stringify(merged)]
  );
  return rowCount > 0 ? next : null;
}

export function parseDataUrl(
  dataUrl: string
): { mime: string; buffer: Buffer } | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  try {
    return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be under 1.5 MB.");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buf.toString("base64")}`;
}
