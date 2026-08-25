/** Booking primary keys are UUIDs (string), not auto-increment integers. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newBookingId(): string {
  return crypto.randomUUID();
}

export function isBookingId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Accept a raw id from a URL param, JSON body, or metadata. */
export function parseBookingId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return isBookingId(v) ? v : null;
}
