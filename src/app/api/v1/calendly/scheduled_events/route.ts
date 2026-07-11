import { NextResponse } from "next/server";
import {
  getActiveBusiness,
  getService,
  listBookings,
} from "@/lib/calendly/repository";
import {
  createScheduledEvent,
  SlotUnavailableError,
  ServiceNotBookableError,
} from "@/lib/calendly/bookings";
import {
  serializeScheduledEvent,
  collection,
} from "@/lib/calendly/serializers";
import { serviceIdFromEventType, BadEventTypeError } from "@/lib/calendly/config";
import { parseIsoAssumeUtc } from "@/lib/calendly/time";

// GET /api/v1/calendly/scheduled_events?business_id=1&status=active
export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = Number(url.searchParams.get("business_id"));
  if (!Number.isInteger(businessId)) {
    return NextResponse.json({ detail: "business_id is required" }, { status: 400 });
  }
  const business = await getActiveBusiness(businessId);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }

  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "active" || statusParam === "canceled"
      ? statusParam
      : undefined;

  const minStart = parseOptionalDate(url.searchParams.get("min_start_time"));
  const maxStart = parseOptionalDate(url.searchParams.get("max_start_time"));
  const count = clampCount(url.searchParams.get("count"));

  const bookings = await listBookings({
    businessId,
    status,
    minStartTime: minStart,
    maxStartTime: maxStart,
    count,
  });

  return NextResponse.json(
    collection(bookings.map((b) => serializeScheduledEvent(b, business)))
  );
}

// POST /api/v1/calendly/scheduled_events — create + confirm a booking (§2.6).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 422 });
  }

  const parsed = validateCreateBody(body);
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

  try {
    const booking = await createScheduledEvent({
      business,
      service,
      startTime: parsed.startTime,
      invitee: parsed.invitee,
      guests: parsed.guests,
      notes: parsed.notes,
    });
    return NextResponse.json(
      { resource: serializeScheduledEvent(booking, business) },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json({ detail: err.message }, { status: 409 });
    }
    if (err instanceof ServiceNotBookableError) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    throw err;
  }
}

type CreateBody = {
  eventType: string;
  startTime: Date;
  invitee: { name: string; email: string; phone?: string | null };
  guests?: number;
  notes?: string | null;
};

function validateCreateBody(body: unknown): CreateBody | { error: string } {
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

  // Fold questions_and_answers into notes as "question: answer" lines (§2.6).
  const noteLines: string[] = [];
  if (typeof b.notes === "string" && b.notes.trim()) noteLines.push(b.notes.trim());
  if (Array.isArray(b.questions_and_answers)) {
    for (const qa of b.questions_and_answers) {
      if (qa && typeof qa === "object") {
        const q = (qa as Record<string, unknown>).question;
        const a = (qa as Record<string, unknown>).answer;
        if (typeof q === "string" && typeof a === "string") {
          noteLines.push(`${q}: ${a}`);
        }
      }
    }
  }
  const notes = noteLines.length ? noteLines.join("\n") : null;

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

function parseOptionalDate(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const d = parseIsoAssumeUtc(raw);
  return d ?? undefined;
}

function clampCount(raw: string | null, def = 20): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return def;
  return Math.min(100, Math.max(1, Math.trunc(n)));
}
