import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getBooking,
  getActiveBusiness,
  markBookingPaid,
} from "@/lib/calendly/repository";
import { parseBookingId } from "@/lib/calendly/booking-id";
import { sendBookingConfirmation } from "@/lib/email";
import { getCheckout, YocoError } from "@/lib/yoco";

/**
 * Reconcile a booking against its Yoco checkout.
 *
 * Used by /booking/success when the webhook can't reach this host (typical on
 * localhost without a tunnel). If Yoco reports the checkout as completed, we
 * mark the booking paid and send the confirmation email (idempotent with the
 * webhook path via markBookingPaid).
 */
export async function POST(request: Request) {
  let body: { bookingId?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId = parseBookingId(
    typeof body.bookingId === "string" || typeof body.bookingId === "number"
      ? String(body.bookingId)
      : null
  );
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const booking = await getBooking(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.payment_status === "paid") {
    return NextResponse.json({
      payment_status: "paid",
      status: booking.status,
      reconciled: false,
    });
  }

  const { rows } = await query<{ checkout_id: string | null }>(
    `SELECT checkout_id FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const checkoutId = rows[0]?.checkout_id;
  if (!checkoutId) {
    return NextResponse.json({
      payment_status: booking.payment_status,
      status: booking.status,
      reconciled: false,
      reason: "no_checkout",
    });
  }

  let checkout;
  try {
    checkout = await getCheckout(checkoutId);
  } catch (err) {
    const message =
      err instanceof YocoError ? err.message : "Could not reach Yoco";
    console.error("[reconcile] getCheckout failed:", message);
    return NextResponse.json(
      { error: message, payment_status: booking.payment_status },
      { status: 502 }
    );
  }

  if (checkout.status !== "completed") {
    return NextResponse.json({
      payment_status: booking.payment_status,
      status: booking.status,
      checkout_status: checkout.status,
      reconciled: false,
    });
  }

  const paymentId = checkout.paymentId ?? checkout.id;
  const amount =
    typeof checkout.amount === "number"
      ? checkout.amount
      : booking.payment_amount_cents ?? 0;

  const newlyPaid = await markBookingPaid(bookingId, paymentId, amount);
  if (newlyPaid) {
    const updated = await getBooking(bookingId);
    const business =
      updated && (await getActiveBusiness(updated.business_id));
    if (updated && business) {
      await sendBookingConfirmation(updated, business);
    }
  }

  const fresh = await getBooking(bookingId);
  return NextResponse.json({
    payment_status: fresh?.payment_status ?? "paid",
    status: fresh?.status ?? "active",
    checkout_status: checkout.status,
    reconciled: newlyPaid,
    email_sent: newlyPaid,
  });
}
