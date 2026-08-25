import { NextResponse } from "next/server";
import { markAllBookingsSeen } from "@/lib/calendly/repository";
import { isAdminAuthorized } from "@/lib/admin-auth";

// PATCH /api/v1/calendly/admin/seen  { business_id?, seen }
// Admin-gated: mark every booking for the business seen (or unseen).
export async function PATCH(request: Request) {
  if (!(await isAdminAuthorized(request))) {
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
