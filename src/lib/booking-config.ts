/** Public booking phone (also used when online checkout is paused). */
export const BOOKING_PHONE = "067 366 2302";
export const BOOKING_PHONE_HREF = "tel:+27673662302";

/**
 * When `NEXT_BOOKING_PHONE_ONLY=1`, the widget skips Yoco checkout
 * and asks guests to call. Remove the env var (or set to 0) and redeploy
 * once live payments are ready.
 */
export function bookingPhoneOnly(): boolean {
  return process.env.NEXT_BOOKING_PHONE_ONLY === "1";
}

/** Server guard — same flag as the public booking widget. */
export function isBookingCheckoutDisabled(): boolean {
  return bookingPhoneOnly();
}
