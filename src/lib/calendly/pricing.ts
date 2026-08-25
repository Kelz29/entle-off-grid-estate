import {
  carWashMinimumCents,
  isCarWashService,
} from "./car-wash";

/** Flat fee added to every paid online booking (Yoco checkout). */
export const PLATFORM_FEE_CENTS = 3000; // R30

/**
 * Total amount charged at checkout:
 *   (price_cents × guests) + car wash minimums (when applicable) + platform fee
 */
export function bookingDepositCents(opts: {
  priceCents: number;
  guests: number;
  serviceSlug: string;
  carTypes?: string[] | null;
}): number {
  const guestPart = opts.priceCents * Math.max(1, opts.guests);
  const washPart = isCarWashService(opts.serviceSlug)
    ? carWashMinimumCents(opts.carTypes ?? [])
    : 0;
  return guestPart + washPart + PLATFORM_FEE_CENTS;
}
