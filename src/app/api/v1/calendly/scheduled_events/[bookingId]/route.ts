import { NextResponse } from "next/server";
import {
  getActiveBusiness,
  getBooking,
  getService,
  cancelBooking,
  setBookingSeen,
  markBookingSettled,
} from "@/lib/calendly/repository";
import { query } from "@/lib/db";
import {
  rescheduleBooking,
  updateBookingGuests,
  updateBookingCars,
  SlotUnavailableError,
  InvalidCarsError,
} from "@/lib/calendly/bookings";
import {
  serializeScheduledEvent,
  serializeScheduledEventPublic,
} from "@/lib/calendly/serializers";
import { parseIsoAssumeUtc } from "@/lib/calendly/time";
import { parseBookingId } from "@/lib/calendly/booking-id";
import { sendBookingRescheduled, sendBookingCancelled } from "@/lib/email";
import { isAdminAuthorized } from "@/lib/admin-auth";

// GET /api/v1/calendly/scheduled_events/{bookingId}
// Public: slim resource for success UI. Admin: full PII.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const booking = await resolveBooking(await params);
  if (!booking) {
    return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(booking.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }
  if (await isAdminAuthorized(request)) {
    return NextResponse.json({
      resource: serializeScheduledEvent(booking, business),
    });
  }
  return NextResponse.json({
    resource: serializeScheduledEventPublic(booking, business),
  });
}

// PATCH /api/v1/calendly/scheduled_events/{bookingId}
//   { "status": "canceled" }          → cancel (frees seats)
//   { "start_time": "<ISO>" }         → reschedule to a new slot
// Admin-gated (not part of the read-only Calendly surface). Requires a token.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let body: {
    status?: string;
    start_time?: string;
    guests?: number;
    car_types?: string[] | null;
    special_request?: string | null;
    payment_status?: string;
    seen?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }

  const { bookingId } = await params;
  const id = parseBookingId(bookingId);
  if (!id) {
    return NextResponse.json({ detail: "Invalid booking id" }, { status: 400 });
  }

  // --- Mark seen / unseen ---
  if (typeof body.seen === "boolean") {
    const booking = await setBookingSeen(id, body.seen);
    if (!booking) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    const business = await getActiveBusiness(booking.business_id);
    if (!business) {
      return NextResponse.json({ detail: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ resource: serializeScheduledEvent(booking, business) });
  }

  // --- Change guest count (paid amount unchanged — no refunds / no top-up) ---
  if (typeof body.guests === "number") {
    const guests = Math.trunc(body.guests);
    if (!Number.isInteger(guests) || guests < 1) {
      return NextResponse.json({ detail: "guests must be ≥ 1" }, { status: 400 });
    }
    const existing = await getBooking(id);
    if (!existing) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    if (existing.status === "cancelled") {
      return NextResponse.json({ detail: "Booking is cancelled" }, { status: 409 });
    }
    const service = await getService(existing.service_id);
    if (!service) {
      return NextResponse.json({ detail: "Service not found" }, { status: 404 });
    }
    try {
      const updated = await updateBookingGuests({ booking: existing, service, guests });
      const business = await getActiveBusiness(updated.business_id);
      if (!business) {
        return NextResponse.json({ detail: "Business not found" }, { status: 404 });
      }
      return NextResponse.json({ resource: serializeScheduledEvent(updated, business) });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        return NextResponse.json(
          { detail: "Not enough seats left in this slot for that many guests" },
          { status: 409 }
        );
      }
      throw err;
    }
  }

  // --- Change cars / car wash types (paid amount unchanged) ---
  if ("car_types" in body) {
    const existing = await getBooking(id);
    if (!existing) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    if (existing.status === "cancelled") {
      return NextResponse.json({ detail: "Booking is cancelled" }, { status: 409 });
    }
    const service = await getService(existing.service_id);
    if (!service) {
      return NextResponse.json({ detail: "Service not found" }, { status: 404 });
    }
    const raw = body.car_types;
    const carTypes =
      raw == null
        ? null
        : Array.isArray(raw)
          ? raw.filter((x): x is string => typeof x === "string")
          : null;
    if (raw != null && !Array.isArray(raw)) {
      return NextResponse.json(
        { detail: "car_types must be an array of type ids, or null" },
        { status: 400 }
      );
    }
    try {
      const updated = await updateBookingCars({
        booking: existing,
        service,
        carTypes,
      });
      const business = await getActiveBusiness(updated.business_id);
      if (!business) {
        return NextResponse.json({ detail: "Business not found" }, { status: 404 });
      }
      return NextResponse.json({ resource: serializeScheduledEvent(updated, business) });
    } catch (err) {
      if (err instanceof InvalidCarsError) {
        return NextResponse.json({ detail: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  // --- Mark partially paid as settled (balance collected at venue) ---
  if (body.payment_status === "paid") {
    const existing = await getBooking(id);
    if (!existing) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    if (existing.payment_status === "paid") {
      const business = await getActiveBusiness(existing.business_id);
      if (!business) {
        return NextResponse.json({ detail: "Business not found" }, { status: 404 });
      }
      return NextResponse.json({
        resource: serializeScheduledEvent(existing, business),
      });
    }
    if (existing.payment_status !== "partially_paid") {
      return NextResponse.json(
        { detail: "Only partially paid bookings can be marked settled" },
        { status: 409 }
      );
    }
    const updated = await markBookingSettled(id);
    if (!updated) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    const business = await getActiveBusiness(updated.business_id);
    if (!business) {
      return NextResponse.json({ detail: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ resource: serializeScheduledEvent(updated, business) });
  }

  // --- Special request (occasion / prep — not priced) ---
  if ("special_request" in body) {
    const existing = await getBooking(id);
    if (!existing) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    const raw = body.special_request;
    const value =
      typeof raw === "string" && raw.trim()
        ? raw.trim().slice(0, 500)
        : null;
    await query(
      `UPDATE bookings SET special_request = $2, updated_at = NOW(3) WHERE id = $1`,
      [id, value]
    );
    const updated = await getBooking(id);
    if (!updated) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    const business = await getActiveBusiness(updated.business_id);
    if (!business) {
      return NextResponse.json({ detail: "Business not found" }, { status: 404 });
    }
    return NextResponse.json({ resource: serializeScheduledEvent(updated, business) });
  }

  // --- Reschedule ---
  if (typeof body.start_time === "string") {
    const newStart = parseIsoAssumeUtc(body.start_time);
    if (!newStart) {
      return NextResponse.json({ detail: "Invalid start_time" }, { status: 400 });
    }
    const existing = await getBooking(id);
    if (!existing) {
      return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    }
    const service = await getService(existing.service_id);
    if (!service) {
      return NextResponse.json({ detail: "Service not found" }, { status: 404 });
    }
    try {
      const moved = await rescheduleBooking({ booking: existing, service, newStart });
      const business = await getActiveBusiness(moved.business_id);
      if (!business) {
        return NextResponse.json({ detail: "Business not found" }, { status: 404 });
      }
      await sendBookingRescheduled(moved, business);
      return NextResponse.json({ resource: serializeScheduledEvent(moved, business) });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        return NextResponse.json({ detail: err.message }, { status: 409 });
      }
      throw err;
    }
  }

  // --- Cancel ---
  if (body.status !== "canceled" && body.status !== "cancelled") {
    return NextResponse.json(
      {
        detail:
          "Provide status 'canceled', start_time, guests, car_types, special_request, or seen",
      },
      { status: 400 }
    );
  }

  const before = await getBooking(id);
  const booking = await cancelBooking(id);
  if (!booking) {
    return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(booking.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }
  // Notify once — only when this call actually cancelled an active booking.
  if (before && before.status !== "cancelled") {
    await sendBookingCancelled(booking, business);
  }
  return NextResponse.json({ resource: serializeScheduledEvent(booking, business) });
}

async function resolveBooking(params: { bookingId: string }) {
  const id = parseBookingId(params.bookingId);
  if (!id) return null;
  return getBooking(id);
}

