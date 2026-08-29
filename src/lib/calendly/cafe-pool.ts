import { CAR_WASH_SERVICE_SLUG } from "./car-wash";

/** Table-only and table+car-wash share one seating pool per slot. */
export const CAFE_TABLE_SERVICE_SLUG = "cafe-table-reservation";

export const CAFE_POOL_SLUGS = [
  CAFE_TABLE_SERVICE_SLUG,
  CAR_WASH_SERVICE_SLUG,
] as const;

export const CAFE_SHARED_CAPACITY = 20;

export function isCafePoolService(slug: string | null | undefined): boolean {
  return slug != null && (CAFE_POOL_SLUGS as readonly string[]).includes(slug);
}

export function cafePoolCapacity(
  slug: string | null | undefined,
  serviceCapacity: number
): number {
  return isCafePoolService(slug) ? CAFE_SHARED_CAPACITY : serviceCapacity;
}
