import { track } from "@vercel/analytics/server";

type AnalyticsProps = Record<string, string | number | boolean | null>;

/** Server-side custom event (checkout / webhook). Safe no-op on failure. */
export async function trackServerEvent(
  name: string,
  data?: AnalyticsProps
): Promise<void> {
  try {
    await track(name, data);
  } catch {
    /* ignore */
  }
}

export const ServerAnalyticsEvents = {
  CheckoutCreated: "Checkout Created",
  CheckoutYocoFailed: "Checkout Yoco Failed",
  PaymentSucceeded: "Payment Succeeded",
} as const;
