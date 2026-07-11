import { NextResponse } from "next/server";
import { releaseUnpaidBooking } from "@/lib/calendly/repository";

// Free a slot held by an unpaid booking when the customer cancels or the
// payment fails. Safe by construction: never affects a paid booking.
export async function POST(request: Request) {
  let body: { bookingId?: number | string } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const id = Number(body.bookingId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ detail: "bookingId is required" }, { status: 400 });
  }
  const released = await releaseUnpaidBooking(id);
  return NextResponse.json({ released });
}
