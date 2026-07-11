import { NextResponse } from "next/server";
import {
  getActiveBusiness,
  getBooking,
  getService,
  cancelBooking,
  setBookingSeen,
} from "@/lib/calendly/repository";
import {
  rescheduleBooking,
  updateBookingGuests,
  SlotUnavailableError,
} from "@/lib/calendly/bookings";
import { serializeScheduledEvent } from "@/lib/calendly/serializers";
import { parseIsoAssumeUtc } from "@/lib/calendly/time";
import { sendBookingRescheduled, sendBookingCancelled } from "@/lib/email";

// GET /api/v1/calendly/scheduled_events/{bookingId} (§2.5).
export async function GET(
  _request: Request,
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
  return NextResponse.json({ resource: serializeScheduledEvent(booking, business) });
}

// PATCH /api/v1/calendly/scheduled_events/{bookingId}
//   { "status": "canceled" }          → cancel (frees seats)
//   { "start_time": "<ISO>" }         → reschedule to a new slot
// Admin-gated (not part of the read-only Calendly surface). Requires a token.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let body: {
    status?: string;
    start_time?: string;
    guests?: number;
    seen?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }

  const { bookingId } = await params;
  const id = Number(bookingId);
  if (!Number.isInteger(id)) {
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

  // --- Change guest count ---
  if (typeof body.guests === "number") {
    const guests = Math.trunc(body.guests);
    if (!Number.isInteger(guests) || guests < 1) {
      return NextResponse.json({ detail: "guests must be ≥ 1" }, { status: 400 });
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
      { detail: "Provide status 'canceled' or a start_time to reschedule" },
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
  const id = Number(params.bookingId);
  if (!Number.isInteger(id)) return null;
  return getBooking(id);
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return token === expected;
}
