import { NextResponse } from "next/server";
import { releaseUnpaidBooking } from "@/lib/calendly/repository";
import { parseBookingId } from "@/lib/calendly/booking-id";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { verifyReleaseToken } from "@/lib/booking-release-token";

/**
 * Free a slot held by a pending unpaid checkout.
 * Requires either a valid HMAC release token (cancel/fail pages) or an admin session.
 */
export async function POST(request: Request) {
  let body: { bookingId?: number | string; token?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const id = parseBookingId(
    body.bookingId != null ? String(body.bookingId) : null
  );
  if (!id) {
    return NextResponse.json({ detail: "bookingId is required" }, { status: 400 });
  }

  const admin = await isAdminAuthorized(request);
  if (!admin) {
    const ok = await verifyReleaseToken(body.token, id);
    if (!ok) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
  }

  const released = await releaseUnpaidBooking(id);
  return NextResponse.json({ released });
}
