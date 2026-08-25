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
  InvalidCarsError,
} from "@/lib/calendly/bookings";
import { serviceIdFromEventType, BadEventTypeError } from "@/lib/calendly/config";
import {
  isCarWashService,
  normalizeCarTypes,
} from "@/lib/calendly/car-wash";
import { bookingDepositCents } from "@/lib/calendly/pricing";
import { parseIsoAssumeUtc } from "@/lib/calendly/time";
import { createCheckout, YocoError } from "@/lib/yoco";
import { createReleaseToken } from "@/lib/booking-release-token";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
} from "@/lib/contact-validation";
import {
  ServerAnalyticsEvents,
  trackServerEvent,
} from "@/lib/analytics-server";
import { checkoutReturnOrigin } from "@/lib/checkout-return-origin";

/**
 * Start a paid booking (Yoco hosted Checkout). Sequence:
 *   1. reserve the slot as a `pending` booking (409 if taken — before checkout)
 *   2. create a Yoco checkout with our success/cancel/failure URLs + bookingId
 *   3. return { redirectUrl } for the browser to hand off to Yoco
 * Payment is confirmed later by the webhook (POST /api/payments/yoco/webhook).
 */
export async function POST(request: Request) {
  const rl = rateLimit(`checkout:${clientIp(request)}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { detail: "Too many checkout attempts. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

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

  // Deposit = (price × guests) + car wash mins (if any) + R30 platform fee.
  const guests = parsed.guests ?? 1;
  let carTypes: string[] | null = null;
  try {
    carTypes = normalizeCarTypes(service.slug, parsed.carTypes);
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Invalid car_types" },
      { status: 422 }
    );
  }
  if (isCarWashService(service.slug) && (!carTypes || carTypes.length < 1)) {
    return NextResponse.json(
      { detail: "car_types is required for this experience" },
      { status: 422 }
    );
  }

  const amountInCents = bookingDepositCents({
    priceCents: service.price_cents,
    guests,
    serviceSlug: service.slug,
    carTypes,
  });

  // 1. Reserve the slot as a pending booking (409 before we create a checkout).
  let bookingId: string;
  try {
    const booking = await createScheduledEvent({
      business,
      service,
      startTime: parsed.startTime,
      invitee: parsed.invitee,
      guests,
      carTypes,
      notes: parsed.notes,
      specialRequest: parsed.specialRequest,
      status: "pending",
    });
    bookingId = booking.id;
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json({ detail: err.message }, { status: 409 });
    }
    if (err instanceof ServiceNotBookableError || err instanceof InvalidCarsError) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    throw err;
  }

  // 2. Create the hosted checkout. Cancel/fail URLs carry an HMAC release token.
  // Path-based return URLs. Origin comes from the browser (same-origin),
  // not a hardcoded APP_BASE_URL — that was sending production payers to localhost.
  const baseUrl = checkoutReturnOrigin(request);
  let releaseToken: string;
  try {
    releaseToken = await createReleaseToken(bookingId);
  } catch (err) {
    await releaseUnpaidBooking(bookingId).catch(() => {});
    return NextResponse.json(
      {
        detail:
          err instanceof Error ? err.message : "Could not issue release token",
      },
      { status: 500 }
    );
  }

  const tokenQs = `token=${encodeURIComponent(releaseToken)}`;
  try {
    const checkout = await createCheckout({
      amountInCents,
      successUrl: `${baseUrl}/booking/success/${encodeURIComponent(bookingId)}`,
      cancelUrl: `${baseUrl}/booking/cancelled/${encodeURIComponent(bookingId)}?${tokenQs}`,
      failureUrl: `${baseUrl}/booking/failed/${encodeURIComponent(bookingId)}?${tokenQs}`,
      metadata: {
        bookingId,
        businessId: String(business.id),
        serviceId: String(service.id),
        customerEmail: parsed.invitee.email,
      },
    });
    await setCheckoutId(bookingId, checkout.id);
    await trackServerEvent(ServerAnalyticsEvents.CheckoutCreated, {
      service_id: service.id,
      amount_cents: amountInCents,
      guests,
    });
    return NextResponse.json(
      {
        redirectUrl: checkout.redirectUrl,
        bookingId,
        releaseToken,
      },
      { status: 201 }
    );
  } catch (err) {
    // Could not start payment → release the reserved slot.
    await releaseUnpaidBooking(bookingId).catch(() => {});
    const message =
      err instanceof YocoError ? err.message : "Could not start payment";
    await trackServerEvent(ServerAnalyticsEvents.CheckoutYocoFailed, {
      service_id: service.id,
      amount_cents: amountInCents,
    });
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

type Parsed = {
  eventType: string;
  startTime: Date;
  invitee: { name: string; email: string; phone?: string | null };
  guests?: number;
  carTypes?: string[] | null;
  notes?: string | null;
  specialRequest?: string | null;
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
    return { error: "invitee.name must be 1 to 201 characters" };
  }
  const emailRaw = typeof invitee.email === "string" ? invitee.email : "";
  if (!isValidEmail(emailRaw)) {
    return { error: "invitee.email must be a valid email" };
  }
  const email = normalizeEmail(emailRaw);
  let phone: string | null = null;
  if (invitee.phone != null && String(invitee.phone).trim()) {
    if (typeof invitee.phone !== "string" || !isValidPhone(invitee.phone)) {
      return { error: "invitee.phone must be a valid phone number" };
    }
    phone = invitee.phone.trim();
  }

  const notes =
    typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;
  const specialRequest =
    typeof b.special_request === "string" && b.special_request.trim()
      ? b.special_request.trim().slice(0, 500)
      : null;
  const guests =
    typeof b.guests === "number" && Number.isFinite(b.guests)
      ? Math.max(1, Math.trunc(b.guests))
      : undefined;
  const carTypes = Array.isArray(b.car_types)
    ? b.car_types.filter((x): x is string => typeof x === "string")
    : undefined;

  return {
    eventType: b.event_type,
    startTime,
    invitee: { name, email, phone },
    guests,
    carTypes,
    notes,
    specialRequest,
  };
}
