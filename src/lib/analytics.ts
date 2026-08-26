export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "js" | "set",
      targetOrName: string | Date,
      params?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

/** GA4 prefers snake_case event names (max 40 chars). */
export function toGaEventName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function sanitizeParams(
  data?: AnalyticsProps
): Record<string, string | number | boolean> | undefined {
  if (!data) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    const k = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
    out[k] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Client-side custom event → Google Analytics 4 (gtag).
 * Safe no-op until the GA script has loaded.
 */
export function trackEvent(name: string, data?: AnalyticsProps): void {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }
    window.gtag("event", toGaEventName(name), sanitizeParams(data));
  } catch {
    /* never break UI for analytics */
  }
}

/** Funnel + engagement event names used across the site. */
export const AnalyticsEvents = {
  CtaBook: "CTA Book",
  CtaExplore: "CTA Explore",
  CtaMenu: "CTA Menu",
  CtaCarWash: "CTA Car Wash",
  ContactPhone: "Contact Phone",
  ContactMaps: "Contact Maps",
  ContactInstagram: "Contact Instagram",
  StaffLogin: "Staff Login",
  BookingExperienceSelected: "Booking Experience Selected",
  BookingSlotSelected: "Booking Slot Selected",
  BookingDetailsOpened: "Booking Details Opened",
  BookingPayIntent: "Booking Pay Intent",
  BookingCheckoutStarted: "Booking Checkout Started",
  BookingCheckoutFailed: "Booking Checkout Failed",
  BookingRedirectYoco: "Booking Redirect Yoco",
  BookingPaymentReceived: "Booking Payment Received",
  BookingPaymentPending: "Booking Payment Pending",
  SpecialShown: "Special Shown",
  SpecialDismissed: "Special Dismissed",
  SpecialReopened: "Special Reopened",
} as const;
