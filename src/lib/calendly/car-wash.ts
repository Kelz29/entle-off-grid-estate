export const CAR_WASH_SERVICE_SLUG = "cafe-table-car-wash";
export const MAX_CARS_PER_SESSION = 4;

/** Per-car wash price (ZAR cents), aligned with the estate car wash list. */
export const CAR_TYPES = [
  { id: "hatch", label: "Small (3 door)", min_cents: 8000 },
  { id: "sedan", label: "Medium (5 door)", min_cents: 10000 },
  { id: "suv", label: "SUV / Bakkie", min_cents: 12000 },
  { id: "bakkie", label: "Bakkie / van", min_cents: 12000 },
] as const;

export type CarTypeId = (typeof CAR_TYPES)[number]["id"];

export function isCarWashService(slug: string | null | undefined): boolean {
  return slug === CAR_WASH_SERVICE_SLUG;
}

export function carTypeById(id: string) {
  return CAR_TYPES.find((t) => t.id === id) ?? null;
}

export function carTypeLabel(id: string): string {
  return carTypeById(id)?.label ?? id;
}

/** Sum of wash minimums for the selected car types. */
export type CarTypeCatalog = ReadonlyArray<{
  id: string;
  label: string;
  min_cents: number;
}>;

export function carWashMinimumCents(
  carTypes: string[],
  catalog: CarTypeCatalog = CAR_TYPES
): number {
  return carTypes.reduce((sum, id) => {
    const t = catalog.find((x) => x.id === id) ?? carTypeById(id);
    return sum + (t?.min_cents ?? 0);
  }, 0);
}

/** Normalize cars for a booking; null when the service does not include car wash. */
export function normalizeCars(
  slug: string,
  cars: number | null | undefined
): number | null {
  if (!isCarWashService(slug)) return null;
  const n = Math.trunc(Number(cars));
  if (!Number.isFinite(n) || n < 1 || n > MAX_CARS_PER_SESSION) {
    throw new Error(
      `cars must be between 1 and ${MAX_CARS_PER_SESSION} for this experience`
    );
  }
  return n;
}

/**
 * Normalize the list of car types for a car-wash booking.
 * Length becomes the car count; each entry must be a known type id.
 */
export function normalizeCarTypes(
  slug: string,
  carTypes: unknown
): string[] | null {
  if (!isCarWashService(slug)) return null;
  if (!Array.isArray(carTypes) || carTypes.length < 1) {
    throw new Error("car_types is required for this experience");
  }
  if (carTypes.length > MAX_CARS_PER_SESSION) {
    throw new Error(
      `At most ${MAX_CARS_PER_SESSION} cars per session`
    );
  }
  const ids: string[] = [];
  for (const raw of carTypes) {
    if (typeof raw !== "string" || !carTypeById(raw)) {
      throw new Error(
        `Each car must be one of: ${CAR_TYPES.map((t) => t.id).join(", ")}`
      );
    }
    ids.push(raw);
  }
  return ids;
}
