import type { BusinessRow, ServiceRow, BookingRow } from "./types";
import { eventTypeUri, scheduledEventUri, schedulingUrl } from "./config";
import { toZonedIso } from "./time";

function iso(value: string | Date | null, tz: string): string | null {
  if (!value) return null;
  return toZonedIso(new Date(value), tz);
}

// EventType resource (CALENDLY_API.md §2.1).
export function serializeEventType(service: ServiceRow, business: BusinessRow) {
  return {
    uri: eventTypeUri(service.id),
    name: service.name,
    active: service.is_active && service.is_available_online,
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
    exclusive: service.exclusive,
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

// ScheduledEvent resource (CALENDLY_API.md §2.5).
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
    notes: booking.notes ?? null,
    payment_status: booking.payment_status,
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
