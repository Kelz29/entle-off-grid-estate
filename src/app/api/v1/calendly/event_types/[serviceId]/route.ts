import { NextResponse } from "next/server";
import {
  getActiveBusiness,
  getService,
  updateService,
} from "@/lib/calendly/repository";
import { serializeEventType } from "@/lib/calendly/serializers";
import { isAdminAuthorized, requireAdminSession } from "@/lib/admin-auth";
import { canManageSeats } from "@/lib/admin-roles";

// GET /api/v1/calendly/event_types/{serviceId}
// Not business-scoped: any existing service id resolves (CALENDLY_API.md §2.2).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params;
  const id = Number(serviceId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ detail: "Invalid service id" }, { status: 400 });
  }

  const service = await getService(id);
  if (!service) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }

  const business = await getActiveBusiness(service.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }

  return NextResponse.json({ resource: serializeEventType(service, business) });
}

function trimField(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

// PATCH /api/v1/calendly/event_types/{serviceId}
// Admin-gated: capacity (Seats panel) plus name/description/duration/deposit/active.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const session = await requireAdminSession(request);
  const allowed = session
    ? canManageSeats(session.role)
    : await isAdminAuthorized(request);
  if (!allowed) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { serviceId } = await params;
  const id = Number(serviceId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ detail: "Invalid service id" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }

  const patch: {
    capacity?: number;
    name?: string;
    description?: string;
    duration_minutes?: number;
    price_cents?: number;
    is_active?: boolean;
  } = {};

  if (body.capacity !== undefined) {
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
      return NextResponse.json(
        { detail: "capacity must be a whole number of 1 or more" },
        { status: 400 }
      );
    }
    patch.capacity = capacity;
  }

  const name = trimField(body.name, 255);
  if (name) patch.name = name;

  if (typeof body.description === "string") {
    patch.description = body.description.trim().slice(0, 2000);
  }

  const durationRaw =
    body.duration_minutes !== undefined
      ? body.duration_minutes
      : body.duration;
  if (durationRaw !== undefined) {
    const duration = Number(durationRaw);
    if (!Number.isInteger(duration) || duration < 15 || duration > 24 * 60) {
      return NextResponse.json(
        { detail: "duration_minutes must be between 15 and 1440" },
        { status: 400 }
      );
    }
    patch.duration_minutes = duration;
  }

  if (body.price_cents !== undefined) {
    const price = Number(body.price_cents);
    if (!Number.isInteger(price) || price < 0 || price > 10_000_000) {
      return NextResponse.json(
        { detail: "price_cents must be a whole number of 0 or more" },
        { status: 400 }
      );
    }
    patch.price_cents = price;
  }

  if (typeof body.is_active === "boolean") {
    patch.is_active = body.is_active;
  } else if (typeof body.active === "boolean") {
    patch.is_active = body.active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        detail:
          "Provide capacity, name, description, duration_minutes, price_cents, or is_active",
      },
      { status: 400 }
    );
  }

  const service = await updateService(id, patch);
  if (!service) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(service.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }
  return NextResponse.json({ resource: serializeEventType(service, business) });
}
