/** Map server errors to guest-safe booking API messages. */

const DB_CONNECTIVITY_RE =
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|PROTOCOL|ER_ACCESS_DENIED|connect timeout|Connection lost|Too many connections/i;

const MISSING_DB_ENV_RE = /Missing required environment variable:\s*MYSQL_/i;

export function isDbConnectivityError(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return DB_CONNECTIVITY_RE.test(message) || MISSING_DB_ENV_RE.test(message);
}

export function publicBookingError(
  err: unknown,
  fallback = "Something went wrong. Please try again or call us to book."
): string {
  if (isDbConnectivityError(err)) {
    return "We're having trouble reaching our booking system right now.";
  }
  return fallback;
}

export function logBookingApiError(route: string, err: unknown): void {
  console.error(`[${route}]`, err);
}
