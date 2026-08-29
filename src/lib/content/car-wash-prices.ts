import { CAR_TYPES, type CarTypeId } from "@/lib/calendly/car-wash";
import type { ResolvedSiteContent } from "./types";

export type CarTypeCatalogItem = {
  id: CarTypeId;
  label: string;
  min_cents: number;
};

export function carTypesFromContent(
  content: ResolvedSiteContent
): CarTypeCatalogItem[] {
  const rands = new Map(
    content.carWash.pricing.map((tier) => [tier.id, tier.price])
  );
  return CAR_TYPES.map((t) => {
    const rand =
      rands.get(t.id) ??
      (t.id === "bakkie" ? rands.get("suv") : undefined);
    return {
      id: t.id,
      label: t.label,
      min_cents:
        typeof rand === "number" && Number.isFinite(rand)
          ? Math.max(0, Math.round(rand * 100))
          : t.min_cents,
    };
  });
}
