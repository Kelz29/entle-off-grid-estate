import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getBooking,
  getActiveBusiness,
  markBookingPaid,
} from "@/lib/calendly/repository";
import { parseBookingId } from "@/lib/calendly/booking-id";
import { sendBookingConfirmation } from "@/lib/email";
import { notifyNewBooking } from "@/lib/slack";
import { getCheckout, YocoError } from "@/lib/yoco";
import { processDeferredPayment } from "@/lib/calendly/deferred-booking";

function metaStrings(
  raw: Record<string, unknown> | undefined
): Record<string, string | undefined> {
  if (!raw) return {};
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (v != null) out[k] = String(v);
  }
  return out;
}

/**
 * Reconcile a booking against its Yoco checkout.
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

  if (booking?.payment_status === "paid") {
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
  let checkoutId = rows[0]?.checkout_id;

  if (!checkoutId) {
    const { rows: deferred } = await query<{ checkout_id: string }>(
      `SELECT checkout_id FROM deferred_bookings WHERE id = $1 LIMIT 1`,
      [bookingId]
    );
    checkoutId = deferred[0]?.checkout_id ?? null;
  }

  if (!checkoutId) {
    return NextResponse.json({
      payment_status: booking?.payment_status ?? "unpaid",
      status: booking?.status ?? "pending",
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
      { error: message, payment_status: booking?.payment_status },
      { status: 502 }
    );
  }

  if (checkout.status !== "completed") {
    return NextResponse.json({
      payment_status: booking?.payment_status ?? "unpaid",
      status: booking?.status ?? "pending",
      checkout_status: checkout.status,
      reconciled: false,
    });
  }

  const paymentId = checkout.paymentId ?? checkout.id;
  const amount =
    typeof checkout.amount === "number"
      ? checkout.amount
      : booking?.payment_amount_cents ?? 0;

  const checkoutMeta = metaStrings(checkout.metadata);

  if (checkoutMeta.mode === "deferred" || !booking) {
    const result = await processDeferredPayment({
      metadata: checkoutMeta,
      checkoutId,
      paymentId,
      amountCents: amount,
    });
    if (result.needsRetry) {
      return NextResponse.json(
        { error: "Database unavailable", payment_status: "unpaid" },
        { status: 503 }
      );
    }
    if (result.ok && result.booking && result.created) {
      const business = await getActiveBusiness(result.booking.business_id);
      if (business) {
        await sendBookingConfirmation(result.booking, business);
        await notifyNewBooking(result.booking, business, "paid");
      }
      return NextResponse.json({
        payment_status: result.booking.payment_status,
        status: result.booking.status,
        checkout_status: checkout.status,
        reconciled: true,
        conflict: result.conflict,
        email_sent: true,
      });
    }
    if (result.ok && result.booking) {
      return NextResponse.json({
        payment_status: result.booking.payment_status,
        status: result.booking.status,
        checkout_status: checkout.status,
        reconciled: false,
        conflict: result.conflict,
      });
    }
  }

  const newlyPaid = await markBookingPaid(bookingId, paymentId, amount);
  if (newlyPaid) {
    const updated = await getBooking(bookingId);
    const business =
      updated && (await getActiveBusiness(updated.business_id));
    if (updated && business) {
      await sendBookingConfirmation(updated, business);
      await notifyNewBooking(updated, business, "paid");
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
