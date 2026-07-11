import { NextResponse } from "next/server";
import { getActiveBusiness, getService } from "@/lib/calendly/repository";
import { getAvailableSlots } from "@/lib/calendly/availability";
import { serializeAvailableTime } from "@/lib/calendly/serializers";
import { serviceIdFromEventType, BadEventTypeError } from "@/lib/calendly/config";
import { parseIsoAssumeUtc } from "@/lib/calendly/time";

const SEVEN_DAYS_MS = 7 * 86_400_000;

// GET /api/v1/calendly/event_type_available_times?event_type=&start_time=&end_time=
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventType = url.searchParams.get("event_type");
  const startRaw = url.searchParams.get("start_time");
  const endRaw = url.searchParams.get("end_time");

  if (!eventType || !startRaw || !endRaw) {
    return NextResponse.json(
      { detail: "event_type, start_time and end_time are required" },
      { status: 400 }
    );
  }

  let serviceId: number;
  try {
    serviceId = serviceIdFromEventType(eventType);
  } catch (err) {
    if (err instanceof BadEventTypeError) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    throw err;
  }

  const start = parseIsoAssumeUtc(startRaw);
  const end = parseIsoAssumeUtc(endRaw);
  if (!start || !end) {
    return NextResponse.json(
      { detail: "Invalid start_time or end_time" },
      { status: 400 }
    );
  }

  // Window rules (CALENDLY_API.md §2.3).
  if (end <= start) {
    return NextResponse.json(
      { detail: "end_time must be after start_time" },
      { status: 400 }
    );
  }
  if (end.getTime() - start.getTime() > SEVEN_DAYS_MS) {
    return NextResponse.json(
      { detail: "Date range must be 7 days or less" },
      { status: 400 }
    );
  }
  if (end.getTime() <= Date.now()) {
    return NextResponse.json(
      { detail: "end_time must be in the future" },
      { status: 400 }
    );
  }

  const service = await getService(serviceId);
  if (!service) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(service.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }

  const slots = await getAvailableSlots({
    business,
    service,
    windowStart: start,
    windowEnd: end,
  });

  // Note: availability responses have NO pagination envelope (§2.3).
  return NextResponse.json({
    collection: slots.map((slot) =>
      serializeAvailableTime(slot.start, slot.remaining, service, business)
    ),
  });
}
