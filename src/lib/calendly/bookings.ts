import {
  isCarWashService,
  normalizeCarTypes,
  carWashMinimumCents,
} from "./car-wash";
import { newBookingId } from "./booking-id";
import type { BookingRow, BusinessRow, ServiceRow } from "./types";
import { findOrCreateCustomer, getBooking } from "./repository";
import { query, withTransaction, type DbClient } from "@/lib/db";

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

export class InvalidCarsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCarsError";
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
  cars?: number | null;
  carTypes?: string[] | null;
  notes?: string | null;
  specialRequest?: string | null;
  status?: "active" | "pending";
}): Promise<BookingRow> {
  const { business, service, startTime, invitee } = input;

  if (!service.is_active || !service.is_available_online) {
    throw new ServiceNotBookableError();
  }

  const guests = Math.max(1, input.guests ?? 1);
  let cars: number | null = null;
  let carTypes: string[] | null = null;
  try {
    const rawTypes =
      input.carTypes ??
      (typeof input.cars === "number" && input.cars > 0
        ? Array.from({ length: input.cars }, () => "sedan")
        : undefined);
    // Empty / omitted car_types on car-wash = table only (admin phone bookings).
    if (
      rawTypes == null ||
      (Array.isArray(rawTypes) && rawTypes.length === 0)
    ) {
      carTypes = null;
      cars = null;
    } else {
      carTypes = normalizeCarTypes(service.slug, rawTypes);
      cars = carTypes?.length ?? null;
    }
  } catch (err) {
    throw new InvalidCarsError(
      err instanceof Error ? err.message : "Invalid cars value"
    );
  }

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
    id: newBookingId(),
    business,
    service,
    customerId,
    invitee,
    startTime,
    endTime,
    guests,
    cars,
    carTypes,
    notes: input.notes ?? null,
    specialRequest: input.specialRequest ?? null,
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
  id: string;
  business: BusinessRow;
  service: ServiceRow;
  customerId: number;
  invitee: { name: string; email: string; phone?: string | null };
  startTime: Date;
  endTime: Date;
  guests: number;
  cars: number | null;
  carTypes: string[] | null;
  notes: string | null;
  specialRequest: string | null;
  status: "active" | "pending";
};

const INSERT_COLS = `(id, business_id, service_id, customer_id, start_time, end_time,
  status, guests, cars, car_types, notes, special_request, payment_provider, payment_status,
  guest_name, guest_email, guest_phone, is_exclusive)`;

function insertValues(a: InsertArgs, exclusive: boolean): unknown[] {
  return [
    a.id,
    a.business.id,
    a.service.id,
    a.customerId,
    a.startTime.toISOString(),
    a.endTime.toISOString(),
    a.status,
    a.guests,
    a.cars,
    a.carTypes ? JSON.stringify(a.carTypes) : null,
    a.notes,
    a.specialRequest,
    a.invitee.name,
    a.invitee.email,
    a.invitee.phone ?? null,
    exclusive ? 1 : 0,
  ];
}

const INSERT_PLACEHOLDERS =
  "($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'yoco', 'unpaid', $13, $14, $15, $16)";

async function insertExclusive(a: InsertArgs): Promise<string> {
  return withTransaction(async (client) => {
    await acquireSlotLock(client, a.service.id, a.startTime);

    const overlapping = await countOverlapping(
      client,
      a.service.id,
      a.startTime,
      a.endTime
    );
    if (overlapping > 0) throw new SlotUnavailableError();

    await client.query(
      `INSERT INTO bookings ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS}`,
      insertValues(a, true)
    );
    return a.id;
  });
}

async function insertShared(a: InsertArgs): Promise<string> {
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

    await client.query(
      `INSERT INTO bookings ${INSERT_COLS} VALUES ${INSERT_PLACEHOLDERS}`,
      insertValues(a, false)
    );
    return a.id;
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

/** If online deposit was paid and party/cars grew, balance is due on arrival. */
async function markPartialIfOwesMore(
  booking: BookingRow,
  nextGuests: number,
  nextCarTypes: string[] | null
): Promise<void> {
  if (booking.payment_status !== "paid") return;
  const prevCars = (() => {
    let raw: unknown = booking.car_types;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];
  })();
  const nextCars = nextCarTypes ?? [];
  const guestsUp = nextGuests > booking.guests;
  const washUp = carWashMinimumCents(nextCars) > carWashMinimumCents(prevCars);
  const carsUp = nextCars.length > prevCars.length;
  if (!guestsUp && !washUp && !carsUp) return;
  await query(
    `UPDATE bookings
        SET payment_status = 'partially_paid', updated_at = NOW(3)
      WHERE id = $1 AND payment_status = 'paid'`,
    [booking.id]
  );
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

  const prevTypes = (() => {
    let raw: unknown = booking.car_types;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : null;
  })();
  await markPartialIfOwesMore(booking, guests, prevTypes);

  const updated = await getBooking(booking.id);
  if (!updated) throw new Error("Booking vanished after guest update");
  return updated;
}

/**
 * Admin: set or clear cars on a booking. Empty carTypes → no wash (null).
 * Does not change payment_amount_cents. If the booking was paid and cars were
 * added/upgraded, status becomes partially_paid (balance on arrival).
 */
export async function updateBookingCars(input: {
  booking: BookingRow;
  service: ServiceRow;
  carTypes: string[] | null;
}): Promise<BookingRow> {
  const { booking, service } = input;
  if (!isCarWashService(service.slug)) {
    throw new InvalidCarsError("This experience does not include car wash");
  }

  let cars: number | null = null;
  let carTypes: string[] | null = null;
  if (input.carTypes && input.carTypes.length > 0) {
    try {
      carTypes = normalizeCarTypes(service.slug, input.carTypes);
      cars = carTypes?.length ?? null;
    } catch (err) {
      throw new InvalidCarsError(
        err instanceof Error ? err.message : "Invalid car_types"
      );
    }
  }

  await query(
    `UPDATE bookings
        SET cars = $2, car_types = $3, updated_at = NOW(3)
      WHERE id = $1`,
    [booking.id, cars, carTypes ? JSON.stringify(carTypes) : null]
  );

  await markPartialIfOwesMore(booking, booking.guests, carTypes);

  const updated = await getBooking(booking.id);
  if (!updated) throw new Error("Booking vanished after car update");
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
  excludeBookingId?: string
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
  excludeBookingId?: string
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
