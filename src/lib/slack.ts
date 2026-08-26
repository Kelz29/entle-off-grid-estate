import type { BookingRow, BusinessRow } from "@/lib/calendly/types";
import { carTypeLabel } from "@/lib/calendly/car-wash";

export type NewBookingKind = "paid" | "walk_in";

function slackWebhookUrl(): string | null {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  return url || null;
}

export function slackConfigured(): boolean {
  return Boolean(slackWebhookUrl());
}

function money(cents?: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}

function whenLabel(value: string | Date, tz: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || /@noemail\.local$/i.test(email.trim());
}

function carsLine(b: BookingRow): string | null {
  if (b.cars == null || b.cars <= 0) return null;
  let raw: unknown = b.car_types;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const labels = Array.isArray(raw)
    ? raw
        .filter((x): x is string => typeof x === "string")
        .map(carTypeLabel)
        .join(", ")
    : "";
  return labels ? `${b.cars} (${labels})` : String(b.cars);
}

function field(label: string, value: string): string {
  return `*${label}:*\n${value}`;
}

/**
 * Post a new-booking alert to Slack (Incoming Webhook).
 * No-op when SLACK_WEBHOOK_URL is unset. Never throws to callers.
 */
export async function notifyNewBooking(
  booking: BookingRow,
  business: BusinessRow,
  kind: NewBookingKind
): Promise<void> {
  const url = slackWebhookUrl();
  if (!url) return;

  try {
    const payOnArrival =
      booking.status === "active" && booking.payment_status === "unpaid";
    const title =
      kind === "walk_in" || payOnArrival
        ? "New booking · Pays at venue"
        : "New booking · Paid online";

    const email = booking.customer_email?.trim() || "";
    const phone = booking.customer_phone?.trim() || "";
    const cars = carsLine(booking);

    const details: string[] = [
      field("Experience", booking.service_name || "—"),
      field("When", whenLabel(booking.start_time, business.timezone)),
      field("Guest", booking.customer_name?.trim() || "—"),
      field("Phone", phone || "—"),
      field(
        "Email",
        email && !isPlaceholderEmail(email) ? email : "— (none on file)"
      ),
      field("Guests", String(booking.guests)),
    ];
    if (cars) details.push(field("Cars", cars));
    details.push(
      field(
        "Amount",
        payOnArrival
          ? "Pay on arrival"
          : money(booking.payment_amount_cents)
      ),
      field(
        "Payment",
        `${booking.payment_status} · ${booking.status}`
      )
    );
    if (booking.special_request?.trim()) {
      details.push(field("Special request", booking.special_request.trim()));
    }
    if (booking.notes?.trim()) {
      details.push(field("Notes", booking.notes.trim()));
    }
    if (business.address) {
      details.push(field("Venue", business.address));
    }
    details.push(field("Booking ID", String(booking.id)));

    const textFallback = [
      title,
      `${booking.customer_name ?? "Guest"} · ${booking.service_name ?? "Experience"}`,
      whenLabel(booking.start_time, business.timezone),
      `${booking.guests} guest(s)`,
    ].join(" — ");

    const body = {
      text: textFallback,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: title, emoji: true },
        },
        {
          type: "section",
          fields: details.slice(0, 10).map((t) => ({
            type: "mrkdwn",
            text: t,
          })),
        },
        ...(details.length > 10
          ? [
              {
                type: "section",
                fields: details.slice(10).map((t) => ({
                  type: "mrkdwn",
                  text: t,
                })),
              },
            ]
          : []),
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        "[slack] webhook failed:",
        res.status,
        errText.slice(0, 200)
      );
    }
  } catch (err) {
    console.error(
      "[slack] notify failed:",
      err instanceof Error ? err.message : err
    );
  }
}
