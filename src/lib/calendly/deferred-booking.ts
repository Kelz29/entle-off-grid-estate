import {
  createScheduledEvent,
  SlotUnavailableError,
} from "./bookings";
import { newBookingId, parseBookingId } from "./booking-id";
import {
  getActiveBusiness,
  getBooking,
  getService,
  markBookingPaid,
  setCheckoutId,
} from "./repository";
import {
  snapshotBusiness,
  snapshotService,
} from "./booking-snapshot";
import { parseIsoAssumeUtc } from "./time";
import { query } from "@/lib/db";
import { isDbConnectivityError } from "@/lib/api-errors";
import { sendDeferredBookingAlert } from "@/lib/email";
import type { BookingRow } from "./types";

export type DeferredBookingPayload = {
  bookingId: string;
  businessId: number;
  serviceId: number;
  startTime: string;
  guests: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  carTypes?: string[] | null;
  notes?: string | null;
  specialRequest?: string | null;
  amountCents: number;
};

export function encodeDeferredMetadata(
  payload: DeferredBookingPayload
): Record<string, string> {
  const json = JSON.stringify(payload);
  return {
    bookingId: payload.bookingId,
    mode: "deferred",
    payload: Buffer.from(json, "utf8").toString("base64url"),
  };
}

export function decodeDeferredMetadata(
  meta: Record<string, string | undefined>
): DeferredBookingPayload | null {
  if (meta.mode !== "deferred") return null;
  const bookingId = parseBookingId(meta.bookingId);
  if (!bookingId) return null;

  if (meta.payload) {
    try {
      const json = Buffer.from(meta.payload, "base64url").toString("utf8");
      const parsed = JSON.parse(json) as DeferredBookingPayload;
      if (parsed.bookingId === bookingId) return parsed;
    } catch {
      /* fall through to scalar fields */
    }
  }

  const startTime = meta.startTime;
  if (!startTime) return null;
  const businessId = Number(meta.businessId);
  const serviceId = Number(meta.serviceId);
  const guests = Number(meta.guests);
  const amountCents = Number(meta.amountCents);
  if (
    !Number.isInteger(businessId) ||
    !Number.isInteger(serviceId) ||
    !Number.isInteger(guests) ||
    !Number.isFinite(amountCents)
  ) {
    return null;
  }

  let carTypes: string[] | null = null;
  if (meta.carTypesJson) {
    try {
      const arr = JSON.parse(meta.carTypesJson);
      if (Array.isArray(arr)) {
        carTypes = arr.filter((x): x is string => typeof x === "string");
      }
    } catch {
      carTypes = null;
    }
  }

  return {
    bookingId,
    businessId,
    serviceId,
    startTime,
    guests,
    guestName: meta.guestName ?? "",
    guestEmail: meta.guestEmail ?? "",
    guestPhone: meta.guestPhone ?? null,
    carTypes,
    notes: meta.notes ?? null,
    specialRequest: meta.specialRequest ?? null,
    amountCents,
  };
}

export async function insertDeferredBookingRow(input: {
  id: string;
  checkoutId: string;
  payload: DeferredBookingPayload;
  paymentId?: string | null;
  paymentAmountCents?: number | null;
  status?: "pending" | "synced" | "conflict";
}): Promise<void> {
  await query(
    `INSERT INTO deferred_bookings
       (id, checkout_id, payload, payment_id, payment_amount_cents, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON DUPLICATE KEY UPDATE
       checkout_id = VALUES(checkout_id),
       payload = VALUES(payload),
       payment_id = COALESCE(VALUES(payment_id), payment_id),
       payment_amount_cents = COALESCE(VALUES(payment_amount_cents), payment_amount_cents),
       status = VALUES(status)`,
    [
      input.id,
      input.checkoutId,
      JSON.stringify(input.payload),
      input.paymentId ?? null,
      input.paymentAmountCents ?? null,
      input.status ?? "pending",
    ]
  );
}

export type DeferredBookingRow = {
  id: string;
  checkout_id: string;
  payload: string;
  payment_id: string | null;
  payment_amount_cents: number | null;
  status: "pending" | "synced" | "conflict";
  created_at: string;
  synced_at: string | null;
};

export async function listDeferredBookings(
  status?: "pending" | "synced" | "conflict"
): Promise<DeferredBookingRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where = `WHERE status = $${params.length}`;
  }
  const { rows } = await query<DeferredBookingRow>(
    `SELECT id, checkout_id, payload, payment_id, payment_amount_cents, status, created_at, synced_at
       FROM deferred_bookings ${where}
       ORDER BY created_at DESC
       LIMIT 100`,
    params
  );
  return rows;
}

export async function markDeferredBookingStatus(
  id: string,
  status: "synced" | "conflict"
): Promise<void> {
  await query(
    `UPDATE deferred_bookings
        SET status = $2, synced_at = NOW(3)
      WHERE id = $1`,
    [id, status]
  );
}

async function resolveBusinessAndService(
  businessId: number,
  serviceId: number
): Promise<{
  business: Awaited<ReturnType<typeof getActiveBusiness>>;
  service: Awaited<ReturnType<typeof getService>>;
}> {
  try {
    const business = await getActiveBusiness(businessId);
    const service = await getService(serviceId);
    return { business, service };
  } catch (err) {
    if (!isDbConnectivityError(err)) throw err;
    const business = snapshotBusiness(businessId);
    const service = snapshotService(serviceId);
    return { business, service };
  }
}

/**
 * Create a booking row from deferred checkout metadata (webhook / reconcile).
 * Returns null if payload invalid; throws if DB unavailable after outbox write fails.
 */
export async function materializeBookingFromMetadata(
  payload: DeferredBookingPayload,
  checkoutId: string,
  paymentId?: string | null,
  paymentAmountCents?: number | null
): Promise<{ booking: BookingRow | null; conflict: boolean; created: boolean }> {
  const existing = await getBooking(payload.bookingId);
  if (existing) {
    if (paymentId && existing.payment_status !== "paid") {
      await markBookingPaid(
        payload.bookingId,
        paymentId,
        paymentAmountCents ?? payload.amountCents
      );
    }
    await markDeferredBookingStatus(payload.bookingId, "synced").catch(() => {});
    return {
      booking: (await getBooking(payload.bookingId)) ?? existing,
      conflict: false,
      created: false,
    };
  }

  const { business, service } = await resolveBusinessAndService(
    payload.businessId,
    payload.serviceId
  );
  if (!business || !service) {
    throw new Error("Could not resolve business/service for deferred booking");
  }

  const startTime = parseIsoAssumeUtc(payload.startTime);
  if (!startTime) throw new Error("Invalid deferred start_time");

  let conflict = false;
  let booking: BookingRow | null = null;

  try {
    booking = await createScheduledEvent({
      business,
      service,
      startTime,
      invitee: {
        name: payload.guestName,
        email: payload.guestEmail,
        phone: payload.guestPhone ?? null,
      },
      guests: payload.guests,
      carTypes: payload.carTypes,
      notes: payload.notes,
      specialRequest: payload.specialRequest,
      status: "active",
      bookingId: payload.bookingId,
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      conflict = true;
      const conflictNote = `[CONFLICT] ${payload.notes ?? ""}`.trim();
      booking = await createScheduledEvent({
        business,
        service,
        startTime,
        invitee: {
          name: payload.guestName,
          email: payload.guestEmail,
          phone: payload.guestPhone ?? null,
        },
        guests: payload.guests,
        carTypes: payload.carTypes,
        notes: conflictNote,
        specialRequest: payload.specialRequest,
        status: "active",
        bookingId: payload.bookingId,
        skipCapacityCheck: true,
      });
    } else {
      throw err;
    }
  }

  await setCheckoutId(payload.bookingId, checkoutId).catch(() => {});

  if (paymentId) {
    await markBookingPaid(
      payload.bookingId,
      paymentId,
      paymentAmountCents ?? payload.amountCents
    );
  }

  await markDeferredBookingStatus(
    payload.bookingId,
    conflict ? "conflict" : "synced"
  ).catch(() => {});

  return {
    booking: (await getBooking(payload.bookingId)) ?? booking,
    conflict,
    created: true,
  };
}

export async function processDeferredPayment(input: {
  metadata: Record<string, string | undefined>;
  checkoutId: string;
  paymentId?: string | null;
  amountCents?: number | null;
}): Promise<{
  ok: boolean;
  booking: BookingRow | null;
  conflict: boolean;
  created: boolean;
  needsRetry: boolean;
}> {
  const payload = decodeDeferredMetadata(input.metadata);
  if (!payload) {
    return {
      ok: false,
      booking: null,
      conflict: false,
      created: false,
      needsRetry: false,
    };
  }

  try {
    const result = await materializeBookingFromMetadata(
      payload,
      input.checkoutId,
      input.paymentId,
      input.amountCents
    );
    return {
      ok: true,
      booking: result.booking,
      conflict: result.conflict,
      created: result.created,
      needsRetry: false,
    };
  } catch (err) {
    if (isDbConnectivityError(err)) {
      try {
        await insertDeferredBookingRow({
          id: payload.bookingId,
          checkoutId: input.checkoutId,
          payload,
          paymentId: input.paymentId,
          paymentAmountCents: input.amountCents,
          status: "pending",
        });
      } catch (outboxErr) {
        await sendDeferredBookingAlert(payload, input.checkoutId, outboxErr);
        return {
          ok: false,
          booking: null,
          conflict: false,
          created: false,
          needsRetry: true,
        };
      }
      return {
        ok: false,
        booking: null,
        conflict: false,
        created: false,
        needsRetry: true,
      };
    }
    throw err;
  }
}

export function buildDeferredPayload(input: {
  businessId: number;
  serviceId: number;
  startTime: Date;
  guests: number;
  invitee: { name: string; email: string; phone?: string | null };
  carTypes?: string[] | null;
  notes?: string | null;
  specialRequest?: string | null;
  amountCents: number;
  bookingId?: string;
}): DeferredBookingPayload {
  return {
    bookingId: input.bookingId ?? newBookingId(),
    businessId: input.businessId,
    serviceId: input.serviceId,
    startTime: input.startTime.toISOString(),
    guests: input.guests,
    guestName: input.invitee.name,
    guestEmail: input.invitee.email,
    guestPhone: input.invitee.phone ?? null,
    carTypes: input.carTypes ?? null,
    notes: input.notes ?? null,
    specialRequest: input.specialRequest ?? null,
    amountCents: input.amountCents,
  };
}

/** Process rows still pending in deferred_bookings after DB recovery. */
export async function syncPendingDeferredBookings(): Promise<number> {
  const rows = await listDeferredBookings("pending");
  let synced = 0;
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as DeferredBookingPayload;
      await materializeBookingFromMetadata(
        payload,
        row.checkout_id,
        row.payment_id,
        row.payment_amount_cents
      );
      synced += 1;
    } catch (err) {
      console.error("[deferred] sync pending failed:", row.id, err);
    }
  }
  return synced;
}
