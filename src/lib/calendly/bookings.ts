import { query, withTransaction, type DbClient } from "@/lib/db";
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
 * Create + confirm a booking. end_time is derived from the service duration.
 *
 *  - exclusive (events): reject overlapping live bookings for the same service
 *  - shared (café): up to `service.capacity` guests may share a slot, enforced
 *    under a MySQL named lock for the (service, slot) pair
 */
export async function createScheduledEvent(input: {
  business: BusinessRow;
  service: ServiceRow;
  startTime: Date;
  invitee: { name: string; email: string; phone?: string | null };
  guests?: number;
  notes?: string | null;
  status?: "active" | "pending";
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
    exclusive ? 1 : 0,
  ];
}

const INSERT_PLACEHOLDERS =
  "($1, $2, $3, $4, $5, $6, $7, $8, 'yoco', 'unpaid', $9, $10, $11, $12)";

async function insertExclusive(a: InsertArgs): Promise<number> {
  return withTransaction(async (client) => {
    await acquireSlotLock(client, a.service.id, a.startTime);

    const overlapping = await countOverlapping(
      client,
      a.service.id,
      a.startTime,
      a.endTime
    );
    if (overlapping > 0) throw new SlotUnavailableError();

    const result = await client.query(
      `INSERT INTO bookings ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS}`,
      insertValues(a, true)
    );
    if (!result.insertId) throw new Error("Insert did not return an id");
    return result.insertId;
  });
}

async function insertShared(a: InsertArgs): Promise<number> {
  return withTransaction(async (client) => {
    await acquireSlotLock(client, a.service.id, a.startTime);

    const held = await slotHeld(client, a.service.id, a.startTime);
    const used = await countOverlappingGuests(
      client,
      a.service.id,
      a.startTime,
      a.endTime
    );
    if (used + held + a.guests > a.service.capacity) {
      throw new SlotUnavailableError();
    }

    const result = await client.query(
      `INSERT INTO bookings ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS}`,
      insertValues(a, false)
    );
    if (!result.insertId) throw new Error("Insert did not return an id");
    return result.insertId;
  });
}

export async function rescheduleBooking(input: {
  booking: BookingRow;
  service: ServiceRow;
  newStart: Date;
}): Promise<BookingRow> {
  const { booking, service, newStart } = input;
  const newEnd = new Date(newStart.getTime() + service.duration_minutes * 60_000);

  if (service.exclusive) {
    await withTransaction(async (client) => {
      await acquireSlotLock(client, service.id, newStart);
      const overlapping = await countOverlapping(
        client,
        service.id,
        newStart,
        newEnd,
        booking.id
      );
      if (overlapping > 0) throw new SlotUnavailableError();
      await client.query(
        `UPDATE bookings SET start_time = $2, end_time = $3, updated_at = NOW(3)
          WHERE id = $1`,
        [booking.id, newStart.toISOString(), newEnd.toISOString()]
      );
    });
  } else {
    await withTransaction(async (client) => {
      await acquireSlotLock(client, service.id, newStart);
      const held = await slotHeld(client, service.id, newStart);
      const used = await countOverlappingGuests(
        client,
        service.id,
        newStart,
        newEnd,
        booking.id
      );
      if (used + held + booking.guests > service.capacity) {
        throw new SlotUnavailableError();
      }
      await client.query(
        `UPDATE bookings SET start_time = $2, end_time = $3, updated_at = NOW(3)
          WHERE id = $1`,
        [booking.id, newStart.toISOString(), newEnd.toISOString()]
      );
    });
  }

  const updated = await getBooking(booking.id);
  if (!updated) throw new Error("Booking vanished after reschedule");
  return updated;
}

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
    await query(
      `UPDATE bookings SET guests = $2, updated_at = NOW(3) WHERE id = $1`,
      [booking.id, guests]
    );
  } else {
    await withTransaction(async (client) => {
      await acquireSlotLock(client, service.id, start);
      const held = await slotHeld(client, service.id, start);
      const used = await countOverlappingGuests(
        client,
        service.id,
        start,
        end,
        booking.id
      );
      if (used + held + guests > service.capacity) {
        throw new SlotUnavailableError();
      }
      await client.query(
        `UPDATE bookings SET guests = $2, updated_at = NOW(3) WHERE id = $1`,
        [booking.id, guests]
      );
    });
  }

  const updated = await getBooking(booking.id);
  if (!updated) throw new Error("Booking vanished after guest update");
  return updated;
}

async function acquireSlotLock(
  client: DbClient,
  serviceId: number,
  slotStart: Date
): Promise<void> {
  const slotEpoch = Math.floor(slotStart.getTime() / 1000);
  const lockName = `eoe:slot:${serviceId}:${slotEpoch}`;
  const { rows } = await client.query<{ locked: number | string }>(
    `SELECT GET_LOCK($1, 10) AS locked`,
    [lockName]
  );
  if (Number(rows[0]?.locked) !== 1) {
    throw new SlotUnavailableError();
  }
}

async function slotHeld(
  client: DbClient,
  serviceId: number,
  slotStart: Date
): Promise<number> {
  const { rows } = await client.query<{ held_seats: number }>(
    `SELECT held_seats FROM slot_overrides WHERE service_id = $1 AND slot_start = $2`,
    [serviceId, slotStart.toISOString()]
  );
  return rows[0]?.held_seats ?? 0;
}

async function countOverlapping(
  client: DbClient,
  serviceId: number,
  start: Date,
  end: Date,
  excludeBookingId?: number
): Promise<number> {
  const { rows } = await client.query<{ cnt: number | string }>(
    `SELECT COUNT(*) AS cnt FROM bookings
      WHERE service_id = $1 AND status <> 'cancelled'
        AND start_time < $3 AND end_time > $2
        AND ($4 IS NULL OR id <> $4)`,
    [serviceId, start.toISOString(), end.toISOString(), excludeBookingId ?? null]
  );
  return Number(rows[0]?.cnt ?? 0);
}

async function countOverlappingGuests(
  client: DbClient,
  serviceId: number,
  start: Date,
  end: Date,
  excludeBookingId?: number
): Promise<number> {
  const { rows } = await client.query<{ seats: number | string }>(
    `SELECT COALESCE(SUM(guests), 0) AS seats FROM bookings
      WHERE service_id = $1 AND status <> 'cancelled'
        AND start_time < $3 AND end_time > $2
        AND ($4 IS NULL OR id <> $4)`,
    [serviceId, start.toISOString(), end.toISOString(), excludeBookingId ?? null]
  );
  return Number(rows[0]?.seats ?? 0);
}
