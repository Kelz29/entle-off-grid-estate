// Base hosts baked into Calendly-compatible response fields (CALENDLY_API.md §"Base URLs").
// These come from server config, NOT the incoming request host.

export const API_BASE_URL =
  process.env.API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const SCHEDULING_BASE_URL =
  process.env.SCHEDULING_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const CALENDLY_BASE = `${API_BASE_URL}/api/v1/calendly`;

export function eventTypeUri(serviceId: number): string {
  return `${CALENDLY_BASE}/event_types/${serviceId}`;
}

export function scheduledEventUri(bookingId: number): string {
  return `${CALENDLY_BASE}/scheduled_events/${bookingId}`;
}

export function schedulingUrl(
  businessId: number,
  serviceId: number,
  startTimeIso?: string
): string {
  const base = `${SCHEDULING_BASE_URL}/book/${businessId}/${serviceId}`;
  return startTimeIso
    ? `${base}?start_time=${encodeURIComponent(startTimeIso)}`
    : base;
}

// Extract the trailing integer service id from either a bare id ("21") or a
// full event-type URI (".../event_types/21"). Throws on a non-numeric tail so
// callers can translate it into a 400 (CALENDLY_API.md §"Identifiers").
export function serviceIdFromEventType(eventType: string): number {
  const tail = eventType.trim().split("/").pop() ?? "";
  const id = Number(tail);
  if (!tail || !Number.isInteger(id)) {
    throw new BadEventTypeError(eventType);
  }
  return id;
}

export class BadEventTypeError extends Error {
  constructor(value: string) {
    super(`Invalid event_type: ${value}`);
    this.name = "BadEventTypeError";
  }
}
