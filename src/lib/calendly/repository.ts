import { query } from "@/lib/db";
import type { BusinessRow, ServiceRow, BookingRow } from "./types";

export async function getActiveBusiness(
  businessId: number
): Promise<BusinessRow | null> {
  const { rows } = await query<BusinessRow>(
    `SELECT * FROM businesses WHERE id = $1 AND is_active = true`,
    [businessId]
  );
  return rows[0] ?? null;
}

export async function getService(serviceId: number): Promise<ServiceRow | null> {
  const { rows } = await query<ServiceRow>(
    `SELECT * FROM services WHERE id = $1`,
    [serviceId]
  );
  return rows[0] ?? null;
}

// Admin: set the per-slot guest capacity for a (shared) service.
export async function setServiceCapacity(
  serviceId: number,
  capacity: number
): Promise<ServiceRow | null> {
  const { rows } = await query<{ id: number }>(
    `UPDATE services SET capacity = $2, updated_at = now()
      WHERE id = $1 RETURNING id`,
    [serviceId, capacity]
  );
  return rows[0] ? getService(serviceId) : null;
}

export interface ListServicesOpts {
  businessId: number;
  active?: boolean; // true → online-bookable only; false → the complement; undefined → all
  count: number;
}

export async function listServices(
  opts: ListServicesOpts
): Promise<ServiceRow[]> {
  const params: unknown[] = [opts.businessId];
  let where = `business_id = $1`;
  if (opts.active === true) {
    where += ` AND is_active = true AND is_available_online = true`;
  } else if (opts.active === false) {
    where += ` AND NOT (is_active = true AND is_available_online = true)`;
  }
  params.push(opts.count);
  const { rows } = await query<ServiceRow>(
    `SELECT * FROM services WHERE ${where} ORDER BY id LIMIT $${params.length}`,
    params
  );
  return rows;
}

// Bookings that occupy time for a service in [from, to). Cancelled excluded.
export async function getActiveBookingsForService(
  serviceId: number,
  from: Date,
  to: Date
): Promise<Array<{ start_time: string; end_time: string; guests: number }>> {
  const { rows } = await query<{
    start_time: string;
    end_time: string;
    guests: number;
  }>(
    `SELECT start_time, end_time, guests FROM bookings
      WHERE service_id = $1 AND status <> 'cancelled'
        AND start_time < $3 AND end_time > $2`,
    [serviceId, from.toISOString(), to.toISOString()]
  );
  return rows;
}

// Per-slot manual holds (blocked seats) in [from, to), keyed by ISO start.
export async function getSlotHolds(
  serviceId: number,
  from: Date,
  to: Date
): Promise<Map<string, number>> {
  const { rows } = await query<{ slot_start: string; held_seats: number }>(
    `SELECT slot_start, held_seats FROM slot_overrides
      WHERE service_id = $1 AND slot_start >= $2 AND slot_start < $3`,
    [serviceId, from.toISOString(), to.toISOString()]
  );
  const m = new Map<string, number>();
  for (const r of rows) m.set(new Date(r.slot_start).toISOString(), r.held_seats);
  return m;
}

export async function setSlotHold(
  serviceId: number,
  slotStart: Date,
  heldSeats: number
): Promise<void> {
  await query(
    `INSERT INTO slot_overrides (service_id, slot_start, held_seats)
       VALUES ($1, $2, $3)
     ON CONFLICT (service_id, slot_start)
       DO UPDATE SET held_seats = EXCLUDED.held_seats, updated_at = now()`,
    [serviceId, slotStart.toISOString(), heldSeats]
  );
}

export async function deleteSlotOverride(
  serviceId: number,
  slotStart: Date
): Promise<void> {
  await query(
    `DELETE FROM slot_overrides WHERE service_id = $1 AND slot_start = $2`,
    [serviceId, slotStart.toISOString()]
  );
}

// Guests booked (live) that overlap a specific slot, excluding one booking.
export async function bookedGuestsForSlot(
  serviceId: number,
  start: Date,
  end: Date,
  excludeBookingId?: number
): Promise<number> {
  const { rows } = await query<{ seats: number }>(
    `SELECT COALESCE(SUM(guests), 0)::int AS seats FROM bookings
      WHERE service_id = $1 AND status <> 'cancelled'
        AND start_time < $3 AND end_time > $2
        AND ($4::int IS NULL OR id <> $4)`,
    [serviceId, start.toISOString(), end.toISOString(), excludeBookingId ?? null]
  );
  return rows[0].seats;
}

export async function findOrCreateCustomer(input: {
  businessId: number;
  name: string;
  email: string;
  phone?: string | null;
}): Promise<number> {
  const { rows } = await query<{ id: number }>(
    `INSERT INTO customers (business_id, name, email, phone)
       VALUES ($1, $2, $3, $4)
     ON CONFLICT (business_id, email)
       -- Keep the first-seen name; the per-booking snapshot holds the name
       -- each booking was actually made with. Only fill a missing phone.
       DO UPDATE SET phone = COALESCE(customers.phone, EXCLUDED.phone)
     RETURNING id`,
    [input.businessId, input.name, input.email.toLowerCase(), input.phone ?? null]
  );
  return rows[0].id;
}

export interface ListBookingsOpts {
  businessId: number;
  status?: "active" | "canceled";
  minStartTime?: Date;
  maxStartTime?: Date;
  count: number;
}

export async function listBookings(
  opts: ListBookingsOpts
): Promise<BookingRow[]> {
  const params: unknown[] = [opts.businessId];
  let where = `b.business_id = $1`;
  if (opts.status === "active") {
    where += ` AND b.status <> 'cancelled'`;
  } else if (opts.status === "canceled") {
    where += ` AND b.status = 'cancelled'`;
  }
  if (opts.minStartTime) {
    params.push(opts.minStartTime.toISOString());
    where += ` AND b.start_time >= $${params.length}`;
  }
  if (opts.maxStartTime) {
    params.push(opts.maxStartTime.toISOString());
    where += ` AND b.start_time <= $${params.length}`;
  }
  params.push(opts.count);
  const { rows } = await query<BookingRow>(
    `SELECT b.*, s.name AS service_name,
            COALESCE(b.guest_name,  c.name)  AS customer_name,
            COALESCE(b.guest_email, c.email) AS customer_email,
            COALESCE(b.guest_phone, c.phone) AS customer_phone
       FROM bookings b
       JOIN services  s ON s.id = b.service_id
       JOIN customers c ON c.id = b.customer_id
      WHERE ${where}
      ORDER BY b.start_time DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function getBooking(bookingId: number): Promise<BookingRow | null> {
  const { rows } = await query<BookingRow>(
    `SELECT b.*, s.name AS service_name,
            COALESCE(b.guest_name,  c.name)  AS customer_name,
            COALESCE(b.guest_email, c.email) AS customer_email,
            COALESCE(b.guest_phone, c.phone) AS customer_phone
       FROM bookings b
       JOIN services  s ON s.id = b.service_id
       JOIN customers c ON c.id = b.customer_id
      WHERE b.id = $1`,
    [bookingId]
  );
  return rows[0] ?? null;
}

// Mark a single booking notification seen / unseen.
export async function setBookingSeen(
  bookingId: number,
  seen: boolean
): Promise<BookingRow | null> {
  await query(
    `UPDATE bookings SET seen = $2, updated_at = now() WHERE id = $1`,
    [bookingId, seen]
  );
  return getBooking(bookingId);
}

// Mark every booking for a business seen (or unseen).
export async function markAllBookingsSeen(
  businessId: number,
  seen: boolean
): Promise<void> {
  await query(
    `UPDATE bookings SET seen = $2, updated_at = now()
      WHERE business_id = $1 AND seen <> $2`,
    [businessId, seen]
  );
}

export async function setCheckoutId(
  bookingId: number,
  checkoutId: string
): Promise<void> {
  await query(
    `UPDATE bookings SET checkout_id = $2, updated_at = now() WHERE id = $1`,
    [bookingId, checkoutId]
  );
}

export async function getBookingByCheckoutId(
  checkoutId: string
): Promise<BookingRow | null> {
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM bookings WHERE checkout_id = $1 LIMIT 1`,
    [checkoutId]
  );
  return rows[0] ? getBooking(rows[0].id) : null;
}

// Mark a (usually pending) booking as paid and activate it. Idempotent: a
// repeated webhook for an already-paid booking is a no-op.
export async function markBookingPaid(
  bookingId: number,
  paymentId: string,
  amountCents: number
): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE bookings
        SET status = 'active', payment_status = 'paid', payment_id = $2,
            payment_amount_cents = $3, updated_at = now()
      WHERE id = $1 AND payment_status <> 'paid'`,
    [bookingId, paymentId, amountCents]
  );
  return rowCount > 0;
}

// Release a slot held by an unpaid booking (abandoned/cancelled checkout).
// Never touches a paid booking.
export async function releaseUnpaidBooking(bookingId: number): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE bookings SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND payment_status <> 'paid' AND status <> 'cancelled'`,
    [bookingId]
  );
  return rowCount > 0;
}

export async function cancelBooking(bookingId: number): Promise<BookingRow | null> {
  const { rows } = await query<{ id: number }>(
    `UPDATE bookings SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND status <> 'cancelled' RETURNING id`,
    [bookingId]
  );
  if (!rows[0]) {
    // Either not found, or already cancelled — return current state if it exists.
    return getBooking(bookingId);
  }
  return getBooking(bookingId);
}
