import { randomUUID } from "crypto";
import { toGaEventName } from "@/lib/analytics";

type AnalyticsProps = Record<string, string | number | boolean | null>;

/**
 * Server-side event → GA4 Measurement Protocol.
 * Requires GA_API_SECRET (Admin → Data streams → Measurement Protocol API secrets).
 * Safe no-op when unset or on failure.
 */
export async function trackServerEvent(
  name: string,
  data?: AnalyticsProps
): Promise<void> {
  const measurementId =
    process.env.NEXT_GA_MEASUREMENT_ID?.trim() || "";
  const apiSecret = process.env.GA_API_SECRET?.trim();
  if (!apiSecret) return;

  try {
    const params: Record<string, string | number | boolean> = {};
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) continue;
        params[key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40)] = value;
      }
    }

    const url = new URL("https://www.google-analytics.com/mp/collect");
    url.searchParams.set("measurement_id", measurementId);
    url.searchParams.set("api_secret", apiSecret);

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: randomUUID(),
        events: [
          {
            name: toGaEventName(name),
            params: {
              ...params,
              engagement_time_msec: 1,
            },
          },
        ],
      }),
      // Don't hang checkout / webhooks on analytics.
      signal: AbortSignal.timeout(2500),
    }).catch(() => null);
  } catch {
    /* ignore */
  }
}

export const ServerAnalyticsEvents = {
  CheckoutCreated: "Checkout Created",
  CheckoutYocoFailed: "Checkout Yoco Failed",
  PaymentSucceeded: "Payment Succeeded",
} as const;
