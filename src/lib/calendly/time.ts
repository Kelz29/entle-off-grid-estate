// Timezone helpers for computing availability in a business's IANA timezone
// (e.g. "Africa/Johannesburg") without pulling in a date library. All functions
// are DST-correct via Intl offset lookups, though ZA itself has no DST.

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallParts(instant: Date, timeZone: string): Parts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // some engines emit "24" for midnight
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// Offset (localWall - UTC) in ms for `instant` in `timeZone`. Rounded to the
// nearest whole minute — real offsets are always whole minutes, and this avoids
// a sub-second error when `instant` carries millisecond/microsecond precision
// (wallParts only resolves to whole seconds).
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const p = wallParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const diff = asUtc - instant.getTime();
  return Math.round(diff / 60_000) * 60_000;
}

// Convert a wall-clock time in `timeZone` to the corresponding UTC instant.
export function wallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const off1 = tzOffsetMs(new Date(guess), timeZone);
  let utc = guess - off1;
  const off2 = tzOffsetMs(new Date(utc), timeZone);
  if (off2 !== off1) utc = guess - off2; // correct across a DST boundary
  return new Date(utc);
}

// Weekday index in `timeZone`, Monday=0 … Sunday=6 (matches business_hours keys).
export function weekdayIndex(instant: Date, timeZone: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(instant);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[wd] ?? 0;
}

// Calendar date (in `timeZone`) of an instant, as { year, month, day }.
export function zonedDateParts(instant: Date, timeZone: string) {
  const p = wallParts(instant, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

// Format an instant as a timezone-aware ISO 8601 string in `timeZone`,
// e.g. "2026-07-04T08:00:00+02:00".
export function toZonedIso(instant: Date, timeZone: string): string {
  const p = wallParts(instant, timeZone);
  const off = tzOffsetMs(instant, timeZone);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const oh = String(Math.floor(abs / 3_600_000)).padStart(2, "0");
  const om = String(Math.floor((abs % 3_600_000) / 60_000)).padStart(2, "0");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(
    p.minute
  )}:${pad(p.second)}${sign}${oh}:${om}`;
}

// Parse an ISO 8601 input. A naive datetime (no timezone designator) is assumed
// to be UTC, matching CALENDLY_API.md §Timezones.
export function parseIsoAssumeUtc(value: string): Date | null {
  const trimmed = value.trim();
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = hasTz ? trimmed : `${trimmed}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

// "HH:MM" -> { hour, minute }
export function parseHhMm(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":");
  return { hour: Number(h), minute: Number(m) };
}
