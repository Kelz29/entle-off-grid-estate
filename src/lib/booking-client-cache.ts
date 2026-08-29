/** Client-side cache for booking widget reads (localStorage). */

const CACHE_KEY = "eoe-booking-cache";
const MAX_AGE_MS = 7 * 86_400_000;

type EventTypesCache = {
  collection: unknown[];
  savedAt: number;
};

type SlotsCacheEntry = {
  collection: unknown[];
  degraded?: boolean;
  savedAt: number;
};

type BookingClientCache = {
  eventTypes?: EventTypesCache;
  slotsByKey?: Record<string, SlotsCacheEntry>;
};

function read(): BookingClientCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BookingClientCache;
  } catch {
    return {};
  }
}

function write(cache: BookingClientCache): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
}

export function saveEventTypesCache(collection: unknown[]): void {
  const cache = read();
  cache.eventTypes = { collection, savedAt: Date.now() };
  write(cache);
}

export function loadEventTypesCache(): unknown[] | null {
  const entry = read().eventTypes;
  if (!entry || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
  return entry.collection;
}

export function slotsCacheKey(
  eventTypeUri: string,
  startIso: string,
  endIso: string
): string {
  return `${eventTypeUri}|${startIso}|${endIso}`;
}

export function saveSlotsCache(
  key: string,
  collection: unknown[],
  degraded?: boolean
): void {
  const cache = read();
  const slotsByKey = { ...(cache.slotsByKey ?? {}) };
  slotsByKey[key] = { collection, degraded, savedAt: Date.now() };
  cache.slotsByKey = slotsByKey;
  write(cache);
}

export function loadSlotsCache(key: string): SlotsCacheEntry | null {
  const entry = read().slotsByKey?.[key];
  if (!entry || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
  return entry;
}
