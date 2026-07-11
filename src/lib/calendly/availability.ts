import type { BusinessRow, ServiceRow } from "./types";
import { DEFAULT_BUSINESS_HOURS } from "./types";
import { getActiveBookingsForService, getSlotHolds } from "./repository";
import {
  parseHhMm,
  wallTimeToUtc,
  weekdayIndex,
  zonedDateParts,
} from "./time";

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

export type Slot = { start: Date; remaining: number };
export type SlotUsage = {
  start: Date;
  capacity: number; // the service's fixed per-slot capacity
  booked: number; // real booking guests + any admin-held seats
  held: number; // manually-blocked seats (admin adjustment)
  remaining: number;
  overridden: boolean; // true if a manual hold is set on this slot
};

type Window = { earliest: Date; latest: Date; durMs: number; candidates: Date[] };

// Shared slot-start generation (CALENDLY_API.md §3): business hours, advance
// bounds, step = duration+buffer, plus the closing "last seating".
function generateWindow(
  business: BusinessRow,
  service: ServiceRow,
  windowStart: Date,
  windowEnd: Date,
  now: Date
): Window {
  const tz = business.timezone;
  const businessHours =
    business.settings?.business_hours ?? DEFAULT_BUSINESS_HOURS;

  const minAdvanceMs = service.min_advance_booking_hours * 60 * MIN_MS;
  const maxAdvanceDays =
    service.max_advance_booking_days ?? business.advance_booking_days;
  const earliest = new Date(
    Math.max(windowStart.getTime(), now.getTime() + minAdvanceMs)
  );
  const latest = new Date(
    Math.min(windowEnd.getTime(), now.getTime() + maxAdvanceDays * DAY_MS)
  );
  const durMs = service.duration_minutes * MIN_MS;
  const stepMs = (service.duration_minutes + service.buffer_minutes) * MIN_MS;
  if (earliest >= latest || stepMs <= 0) {
    return { earliest, latest, durMs, candidates: [] };
  }

  const startD = zonedDateParts(earliest, tz);
  const anchor = Date.UTC(startD.year, startD.month - 1, startD.day);
  const endD = zonedDateParts(new Date(latest.getTime() - 1), tz);
  const endAnchor = Date.UTC(endD.year, endD.month - 1, endD.day);

  const candidates: Date[] = [];
  for (let a = anchor; a <= endAnchor; a += DAY_MS) {
    const dt = new Date(a);
    const y = dt.getUTCFullYear();
    const mo = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();

    const noon = wallTimeToUtc(y, mo, d, 12, 0, tz);
    const hours = businessHours[String(weekdayIndex(noon, tz))];
    if (!hours || !hours.start || !hours.end) continue;

    const { hour: sh, minute: sm } = parseHhMm(hours.start);
    const { hour: eh, minute: em } = parseHhMm(hours.end);
    const open = wallTimeToUtc(y, mo, d, sh, sm, tz).getTime();
    const close = wallTimeToUtc(y, mo, d, eh, em, tz).getTime();

    for (let s = open; s + durMs <= close; s += stepMs) {
      if (s < earliest.getTime()) continue;
      if (s >= latest.getTime()) break;
      candidates.push(new Date(s));
    }
    if (close >= earliest.getTime() && close < latest.getTime()) {
      candidates.push(new Date(close));
    }
  }
  return { earliest, latest, durMs, candidates };
}

async function bookedIntervals(serviceId: number, from: Date, to: Date) {
  const booked = await getActiveBookingsForService(serviceId, from, to);
  return booked.map((b) => ({
    start: new Date(b.start_time).getTime(),
    end: new Date(b.end_time).getTime(),
    guests: b.guests,
  }));
}

/** Public availability — only bookable slots (remaining > 0). */
export async function getAvailableSlots(opts: {
  business: BusinessRow;
  service: ServiceRow;
  windowStart: Date;
  windowEnd: Date;
  now?: Date;
}): Promise<Slot[]> {
  const usage = await getSlotUsage(opts);
  return usage
    .filter((u) => u.remaining > 0)
    .map((u) => ({ start: u.start, remaining: u.remaining }));
}

/** Admin view — every generated slot with booked / capacity / remaining. */
export async function getSlotUsage(opts: {
  business: BusinessRow;
  service: ServiceRow;
  windowStart: Date;
  windowEnd: Date;
  now?: Date;
}): Promise<SlotUsage[]> {
  const { business, service, windowStart, windowEnd } = opts;
  const now = opts.now ?? new Date();
  const win = generateWindow(business, service, windowStart, windowEnd, now);
  if (win.candidates.length === 0) return [];

  const intervals = await bookedIntervals(service.id, win.earliest, win.latest);
  const holds = await getSlotHolds(service.id, win.earliest, win.latest);

  const out: SlotUsage[] = [];
  for (const slot of win.candidates) {
    const s = slot.getTime();
    const e = s + win.durMs;
    const overlapping = intervals.filter((iv) => s < iv.end && e > iv.start);
    const iso = slot.toISOString();
    const capacity = service.exclusive ? 1 : service.capacity;
    const held = service.exclusive ? 0 : holds.get(iso) ?? 0;
    const actual = service.exclusive
      ? overlapping.length > 0
        ? 1
        : 0
      : overlapping.reduce((sum, iv) => sum + iv.guests, 0);
    const booked = actual + held;
    out.push({
      start: slot,
      capacity,
      booked,
      held,
      remaining: capacity - booked,
      overridden: held > 0,
    });
  }
  return out;
}
