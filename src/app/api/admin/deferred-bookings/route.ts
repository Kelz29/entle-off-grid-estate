import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  listDeferredBookings,
  syncPendingDeferredBookings,
} from "@/lib/calendly/deferred-booking";

export async function GET(request: Request) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const filter =
    status === "pending" || status === "synced" || status === "conflict"
      ? status
      : undefined;

  const rows = await listDeferredBookings(filter);
  return NextResponse.json({
    collection: rows.map((row) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }
      return {
        id: row.id,
        checkout_id: row.checkout_id,
        status: row.status,
        payment_id: row.payment_id,
        payment_amount_cents: row.payment_amount_cents,
        created_at: row.created_at,
        synced_at: row.synced_at,
        guest_name: payload.guestName,
        guest_email: payload.guestEmail,
        start_time: payload.startTime,
        guests: payload.guests,
      };
    }),
  });
}

export async function POST(request: Request) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const synced = await syncPendingDeferredBookings();
  return NextResponse.json({ synced });
}
