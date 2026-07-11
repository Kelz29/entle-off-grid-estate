import { NextResponse } from "next/server";
import { markAllBookingsSeen } from "@/lib/calendly/repository";

// PATCH /api/v1/calendly/admin/seen  { business_id?, seen }
// Admin-gated: mark every booking for the business seen (or unseen).
export async function PATCH(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!expected || token !== expected) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let body: { business_id?: number; seen?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    /* default below */
  }
  const businessId = Number(body.business_id ?? 1);
  const seen = body.seen !== false; // defaults to marking all seen
  await markAllBookingsSeen(businessId, seen);
  return NextResponse.json({ ok: true });
}
