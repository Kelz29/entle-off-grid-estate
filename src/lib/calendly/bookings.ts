import type { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/db";
import type { BusinessRow, ServiceRow, BookingRow } from "./types";
import { findOrCreateCustomer, getBooking } from "./repository";

export class SlotUnavailableError extends Error {
  constructor() {
    super("Time slot is not available");
    this.name = "SlotUnavailableError";
  }
}

export class ServiceNotBookableError extends Error {
  constructor() {
    super("Service is not available for online booking");
    this.name = "ServiceNotBookableError";
  }
}

/**
 * Create + confirm a booking (CALENDLY_API.md §2.6). end_time is derived from
 * the service duration. Two concurrency models depending on the service:
 *
 *  - exclusive (events): the Postgres exclusion constraint
 *    `bookings_service_no_overlap` guarantees one booking per slot; a violation
 *    surfaces as a 409.
 *  - shared (café): up to `service.capacity` guests may share a slot. Enforced
 *    in a transaction under a per-(service, slot) advisory lock — count the
 *    guests already booked for the slot and reject if this party would exceed
 *    capacity. The constraint doesn't cover these rows (is_exclusive = false).
 */
export async function createScheduledEvent(input: {
  business: BusinessRow;
  service: ServiceRow;
  startTime: Date;
  invitee: { name: string; email: string; phone?: string | null };
  guests?: number;
  notes?: string | null;
  status?: "active" | "pending"; // "pending" holds the slot during payment
}): Promise<BookingRow> {
  const { business, service, startTime, invitee } = input;

  if (!service.is_active || !service.is_available_online) {
    throw new ServiceNotBookableError();
  }

  const guests = Math.max(1, input.guests ?? 1);
  const endTime = new Date(
    startTime.getTime() + service.duration_minutes * 60_000
  );
  const status = input.status ?? "active";

  const customerId = await findOrCreateCustomer({
    businessId: business.id,
    name: invitee.name,
    email: invitee.email,
    phone: invitee.phone ?? null,
  });

  const insertArgs = {
    business,
    service,
    customerId,
    invitee,
    startTime,
    endTime,
    guests,
    notes: input.notes ?? null,
    status,
  };
  const id = service.exclusive
    ? await insertExclusive(insertArgs)
    : await insertShared(insertArgs);

  const booking = await getBooking(id);
  if (!booking) throw new Error("Booking vanished after insert");
  return booking;
}

type InsertArgs = {
  business: BusinessRow;
  service: ServiceRow;
  customerId: number;
  invitee: { name: string; email: string; phone?: string | null };
  startTime: Date;
  endTime: Date;
  guests: number;
  notes: string | null;
  status: "active" | "pending";
};

// Column list + values shared by both insert paths (exclusive/shared differ
// only by is_exclusive). Guest details are snapshotted onto the booking.
const INSERT_COLS = `(business_id, service_id, customer_id, start_time, end_time,
  status, guests, notes, payment_provider, payment_status,
  guest_name, guest_email, guest_phone, is_exclusive)`;
function insertValues(a: InsertArgs, exclusive: boolean): unknown[] {
  return [
    a.business.id,
    a.service.id,
    a.customerId,
    a.startTime.toISOString(),
    a.endTime.toISOString(),
    a.status,
    a.guests,
    a.notes,
    a.invitee.name,
    a.invitee.email,
    a.invitee.phone ?? null,
    exclusive,
  ];
}
const INSERT_PLACEHOLDERS =
  "($1, $2, $3, $4, $5, $6, $7, $8, 'yoco', 'unpaid', $9, $10, $11, $12)";

async function insertExclusive(a: InsertArgs): Promise<number> {
  try {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO bookings ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS} RETURNING id`,
      insertValues(a, true)
    );
    return rows[0].id;
  } catch (err) {
    if (isPgCode(err, "23P01")) throw new SlotUnavailableError(); // overlap
    throw err;
  }
}

async function insertShared(a: InsertArgs): Promise<number> {
  // All café seatings for a slot share the same start_time (steps are
  // duration+buffer apart, so they never overlap across different starts) —
  // lock on (service, slot-start) to serialise concurrent bookings, then count.
  const slotEpoch = Math.floor(a.startTime.getTime() / 1000);
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
      a.service.id,
      slotEpoch,
    ]);

    const held = await slotHeld(client, a.service.id, a.startTime);
    const { rows: used } = await client.query<{ seats: number }>(
      `SELECT COALESCE(SUM(guests), 0)::int AS seats FROM bookings
        WHERE service_id = $1 AND status <> 'cancelled'
          AND start_time < $3 AND end_time > $2`,
      [a.service.id, a.startTime.toISOString(), a.endTime.toISOString()]
    );
    if (used[0].seats + held + a.guests > a.service.capacity) {
      throw new SlotUnavailableError();
    }

    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO bookings ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS} RETURNING id`,
      insertValues(a, false)
    );
    return rows[0].id;
  });
}

/**
 * Move a booking to a new start time (admin reschedule). Re-checks the target
 * slot with the same capacity rules as creation, excluding this booking itself,
 * and frees the old slot's seats by virtue of the row moving.
 */
export async function rescheduleBooking(input: {
  booking: BookingRow;
  service: ServiceRow;
  newStart: Date;
}): Promise<BookingRow> {
  const { booking, service, newStart } = input;
  const newEnd = new Date(newStart.getTime() + service.duration_minutes * 60_000);

  if (service.exclusive) {
    try {
      await query(
        `UPDATE bookings SET start_time = $2, end_time = $3, updated_at = now()
          WHERE id = $1`,
        [booking.id, newStart.toISOString(), newEnd.toISOString()]
      );
    } catch (err) {
      if (isPgCode(err, "23P01")) throw new SlotUnavailableError();
      throw err;
    }
  } else {
    const slotEpoch = Math.floor(newStart.getTime() / 1000);
    await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
        service.id,
        slotEpoch,
      ]);
      const held = await slotHeld(client, service.id, newStart);
      const { rows } = await client.query<{ seats: number }>(
        `SELECT COALESCE(SUM(guests), 0)::int AS seats FROM bookings
          WHERE service_id = $1 AND status <> 'cancelled' AND id <> $4
            AND start_time < $3 AND end_time > $2`,
        [service.id, newStart.toISOString(), newEnd.toISOString(), booking.id]
      );
      if (rows[0].seats + held + booking.guests > service.capacity) {
        throw new SlotUnavailableError();
      }
      await client.query(
        `UPDATE bookings SET start_time = $2, end_time = $3, updated_at = now()
          WHERE id = $1`,
        [booking.id, newStart.toISOString(), newEnd.toISOString()]
      );
    });
  }

  const updated = await getBooking(booking.id);
  if (!updated) throw new Error("Booking vanished after reschedule");
  return updated;
}

/**
 * Admin: change a booking's guest count. For shared services this re-checks the
 * slot's effective capacity (per-slot override, else service default) excluding
 * this booking; exclusive bookings just update.
 */
export async function updateBookingGuests(input: {
  booking: BookingRow;
  service: ServiceRow;
  guests: number;
}): Promise<BookingRow> {
  const { booking, service } = input;
  const guests = Math.max(1, Math.trunc(input.guests));
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);

  if (service.exclusive) {
    await query(`UPDATE bookings SET guests = $2, updated_at = now() WHERE id = $1`, [
      booking.id,
      guests,
    ]);
  } else {
    const slotEpoch = Math.floor(start.getTime() / 1000);
    await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [service.id, slotEpoch]);
      const held = await slotHeld(client, service.id, start);
      const { rows } = await client.query<{ seats: number }>(
        `SELECT COALESCE(SUM(guests), 0)::int AS seats FROM bookings
          WHERE service_id = $1 AND status <> 'cancelled' AND id <> $4
            AND start_time < $3 AND end_time > $2`,
        [service.id, start.toISOString(), end.toISOString(), booking.id]
      );
      if (rows[0].seats + held + guests > service.capacity)
        throw new SlotUnavailableError();
      await client.query(`UPDATE bookings SET guests = $2, updated_at = now() WHERE id = $1`, [
        booking.id,
        guests,
      ]);
    });
  }

  const updated = await getBooking(booking.id);
  if (!updated) throw new Error("Booking vanished after guest update");
  return updated;
}

// Manually-held (blocked) seats for a slot, read on a transaction client.
async function slotHeld(
  client: PoolClient,
  serviceId: number,
  slotStart: Date
): Promise<number> {
  const { rows } = await client.query<{ held_seats: number }>(
    `SELECT held_seats FROM slot_overrides WHERE service_id = $1 AND slot_start = $2`,
    [serviceId, slotStart.toISOString()]
  );
  return rows[0]?.held_seats ?? 0;
}

function isPgCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === code
  );
}
