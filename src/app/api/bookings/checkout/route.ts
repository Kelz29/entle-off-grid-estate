import { NextResponse } from "next/server";
import {
  getActiveBusiness,
  getService,
  setCheckoutId,
  releaseUnpaidBooking,
} from "@/lib/calendly/repository";
import {
  createScheduledEvent,
  SlotUnavailableError,
  ServiceNotBookableError,
} from "@/lib/calendly/bookings";
import { serviceIdFromEventType, BadEventTypeError } from "@/lib/calendly/config";
import { parseIsoAssumeUtc } from "@/lib/calendly/time";
import { createCheckout, YocoError } from "@/lib/yoco";

const APP_BASE_URL =
  process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/**
 * Origin the customer's browser is actually on (localhost vs the ngrok
 * tunnel), so Yoco's success/cancel/failure redirects land back on the same
 * host the booking was made from. Behind a tunnel/proxy the original scheme
 * and host arrive in X-Forwarded-*; otherwise fall back to the Host header,
 * and finally to APP_BASE_URL.
 */
function requestOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return APP_BASE_URL;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

/**
 * Start a paid booking (Yoco hosted Checkout). Sequence:
 *   1. reserve the slot as a `pending` booking (409 if taken — before checkout)
 *   2. create a Yoco checkout with our success/cancel/failure URLs + bookingId
 *   3. return { redirectUrl } for the browser to hand off to Yoco
 * Payment is confirmed later by the webhook (POST /api/payments/yoco/webhook).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 422 });
  }

  const parsed = validate(body);
  if ("error" in parsed) {
    return NextResponse.json({ detail: parsed.error }, { status: 422 });
  }

  let serviceId: number;
  try {
    serviceId = serviceIdFromEventType(parsed.eventType);
  } catch (err) {
    if (err instanceof BadEventTypeError) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    throw err;
  }

  const service = await getService(serviceId);
  if (!service) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(service.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }
  if (service.price_cents <= 0) {
    return NextResponse.json(
      { detail: "This experience has no deposit configured" },
      { status: 400 }
    );
  }

  // Deposit is per guest: charged total = price_cents × party size.
  const guests = parsed.guests ?? 1;

  // 1. Reserve the slot as a pending booking (409 before we create a checkout).
  let bookingId: number;
  try {
    const booking = await createScheduledEvent({
      business,
      service,
      startTime: parsed.startTime,
      invitee: parsed.invitee,
      guests,
      notes: parsed.notes,
      status: "pending",
    });
    bookingId = booking.id;
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json({ detail: err.message }, { status: 409 });
    }
    if (err instanceof ServiceNotBookableError) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    throw err;
  }

  // 2. Create the hosted checkout. Redirects go back to wherever the customer
  //    is browsing from (localhost or the public tunnel), not a fixed host.
  const baseUrl = requestOrigin(request);
  try {
    const checkout = await createCheckout({
      amountInCents: service.price_cents * guests,
      successUrl: `${baseUrl}/booking/success?booking=${bookingId}`,
      cancelUrl: `${baseUrl}/booking/cancelled?booking=${bookingId}`,
      failureUrl: `${baseUrl}/booking/failed?booking=${bookingId}`,
      metadata: {
        bookingId: String(bookingId),
        businessId: String(business.id),
        serviceId: String(service.id),
        customerEmail: parsed.invitee.email,
      },
    });
    await setCheckoutId(bookingId, checkout.id);
    return NextResponse.json(
      { redirectUrl: checkout.redirectUrl, bookingId },
      { status: 201 }
    );
  } catch (err) {
    // Could not start payment → release the reserved slot.
    await releaseUnpaidBooking(bookingId).catch(() => {});
    const message =
      err instanceof YocoError ? err.message : "Could not start payment";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

type Parsed = {
  eventType: string;
  startTime: Date;
  invitee: { name: string; email: string; phone?: string | null };
  guests?: number;
  notes?: string | null;
};

function validate(body: unknown): Parsed | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Body must be an object" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.event_type !== "string" || !b.event_type.trim()) {
    return { error: "event_type is required" };
  }
  if (typeof b.start_time !== "string") {
    return { error: "start_time is required" };
  }
  const startTime = parseIsoAssumeUtc(b.start_time);
  if (!startTime) return { error: "start_time is not a valid datetime" };

  const invitee = b.invitee as Record<string, unknown> | undefined;
  if (!invitee || typeof invitee !== "object") {
    return { error: "invitee is required" };
  }
  const name = typeof invitee.name === "string" ? invitee.name.trim() : "";
  if (name.length < 1 || name.length > 201) {
    return { error: "invitee.name must be 1–201 characters" };
  }
  const email = typeof invitee.email === "string" ? invitee.email.trim() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "invitee.email must be a valid email" };
  }
  let phone: string | null = null;
  if (invitee.phone != null) {
    if (typeof invitee.phone !== "string" || invitee.phone.length > 20) {
      return { error: "invitee.phone must be ≤ 20 characters" };
    }
    phone = invitee.phone;
  }

  const notes =
    typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;
  const guests =
    typeof b.guests === "number" && Number.isFinite(b.guests)
      ? Math.max(1, Math.trunc(b.guests))
      : undefined;

  return {
    eventType: b.event_type,
    startTime,
    invitee: { name, email, phone },
    guests,
    notes,
  };
}
