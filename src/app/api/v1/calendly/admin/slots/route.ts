import { NextResponse } from "next/server";
import {
  getActiveBusiness,
  getService,
  setSlotHold,
  deleteSlotOverride,
  bookedGuestsForSlot,
  getSlotHolds,
} from "@/lib/calendly/repository";
import { getSlotUsage } from "@/lib/calendly/availability";
import {
  serviceIdFromEventType,
  BadEventTypeError,
} from "@/lib/calendly/config";
import { parseIsoAssumeUtc, toZonedIso } from "@/lib/calendly/time";
import type { ServiceRow } from "@/lib/calendly/types";

// Admin-only: per-slot seat management. Both verbs require the admin token.
function authorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return token === expected;
}

async function resolveServiceId(eventType: string): Promise<number | null> {
  try {
    return serviceIdFromEventType(eventType);
  } catch (err) {
    if (err instanceof BadEventTypeError) return null;
    throw err;
  }
}

// GET /api/v1/calendly/admin/slots?event_type=&date=YYYY-MM-DD
// Every slot for that day with booked / capacity / remaining / held.
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const eventType = url.searchParams.get("event_type");
  const date = url.searchParams.get("date"); // YYYY-MM-DD
  if (!eventType || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { detail: "event_type and date=YYYY-MM-DD are required" },
      { status: 400 }
    );
  }
  const serviceId = await resolveServiceId(eventType);
  if (serviceId == null) {
    return NextResponse.json({ detail: "Invalid event_type" }, { status: 400 });
  }
  const service = await getService(serviceId);
  if (!service) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(service.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }

  const windowStart = new Date(`${date}T00:00:00Z`);
  const windowEnd = new Date(windowStart.getTime() + 86_400_000);
  const usage = await getSlotUsage({ business, service, windowStart, windowEnd });

  return NextResponse.json({
    collection: usage.map((u) => ({
      start_time: toZonedIso(u.start, business.timezone),
      capacity: u.capacity,
      booked: u.booked,
      held: u.held,
      remaining: Math.max(0, u.remaining),
      overridden: u.overridden,
    })),
  });
}

// PATCH /api/v1/calendly/admin/slots
//   { event_type, start_time, seats_left } → set seats left (adjusts "booked"
//     via a manual hold; capacity stays fixed).
//   { event_type, start_time, reset:true } → clear the manual hold.
export async function PATCH(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  let body: {
    event_type?: string;
    start_time?: string;
    seats_left?: unknown;
    reset?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.event_type || !body.start_time) {
    return NextResponse.json(
      { detail: "event_type and start_time are required" },
      { status: 400 }
    );
  }
  const serviceId = await resolveServiceId(body.event_type);
  if (serviceId == null) {
    return NextResponse.json({ detail: "Invalid event_type" }, { status: 400 });
  }
  const start = parseIsoAssumeUtc(body.start_time);
  if (!start) {
    return NextResponse.json({ detail: "Invalid start_time" }, { status: 400 });
  }
  const service = await getService(serviceId);
  if (!service) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(service.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }

  if (body.reset) {
    await deleteSlotOverride(serviceId, start);
    return NextResponse.json({ resource: await slotState(service, business, start) });
  }

  const seatsLeft = Number(body.seats_left);
  if (!Number.isInteger(seatsLeft) || seatsLeft < 0) {
    return NextResponse.json(
      { detail: "seats_left must be a whole number of 0 or more" },
      { status: 400 }
    );
  }

  // Turn the desired "seats left" into a manual hold, keeping capacity fixed.
  // Real bookings can't be un-booked, so left maxes out at capacity − real.
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const real = await bookedGuestsForSlot(serviceId, start, end);
  const capacity = service.capacity;
  const clampedLeft = Math.min(seatsLeft, Math.max(0, capacity - real));
  const held = capacity - real - clampedLeft; // >= 0
  if (held <= 0) {
    await deleteSlotOverride(serviceId, start);
  } else {
    await setSlotHold(serviceId, start, held);
  }

  return NextResponse.json({ resource: await slotState(service, business, start) });
}

async function slotState(
  service: ServiceRow,
  business: { timezone: string },
  start: Date
) {
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const holds = await getSlotHolds(
    service.id,
    start,
    new Date(start.getTime() + 1000)
  );
  const held = holds.get(start.toISOString()) ?? 0;
  const real = await bookedGuestsForSlot(service.id, start, end);
  const booked = real + held;
  return {
    start_time: toZonedIso(start, business.timezone),
    capacity: service.capacity,
    booked,
    held,
    remaining: Math.max(0, service.capacity - booked),
    overridden: held > 0,
  };
}
