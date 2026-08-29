import {
  computeSlotUsageFromIntervals,
  type BookedInterval,
} from "./availability";
import type { BusinessRow, ServiceRow } from "./types";

export type SnapshotBookedRow = {
  start_time: string;
  end_time: string;
  guests: number;
};

export type BookingSnapshot = {
  business: BusinessRow;
  services: ServiceRow[];
  /** Live bookings per service id, refreshed on successful reads. */
  bookedByService: Record<number, SnapshotBookedRow[]>;
  updatedAt: number;
};

declare global {
  var __eoeBookingSnapshot: BookingSnapshot | undefined;
}

const BUNDLED_BUSINESS: BusinessRow = {
  id: 1,
  name: "Entle Off Grid Estate",
  slug: "entle-off-grid-estate",
  timezone: "Africa/Johannesburg",
  address: "182 Lakeview Bloemfontein, South Africa",
  advance_booking_days: 60,
  settings: {
    business_hours: {
      "0": null,
      "1": null,
      "2": null,
      "3": null,
      "4": { start: "11:00", end: "18:00" },
      "5": { start: "11:00", end: "18:00" },
      "6": { start: "11:00", end: "18:00" },
    },
  },
  is_active: true,
  created_at: "2020-01-01T00:00:00.000Z",
};

function bundledService(
  id: number,
  slug: string,
  name: string,
  description: string,
  color: string
): ServiceRow {
  return {
    id,
    business_id: 1,
    name,
    slug,
    description,
    duration_minutes: 120,
    buffer_minutes: 15,
    price_cents: 10000,
    color,
    min_advance_booking_hours: 2,
    max_advance_booking_days: 60,
    is_active: true,
    is_available_online: true,
    exclusive: false,
    capacity: 50,
    created_at: "2020-01-01T00:00:00.000Z",
    updated_at: "2020-01-01T00:00:00.000Z",
  };
}

const BUNDLED_SERVICES: ServiceRow[] = [
  bundledService(
    1,
    "cafe-table-reservation",
    "Cafe Table Reservation",
    "Reserve a table at The Cafe for a relaxed off grid meal.",
    "#9A6552"
  ),
  bundledService(
    2,
    "cafe-table-car-wash",
    "Cafe Table Reservation + Car Wash",
    "Reserve a table at The Cafe and add a car wash.",
    "#CDA98E"
  ),
];

export function bundledSnapshot(): BookingSnapshot {
  return {
    business: BUNDLED_BUSINESS,
    services: BUNDLED_SERVICES,
    bookedByService: {},
    updatedAt: 0,
  };
}

export function rememberBookingSnapshot(patch: {
  business?: BusinessRow;
  services?: ServiceRow[];
  bookedForService?: {
    serviceId: number;
    rows: SnapshotBookedRow[];
    from: Date;
    to: Date;
  };
}): BookingSnapshot {
  const prev = globalThis.__eoeBookingSnapshot ?? bundledSnapshot();
  const bookedByService = { ...prev.bookedByService };

  if (patch.bookedForService) {
    const { serviceId, rows, from, to } = patch.bookedForService;
    const existing = bookedByService[serviceId] ?? [];
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const kept = existing.filter((r) => {
      const s = new Date(r.start_time).getTime();
      return s < fromMs || s >= toMs;
    });
    bookedByService[serviceId] = [...kept, ...rows];
  }

  const next: BookingSnapshot = {
    business: patch.business ?? prev.business,
    services: patch.services ?? prev.services,
    bookedByService,
    updatedAt: Date.now(),
  };
  globalThis.__eoeBookingSnapshot = next;
  return next;
}

export function getBookingSnapshot(): BookingSnapshot {
  return globalThis.__eoeBookingSnapshot ?? bundledSnapshot();
}

export function snapshotAgeMs(): number | null {
  const snap = globalThis.__eoeBookingSnapshot;
  if (!snap?.updatedAt) return null;
  return Date.now() - snap.updatedAt;
}

export function snapshotBusiness(businessId: number): BusinessRow | null {
  const snap = getBookingSnapshot();
  if (snap.business.id === businessId) return snap.business;
  return bundledSnapshot().business.id === businessId
    ? bundledSnapshot().business
    : null;
}

export function snapshotServices(
  businessId: number,
  active?: boolean
): ServiceRow[] {
  const snap = getBookingSnapshot();
  const list =
    snap.services.length > 0 ? snap.services : bundledSnapshot().services;
  let out = list.filter((s) => s.business_id === businessId);
  if (active === true) {
    out = out.filter((s) => s.is_active && s.is_available_online);
  } else if (active === false) {
    out = out.filter((s) => !s.is_active || !s.is_available_online);
  }
  return out;
}

export function snapshotService(serviceId: number): ServiceRow | null {
  const snap = getBookingSnapshot();
  const found = snap.services.find((s) => s.id === serviceId);
  if (found) return found;
  return bundledSnapshot().services.find((s) => s.id === serviceId) ?? null;
}

function bookedIntervalsForService(
  serviceId: number,
  from: Date,
  to: Date
): BookedInterval[] {
  const snap = getBookingSnapshot();
  const rows = snap.bookedByService[serviceId] ?? [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return rows
    .filter((r) => {
      const s = new Date(r.start_time).getTime();
      const e = new Date(r.end_time).getTime();
      return s < toMs && e > fromMs;
    })
    .map((r) => ({
      start: new Date(r.start_time).getTime(),
      end: new Date(r.end_time).getTime(),
      guests: r.guests,
    }));
}

export function degradedAvailableSlots(opts: {
  business: BusinessRow;
  service: ServiceRow;
  windowStart: Date;
  windowEnd: Date;
  now?: Date;
}): { start: Date; remaining: number }[] {
  const winStart = opts.windowStart;
  const winEnd = opts.windowEnd;
  const intervals = bookedIntervalsForService(
    opts.service.id,
    winStart,
    winEnd
  );
  const usage = computeSlotUsageFromIntervals({
    business: opts.business,
    service: opts.service,
    windowStart: winStart,
    windowEnd: winEnd,
    now: opts.now,
    intervals,
  });
  return usage
    .filter((u) => u.remaining > 0)
    .map((u) => ({ start: u.start, remaining: u.remaining }));
}
