import { NextResponse } from "next/server";
import {
  getActiveBusiness,
  getService,
  setServiceCapacity,
} from "@/lib/calendly/repository";
import { serializeEventType } from "@/lib/calendly/serializers";

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

// PATCH /api/v1/calendly/event_types/{serviceId}  { "capacity": 60 }
// Admin-gated: set the per-slot guest capacity for a shared (café) service.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const expected = process.env.ADMIN_TOKEN;
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!expected || token !== expected) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { serviceId } = await params;
  const id = Number(serviceId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ detail: "Invalid service id" }, { status: 400 });
  }

  let body: { capacity?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const capacity = Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) {
    return NextResponse.json(
      { detail: "capacity must be a whole number of 1 or more" },
      { status: 400 }
    );
  }

  const service = await setServiceCapacity(id, capacity);
  if (!service) {
    return NextResponse.json({ detail: "Event type not found" }, { status: 404 });
  }
  const business = await getActiveBusiness(service.business_id);
  if (!business) {
    return NextResponse.json({ detail: "Business not found" }, { status: 404 });
  }
  return NextResponse.json({ resource: serializeEventType(service, business) });
}
