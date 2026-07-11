import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/yoco";
import {
  markBookingPaid,
  getBookingByCheckoutId,
  getBooking,
  getActiveBusiness,
} from "@/lib/calendly/repository";
import { sendBookingConfirmation } from "@/lib/email";

/**
 * Yoco webhook receiver. Verifies the Svix-style signature over the RAW body,
 * then marks the matching booking paid on `payment.succeeded`.
 * Register the endpoint with scripts/register-yoco-webhook.mjs and put the
 * returned secret in YOCO_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const ok = verifyWebhookSignature({
    rawBody,
    webhookId: request.headers.get("webhook-id"),
    webhookTimestamp: request.headers.get("webhook-timestamp"),
    webhookSignature: request.headers.get("webhook-signature"),
  });
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    type?: string;
    payload?: {
      id?: string;
      amount?: number;
      status?: string;
      metadata?: Record<string, string>;
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type === "payment.succeeded" && event.payload) {
    const p = event.payload;
    const meta = p.metadata ?? {};

    // Prefer the bookingId we stamped on the checkout; fall back to checkoutId.
    let bookingId = Number(meta.bookingId);
    if (!Number.isInteger(bookingId) && meta.checkoutId) {
      const b = await getBookingByCheckoutId(meta.checkoutId);
      if (b) bookingId = b.id;
    }

    if (Number.isInteger(bookingId)) {
      const paymentId = p.id ?? "";
      const amount = typeof p.amount === "number" ? p.amount : 0;
      const newlyPaid = await markBookingPaid(bookingId, paymentId, amount);
      // Send the confirmation email once, only on the first successful payment.
      if (newlyPaid) {
        const booking = await getBooking(bookingId);
        const business = booking && (await getActiveBusiness(booking.business_id));
        if (booking && business) await sendBookingConfirmation(booking, business);
      }
    }
  }

  // Always 200 for handled/ignored events so Yoco stops retrying.
  return NextResponse.json({ received: true });
}
