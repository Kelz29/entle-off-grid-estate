import { track } from "@vercel/analytics";

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null
>;

/** Client-side custom event — never throws into UI flows. */
export function trackEvent(name: string, data?: AnalyticsProps): void {
  try {
    track(name, data);
  } catch {
    /* ignore */
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
