import type { BusinessRow, ServiceRow, BookingRow } from "./types";
import { eventTypeUri, scheduledEventUri, schedulingUrl } from "./config";
import { toZonedIso } from "./time";
import { carTypeLabel } from "./car-wash";

function iso(value: string | Date | null, tz: string): string | null {
  if (!value) return null;
  return toZonedIso(new Date(value), tz);
}

function parseCarTypes(raw: BookingRow["car_types"] | string | null | undefined): string[] | null {
  if (raw == null) return null;
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  return arr.filter((x): x is string => typeof x === "string");
}


// EventType resource (CALENDLY_API.md §2.1).
export function serializeEventType(service: ServiceRow, business: BusinessRow) {
  return {
    uri: eventTypeUri(service.id),
    name: service.name,
    active: Boolean(service.is_active && service.is_available_online),
    slug: service.slug,
    scheduling_url: schedulingUrl(business.id, service.id),
    duration: service.duration_minutes,
    kind: "solo",
    pooling_type: null,
    type: "StandardEventType",
    color: service.color,
    description_plain: service.description,
    description_html: service.description,
    // Non-Calendly extras this site relies on (deposit, venue, capacity).
    price_cents: service.price_cents,
    location: business.address ?? null,
    exclusive: Boolean(service.exclusive),
    capacity: service.capacity,
    created_at: iso(service.created_at, business.timezone),
    updated_at: iso(service.updated_at, business.timezone),
  };
}

// One entry in the availability collection (CALENDLY_API.md §2.3).
// `remaining` = guests still bookable in this slot (1 for exclusive services).
export function serializeAvailableTime(
  slot: Date,
  remaining: number,
  service: ServiceRow,
  business: BusinessRow
) {
  const startIso = toZonedIso(slot, business.timezone);
  return {
    status: "available" as const,
    invitees_remaining: remaining,
    start_time: startIso,
    scheduling_url: schedulingUrl(
      business.id,
      service.id,
      new Date(slot).toISOString()
    ),
  };
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  if (email.endsWith("@noemail.local")) return "";
  const at = email.indexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Public success-page resource — no phone, notes, or full email.
 */
export function serializeScheduledEventPublic(
  booking: BookingRow,
  business: BusinessRow
) {
  const active = booking.status !== "cancelled";
  return {
    uri: scheduledEventUri(booking.id),
    name: booking.service_name ?? "",
    status: active ? "active" : "canceled",
    start_time: iso(booking.start_time, business.timezone),
    payment_status: booking.payment_status,
    payment_amount_cents: booking.payment_amount_cents,
    invitee: {
      email: maskEmail(booking.customer_email),
    },
  };
}

// ScheduledEvent resource (CALENDLY_API.md §2.5) — full PII for admin.
export function serializeScheduledEvent(
  booking: BookingRow,
  business: BusinessRow
) {
  const active = booking.status !== "cancelled";
  return {
    uri: scheduledEventUri(booking.id),
    name: booking.service_name ?? "",
    status: active ? "active" : "canceled",
    start_time: iso(booking.start_time, business.timezone),
    end_time: iso(booking.end_time, business.timezone),
    event_type: eventTypeUri(booking.service_id),
    location: business.address
      ? { type: "physical", location: business.address }
      : null,
    invitees_counter: { total: 1, active: active ? 1 : 0, limit: 1 },
    // Extras used by the admin dashboard.
    invitee: {
      name: booking.customer_name ?? "",
      email: booking.customer_email ?? "",
      phone: booking.customer_phone ?? null,
    },
    guests: booking.guests,
    cars: booking.cars ?? null,
    car_types: parseCarTypes(booking.car_types),
    car_labels: (() => {
      const types = parseCarTypes(booking.car_types);
      return types ? types.map(carTypeLabel) : null;
    })(),
    notes: booking.notes ?? null,
    special_request: booking.special_request ?? null,
    payment_status: booking.payment_status,
    // Manual (phone/walk-in) bookings skip checkout entirely: they're created
    // straight to 'active' while unpaid (website bookings hold as 'pending'
    // until the Yoco webhook marks them paid). The guest settles at the venue.
    pay_on_arrival:
      booking.status === "active" && booking.payment_status === "unpaid",
    balance_due_on_arrival: booking.payment_status === "partially_paid",
    payment_provider: booking.payment_provider,
    payment_amount_cents: booking.payment_amount_cents,
    seen: booking.seen,
    created_at: iso(booking.created_at, business.timezone),
    updated_at: iso(booking.updated_at, business.timezone),
  };
}

export function collection<T>(items: T[]) {
  return {
    collection: items,
    pagination: {
      count: items.length,
      next_page: null,
      previous_page: null,
      next_page_token: null,
      previous_page_token: null,
    },
  };
}
