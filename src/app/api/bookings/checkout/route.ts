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
import { isBookingCheckoutDisabled } from "@/lib/booking-config";
import { getPublicSiteContent } from "@/lib/content/get-public-content";
import { carTypesFromContent } from "@/lib/content/car-wash-prices";
import {
  snapshotBusiness,
  snapshotService,
} from "@/lib/calendly/booking-snapshot";
import {
  buildDeferredPayload,
  encodeDeferredMetadata,
} from "@/lib/calendly/deferred-booking";
import {
  isDbConnectivityError,
  logBookingApiError,
  publicBookingError,
} from "@/lib/api-errors";
import type { BusinessRow, ServiceRow } from "@/lib/calendly/types";

/**
 * Start a paid booking (Yoco hosted Checkout). Sequence:
 *   1. reserve the slot as a `pending` booking (409 if taken — before checkout)
 *   2. create a Yoco checkout with our success/cancel/failure URLs + bookingId
 *   3. return { redirectUrl } for the browser to hand off to Yoco
 * If MySQL is unreachable after validation, falls back to deferred checkout
 * (full payload in Yoco metadata, materialized on webhook/reconcile).
 */
export async function POST(request: Request) {
  if (isBookingCheckoutDisabled()) {
    return NextResponse.json(
      {
        detail:
          "Online payment is under maintenance. Please call 067 366 2302 to book.",
      },
      { status: 503 }
    );
  }

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

  const resolved = await resolveServiceAndBusiness(serviceId);
  if (!resolved) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }
  const { service, business } = resolved;

  if (service.price_cents <= 0) {
    return NextResponse.json(
      { detail: "This experience has no deposit configured" },
      { status: 400 }
    );
  }

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

  const catalog = carTypesFromContent(await getPublicSiteContent());
  const amountInCents = bookingDepositCents({
    priceCents: service.price_cents,
    guests,
    serviceSlug: service.slug,
    carTypes,
    carTypeCatalog: catalog,
  });

  let bookingId: string;
  let deferred = false;

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
    if (
      err instanceof ServiceNotBookableError ||
      err instanceof InvalidCarsError
    ) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    if (isDbConnectivityError(err)) {
      const payload = buildDeferredPayload({
        businessId: business.id,
        serviceId: service.id,
        startTime: parsed.startTime,
        guests,
        invitee: parsed.invitee,
        carTypes,
        notes: parsed.notes,
        specialRequest: parsed.specialRequest,
        amountCents: amountInCents,
      });
      bookingId = payload.bookingId;
      deferred = true;
    } else {
      logBookingApiError("checkout", err);
      return NextResponse.json(
        { detail: publicBookingError(err) },
        { status: 503 }
      );
    }
  }

  const baseUrl = checkoutReturnOrigin(request);
  let releaseToken: string;
  try {
    releaseToken = await createReleaseToken(bookingId);
  } catch (err) {
    if (!deferred) await releaseUnpaidBooking(bookingId).catch(() => {});
    return NextResponse.json(
      {
        detail:
          err instanceof Error ? err.message : "Could not issue release token",
      },
      { status: 500 }
    );
  }

  const tokenQs = `token=${encodeURIComponent(releaseToken)}`;
  const successUrl = `${baseUrl}/booking/success/${encodeURIComponent(bookingId)}`;
  const cancelUrl = `${baseUrl}/booking/cancelled/${encodeURIComponent(bookingId)}?${tokenQs}`;
  const failureUrl = `${baseUrl}/booking/failed/${encodeURIComponent(bookingId)}?${tokenQs}`;

  const deferredPayload = deferred
    ? buildDeferredPayload({
        businessId: business.id,
        serviceId: service.id,
        startTime: parsed.startTime,
        guests,
        invitee: parsed.invitee,
        carTypes,
        notes: parsed.notes,
        specialRequest: parsed.specialRequest,
        amountCents: amountInCents,
        bookingId,
      })
    : null;

  try {
    const checkout = await createCheckout({
      amountInCents,
      successUrl,
      cancelUrl,
      failureUrl,
      metadata: deferred
        ? encodeDeferredMetadata(deferredPayload!)
        : {
            bookingId,
            businessId: String(business.id),
            serviceId: String(service.id),
            customerEmail: parsed.invitee.email,
          },
    });

    if (!deferred) {
      await setCheckoutId(bookingId, checkout.id);
    } else {
      await setCheckoutId(bookingId, checkout.id).catch(() => {});
    }

    await trackServerEvent(ServerAnalyticsEvents.CheckoutCreated, {
      service_id: service.id,
      amount_cents: amountInCents,
      guests,
      deferred,
    });

    return NextResponse.json(
      {
        redirectUrl: checkout.redirectUrl,
        bookingId,
        releaseToken,
        deferred,
      },
      { status: 201 }
    );
  } catch (err) {
    if (!deferred) await releaseUnpaidBooking(bookingId).catch(() => {});
    const message =
      err instanceof YocoError ? err.message : "Could not start payment";
    const yocoStatus = err instanceof YocoError ? err.status : undefined;
    console.error("[checkout] Yoco failed:", {
      yocoStatus,
      message,
      baseUrl,
      amountInCents,
      successUrl,
      deferred,
    });
    await trackServerEvent(ServerAnalyticsEvents.CheckoutYocoFailed, {
      service_id: service.id,
      amount_cents: amountInCents,
    });
    return NextResponse.json(
      { detail: message, ...(yocoStatus ? { yocoStatus } : {}) },
      { status: 502 }
    );
  }
}

async function resolveServiceAndBusiness(
  serviceId: number
): Promise<{ service: ServiceRow; business: BusinessRow } | null> {
  try {
    const service = await getService(serviceId);
    if (!service) return null;
    const business = await getActiveBusiness(service.business_id);
    if (!business) return null;
    return { service, business };
  } catch (err) {
    if (!isDbConnectivityError(err)) throw err;
    const service = snapshotService(serviceId);
    if (!service) return null;
    const business = snapshotBusiness(service.business_id);
    if (!business) return null;
    return { service, business };
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
