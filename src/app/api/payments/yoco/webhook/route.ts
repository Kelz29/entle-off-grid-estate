import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/yoco";
import {
  markBookingPaid,
  getBookingByCheckoutId,
  getBooking,
  getActiveBusiness,
} from "@/lib/calendly/repository";
import { parseBookingId } from "@/lib/calendly/booking-id";
import { sendBookingConfirmation } from "@/lib/email";
import { notifyNewBooking } from "@/lib/slack";
import {
  ServerAnalyticsEvents,
  trackServerEvent,
} from "@/lib/analytics-server";
import { processDeferredPayment } from "@/lib/calendly/deferred-booking";

/**
 * Yoco webhook receiver. Verifies the Svix-style signature over the RAW body,
 * then marks the matching booking paid on `payment.succeeded`.
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
      checkoutId?: string;
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
    const checkoutKey = meta.checkoutId ?? p.checkoutId ?? "";

    if (meta.mode === "deferred") {
      const result = await processDeferredPayment({
        metadata: meta,
        checkoutId: checkoutKey,
        paymentId: p.id ?? null,
        amountCents: typeof p.amount === "number" ? p.amount : null,
      });
      if (result.needsRetry) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      }
      if (result.ok && result.booking && result.created) {
        await trackServerEvent(ServerAnalyticsEvents.PaymentSucceeded, {
          amount_cents: p.amount ?? 0,
          deferred: true,
          conflict: result.conflict,
        });
        const business = await getActiveBusiness(result.booking.business_id);
        if (business) {
          await sendBookingConfirmation(result.booking, business);
          await notifyNewBooking(result.booking, business, "paid");
        }
      }
    } else {
      let bookingId = parseBookingId(meta.bookingId);
      if (!bookingId && checkoutKey) {
        const b = await getBookingByCheckoutId(checkoutKey);
        if (b) bookingId = b.id;
      }

      if (bookingId) {
        const paymentId = p.id ?? "";
        const amount = typeof p.amount === "number" ? p.amount : 0;
        const newlyPaid = await markBookingPaid(bookingId, paymentId, amount);
        if (newlyPaid) {
          await trackServerEvent(ServerAnalyticsEvents.PaymentSucceeded, {
            amount_cents: amount,
          });
          const booking = await getBooking(bookingId);
          const business =
            booking && (await getActiveBusiness(booking.business_id));
          if (booking && business) {
            await sendBookingConfirmation(booking, business);
            await notifyNewBooking(booking, business, "paid");
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
