"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  playNotifySound,
  unlockNotifySound,
} from "@/lib/admin-notify-sound";
import {
  CAR_TYPES,
  MAX_CARS_PER_SESSION,
  carWashMinimumCents,
  isCarWashService,
} from "@/lib/calendly/car-wash";
import {
  ADMIN_ROLES,
  canAccessSection,
  defaultSectionForRole,
  type AdminRole,
  type AdminSection as RoleSection,
} from "@/lib/admin-roles";
import { ContentPanel } from "@/components/admin/content/ContentPanel";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1";
const VENUE_TZ = "Africa/Johannesburg";

// Gold used for fills / active states (readable on white as a fill, not as text).
const GOLD = "#7a4f3f";
const GOLD_TEXT = "#7a4f3f"; // matches --eoe-espresso

type ScheduledEvent = {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  end_time: string;
  event_type: string;
  invitee: { name: string; email: string; phone: string | null };
  guests: number;
  cars: number | null;
  car_types?: string[] | null;
  car_labels?: string[] | null;
  notes: string | null;
  special_request?: string | null;
  payment_status: string;
  pay_on_arrival?: boolean;
  balance_due_on_arrival?: boolean;
  payment_provider: string;
  payment_amount_cents?: number | null;
  seen: boolean;
  created_at: string;
};

type EventType = {
  uri: string;
  name: string;
  slug?: string;
  color: string;
  exclusive?: boolean;
  capacity?: number;
  price_cents?: number;
};

function adminFetch(url: string, init?: RequestInit) {
  return fetch(url, { ...init, credentials: "same-origin" });
}

const fetcher = (url: string) => adminFetch(url).then((r) => r.json());

// ---------- helpers ----------
function bookingId(uri: string) {
  return uri.split("/").pop() ?? "";
}
function serviceId(uri: string) {
  return uri.split("/").pop() ?? "";
}
// Placeholder addresses from manual (phone) bookings aren't worth showing.
function displayEmail(email: string) {
  return email.endsWith("@noemail.local") ? "" : email;
}
function money(cents?: number | null) {
  if (!cents) return "R0";
  return `R${(cents / 100).toLocaleString("en-ZA")}`;
}
// A zoned ISO carries wall time already: "2026-07-04T08:00:00+02:00"
function dayKey(iso: string) {
  return iso.slice(0, 10);
}
function timeOf(iso: string) {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}
function venueTodayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VENUE_TZ }).format(
    new Date()
  );
}
// Venue open Fri(5)/Sat(6)/Sun(0) — used by seats date picker.
function isOpenDayKey(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  const day = d.getUTCDay(); // Sun=0 … Sat=6
  return day === 0 || day === 5 || day === 6;
}
function nearestOpenDayKey(fromKey?: string) {
  let key = fromKey ?? venueTodayKey();
  for (let i = 0; i < 7; i++) {
    if (isOpenDayKey(key)) return key;
    key = addDaysKey(key, 1);
  }
  return key;
}
function addDaysKey(key: string, days: number) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function longDay(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function shortDay(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
function relativeDay(key: string, today: string) {
  if (key === today) return "Today";
  if (key === addDaysKey(today, 1)) return "Tomorrow";
  if (key === addDaysKey(today, -1)) return "Yesterday";
  return longDay(key);
}

function SpecialRequestBanner({
  text,
  compact,
}: {
  text: string | null | undefined;
  compact?: boolean;
}) {
  const value = text?.trim();
  if (!value) return null;
  if (compact) {
    return (
      <span className="mt-1 inline-flex max-w-full items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-900">
        Special request
      </span>
    );
  }
  return (
    <div className="rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800/90">
        Prepare: special request
      </p>
      <p className="mt-1 whitespace-pre-line">{value}</p>
    </div>
  );
}

type StatusFilter = "upcoming" | "today" | "past" | "cancelled" | "all";
type View = "agenda" | "table";
type AdminSection = RoleSection;
type PaymentFilter = "all" | "paid" | "partial" | "awaiting" | "arrival";
type SeenFilter = "all" | "unseen" | "seen";
type BookingSort = "auto" | "start_asc" | "start_desc" | "booked_desc" | "booked_asc";

const FILTER_SELECT_CLASS =
  "min-h-10 w-full rounded-full border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold sm:min-w-0";
const FILTER_INPUT_CLASS =
  "min-h-10 w-full rounded-full border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none placeholder:text-eoe-espresso/60 focus:border-eoe-gold";

type BookingFilterOpts = {
  statusFilter: StatusFilter;
  experience: string;
  q: string;
  payFilter: PaymentFilter;
  dateFrom: string;
  dateTo: string;
  seenFilter: SeenFilter;
  minGuests: string;
  maxGuests: string;
  specialRequestOnly: boolean;
  carWashOnly: boolean;
  today: string;
};

function matchesBookingFilters(b: ScheduledEvent, opts: BookingFilterOpts): boolean {
  const key = dayKey(b.start_time);
  const cancelled = b.status === "canceled";

  if (opts.statusFilter === "cancelled" && !cancelled) return false;
  if (opts.statusFilter !== "cancelled" && opts.statusFilter !== "all" && cancelled)
    return false;
  if (opts.statusFilter === "upcoming" && key < opts.today) return false;
  if (opts.statusFilter === "today" && key !== opts.today) return false;
  if (opts.statusFilter === "past" && key >= opts.today) return false;

  if (opts.dateFrom && key < opts.dateFrom) return false;
  if (opts.dateTo && key > opts.dateTo) return false;

  if (opts.experience !== "all" && serviceId(b.event_type) !== opts.experience)
    return false;

  if (opts.payFilter !== "all") {
    if (opts.payFilter === "paid" && b.payment_status !== "paid") return false;
    if (opts.payFilter === "partial" && b.payment_status !== "partially_paid")
      return false;
    if (
      opts.payFilter === "awaiting" &&
      (b.payment_status !== "unpaid" || b.pay_on_arrival)
    )
      return false;
    if (opts.payFilter === "arrival" && !b.pay_on_arrival) return false;
  }

  if (opts.seenFilter === "unseen" && b.seen) return false;
  if (opts.seenFilter === "seen" && !b.seen) return false;

  if (opts.minGuests.trim()) {
    const min = Number(opts.minGuests);
    if (Number.isFinite(min) && b.guests < min) return false;
  }
  if (opts.maxGuests.trim()) {
    const max = Number(opts.maxGuests);
    if (Number.isFinite(max) && b.guests > max) return false;
  }

  if (opts.specialRequestOnly && !b.special_request?.trim()) return false;
  if (opts.carWashOnly && !(b.cars != null && b.cars > 0)) return false;

  const needle = opts.q.trim().toLowerCase();
  if (!needle) return true;
  return (
    b.invitee.name.toLowerCase().includes(needle) ||
    b.invitee.email.toLowerCase().includes(needle) ||
    (b.invitee.phone ?? "").toLowerCase().includes(needle) ||
    b.name.toLowerCase().includes(needle) ||
    (b.notes ?? "").toLowerCase().includes(needle) ||
    (b.special_request ?? "").toLowerCase().includes(needle) ||
    bookingId(b.uri).toLowerCase().includes(needle)
  );
}

function sortBookings(
  rows: ScheduledEvent[],
  sort: BookingSort,
  statusFilter: StatusFilter
): ScheduledEvent[] {
  const copy = [...rows];
  const effective =
    sort === "auto"
      ? statusFilter === "upcoming" || statusFilter === "today"
        ? "start_asc"
        : "start_desc"
      : sort;
  switch (effective) {
    case "start_desc":
      return copy.sort((a, b) => b.start_time.localeCompare(a.start_time));
    case "booked_desc":
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "booked_asc":
      return copy.sort((a, b) => a.created_at.localeCompare(b.created_at));
    default:
      return copy.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
}

function countActiveBookingFilters(opts: {
  statusFilter: StatusFilter;
  experience: string;
  q: string;
  payFilter: PaymentFilter;
  dateFrom: string;
  dateTo: string;
  seenFilter: SeenFilter;
  minGuests: string;
  maxGuests: string;
  specialRequestOnly: boolean;
  carWashOnly: boolean;
  bookingSort: BookingSort;
}): number {
  let n = 0;
  if (opts.statusFilter !== "upcoming") n++;
  if (opts.experience !== "all") n++;
  if (opts.q.trim()) n++;
  if (opts.payFilter !== "all") n++;
  if (opts.dateFrom) n++;
  if (opts.dateTo) n++;
  if (opts.seenFilter !== "all") n++;
  if (opts.minGuests.trim()) n++;
  if (opts.maxGuests.trim()) n++;
  if (opts.specialRequestOnly) n++;
  if (opts.carWashOnly) n++;
  if (opts.bookingSort !== "auto") n++;
  return n;
}

const NAV: { id: AdminSection; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "KPIs and load" },
  { id: "bookings", label: "Bookings", hint: "Agenda and table" },
  { id: "payments", label: "Payments", hint: "Deposits and dues" },
  { id: "clients", label: "Clients", hint: "Guest emails" },
  { id: "specials", label: "Specials", hint: "Home invitation flyer" },
  { id: "content", label: "Manage content", hint: "Copy, menu, and media" },
  { id: "seats", label: "Seats", hint: "Capacity and holds" },
  { id: "users", label: "Users", hint: "Staff accounts and roles" },
];

type MeResponse = {
  authenticated: boolean;
  user: string;
  role: AdminRole;
  sections: AdminSection[];
  permissions: {
    users: boolean;
    broadcast: boolean;
    seats: boolean;
    specials: boolean;
    content?: boolean;
    payments: boolean;
    clients: boolean;
  };
};

// ---------- page ----------
export default function AdminPage() {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [experience, setExperience] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("agenda");
  const [payFilter, setPayFilter] = useState<PaymentFilter>("all");
  const [bookingPayFilter, setBookingPayFilter] = useState<PaymentFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [seenFilter, setSeenFilter] = useState<SeenFilter>("all");
  const [minGuests, setMinGuests] = useState("");
  const [maxGuests, setMaxGuests] = useState("");
  const [specialRequestOnly, setSpecialRequestOnly] = useState(false);
  const [carWashOnly, setCarWashOnly] = useState(false);
  const [bookingSort, setBookingSort] = useState<BookingSort>("auto");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [detailUri, setDetailUri] = useState<string | null>(null);

  const today = venueTodayKey();

  const { data: me } = useSWR<MeResponse>("/api/admin/me", fetcher, {
    revalidateOnFocus: false,
  });
  const role = me?.role ?? "staff";
  const allowedSections = useMemo(
    () => new Set((me?.sections ?? ["overview", "bookings"]) as AdminSection[]),
    [me?.sections]
  );
  const navItems = useMemo(
    () => NAV.filter((n) => allowedSections.has(n.id)),
    [allowedSections]
  );

  useEffect(() => {
    if (!me?.sections?.length) return;
    if (!allowedSections.has(section)) {
      setSection(defaultSectionForRole(role));
    }
  }, [me, allowedSections, section, role]);

  async function signOut() {
    await adminFetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }
  const { data, error, isLoading, mutate } = useSWR<{
    collection: ScheduledEvent[];
  }>(
    `/api/v1/calendly/scheduled_events?business_id=${BUSINESS_ID}&count=500`,
    fetcher,
    { refreshInterval: 20000 }
  );
  const { data: typesData, mutate: mutateTypes } = useSWR<{
    collection: EventType[];
  }>(
    `/api/v1/calendly/event_types?business_id=${BUSINESS_ID}`,
    fetcher
  );
  const [showNew, setShowNew] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const all = useMemo(() => data?.collection ?? [], [data]);
  const types = useMemo(() => typesData?.collection ?? [], [typesData]);
  const colorFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of types) m.set(serviceId(t.uri), t.color);
    return (evUri: string) => m.get(serviceId(evUri)) ?? GOLD;
  }, [types]);
  // Which services are shared (café) — used to show seats-left to the admin only.
  const sharedFor = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const t of types) m.set(serviceId(t.uri), t.exclusive === false);
    return (evUri: string) => m.get(serviceId(evUri)) ?? false;
  }, [types]);
  const carWashFor = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const t of types) m.set(serviceId(t.uri), isCarWashService(t.slug));
    return (evUri: string) => m.get(serviceId(evUri)) ?? false;
  }, [types]);

  const stats = useMemo(() => {
    let upcoming = 0,
      todayCount = 0,
      cancelled = 0,
      deposits = 0,
      awaiting = 0,
      partial = 0;
    for (const b of all) {
      const key = dayKey(b.start_time);
      if (b.status === "canceled") cancelled++;
      else {
        if (key >= today) upcoming++;
        if (key === today) todayCount++;
        if (b.payment_status === "paid" || b.payment_status === "partially_paid") {
          deposits += b.payment_amount_cents ?? 0;
        }
        if (b.payment_status === "partially_paid") partial++;
        else if (b.payment_status === "unpaid" && !b.pay_on_arrival) awaiting++;
      }
    }
    return {
      total: all.length,
      upcoming,
      today: todayCount,
      cancelled,
      deposits,
      awaiting,
      partial,
    };
  }, [all, today]);

  // 14-day load strip (active bookings per day)
  const strip = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of all) {
      if (b.status === "canceled") continue;
      const k = dayKey(b.start_time);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const days = Array.from({ length: 14 }, (_, i) => {
      const key = addDaysKey(today, i);
      return { key, count: counts.get(key) ?? 0 };
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    return { days, max };
  }, [all, today]);

  const bookingFilterOpts = useMemo(
    (): BookingFilterOpts => ({
      statusFilter,
      experience,
      q,
      payFilter: bookingPayFilter,
      dateFrom,
      dateTo,
      seenFilter,
      minGuests,
      maxGuests,
      specialRequestOnly,
      carWashOnly,
      today,
    }),
    [
      statusFilter,
      experience,
      q,
      bookingPayFilter,
      dateFrom,
      dateTo,
      seenFilter,
      minGuests,
      maxGuests,
      specialRequestOnly,
      carWashOnly,
      today,
    ]
  );

  const activeBookingFilterCount = useMemo(
    () =>
      countActiveBookingFilters({
        statusFilter,
        experience,
        q,
        payFilter: bookingPayFilter,
        dateFrom,
        dateTo,
        seenFilter,
        minGuests,
        maxGuests,
        specialRequestOnly,
        carWashOnly,
        bookingSort,
      }),
    [
      statusFilter,
      experience,
      q,
      bookingPayFilter,
      dateFrom,
      dateTo,
      seenFilter,
      minGuests,
      maxGuests,
      specialRequestOnly,
      carWashOnly,
      bookingSort,
    ]
  );

  const clearBookingFilters = useCallback(() => {
    setStatusFilter("upcoming");
    setExperience("all");
    setQ("");
    setBookingPayFilter("all");
    setDateFrom("");
    setDateTo("");
    setSeenFilter("all");
    setMinGuests("");
    setMaxGuests("");
    setSpecialRequestOnly(false);
    setCarWashOnly(false);
    setBookingSort("auto");
  }, []);

  const filtered = useMemo(() => {
    return all.filter((b) => matchesBookingFilters(b, bookingFilterOpts));
  }, [all, bookingFilterOpts]);

  const sorted = useMemo(
    () => sortBookings(filtered, bookingSort, statusFilter),
    [filtered, bookingSort, statusFilter]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, ScheduledEvent[]>();
    for (const b of sorted) {
      const k = dayKey(b.start_time);
      const arr = groups.get(k) ?? [];
      arr.push(b);
      groups.set(k, arr);
    }
    return Array.from(groups.entries());
  }, [sorted]);

  const paymentRows = useMemo(() => {
    return all
      .filter((b) => b.status !== "canceled")
      .filter((b) => {
        if (payFilter === "paid") return b.payment_status === "paid";
        if (payFilter === "partial")
          return b.payment_status === "partially_paid";
        if (payFilter === "awaiting")
          return b.payment_status === "unpaid" && !b.pay_on_arrival;
        if (payFilter === "arrival") return Boolean(b.pay_on_arrival);
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [all, payFilter]);

  const go = (id: AdminSection) => {
    if (!allowedSections.has(id)) return;
    setSection(id);
    setNavOpen(false);
  };

  const softRefresh = useCallback(async () => {
    await Promise.all([mutate(), mutateTypes()]);
  }, [mutate, mutateTypes]);

  const applyQuickStatusFilter = useCallback(
    (filter: StatusFilter) => {
      clearBookingFilters();
      setStatusFilter(filter);
    },
    [clearBookingFilters]
  );

  const openBooking = useCallback(
    (b: ScheduledEvent) => {
      const key = dayKey(b.start_time);
      setSection("bookings");
      setNavOpen(false);
      clearBookingFilters();
      if (b.status === "canceled") setStatusFilter("cancelled");
      else if (key === today) setStatusFilter("today");
      else if (key < today) setStatusFilter("past");
      else setStatusFilter("upcoming");
      setDetailUri(b.uri);
    },
    [today, clearBookingFilters]
  );

  const sectionTitle =
    navItems.find((n) => n.id === section)?.label ?? "Dashboard";

  const detailBooking = useMemo(
    () => (detailUri ? (all.find((b) => b.uri === detailUri) ?? null) : null),
    [all, detailUri]
  );

  useEffect(() => {
    if (detailUri && !all.some((b) => b.uri === detailUri)) {
      setDetailUri(null);
    }
  }, [all, detailUri]);

  const cancel = async (uri: string) => {
    const id = bookingId(uri);
    await adminFetch(`/api/v1/calendly/scheduled_events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
    });
    await mutate();
  };

  // Free a website checkout hold (unpaid, not pay-on-arrival). Public release
  // endpoint is safe: never touches paid bookings.
  const releaseHold = async (uri: string) => {
    const id = bookingId(uri);
    const res = await adminFetch("/api/bookings/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.detail ?? "Could not release hold";
    }
    const body = await res.json().catch(() => ({}));
    if (!body.released) return "Hold was already released or paid";
    await mutate();
    return null;
  };

  // Returns null on success, or an error message (e.g. slot full).
  const reschedule = async (uri: string, startIso: string) => {
    const id = bookingId(uri);
    const res = await adminFetch(
      `/api/v1/calendly/scheduled_events/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_time: startIso }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.detail ?? "Could not reschedule";
    }
    await mutate();
    return null;
  };

  // Change a booking's guest count. Returns null on success or an error message.
  // Paid deposit is never adjusted (no refunds / no online top-up).
  const editGuests = async (uri: string, guests: number) => {
    const id = bookingId(uri);
    const res = await adminFetch(
      `/api/v1/calendly/scheduled_events/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.detail ?? "Could not update guests";
    }
    await mutate();
    return null;
  };

  const editCars = async (uri: string, carTypes: string[] | null) => {
    const id = bookingId(uri);
    const res = await adminFetch(
      `/api/v1/calendly/scheduled_events/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_types: carTypes }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.detail ?? "Could not update cars";
    }
    await mutate();
    return null;
  };

  const editSpecialRequest = async (
    uri: string,
    specialRequest: string | null
  ) => {
    const id = bookingId(uri);
    const res = await adminFetch(
      `/api/v1/calendly/scheduled_events/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ special_request: specialRequest }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.detail ?? "Could not update special request";
    }
    await mutate();
    return null;
  };

  /** Mark partially_paid as settled (balance collected at venue). */
  const settlePayment = async (uri: string) => {
    const id = bookingId(uri);
    const res = await adminFetch(
      `/api/v1/calendly/scheduled_events/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_status: "paid" }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.detail ?? "Could not mark settled";
    }
    await mutate();
    return null;
  };

  // --- New-booking notifications (seen / unseen) ---
  const notifications = useMemo(
    () =>
      [...all]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 25),
    [all]
  );
  const unseenCount = useMemo(
    () => all.filter((b) => !b.seen).length,
    [all]
  );
  const prevUnseenRef = useRef<number | null>(null);
  useEffect(() => {
    const unlock = () => unlockNotifySound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const prev = prevUnseenRef.current;
    prevUnseenRef.current = unseenCount;
    if (prev === null) return; // skip initial load
    if (unseenCount > prev) playNotifySound();
  }, [data, unseenCount]);
  const toggleSeen = async (uri: string, seen: boolean) => {
    const id = bookingId(uri);
    await adminFetch(`/api/v1/calendly/scheduled_events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen }),
    });
    await mutate();
  };
  const openFromNotification = async (b: ScheduledEvent) => {
    if (!b.seen) await toggleSeen(b.uri, true);
    openBooking(b);
  };
  const markAllSeen = async () => {
    await adminFetch(`/api/v1/calendly/admin/seen`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: true, business_id: Number(BUSINESS_ID) }),
    });
    await mutate();
  };

  return (
    <div className="h-dvh overflow-hidden bg-eoe-ivory text-eoe-ink md:pl-64 lg:pl-72">
      {/* Mobile nav backdrop */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-eoe-ink/40 md:hidden"
        />
      )}

      {/* Sidebar stays fixed; only the right pane scrolls */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,88vw)] flex-col border-r border-eoe-espresso/10 bg-white transition-transform md:w-64 lg:w-72 ${
          navOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="shrink-0 border-b border-eoe-espresso/10 px-5 py-4 md:py-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.28em]"
                style={{ color: GOLD_TEXT }}
              >
                Entle Off Grid Estate
              </p>
              <p className="mt-2 font-display text-2xl tracking-wide text-eoe-ink">
                Admin
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="rounded-full border border-eoe-espresso/15 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-eoe-espresso md:hidden"
              aria-label="Close menu"
            >
              Close
            </button>
          </div>
          {me?.user && (
            <p className="mt-3 text-[11px] text-eoe-espresso/75">
              Signed in as{" "}
              <span className="font-medium text-eoe-ink">{me.user}</span>
              <span className="mt-0.5 block capitalize text-eoe-espresso/60">
                {role} access
              </span>
            </p>
          )}
        </div>
        <nav
          className={`min-h-0 flex-1 space-y-0.5 px-3 py-3 md:space-y-1 md:overflow-hidden md:py-4 ${
            navOpen ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
          }`}
        >
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={`flex min-h-11 w-full flex-col justify-center rounded-2xl px-3.5 py-2.5 text-left transition md:min-h-10 md:py-2 ${
                  active
                    ? "bg-eoe-espresso text-eoe-ivory"
                    : "text-eoe-ink/80 hover:bg-eoe-ivory"
                }`}
              >
                <span className="text-[12px] font-medium uppercase tracking-[0.16em]">
                  {item.label}
                </span>
                <span
                  className={`mt-0.5 hidden text-[11px] lg:block ${
                    active ? "text-eoe-ivory/70" : "text-eoe-espresso/70"
                  }`}
                >
                  {item.hint}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-2 border-t border-eoe-espresso/10 px-3 py-3 md:py-4">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-eoe-espresso/15 px-3 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-eoe-ivory"
          >
            View site
          </a>
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="min-h-11 w-full rounded-full border border-eoe-espresso/15 px-3 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-eoe-ivory"
          >
            Change password
          </button>
          <button
            type="button"
            onClick={() => void softRefresh()}
            className="min-h-11 w-full rounded-full border border-eoe-espresso/15 px-3 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-eoe-ivory"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            className="min-h-11 w-full rounded-full border border-eoe-espresso/15 px-3 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-eoe-ivory"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex h-dvh min-w-0 flex-col">
        <header className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-eoe-espresso/10 bg-eoe-ivory/95 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-4 sm:py-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="min-h-11 shrink-0 rounded-full border border-eoe-espresso/15 px-3.5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso md:hidden"
            >
              Menu
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl tracking-wide text-eoe-ink sm:text-2xl md:text-3xl">
                {sectionTitle}
              </h1>
              <p className="hidden text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/70 sm:block">
                {navItems.find((n) => n.id === section)?.hint}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="min-h-11 rounded-full border border-eoe-espresso/15 px-3 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-white sm:px-3.5"
            >
              Site
            </a>
            <NotificationsBell
              items={notifications}
              unseenCount={unseenCount}
              onOpen={openFromNotification}
              onMarkAll={markAllSeen}
            />
            {(section === "bookings" || section === "overview") &&
              canAccessSection(role, "bookings") && (
              <button
                onClick={() => setShowNew(true)}
                className="min-h-11 rounded-full bg-eoe-espresso px-3 py-2.5 text-[11px] uppercase tracking-[0.16em] text-eoe-ivory transition hover:bg-eoe-espresso/90 sm:px-4 sm:tracking-[0.22em]"
              >
                <span className="sm:hidden">New</span>
                <span className="hidden sm:inline">New booking</span>
              </button>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8 md:px-8">
          {showNew && (
            <NewBookingModal
              types={types}
              onClose={() => setShowNew(false)}
              onCreated={async () => {
                setShowNew(false);
                await mutate();
              }}
            />
          )}
          {showPassword && (
            <ChangePasswordModal
              username={me?.user ?? ""}
              onClose={() => setShowPassword(false)}
            />
          )}

          {error && (
            <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              Failed to load bookings.
            </p>
          )}

          <DeferredBookingsAlert />

          {section === "overview" && (
            <div className="space-y-8">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Kpi
                  label="Upcoming"
                  value={stats.upcoming}
                  tone="primary"
                  onClick={() => {
                    applyQuickStatusFilter("upcoming");
                    go("bookings");
                  }}
                />
                <Kpi
                  label="Today"
                  value={stats.today}
                  onClick={() => {
                    applyQuickStatusFilter("today");
                    go("bookings");
                  }}
                />
                {canAccessSection(role, "payments") && (
                  <>
                    <Kpi
                      label="Deposits collected"
                      value={money(stats.deposits)}
                      onClick={() => {
                        setPayFilter("paid");
                        go("payments");
                      }}
                    />
                    <Kpi
                      label="Awaiting payment"
                      value={stats.awaiting}
                      tone="warn"
                      onClick={() => {
                        setPayFilter("awaiting");
                        go("payments");
                      }}
                    />
                    <Kpi
                      label="Balance due"
                      value={stats.partial}
                      tone="warn"
                      onClick={() => {
                        setPayFilter("partial");
                        go("payments");
                      }}
                    />
                  </>
                )}
                <Kpi
                  label="Cancelled"
                  value={stats.cancelled}
                  tone="muted"
                  onClick={() => {
                    applyQuickStatusFilter("cancelled");
                    go("bookings");
                  }}
                />
              </section>
              <LoadStrip days={strip.days} max={strip.max} today={today} />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => go("bookings")}
                  className="min-h-11 rounded-full border border-eoe-espresso/20 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-white"
                >
                  Open bookings
                </button>
                {canAccessSection(role, "payments") && (
                  <button
                    type="button"
                    onClick={() => go("payments")}
                    className="min-h-11 rounded-full border border-eoe-espresso/20 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-white"
                  >
                    Review payments
                  </button>
                )}
                {canAccessSection(role, "seats") && (
                  <button
                    type="button"
                    onClick={() => go("seats")}
                    className="min-h-11 rounded-full border border-eoe-espresso/20 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-white"
                  >
                    Manage seats
                  </button>
                )}
              </div>
            </div>
          )}

          {section === "bookings" && (
            <div>
              <section className="sticky top-[3.25rem] z-20 -mx-3 space-y-3 border-b border-eoe-espresso/10 bg-eoe-ivory/95 px-3 py-3 backdrop-blur sm:top-[3.75rem] sm:-mx-4 sm:px-4 md:static md:z-auto md:mx-0 md:space-y-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
                  <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <Segmented
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        ["upcoming", "Upcoming"],
                        ["today", "Today"],
                        ["past", "Past"],
                        ["cancelled", "Cancelled"],
                        ["all", "All"],
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search guest, email, phone, notes, ID"
                      className="min-h-11 min-w-0 flex-1 rounded-full border border-eoe-espresso/15 bg-white px-4 py-2.5 text-sm text-eoe-espresso outline-none placeholder:text-eoe-espresso/70 focus:border-eoe-gold sm:min-w-[14rem]"
                    />
                    <div className="hidden sm:block">
                      <Toggle value={view} onChange={setView} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersExpanded((v) => !v)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-eoe-espresso/15 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso hover:border-eoe-gold/50"
                  >
                    Filters
                    {activeBookingFilterCount > 0 && (
                      <span className="rounded-full bg-eoe-gold px-2 py-0.5 text-[10px] font-semibold text-eoe-ivory">
                        {activeBookingFilterCount}
                      </span>
                    )}
                    <span className="text-eoe-espresso/60">
                      {filtersExpanded ? "▲" : "▼"}
                    </span>
                  </button>
                  {activeBookingFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearBookingFilters}
                      className="min-h-10 rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75 hover:text-eoe-espresso"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {(filtersExpanded || activeBookingFilterCount > 0) && (
                  <div className="rounded-2xl border border-eoe-espresso/10 bg-white/80 p-3 shadow-sm sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                          Experience
                        </span>
                        <select
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          className={FILTER_SELECT_CLASS}
                        >
                          <option value="all">All experiences</option>
                          {types.map((t) => (
                            <option key={t.uri} value={serviceId(t.uri)}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      {canAccessSection(role, "payments") && (
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                            Payment
                          </span>
                          <select
                            value={bookingPayFilter}
                            onChange={(e) =>
                              setBookingPayFilter(e.target.value as PaymentFilter)
                            }
                            className={FILTER_SELECT_CLASS}
                          >
                            <option value="all">Any payment</option>
                            <option value="paid">Paid in full</option>
                            <option value="partial">Balance due</option>
                            <option value="awaiting">Awaiting payment</option>
                            <option value="arrival">Pays at restaurant</option>
                          </select>
                        </label>
                      )}

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                          Notification
                        </span>
                        <select
                          value={seenFilter}
                          onChange={(e) =>
                            setSeenFilter(e.target.value as SeenFilter)
                          }
                          className={FILTER_SELECT_CLASS}
                        >
                          <option value="all">All bookings</option>
                          <option value="unseen">Unseen only</option>
                          <option value="seen">Seen only</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                          Sort by
                        </span>
                        <select
                          value={bookingSort}
                          onChange={(e) =>
                            setBookingSort(e.target.value as BookingSort)
                          }
                          className={FILTER_SELECT_CLASS}
                        >
                          <option value="auto">Default</option>
                          <option value="start_asc">Start time (earliest)</option>
                          <option value="start_desc">Start time (latest)</option>
                          <option value="booked_desc">Booked recently</option>
                          <option value="booked_asc">Booked oldest</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                          From date
                        </span>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className={FILTER_INPUT_CLASS}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                          To date
                        </span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className={FILTER_INPUT_CLASS}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                          Min guests
                        </span>
                        <input
                          type="number"
                          min={1}
                          placeholder="Any"
                          value={minGuests}
                          onChange={(e) => setMinGuests(e.target.value)}
                          className={FILTER_INPUT_CLASS}
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70">
                          Max guests
                        </span>
                        <input
                          type="number"
                          min={1}
                          placeholder="Any"
                          value={maxGuests}
                          onChange={(e) => setMaxGuests(e.target.value)}
                          className={FILTER_INPUT_CLASS}
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 border-t border-eoe-espresso/8 pt-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-eoe-espresso">
                        <input
                          type="checkbox"
                          checked={specialRequestOnly}
                          onChange={(e) => setSpecialRequestOnly(e.target.checked)}
                          className="size-4 rounded border-eoe-espresso/25 text-eoe-gold focus:ring-eoe-gold/40"
                        />
                        Special request only
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-eoe-espresso">
                        <input
                          type="checkbox"
                          checked={carWashOnly}
                          onChange={(e) => setCarWashOnly(e.target.checked)}
                          className="size-4 rounded border-eoe-espresso/25 text-eoe-gold focus:ring-eoe-gold/40"
                        />
                        Car wash included
                      </label>
                    </div>
                  </div>
                )}

                <div className="sm:hidden">
                  <Toggle value={view} onChange={setView} />
                </div>
              </section>

              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-eoe-espresso/70 sm:mt-5">
                {sorted.length} {sorted.length === 1 ? "booking" : "bookings"}
                {activeBookingFilterCount > 0 && (
                  <span className="text-eoe-espresso/55">
                    {" "}
                    · {activeBookingFilterCount} filter
                    {activeBookingFilterCount === 1 ? "" : "s"} active
                  </span>
                )}
              </p>

              {isLoading && (
                <p className="mt-4 text-sm text-eoe-espresso/85">
                  Loading bookings…
                </p>
              )}
              {!isLoading && sorted.length === 0 && (
                <div className="mt-6 rounded-2xl border border-dashed border-eoe-espresso/15 bg-white/60 px-6 py-12 text-center text-sm text-eoe-espresso/80">
                  No bookings match this view.
                </div>
              )}

              {view === "agenda" ? (
                <div className="mt-3 space-y-6 sm:mt-4 sm:space-y-8">
                  {grouped.map(([key, items]) => (
                    <div key={key}>
                      <div className="flex items-baseline justify-between gap-3 border-b border-eoe-gold/40 pb-2">
                        <h2 className="min-w-0 font-display text-lg tracking-wide text-eoe-espresso sm:text-xl">
                          {relativeDay(key, today)}
                        </h2>
                        <span className="shrink-0 text-[11px] text-eoe-espresso/70 sm:text-xs">
                          {items.length} ·{" "}
                          {items.reduce((s, b) => s + b.guests, 0)} guests
                        </span>
                      </div>
                      <div className="mt-3 space-y-2.5 sm:space-y-3">
                        {items.map((b) => (
                          <BookingCard
                            key={b.uri}
                            b={b}
                            color={colorFor(b.event_type)}
                            shared={sharedFor(b.event_type)}
                            onOpen={() => setDetailUri(b.uri)}
                            onCancel={cancel}
                            onReschedule={reschedule}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <TableView
                  rows={sorted}
                  colorFor={colorFor}
                  today={today}
                  activeUri={detailUri}
                  onOpenDetail={setDetailUri}
                />
              )}
            </div>
          )}

          {detailBooking && (
            <BookingDetailModal
              b={detailBooking}
              color={colorFor(detailBooking.event_type)}
              shared={sharedFor(detailBooking.event_type)}
              allowsCars={carWashFor(detailBooking.event_type)}
              onClose={() => setDetailUri(null)}
              onCancel={cancel}
              onReschedule={reschedule}
              onEditGuests={editGuests}
              onEditCars={editCars}
              onEditSpecialRequest={editSpecialRequest}
              onReleaseHold={releaseHold}
              onSettlePayment={settlePayment}
            />
          )}

          {section === "payments" && canAccessSection(role, "payments") && (
            <div className="space-y-6">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi
                  label="Deposits collected"
                  value={money(stats.deposits)}
                  tone="primary"
                  onClick={() => setPayFilter("paid")}
                />
                <Kpi
                  label="Awaiting payment"
                  value={stats.awaiting}
                  tone="warn"
                  onClick={() => setPayFilter("awaiting")}
                />
                <Kpi
                  label="Balance due"
                  value={stats.partial}
                  tone="warn"
                  onClick={() => setPayFilter("partial")}
                />
                <Kpi
                  label="Pays at restaurant"
                  value={
                    all.filter(
                      (b) => b.status !== "canceled" && b.pay_on_arrival
                    ).length
                  }
                  onClick={() => setPayFilter("arrival")}
                />
              </section>
              <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Segmented
                  value={payFilter}
                  onChange={setPayFilter}
                  options={[
                    ["all", "All"],
                    ["paid", "Paid"],
                    ["partial", "Balance due"],
                    ["awaiting", "Awaiting"],
                    ["arrival", "At restaurant"],
                  ]}
                />
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-eoe-espresso/70">
                {paymentRows.length}{" "}
                {paymentRows.length === 1 ? "payment" : "payments"}
              </p>
              <PaymentsTable
                rows={paymentRows}
                colorFor={colorFor}
                onOpenDetail={setDetailUri}
              />
            </div>
          )}

          {section === "clients" && canAccessSection(role, "clients") && (
            <ClientsPanel canBroadcast={Boolean(me?.permissions?.broadcast)} />
          )}

          {section === "specials" && canAccessSection(role, "specials") && (
            <SpecialsPanel />
          )}

          {section === "content" && canAccessSection(role, "content") && (
            <ContentPanel />
          )}

          {section === "seats" && canAccessSection(role, "seats") && (
            <SeatSettings services={types} onSaved={() => mutateTypes()} />
          )}

          {section === "users" && canAccessSection(role, "users") && (
            <UsersPanel />
          )}
        </main>
      </div>
    </div>
  );
}

// ---------- clients / mass email ----------
type ClientRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  booking_count: number;
  last_visit: string | null;
};

function ClientsPanel({ canBroadcast = true }: { canBroadcast?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<{ collection: ClientRow[] }>(
    `/api/admin/clients?business_id=${BUSINESS_ID}`,
    fetcher
  );
  const clients = data?.collection ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated && clients.length > 0) {
      setSelected(new Set(clients.map((c) => c.email.toLowerCase())));
      setHydrated(true);
    }
  }, [clients, hydrated]);

  const toggle = (email: string) => {
    const key = email.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(clients.map((c) => c.email.toLowerCase())));
  const selectNone = () => setSelected(new Set());

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      setMsg("Add a subject and message first.");
      return;
    }
    if (selected.size === 0) {
      setMsg("Select at least one client.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: Number(BUSINESS_ID),
          subject: subject.trim(),
          body: body.trim(),
          emails: [...selected],
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.detail ?? "Could not send emails.");
        return;
      }
      const gap = d.gap_seconds ?? 30;
      const eta = d.eta_seconds;
      const etaLabel =
        typeof eta === "number" && eta > 0
          ? eta < 60
            ? `~${eta}s`
            : `~${Math.ceil(eta / 60)} min`
          : null;
      setMsg(
        `Queued ${d.queued} of ${d.total} (${gap}s apart)${
          etaLabel ? ` · ${etaLabel}` : ""
        }${d.skipped ? ` · ${d.skipped} skipped` : ""}.`
      );
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-2xl border border-eoe-espresso/15 bg-white px-3.5 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold";

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm leading-relaxed text-eoe-espresso/85">
        Guests who booked with a real email. Use this list for specials and
        updates. Placeholder walk-in addresses are hidden. Emails are queued
        and sent one at a time, 30 seconds apart.
      </p>

      {canBroadcast && (
      <section className="rounded-2xl border border-eoe-espresso/12 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
          Compose special
        </p>
        <div className="mt-3 space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g. Weekend brunch special)"
            className={inputCls}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Message to selected clients"
            className={`${inputCls} rounded-2xl`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={send}
              className="min-h-11 rounded-full bg-eoe-espresso px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:opacity-40"
            >
              {busy
                ? "Sending…"
                : `Email ${selected.size} selected`}
            </button>
            {msg && (
              <span className="text-xs text-eoe-espresso/80">{msg}</span>
            )}
          </div>
        </div>
      </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-eoe-espresso/70">
          {clients.length} {clients.length === 1 ? "client" : "clients"}
        </p>
        {canBroadcast && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="min-h-10 rounded-full border border-eoe-espresso/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-eoe-espresso hover:bg-white"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="min-h-10 rounded-full border border-eoe-espresso/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-eoe-espresso hover:bg-white"
          >
            Clear
          </button>
        </div>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-eoe-espresso/85">Loading clients…</p>
      )}
      {error && (
        <p className="text-sm text-rose-600">Could not load clients.</p>
      )}
      {!isLoading && clients.length === 0 && (
        <div className="rounded-2xl border border-dashed border-eoe-espresso/15 bg-white/60 px-6 py-12 text-center text-sm text-eoe-espresso/80">
          No bookable email clients yet.
        </div>
      )}

      {clients.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-eoe-espresso/10 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-eoe-ivory text-[10px] uppercase tracking-[0.18em] text-eoe-espresso/70">
              <tr>
                {canBroadcast && <th className="px-4 py-3 font-medium"> </th>}
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Bookings</th>
                <th className="px-4 py-3 font-medium">Last visit</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const key = c.email.toLowerCase();
                const checked = selected.has(key);
                return (
                  <tr
                    key={c.id}
                    className="border-t border-eoe-espresso/8 text-eoe-ink"
                  >
                    {canBroadcast && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.email)}
                        aria-label={`Select ${c.name}`}
                      />
                    </td>
                    )}
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`mailto:${c.email}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {c.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-eoe-espresso/80">
                      {c.phone || "n/a"}
                    </td>
                    <td className="px-4 py-3">{c.booking_count}</td>
                    <td className="px-4 py-3 text-eoe-espresso/80">
                      {c.last_visit
                        ? shortDay(dayKey(String(c.last_visit)))
                        : "n/a"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- users / roles ----------
type AdminUserRow = {
  id: number;
  username: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
};

function UsersPanel() {
  const { data, error, isLoading, mutate } = useSWR<{
    collection: AdminUserRow[];
  }>("/api/admin/users", fetcher);
  const users = data?.collection ?? [];
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetPw2, setResetPw2] = useState("");

  const creatable = ADMIN_ROLES.filter((r) => r.id !== "owner");

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          display_name: displayName.trim() || username.trim(),
          role,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.detail ?? "Could not create user");
        return;
      }
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("staff");
      setMsg("Account created");
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (id: number, is_active: boolean) => {
    const res = await adminFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.detail ?? "Could not update user");
      return;
    }
    await mutate();
  };

  const changeRole = async (id: number, next: "manager" | "staff") => {
    const res = await adminFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.detail ?? "Could not update role");
      return;
    }
    await mutate();
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(`Remove account “${name}”? They will no longer be able to sign in.`))
      return;
    const res = await adminFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.detail ?? "Could not delete user");
      return;
    }
    await mutate();
  };

  const saveResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (resetId == null) return;
    if (resetPw.length < 8) {
      setMsg("Password must be at least 8 characters");
      return;
    }
    if (resetPw !== resetPw2) {
      setMsg("Passwords do not match");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch(`/api/admin/users/${resetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPw }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.detail ?? "Could not update password");
        return;
      }
      setResetId(null);
      setResetPw("");
      setResetPw2("");
      setMsg("Password updated");
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "min-h-11 w-full rounded-full border border-eoe-espresso/15 bg-white px-4 py-2.5 text-sm text-eoe-espresso outline-none focus:border-eoe-gold";

  const resetTarget = users.find((u) => u.id === resetId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-eoe-espresso/12 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
          Roles
        </p>
        <ul className="mt-3 space-y-2 text-sm text-eoe-espresso/85">
          {ADMIN_ROLES.map((r) => (
            <li key={r.id}>
              <span className="font-medium text-eoe-ink">{r.label}</span>
              {": "}
              {r.hint}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-eoe-espresso/70">
          Owner signs in with the env account (ADMIN_USER). Create manager or
          staff accounts here for day-to-day access. You can reset any staff
          password below; each person can also change their own from the sidebar.
        </p>
      </div>

      <form
        onSubmit={create}
        className="rounded-2xl border border-eoe-espresso/12 bg-white p-4 shadow-sm sm:p-5"
      >
        <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
          Add account
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
              Username
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
              Display name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
              Role
            </span>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "manager" | "staff")
              }
              className={inputCls}
            >
              {creatable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-full bg-eoe-espresso px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
          {msg && <span className="text-xs text-eoe-espresso/80">{msg}</span>}
        </div>
      </form>

      {resetTarget && (
        <form
          onSubmit={saveResetPassword}
          className="rounded-2xl border border-eoe-gold/40 bg-eoe-gold/5 p-4 shadow-sm sm:p-5"
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
            Set password for @{resetTarget.username}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                New password
              </span>
              <input
                type="password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                Confirm password
              </span>
              <input
                type="password"
                value={resetPw2}
                onChange={(e) => setResetPw2(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputCls}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-full bg-eoe-espresso px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResetId(null);
                setResetPw("");
                setResetPw2("");
              }}
              className="min-h-11 rounded-full border border-eoe-espresso/15 px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading && (
        <p className="text-sm text-eoe-espresso/85">Loading users…</p>
      )}
      {error && (
        <p className="text-sm text-rose-600">
          Could not load users. Ensure the admin_users table is migrated.
        </p>
      )}

      {users.length > 0 && (
        <div className="space-y-3 md:hidden">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-eoe-espresso/10 bg-white p-4 shadow-sm"
            >
              <p className="font-medium text-eoe-ink">
                {u.display_name || u.username}
              </p>
              <p className="text-xs text-eoe-espresso/70">@{u.username}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {u.role === "owner" ? (
                  <span className="rounded-full bg-eoe-espresso/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-eoe-espresso">
                    Owner
                  </span>
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) =>
                      void changeRole(
                        u.id,
                        e.target.value as "manager" | "staff"
                      )
                    }
                    className="min-h-10 rounded-full border border-eoe-espresso/15 bg-white px-3 text-xs text-eoe-espresso"
                  >
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                  </select>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] ${
                    u.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-eoe-espresso/10 text-eoe-espresso/70"
                  }`}
                >
                  {u.is_active ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetId(u.id);
                    setResetPw("");
                    setResetPw2("");
                    setMsg(null);
                  }}
                  className="min-h-10 rounded-full border border-eoe-espresso/15 px-3 text-[10px] uppercase tracking-[0.14em] text-eoe-espresso"
                >
                  Set password
                </button>
                {u.role !== "owner" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void setActive(u.id, !u.is_active)}
                      className="min-h-10 rounded-full border border-eoe-espresso/15 px-3 text-[10px] uppercase tracking-[0.14em] text-eoe-espresso"
                    >
                      {u.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(u.id, u.username)}
                      className="min-h-10 rounded-full border border-rose-200 px-3 text-[10px] uppercase tracking-[0.14em] text-rose-700"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {users.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-eoe-espresso/10 bg-white shadow-sm md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-eoe-ivory text-[10px] uppercase tracking-[0.18em] text-eoe-espresso/70">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-eoe-espresso/8 text-eoe-ink"
                >
                  <td className="px-4 py-3">
                    <div>{u.display_name || u.username}</div>
                    <div className="text-xs text-eoe-espresso/70">
                      @{u.username}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "owner" ? (
                      "Owner"
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) =>
                          void changeRole(
                            u.id,
                            e.target.value as "manager" | "staff"
                          )
                        }
                        className="rounded-full border border-eoe-espresso/15 bg-white px-3 py-1.5 text-xs"
                      >
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? "Active" : "Disabled"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResetId(u.id);
                          setResetPw("");
                          setResetPw2("");
                          setMsg(null);
                        }}
                        className="text-[11px] uppercase tracking-[0.14em] text-eoe-espresso hover:underline"
                      >
                        Set password
                      </button>
                      {u.role !== "owner" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void setActive(u.id, !u.is_active)}
                            className="text-[11px] uppercase tracking-[0.14em] text-eoe-espresso hover:underline"
                          >
                            {u.is_active ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(u.id, u.username)}
                            className="text-[11px] uppercase tracking-[0.14em] text-rose-700 hover:underline"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChangePasswordModal({
  username,
  onClose,
}: {
  username: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const inputCls =
    "min-h-11 w-full rounded-full border border-eoe-espresso/15 bg-white px-4 py-2.5 text-sm text-eoe-espresso outline-none focus:border-eoe-gold";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await adminFetch("/api/admin/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: current,
          new_password: next,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.detail ?? "Could not change password");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-eoe-ink/45 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="change-password-title"
        className="w-full max-w-md rounded-t-3xl border border-eoe-espresso/10 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/75">
              Account
            </p>
            <h2
              id="change-password-title"
              className="mt-1 font-display text-2xl tracking-wide text-eoe-espresso"
            >
              Change password
            </h2>
            {username && (
              <p className="mt-1 text-xs text-eoe-espresso/70">@{username}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-eoe-espresso/15 text-xl text-eoe-espresso/70"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="mt-6">
            <p className="text-sm text-eoe-ink">
              Password updated. Use the new password next time you sign in.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 min-h-11 w-full rounded-full bg-eoe-espresso px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                Current password
              </span>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                New password
              </span>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                Confirm new password
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputCls}
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-full bg-eoe-espresso px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory disabled:opacity-40"
            >
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- deferred / offline booking recovery ----------
type DeferredRow = {
  id: string;
  status: string;
  guest_name?: string;
  guest_email?: string;
  start_time?: string;
  guests?: number;
  created_at: string;
};

function DeferredBookingsAlert() {
  const { data, mutate } = useSWR<{ collection?: DeferredRow[] }>(
    "/api/admin/deferred-bookings",
    fetcher,
    { refreshInterval: 60_000 }
  );
  const rows = data?.collection ?? [];
  const conflicts = rows.filter((r) => r.status === "conflict");
  const pending = rows.filter((r) => r.status === "pending");
  const [syncing, setSyncing] = useState(false);

  if (!conflicts.length && !pending.length) return null;

  async function syncNow() {
    setSyncing(true);
    try {
      await adminFetch("/api/admin/deferred-bookings", { method: "POST" });
      await mutate();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-eoe-ink">
      <p className="font-medium text-eoe-espresso">
        Offline booking recovery
      </p>
      {pending.length > 0 && (
        <p className="mt-1 text-eoe-ink/90">
          {pending.length} paid booking{pending.length === 1 ? "" : "s"} waiting
          to sync from Yoco.
        </p>
      )}
      {conflicts.length > 0 && (
        <ul className="mt-2 space-y-1 text-eoe-ink/90">
          {conflicts.slice(0, 5).map((r) => (
            <li key={r.id}>
              <span className="font-medium text-amber-900">Conflict</span> ·{" "}
              {r.guest_name ?? "Guest"} · {r.start_time ?? "—"} · {r.guests ?? 1}{" "}
              guest{(r.guests ?? 1) === 1 ? "" : "s"}
            </li>
          ))}
          {conflicts.length > 5 && (
            <li className="text-eoe-ink/70">+{conflicts.length - 5} more</li>
          )}
        </ul>
      )}
      <button
        type="button"
        disabled={syncing}
        onClick={syncNow}
        className="mt-3 min-h-9 rounded-full border border-amber-300 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso hover:bg-amber-100/80 disabled:opacity-60"
      >
        {syncing ? "Syncing…" : "Retry sync"}
      </button>
    </div>
  );
}

// ---------- notifications ----------
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotificationsBell({
  items,
  unseenCount,
  onOpen,
  onMarkAll,
}: {
  items: ScheduledEvent[];
  unseenCount: number;
  onOpen: (b: ScheduledEvent) => void | Promise<void>;
  onMarkAll: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="New bookings"
        className="relative rounded-full border border-eoe-espresso/20 px-3.5 py-2 text-base leading-none text-eoe-espresso transition hover:bg-eoe-espresso/5"
      >
        <span aria-hidden>🔔</span>
        {unseenCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-eoe-espresso px-1 text-[10px] font-semibold text-eoe-ivory">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border border-eoe-espresso/12 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-eoe-espresso/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/80">
                New bookings
              </p>
              {unseenCount > 0 && (
                <button
                  onClick={onMarkAll}
                  className="text-[10px] uppercase tracking-[0.16em] hover:underline"
                  style={{ color: GOLD_TEXT }}
                >
                  Mark all seen
                </button>
              )}
            </div>
            <div className="max-h-[440px] overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-eoe-espresso/70">
                  No bookings yet.
                </p>
              )}
              {items.map((b) => {
                const day = shortDay(dayKey(b.start_time));
                const time = timeOf(b.start_time);
                return (
                  <button
                    key={b.uri}
                    onClick={() => {
                      setOpen(false);
                      void onOpen(b);
                    }}
                    title="Open booking"
                    className={`flex w-full items-start gap-3 border-b border-eoe-espresso/[0.06] px-4 py-3 text-left transition hover:bg-eoe-ivory ${
                      b.seen ? "" : "bg-eoe-gold/10"
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        b.seen
                          ? "border border-eoe-espresso/25"
                          : "bg-eoe-gold"
                      }`}
                    />
                    <span className="flex-1">
                      <span
                        className={`block text-sm ${
                          b.seen
                            ? "text-eoe-ink"
                            : "font-medium text-eoe-espresso"
                        }`}
                      >
                        {b.invitee.name} · {b.name}
                      </span>
                      <span className="block text-xs text-eoe-espresso/75">
                        {day} · {time} · {b.guests}{" "}
                        {b.guests === 1 ? "guest" : "guests"}
                        {b.cars != null && b.cars > 0
                          ? ` · ${b.cars} ${b.cars === 1 ? "car" : "cars"}${
                              b.car_labels?.length
                                ? ` (${b.car_labels.join(", ")})`
                                : ""
                            }`
                          : ""}
                      </span>
                      <span className="block text-[11px] text-eoe-espresso/70">
                        {relTime(b.created_at)}
                        {b.status === "canceled" ? " · cancelled" : ""}
                        {b.payment_status === "paid"
                          ? " · paid"
                          : b.payment_status === "partially_paid"
                            ? " · partially paid"
                            : b.pay_on_arrival
                              ? " · pays at restaurant"
                              : " · awaiting payment"}
                        {b.special_request?.trim() ? " · special request" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- manual booking (phone / WhatsApp / walk-in) ----------
// Creates a booking through the payment-free Calendly POST — no checkout, the
// guest settles on arrival. Email is optional (call-in guests often have none);
// a placeholder @noemail.local address satisfies the API and is never mailed.
function NewBookingModal({
  types,
  onClose,
  onCreated,
}: {
  types: EventType[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [sid, setSid] = useState(types[0] ? serviceId(types[0].uri) : "");
  const [date, setDate] = useState(nearestOpenDayKey());
  const [times, setTimes] = useState<
    { start_time: string; invitees_remaining: number }[]
  >([]);
  const [timesLoading, setTimesLoading] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState("2");
  const [carTypes, setCarTypes] = useState<string[]>([]);
  const [specialRequest, setSpecialRequest] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const type = types.find((t) => serviceId(t.uri) === sid);
  const shared = type?.exclusive === false;
  const needsCars = isCarWashService(type?.slug);
  const guestCount = Math.max(1, Number(guests) || 1);
  const washMin = needsCars ? carWashMinimumCents(carTypes) : 0;
  const priceCents = type?.price_cents ?? 0;

  const resizeTypes = (count: number) => {
    const n = Math.min(MAX_CARS_PER_SESSION, Math.max(0, count));
    setCarTypes((prev) => {
      if (prev.length === n) return prev;
      if (n === 0) return [];
      if (prev.length > n) return prev.slice(0, n);
      return [
        ...prev,
        ...Array.from({ length: n - prev.length }, () => "sedan"),
      ];
    });
  };

  useEffect(() => {
    if (!sid || !date) return;
    let alive = true;
    const load = async () => {
      setTimesLoading(true);
      setSlot(null);
      const end = addDaysKey(date, 1);
      try {
        const r = await adminFetch(
          `/api/v1/calendly/event_type_available_times?event_type=${sid}` +
            `&start_time=${date}T00:00:00Z&end_time=${end}T00:00:00Z`
        );
        const d = r.ok ? await r.json() : { collection: [] };
        if (alive) setTimes(d.collection ?? []);
      } catch {
        if (alive) setTimes([]);
      } finally {
        if (alive) setTimesLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [sid, date]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot) {
      setError("Pick a time slot first.");
      return;
    }
    setBusy(true);
    setError(null);
    const digits = phone.replace(/\D/g, "");
    const fallbackEmail = `guest-${digits || Date.now()}@noemail.local`;
    const res = await adminFetch(`/api/v1/calendly/scheduled_events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: sid,
        start_time: slot,
        invitee: {
          name,
          email: email.trim() || fallbackEmail,
          phone: phone || undefined,
        },
        guests: guestCount,
        ...(needsCars && carTypes.length > 0 ? { car_types: carTypes } : {}),
        special_request: specialRequest.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(
        res.status === 409
          ? "That slot is full or taken. Pick another time."
          : b.detail ?? "Could not create the booking."
      );
      setBusy(false);
      return;
    }
    const created = await res.json().catch(() => null);
    const uri: string | undefined = created?.resource?.uri;
    if (uri) {
      await adminFetch(`/api/v1/calendly/scheduled_events/${bookingId(uri)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seen: true }),
      }).catch(() => {});
    }
    setBusy(false);
    await onCreated();
  };

  const inputCls =
    "w-full rounded-full border border-eoe-espresso/15 bg-white px-3.5 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-eoe-ink/45 px-0 py-0 backdrop-blur-sm sm:items-start sm:px-4 sm:py-10"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-eoe-espresso/10 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl tracking-wide text-eoe-espresso">
              New booking
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-eoe-espresso/75">
              For guests booking by phone or message. No online payment;
              marked as pays at restaurant.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 text-lg leading-none text-eoe-espresso/70 hover:text-eoe-espresso"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Experience
            </span>
            <select
              value={sid}
              onChange={(e) => {
                setSid(e.target.value);
                setCarTypes([]);
              }}
              className={inputCls}
            >
              {types.map((t) => (
                <option key={t.uri} value={serviceId(t.uri)}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Date (Fri to Sun)
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(isOpenDayKey(next) ? next : nearestOpenDayKey(next));
              }}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Guests
            </span>
            <input
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className={inputCls}
            />
          </label>
          {needsCars && (
            <>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
                  Cars to wash (optional, max {MAX_CARS_PER_SESSION})
                </span>
                <input
                  type="number"
                  min={0}
                  max={MAX_CARS_PER_SESSION}
                  value={carTypes.length}
                  onChange={(e) =>
                    resizeTypes(Math.trunc(Number(e.target.value)) || 0)
                  }
                  className={inputCls}
                />
              </label>
              {carTypes.map((id, i) => (
                <label key={i} className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
                    Car {i + 1} type
                  </span>
                  <select
                    value={id}
                    onChange={(e) =>
                      setCarTypes((prev) =>
                        prev.map((t, idx) => (idx === i ? e.target.value : t))
                      )
                    }
                    className={inputCls}
                  >
                    {CAR_TYPES.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} (from {money(o.min_cents)})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {carTypes.length === 0 && (
                <p className="sm:col-span-2 text-[11px] text-eoe-espresso/70">
                  No car wash yet. You can add cars later from the booking
                  details; any balance is settled on arrival.
                </p>
              )}
            </>
          )}
        </div>

        {needsCars && priceCents > 0 && (
          <p className="mt-3 rounded-xl bg-eoe-ivory px-3 py-2 text-[11px] leading-relaxed text-eoe-espresso/80">
            Guide only (settled at restaurant): {money(priceCents)} ×{" "}
            {guestCount} guests
            {washMin > 0 ? ` + ${money(washMin)} car wash minimum` : ""}
            {` = ${money(priceCents * guestCount + washMin)}`}. No online
            charge for manual bookings.
          </p>
        )}

        <div className="mt-4">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
            Time
          </span>
          <div className="flex flex-wrap gap-2">
            {timesLoading && (
              <p className="text-xs text-eoe-espresso/70">Loading…</p>
            )}
            {!timesLoading && times.length === 0 && (
              <p className="text-xs text-eoe-espresso/70">
                Closed / no open times on this day.
              </p>
            )}
            {times.map((t) => (
              <button
                key={t.start_time}
                type="button"
                onClick={() => setSlot(t.start_time)}
                className={`flex flex-col items-center rounded-xl border px-3 py-1.5 text-sm transition ${
                  slot === t.start_time
                    ? "border-eoe-espresso bg-eoe-espresso text-eoe-ivory"
                    : "border-eoe-espresso/20 text-eoe-espresso hover:border-eoe-gold"
                }`}
              >
                {timeOf(t.start_time)}
                {shared && (
                  <span
                    className={`text-[10px] ${
                      slot === t.start_time
                        ? "text-eoe-ivory/70"
                        : "text-eoe-espresso/70"
                    }`}
                  >
                    {t.invitees_remaining} seats
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Guest name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Phone
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Email (optional)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Special request (optional)
            </span>
            <textarea
              value={specialRequest}
              onChange={(e) => setSpecialRequest(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Anniversary, birthday, flowers, proposal…"
              className="w-full rounded-2xl border border-eoe-espresso/15 bg-white px-3.5 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
              Internal notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. booked via WhatsApp, window table"
              className="w-full rounded-2xl border border-eoe-espresso/15 bg-white px-3.5 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-eoe-espresso/20 px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-eoe-ivory"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !slot || !name.trim()}
            className="rounded-full bg-eoe-espresso px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create booking"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- home cocktail special ----------
type SpecialResource = {
  enabled: boolean;
  eyebrow: string;
  image_src: string;
  image_alt: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  has_upload: boolean;
};

function SpecialsPanel() {
  const { data, error, isLoading, mutate } = useSWR<{ resource: SpecialResource }>(
    "/api/admin/specials/cocktail",
    fetcher
  );
  const resource = data?.resource;
  const [enabled, setEnabled] = useState(true);
  const [eyebrow, setEyebrow] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("#booking");
  const [imageSrc, setImageSrc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [clearUpload, setClearUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewBump, setPreviewBump] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!resource) return;
    setEnabled(resource.enabled);
    setEyebrow(resource.eyebrow);
    setImageAlt(resource.image_alt);
    setCtaLabel(resource.cta_label);
    setCtaHref(resource.cta_href);
    setImageSrc(resource.image_src);
    setFile(null);
    setClearUpload(false);
  }, [resource]);

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const dirty =
    !!resource &&
    (enabled !== resource.enabled ||
      eyebrow !== resource.eyebrow ||
      imageAlt !== resource.image_alt ||
      ctaLabel !== resource.cta_label ||
      ctaHref !== resource.cta_href ||
      imageSrc !== resource.image_src ||
      file != null ||
      clearUpload);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.set("enabled", enabled ? "true" : "false");
      form.set("eyebrow", eyebrow);
      form.set("image_alt", imageAlt);
      form.set("cta_label", ctaLabel);
      form.set("cta_href", ctaHref);
      form.set("image_src", imageSrc);
      if (clearUpload) form.set("clear_image_upload", "true");
      if (file) form.set("image", file);
      const res = await adminFetch("/api/admin/specials/cocktail", {
        method: "PATCH",
        body: form,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.detail ?? "Could not save");
        return;
      }
      setMsg("Saved ✓");
      setFile(null);
      setClearUpload(false);
      setPreviewBump((n) => n + 1);
      await mutate();
    } catch {
      setMsg("Could not save");
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = localPreview
    ? localPreview
    : clearUpload
      ? imageSrc || "/specials/cocktail-friday-sunday.jpg"
      : `${resource?.image_url ?? imageSrc}?v=${previewBump}`;

  return (
    <section className="rounded-2xl border border-eoe-espresso/12 bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
        Home invitation
      </p>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-eoe-espresso/75">
        Controls the cocktail special that appears when guests open the website.
        The eyebrow is the small line above the flyer; offer copy printed on the
        poster itself only changes when you upload a new image. Turn it off
        anytime, swap the flyer, or update the button.
      </p>

      {isLoading && (
        <p className="mt-4 text-sm text-eoe-espresso/70">Loading…</p>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-700">Could not load special.</p>
      )}

      {resource && (
        <form onSubmit={save} className="mt-5 grid gap-6 lg:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm text-eoe-espresso">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-4 rounded border-eoe-espresso/30"
              />
              Show on the website
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                Eyebrow
              </span>
              <input
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                Image description (alt text)
              </span>
              <textarea
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                rows={3}
                maxLength={400}
                className="mt-1 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                  Button label
                </span>
                <input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  maxLength={80}
                  className="mt-1 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                  Button link
                </span>
                <input
                  value={ctaHref}
                  onChange={(e) => setCtaHref(e.target.value)}
                  maxLength={300}
                  placeholder="#booking"
                  className="mt-1 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
                />
              </label>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                Flyer image
              </p>
              <p className="mt-1 text-xs text-eoe-espresso/65">
                Upload a new poster (JPEG/PNG/WebP, max 1.5&nbsp;MB), or keep the
                default path below.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  setFile(next);
                  if (next) setClearUpload(false);
                }}
                className="mt-2 block w-full text-sm text-eoe-espresso file:mr-3 file:rounded-full file:border-0 file:bg-eoe-espresso file:px-3 file:py-1.5 file:text-[10px] file:uppercase file:tracking-[0.16em] file:text-eoe-ivory"
              />
              {(resource.has_upload || file) && !clearUpload && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setClearUpload(true);
                  }}
                  className="mt-2 text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:text-eoe-espresso"
                >
                  Remove upload · use path
                </button>
              )}
              <label className="mt-3 block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                  Fallback image path
                </span>
                <input
                  value={imageSrc}
                  onChange={(e) => setImageSrc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2 font-mono text-xs text-eoe-espresso outline-none focus:border-eoe-gold"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={busy || !dirty}
                className="rounded-full bg-eoe-espresso px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save special"}
              </button>
              {msg && (
                <span className="text-xs text-eoe-espresso/80">{msg}</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
              Preview
            </p>
            <div className="mt-2 overflow-hidden rounded-2xl border border-eoe-espresso/12 bg-[#2a1a12] p-3">
              <p className="mb-2 text-center text-[9px] uppercase tracking-[0.24em] text-eoe-ivory/80">
                {eyebrow || "—"}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={imageAlt || "Special preview"}
                className="mx-auto h-auto max-h-72 w-full object-contain"
              />
              <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-eoe-ivory/90">
                {ctaLabel || "—"}
              </p>
            </div>
            {resource.has_upload && !clearUpload && !file && (
              <p className="mt-2 text-[11px] text-eoe-espresso/65">
                Using uploaded flyer
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

// ---------- seat capacity settings ----------
function SeatSettings({
  services,
  onSaved,
}: {
  services: EventType[];
  onSaved: () => void;
}) {
  const shared = services.filter((s) => s.exclusive === false);
  return (
    <section className="rounded-2xl border border-eoe-espresso/12 bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
        Seats per time slot
      </p>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-eoe-espresso/75">
        How many guests can book the same café slot before it shows as full.
        Events stay one booking per slot and aren&apos;t listed here.
      </p>
      <div className="mt-4 space-y-3">
        {shared.length === 0 && (
          <p className="text-sm text-eoe-espresso/70">
            No shared experiences yet.
          </p>
        )}
        {shared.map((s) => (
          <SeatRow key={s.uri} s={s} onSaved={onSaved} />
        ))}
      </div>

      {shared.length > 0 && <PerSlotSeats services={shared} />}
    </section>
  );
}

type SlotUsage = {
  start_time: string;
  capacity: number;
  booked: number;
  remaining: number;
  overridden: boolean;
};

// Per-slot seats: see booked / left for each slot on a date and override a
// specific slot's capacity (e.g. extra tables for one sitting).
function PerSlotSeats({ services }: { services: EventType[] }) {
  const [sid, setSid] = useState("");
  const [date, setDate] = useState(() => nearestOpenDayKey());
  const [slots, setSlots] = useState<SlotUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const activeSid = sid || (services[0] ? serviceId(services[0].uri) : "");

  const load = useCallback(async () => {
    if (!activeSid || !date) return;
    setLoading(true);
    try {
      const res = await adminFetch(
        `/api/v1/calendly/admin/slots?event_type=${activeSid}&date=${date}`
      );
      const d = res.ok ? await res.json() : { collection: [] };
      setSlots(d.collection ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [activeSid, date]);

  useEffect(() => {
    load();
  }, [load]);

  const onDateChange = (raw: string) => {
    if (!raw) return;
    if (isOpenDayKey(raw)) {
      setDate(raw);
      return;
    }
    // Snap to the next open day (Fri / Sat / Sun).
    setDate(nearestOpenDayKey(raw));
  };

  return (
    <div className="mt-5 border-t border-eoe-espresso/10 pt-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
        Seats on a specific day
      </p>
      <p className="mt-1 text-xs text-eoe-espresso/70">
        Only Friday, Saturday and Sunday are open.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={activeSid}
          onChange={(e) => setSid(e.target.value)}
          className="rounded-full border border-eoe-espresso/15 bg-white px-3 py-1.5 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
        >
          {services.map((s) => (
            <option key={s.uri} value={serviceId(s.uri)}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          onBlur={() => {
            if (!isOpenDayKey(date)) setDate(nearestOpenDayKey(date));
          }}
          className="rounded-full border border-eoe-espresso/15 bg-white px-3 py-1.5 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
        />
      </div>
      <div className="mt-3 space-y-2">
        {loading && <p className="text-xs text-eoe-espresso/70">Loading…</p>}
        {!loading && slots.length === 0 && (
          <p className="text-xs text-eoe-espresso/70">
            Closed / no slots on this day.
          </p>
        )}
        {slots.map((slot) => (
          <SlotSeatRow
            key={`${slot.start_time}-${slot.booked}-${slot.remaining}`}
            sid={activeSid}
            slot={slot}
            onChanged={load}
          />
        ))}
      </div>
    </div>
  );
}

function SlotSeatRow({
  sid,
  slot,
  onChanged,
}: {
  sid: string;
  slot: SlotUsage;
  onChanged: () => void;
}) {
  // The editable value is SEATS LEFT; saving adjusts "booked", not capacity.
  const [value, setValue] = useState(String(slot.remaining));
  const [busy, setBusy] = useState(false);
  const dirty = value !== "" && Number(value) !== slot.remaining;

  const patch = async (bodyExtra: object) => {
    setBusy(true);
    try {
      await adminFetch(`/api/v1/calendly/admin/slots`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: sid,
          start_time: slot.start_time,
          ...bodyExtra,
        }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="w-14 font-display text-base text-eoe-espresso">
        {timeOf(slot.start_time)}
      </span>
      <span className="text-xs text-eoe-espresso/75">
        {slot.booked} booked of {slot.capacity}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 rounded-full border border-eoe-espresso/15 bg-white px-3 py-1 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
        />
        <span className="text-[11px] text-eoe-espresso/70">seats left</span>
        <button
          onClick={() => patch({ seats_left: Number(value) })}
          disabled={busy || !dirty || Number(value) < 0}
          className="rounded-full bg-eoe-espresso px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:opacity-40"
        >
          Save
        </button>
        {slot.overridden && (
          <button
            onClick={() => patch({ reset: true })}
            disabled={busy}
            className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:text-eoe-espresso"
          >
            Reset
          </button>
        )}
      </span>
    </div>
  );
}

function SeatRow({ s, onSaved }: { s: EventType; onSaved: () => void }) {
  const [value, setValue] = useState(String(s.capacity ?? 1));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = value !== "" && Number(value) !== (s.capacity ?? 1);

  const save = async () => {
    const capacity = Number(value);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setMsg("Enter a whole number ≥ 1");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await adminFetch(
      `/api/v1/calendly/event_types/${serviceId(s.uri)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacity }),
      }
    );
    setBusy(false);
    if (res.ok) {
      setMsg("Saved ✓");
      onSaved();
      setTimeout(() => setMsg(null), 1600);
    } else {
      const b = await res.json().catch(() => ({}));
      setMsg(b.detail ?? "Failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex min-w-[190px] items-center gap-2 text-sm text-eoe-espresso">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: s.color }}
        />
        {s.name}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 rounded-full border border-eoe-espresso/15 bg-white px-3 py-1.5 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
      />
      <span className="text-xs text-eoe-espresso/70">seats / slot</span>
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="rounded-full bg-eoe-espresso px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] text-eoe-ivory transition hover:bg-eoe-espresso/90 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {msg && <span className="text-[11px] text-eoe-espresso/80">{msg}</span>}
    </div>
  );
}

// ---------- KPI ----------
function Kpi({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "warn" | "muted";
  onClick?: () => void;
}) {
  const cardCls =
    tone === "primary"
      ? "border-eoe-gold/50 bg-eoe-gold/12"
      : "border-eoe-espresso/10 bg-white";
  const valueStyle = tone === "primary" ? { color: GOLD_TEXT } : undefined;
  const valueCls =
    tone === "warn"
      ? "text-amber-600"
      : tone === "muted"
        ? "text-eoe-espresso/80"
        : "text-eoe-ink";
  const shared = `rounded-2xl border px-3.5 py-3.5 text-left shadow-sm sm:px-5 sm:py-4 ${cardCls} ${
    onClick
      ? "cursor-pointer transition hover:border-eoe-espresso/25 hover:shadow-md active:scale-[0.99]"
      : ""
  }`;
  const body = (
    <>
      <p className="text-[10px] uppercase tracking-[0.18em] text-eoe-espresso/75 sm:text-[11px] sm:tracking-[0.22em]">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl sm:mt-2 sm:text-3xl ${valueCls}`}
        style={valueStyle}
      >
        {value}
      </p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shared}>
        {body}
      </button>
    );
  }
  return <div className={shared}>{body}</div>;
}

// ---------- 14-day load strip ----------
function LoadStrip({
  days,
  max,
  today,
}: {
  days: { key: string; count: number }[];
  max: number;
  today: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <section className="mt-4 rounded-2xl border border-eoe-espresso/10 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
          Next 14 days
        </p>
        <p className="text-[11px] text-eoe-espresso/70">bookings per day</p>
      </div>
      <div className="relative mt-4 flex items-end gap-1.5" style={{ height: 72 }}>
        {days.map((d, i) => {
          const h = d.count === 0 ? 3 : Math.round((d.count / max) * 60) + 6;
          const isToday = d.key === today;
          return (
            <div
              key={d.key}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-eoe-espresso px-2.5 py-1.5 text-[11px] font-medium text-eoe-ivory shadow-lg">
                  {shortDay(d.key)} · {d.count}{" "}
                  {d.count === 1 ? "booking" : "bookings"}
                </div>
              )}
              <div
                className="w-full rounded-md transition-opacity"
                style={{
                  height: h,
                  backgroundColor: d.count === 0 ? "rgba(122,79,63,0.12)" : GOLD,
                  opacity: hover === null || hover === i ? 1 : 0.55,
                }}
              />
              <span
                className={`mt-1.5 text-[10px] ${
                  isToday ? "font-semibold" : "text-eoe-espresso/70"
                }`}
                style={isToday ? { color: GOLD_TEXT } : undefined}
              >
                {d.key.slice(8, 10)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- controls ----------
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex max-w-full flex-nowrap rounded-full border border-eoe-espresso/15 bg-white p-1 text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.16em]">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`min-h-10 shrink-0 rounded-full px-3 py-2 font-semibold transition sm:px-3.5 ${
            value === v
              ? "bg-eoe-gold text-eoe-ivory"
              : "font-normal text-eoe-espresso/80 hover:text-eoe-espresso"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex w-full rounded-full border border-eoe-espresso/15 bg-white p-1 text-[11px] uppercase tracking-[0.16em] sm:w-auto">
      {(
        [
          ["agenda", "Agenda"],
          ["table", "List"],
        ] as [View, string][]
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`min-h-10 flex-1 rounded-full px-3.5 py-2 font-semibold transition sm:flex-none ${
            value === v
              ? "bg-eoe-gold text-eoe-ivory"
              : "font-normal text-eoe-espresso/80 hover:text-eoe-espresso"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------- status badge ----------
function isAwaitingHold(b: ScheduledEvent) {
  return (
    b.status !== "canceled" &&
    b.payment_status === "unpaid" &&
    !b.pay_on_arrival
  );
}

function heldMinutes(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function heldAgeLabel(iso: string): string {
  const m = heldMinutes(iso);
  if (m < 1) return "Held just now";
  if (m < 60) return `Held ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Held ${h}h`;
  return `Held ${Math.floor(h / 24)}d`;
}

function statusOf(b: ScheduledEvent) {
  if (b.status === "canceled")
    return {
      label: "Cancelled",
      cls: "bg-eoe-espresso/8 text-eoe-espresso/70",
      age: null as string | null,
      stale: false,
    };
  if (b.payment_status === "partially_paid")
    return {
      label: "Partially paid",
      cls: "bg-orange-100 text-orange-800",
      age: null as string | null,
      stale: false,
    };
  if (b.payment_status === "paid")
    return {
      label: "Paid",
      cls: "bg-emerald-100 text-emerald-700",
      age: null as string | null,
      stale: false,
    };
  // Manual (phone/walk-in) bookings: no online checkout, settled at the venue.
  if (b.pay_on_arrival)
    return {
      label: "Pays at restaurant",
      cls: "bg-sky-100 text-sky-700",
      age: null as string | null,
      stale: false,
    };
  const stale = heldMinutes(b.created_at) >= 30;
  return {
    label: "Awaiting payment",
    cls: stale ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
    age: heldAgeLabel(b.created_at),
    stale,
  };
}

// ---------- agenda card ----------
function BookingCard({
  b,
  color,
  shared,
  onOpen,
  onCancel,
  onReschedule,
}: {
  b: ScheduledEvent;
  color: string;
  shared: boolean;
  onOpen: () => void;
  onCancel: (uri: string) => Promise<void>;
  onReschedule: (uri: string, startIso: string) => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const st = statusOf(b);
  const cancelled = b.status === "canceled";

  const doCancel = async () => {
    setBusy(true);
    try {
      await onCancel(b.uri);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border shadow-sm ${
        cancelled
          ? "border-eoe-espresso/8 bg-eoe-ivory/70"
          : "border-eoe-espresso/10 bg-white"
      } px-3.5 py-3.5 sm:px-5 sm:py-4`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 gap-3 rounded-xl text-left transition active:bg-eoe-ivory/80 sm:gap-4 sm:hover:bg-eoe-ivory/70"
          >
            <div className="w-12 shrink-0 text-center sm:w-14">
              <p className="font-display text-base text-eoe-espresso sm:text-lg">
                {timeOf(b.start_time)}
              </p>
              <p className="text-[10px] text-eoe-espresso/70">
                {timeOf(b.end_time)}
              </p>
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <p className="truncate text-base font-medium text-eoe-ink sm:text-sm">
                {b.invitee.name}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-eoe-espresso sm:text-xs sm:font-medium">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 truncate">{b.name}</span>
                <span className="text-eoe-espresso/70">
                  · {b.guests} {b.guests === 1 ? "guest" : "guests"}
                  {b.cars != null && b.cars > 0
                    ? ` · ${b.cars} ${b.cars === 1 ? "car" : "cars"}`
                    : ""}
                </span>
              </p>
              <p className="mt-1 truncate text-xs text-eoe-espresso/75">
                {b.invitee.phone ||
                  displayEmail(b.invitee.email) ||
                  "No contact"}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs">
            <span
              className={`max-w-[9.5rem] rounded-full px-2.5 py-1 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide sm:max-w-none sm:px-3 ${st.cls}`}
            >
              {st.label}
            </span>
            {st.age && (
              <span
                className={
                  st.stale ? "font-medium text-rose-600" : "text-eoe-espresso/75"
                }
              >
                {st.age}
              </span>
            )}
            {(b.payment_status === "paid" ||
              b.payment_status === "partially_paid") && (
              <span className="text-right text-[11px] text-eoe-espresso/75">
                {money(b.payment_amount_cents)}
                {b.payment_status === "partially_paid" ? " due" : ""}
              </span>
            )}
          </div>
        </div>

        {b.notes && (
          <p className="whitespace-pre-line rounded-lg bg-eoe-ivory px-3 py-2 text-xs text-eoe-espresso/85">
            {b.notes}
          </p>
        )}
        {b.special_request?.trim() && (
          <SpecialRequestBanner text={b.special_request} />
        )}

        {!cancelled &&
          (confirming ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-eoe-espresso/8 pt-3">
              <button
                onClick={doCancel}
                disabled={busy}
                className="min-h-11 flex-1 rounded-full bg-rose-100 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-rose-700 hover:bg-rose-200 disabled:opacity-50 sm:flex-none"
              >
                {busy ? "…" : "Confirm cancel"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="min-h-11 px-3 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:text-eoe-espresso"
              >
                Keep
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 border-t border-eoe-espresso/8 pt-3">
              <button
                onClick={onOpen}
                className="min-h-11 rounded-full border border-eoe-espresso/20 px-2 py-2 text-[11px] uppercase tracking-[0.14em] text-eoe-espresso hover:bg-eoe-espresso/5"
              >
                Open
              </button>
              <button
                onClick={() => setRescheduling((v) => !v)}
                className="min-h-11 rounded-full border border-eoe-espresso/20 px-2 py-2 text-[11px] uppercase tracking-[0.14em] text-eoe-espresso hover:bg-eoe-espresso/5"
              >
                {rescheduling ? "Close" : "Move"}
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="min-h-11 rounded-full border border-eoe-espresso/20 px-2 py-2 text-[11px] uppercase tracking-[0.14em] text-eoe-espresso hover:bg-eoe-espresso/5"
              >
                Cancel
              </button>
            </div>
          ))}
      </div>

      {rescheduling && !cancelled && (
        <RescheduleControl
          b={b}
          shared={shared}
          onReschedule={onReschedule}
          onDone={() => setRescheduling(false)}
        />
      )}
    </div>
  );
}

// Inline admin reschedule: pick a new date + available time (seats shown to the
// admin only) and move the booking, freeing the old slot's seats.
function RescheduleControl({
  b,
  shared,
  onReschedule,
  onDone,
}: {
  b: ScheduledEvent;
  shared: boolean;
  onReschedule: (uri: string, startIso: string) => Promise<string | null>;
  onDone: () => void;
}) {
  const [date, setDate] = useState(dayKey(b.start_time));
  const [times, setTimes] = useState<
    { start_time: string; invitees_remaining: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sid = serviceId(b.event_type);
  const todayKey = venueTodayKey();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const end = addDaysKey(date, 1);
      try {
        const r = await adminFetch(
          `/api/v1/calendly/event_type_available_times?event_type=${sid}` +
            `&start_time=${date}T00:00:00Z&end_time=${end}T00:00:00Z`
        );
        const d = r.ok ? await r.json() : { collection: [] };
        if (alive) setTimes(d.collection ?? []);
      } catch {
        if (alive) setTimes([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [date, sid]);

  const move = async (startIso: string) => {
    setBusy(true);
    setError(null);
    const err = await onReschedule(b.uri, startIso);
    setBusy(false);
    if (err) setError(err);
    else onDone();
  };

  return (
    <div className="mt-4 rounded-xl border border-eoe-espresso/10 bg-eoe-ivory/60 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/75">
          Move to
        </span>
        <input
          type="date"
          value={date}
          min={todayKey}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-11 w-full rounded-full border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold sm:w-auto sm:min-h-0 sm:py-1.5"
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {loading && <p className="col-span-3 text-xs text-eoe-espresso/70">Loading…</p>}
        {!loading && times.length === 0 && (
          <p className="col-span-3 text-xs text-eoe-espresso/70">
            No open times on this day.
          </p>
        )}
        {times.map((t) => (
          <button
            key={t.start_time}
            disabled={busy}
            onClick={() => move(t.start_time)}
            className="flex min-h-11 flex-col items-center justify-center rounded-xl border border-eoe-espresso/20 px-2 py-2 text-sm text-eoe-espresso transition hover:border-eoe-gold hover:bg-white disabled:opacity-50 sm:min-h-0 sm:px-3 sm:py-1.5"
          >
            {timeOf(t.start_time)}
            {shared && (
              <span className="text-[10px] text-eoe-espresso/70">
                {t.invitees_remaining} seats
              </span>
            )}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

// ---------- payments ----------
function PaymentsTable({
  rows,
  colorFor,
  onOpenDetail,
}: {
  rows: ScheduledEvent[];
  colorFor: (uri: string) => string;
  onOpenDetail: (uri: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-eoe-espresso/15 bg-white/60 px-6 py-12 text-center text-sm text-eoe-espresso/80">
        No payments match this filter.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2.5 lg:hidden">
        {rows.map((b) => (
          <BookingMobileRow
            key={b.uri}
            b={b}
            color={colorFor(b.event_type)}
            today={venueTodayKey()}
            onOpen={() => onOpenDetail(b.uri)}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-eoe-espresso/10 bg-white shadow-sm lg:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-eoe-ivory text-[10px] uppercase tracking-[0.18em] text-eoe-espresso/70">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Experience</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const st = statusOf(b);
              return (
                <tr
                  key={b.uri}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDetail(b.uri)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDetail(b.uri);
                    }
                  }}
                  className="cursor-pointer border-t border-eoe-espresso/8 text-eoe-ink transition hover:bg-eoe-ivory/80"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <div>{shortDay(dayKey(b.start_time))}</div>
                    <div className="text-xs text-eoe-espresso/70">
                      {timeOf(b.start_time)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{b.invitee.name}</div>
                    <div className="text-xs text-eoe-espresso/70">
                      {displayEmail(b.invitee.email) || b.invitee.phone || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorFor(b.event_type) }}
                      />
                      {b.name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {b.payment_status === "paid" ||
                    b.payment_status === "partially_paid"
                      ? money(b.payment_amount_cents)
                      : b.pay_on_arrival
                        ? "At restaurant"
                        : "Unpaid"}
                    {b.payment_status === "partially_paid" && (
                      <span className="mt-0.5 block text-[11px] text-orange-700">
                        Balance on arrival
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${st.cls}`}
                    >
                      {st.label}
                    </span>
                    {st.age && (
                      <span
                        className={`mt-1 block text-[11px] ${
                          st.stale
                            ? "font-medium text-rose-600"
                            : "text-eoe-espresso/70"
                        }`}
                      >
                        {st.age}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- table ----------
function BookingMobileRow({
  b,
  color,
  today,
  active,
  onOpen,
}: {
  b: ScheduledEvent;
  color: string;
  today: string;
  active?: boolean;
  onOpen: () => void;
}) {
  const st = statusOf(b);
  const cancelled = b.status === "canceled";
  const day = dayKey(b.start_time);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3.5 py-3.5 text-left shadow-sm transition active:scale-[0.99] ${
        cancelled
          ? "border-eoe-espresso/8 bg-eoe-ivory/70 text-eoe-espresso/70"
          : "border-eoe-espresso/10 bg-white text-eoe-ink"
      } ${active ? "ring-2 ring-eoe-gold/40" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{b.invitee.name}</p>
        <p className="mt-0.5 text-xs text-eoe-espresso/80">
          {day === today ? "Today" : shortDay(day)} · {timeOf(b.start_time)} ·{" "}
          {b.guests} {b.guests === 1 ? "guest" : "guests"}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs text-eoe-espresso">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate">{b.name}</span>
        </p>
        <SpecialRequestBanner text={b.special_request} compact />
      </div>
      <span
        className={`max-w-[7.5rem] shrink-0 rounded-full px-2.5 py-1 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide ${st.cls}`}
      >
        {st.label}
      </span>
    </button>
  );
}

function TableView({
  rows,
  colorFor,
  today,
  activeUri,
  onOpenDetail,
}: {
  rows: ScheduledEvent[];
  colorFor: (uri: string) => string;
  today: string;
  activeUri: string | null;
  onOpenDetail: (uri: string) => void;
}) {
  return (
    <>
      <div className="mt-3 space-y-2.5 lg:hidden">
        {rows.map((b) => (
          <BookingMobileRow
            key={b.uri}
            b={b}
            color={colorFor(b.event_type)}
            today={today}
            active={activeUri === b.uri}
            onOpen={() => onOpenDetail(b.uri)}
          />
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-eoe-espresso/10 bg-white shadow-sm lg:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-eoe-ivory text-[10px] uppercase tracking-[0.18em] text-eoe-espresso/70">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Experience</th>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Pax</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const st = statusOf(b);
              const cancelled = b.status === "canceled";
              return (
                <tr
                  key={b.uri}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenDetail(b.uri)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenDetail(b.uri);
                    }
                  }}
                  className={`cursor-pointer border-t border-eoe-espresso/8 transition hover:bg-eoe-ivory/80 ${
                    cancelled ? "text-eoe-espresso/70" : "text-eoe-ink"
                  } ${activeUri === b.uri ? "bg-eoe-gold/10" : ""}`}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    {dayKey(b.start_time) === today ? (
                      <span
                        className="font-semibold"
                        style={{ color: GOLD_TEXT }}
                      >
                        Today
                      </span>
                    ) : (
                      shortDay(dayKey(b.start_time))
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {timeOf(b.start_time)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorFor(b.event_type) }}
                      />
                      {b.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>{b.invitee.name}</div>
                    <div className="text-xs text-eoe-espresso/70">
                      {displayEmail(b.invitee.email) ||
                        b.invitee.phone ||
                        "Tap to edit"}
                    </div>
                    <SpecialRequestBanner text={b.special_request} compact />
                  </td>
                  <td className="px-4 py-3">
                    {b.guests}
                    {b.cars != null && b.cars > 0 ? (
                      <span className="block text-[11px] text-eoe-espresso/70">
                        {b.cars} {b.cars === 1 ? "car" : "cars"}
                        {b.car_labels?.length
                          ? ` · ${b.car_labels.join(", ")}`
                          : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {b.payment_status === "paid" ||
                    b.payment_status === "partially_paid"
                      ? money(b.payment_amount_cents)
                      : b.pay_on_arrival
                        ? "At restaurant"
                        : "n/a"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${st.cls}`}
                    >
                      {st.label}
                    </span>
                    {st.age && (
                      <span
                        className={`mt-1 block text-[11px] ${
                          st.stale
                            ? "font-medium text-rose-600"
                            : "text-eoe-espresso/70"
                        }`}
                      >
                        {st.age}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-eoe-espresso/70">
                      Edit
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BookingDetailModal({
  b,
  color,
  shared,
  allowsCars,
  onClose,
  onCancel,
  onReschedule,
  onEditGuests,
  onEditCars,
  onEditSpecialRequest,
  onReleaseHold,
  onSettlePayment,
}: {
  b: ScheduledEvent;
  color: string;
  shared: boolean;
  allowsCars: boolean;
  onClose: () => void;
  onCancel: (uri: string) => Promise<void>;
  onReschedule: (uri: string, startIso: string) => Promise<string | null>;
  onEditGuests: (uri: string, guests: number) => Promise<string | null>;
  onEditCars: (uri: string, carTypes: string[] | null) => Promise<string | null>;
  onEditSpecialRequest: (
    uri: string,
    specialRequest: string | null
  ) => Promise<string | null>;
  onReleaseHold: (uri: string) => Promise<string | null>;
  onSettlePayment: (uri: string) => Promise<string | null>;
}) {
  const st = statusOf(b);
  const cancelled = b.status === "canceled";
  const awaitingHold = isAwaitingHold(b);
  const paid = b.payment_status === "paid";
  const partial = b.payment_status === "partially_paid";
  const email = displayEmail(b.invitee.email);
  const phone = b.invitee.phone?.trim() || null;

  const [guestVal, setGuestVal] = useState(b.guests);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestErr, setGuestErr] = useState<string | null>(null);
  const [carTypes, setCarTypes] = useState<string[]>(
    () => b.car_types?.slice() ?? []
  );
  const [carBusy, setCarBusy] = useState(false);
  const [carErr, setCarErr] = useState<string | null>(null);
  const [requestVal, setRequestVal] = useState(b.special_request ?? "");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestErr, setRequestErr] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    setGuestVal(b.guests);
    setGuestErr(null);
    setCarTypes(b.car_types?.slice() ?? []);
    setCarErr(null);
    setRequestVal(b.special_request ?? "");
    setRequestErr(null);
    setActionErr(null);
    setReleasing(false);
    setSettling(false);
  }, [b.uri, b.guests, b.car_types, b.special_request]);

  const guestsDirty = guestVal !== b.guests;
  const carsKey = (types: string[]) => types.join(",");
  const carsDirty = carsKey(carTypes) !== carsKey(b.car_types ?? []);
  const requestDirty =
    (requestVal.trim() || null) !== (b.special_request?.trim() || null);

  const resizeCars = (count: number) => {
    const n = Math.min(MAX_CARS_PER_SESSION, Math.max(0, count));
    setCarTypes((prev) => {
      if (prev.length === n) return prev;
      if (n === 0) return [];
      if (prev.length > n) return prev.slice(0, n);
      return [
        ...prev,
        ...Array.from({ length: n - prev.length }, () => "sedan"),
      ];
    });
  };

  const saveGuests = async () => {
    if (!Number.isInteger(guestVal) || guestVal < 1) {
      setGuestErr("Enter a whole number ≥ 1");
      return;
    }
    setGuestBusy(true);
    setGuestErr(null);
    const err = await onEditGuests(b.uri, guestVal);
    setGuestBusy(false);
    if (err) setGuestErr(err);
  };

  const saveCars = async () => {
    setCarBusy(true);
    setCarErr(null);
    const err = await onEditCars(
      b.uri,
      carTypes.length > 0 ? carTypes : null
    );
    setCarBusy(false);
    if (err) setCarErr(err);
  };

  const saveRequest = async () => {
    setRequestBusy(true);
    setRequestErr(null);
    const err = await onEditSpecialRequest(
      b.uri,
      requestVal.trim() ? requestVal.trim() : null
    );
    setRequestBusy(false);
    if (err) setRequestErr(err);
  };

  const doCancel = async () => {
    setBusy(true);
    setActionErr(null);
    try {
      await onCancel(b.uri);
      onClose();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const doRelease = async () => {
    setBusy(true);
    setActionErr(null);
    const err = await onReleaseHold(b.uri);
    setBusy(false);
    if (err) {
      setActionErr(err);
      setReleasing(false);
      return;
    }
    onClose();
  };

  const doSettle = async () => {
    setBusy(true);
    setActionErr(null);
    const err = await onSettlePayment(b.uri);
    setBusy(false);
    if (err) {
      setActionErr(err);
      setSettling(false);
      return;
    }
    setSettling(false);
  };

  const stepCls =
    "flex h-11 w-11 items-center justify-center rounded-full border border-eoe-espresso/20 text-lg leading-none text-eoe-espresso transition hover:bg-eoe-espresso/5 disabled:opacity-40 sm:h-9 sm:w-9";
  const selectCls =
    "min-h-11 w-full rounded-full border border-eoe-espresso/15 bg-white px-3 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-eoe-ink/45 px-0 py-0 backdrop-blur-sm sm:items-start sm:px-4 sm:py-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="booking-detail-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-eoe-espresso/10 bg-white shadow-2xl sm:max-h-[min(92vh,52rem)] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-eoe-espresso/8 px-4 py-4 sm:px-7 sm:pt-7 sm:pb-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/75">
              Booking details
            </p>
            <h2
              id="booking-detail-title"
              className="mt-1 truncate font-display text-xl tracking-wide text-eoe-espresso sm:text-2xl"
            >
              {b.invitee.name}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-eoe-ink">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{b.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-eoe-espresso/15 text-xl leading-none text-eoe-espresso/70 hover:bg-eoe-ivory hover:text-eoe-espresso"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-7 sm:pb-7">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${st.cls}`}
          >
            {st.label}
          </span>
          {st.age && (
            <span
              className={`text-xs ${
                st.stale ? "font-medium text-rose-600" : "text-eoe-espresso/75"
              }`}
            >
              {st.age}
            </span>
          )}
          {(paid || partial) && (
            <span className="text-xs text-eoe-espresso/75">
              {money(b.payment_amount_cents)} deposit
              {partial ? " (balance due)" : ""}
            </span>
          )}
        </div>

        {(paid || partial) && !cancelled && (
          <p className="mt-3 rounded-xl bg-eoe-ivory px-3 py-2 text-[11px] leading-relaxed text-eoe-espresso/80">
            Online deposits are non refundable. Editing guests or cars updates
            the booking only; the amount already paid stays as is. Settle any
            difference on arrival
            {partial ? ", then tap Mark settled below" : ""}.
          </p>
        )}

        {partial && !cancelled && (
          <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50/90 px-4 py-3">
            <p className="text-xs leading-relaxed text-orange-950/85">
              Extra guests or car wash added after the online deposit. Collect
              the balance at the venue, then mark this booking settled.
            </p>
            {settling ? (
              <span className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={doSettle}
                  disabled={busy}
                  className="min-h-11 rounded-full bg-emerald-700 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? "…" : "Confirm settled"}
                </button>
                <button
                  type="button"
                  onClick={() => setSettling(false)}
                  className="min-h-11 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:text-eoe-espresso"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSettling(true)}
                className="mt-3 min-h-11 rounded-full border border-orange-300 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-orange-900 hover:bg-orange-100"
              >
                Mark settled
              </button>
            )}
          </div>
        )}

        {b.special_request?.trim() && (
          <div className="mt-3">
            <SpecialRequestBanner text={b.special_request} />
          </div>
        )}

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-eoe-espresso/8 pb-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
              When
            </dt>
            <dd className="text-right text-eoe-ink">
              {shortDay(dayKey(b.start_time))}
              <span className="block text-xs text-eoe-espresso/75">
                {timeOf(b.start_time)} to {timeOf(b.end_time)}
              </span>
            </dd>
          </div>

          <div className="flex justify-between gap-4 border-b border-eoe-espresso/8 pb-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
              Phone
            </dt>
            <dd className="text-right">
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="font-medium text-eoe-espresso underline-offset-2 hover:underline"
                >
                  {phone}
                </a>
              ) : (
                <span className="text-eoe-espresso/60">Not provided</span>
              )}
            </dd>
          </div>

          <div className="flex justify-between gap-4 border-b border-eoe-espresso/8 pb-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
              Email
            </dt>
            <dd className="max-w-[60%] break-all text-right text-eoe-ink">
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="text-eoe-espresso underline-offset-2 hover:underline"
                >
                  {email}
                </a>
              ) : (
                <span className="text-eoe-espresso/60">Not provided</span>
              )}
            </dd>
          </div>

          <div className="border-b border-eoe-espresso/8 pb-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                Guests
              </dt>
              {cancelled ? (
                <dd className="text-eoe-ink">{b.guests}</dd>
              ) : (
                <dd className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Fewer guests"
                    disabled={guestBusy || guestVal <= 1}
                    onClick={() => setGuestVal((n) => Math.max(1, n - 1))}
                    className={stepCls}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={guestVal}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setGuestVal(Number.isFinite(n) ? n : 1);
                    }}
                    className="w-14 rounded-full border border-eoe-espresso/20 bg-white px-2 py-1.5 text-center text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
                  />
                  <button
                    type="button"
                    aria-label="More guests"
                    disabled={guestBusy}
                    onClick={() => setGuestVal((n) => n + 1)}
                    className={stepCls}
                  >
                    +
                  </button>
                  {guestsDirty && (
                    <button
                      type="button"
                      onClick={saveGuests}
                      disabled={guestBusy}
                      className="ml-1 rounded-full bg-eoe-espresso px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-eoe-ivory disabled:opacity-40"
                    >
                      {guestBusy ? "…" : "Save"}
                    </button>
                  )}
                </dd>
              )}
            </div>
            {guestErr && (
              <p className="mt-2 text-right text-[11px] text-rose-600">
                {guestErr}
              </p>
            )}
            {!cancelled && shared && (
              <p className="mt-2 text-right text-[11px] text-eoe-espresso/70">
                Changing party size rechecks seat capacity for this slot.
              </p>
            )}
          </div>

          {allowsCars && (
            <div className="border-b border-eoe-espresso/8 pb-3">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                  Cars
                </dt>
                {cancelled ? (
                  <dd className="text-right text-eoe-ink">
                    {b.cars ?? 0}
                    {b.car_labels?.length
                      ? ` · ${b.car_labels.join(", ")}`
                      : ""}
                  </dd>
                ) : (
                  <dd className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Fewer cars"
                      disabled={carBusy || carTypes.length <= 0}
                      onClick={() => resizeCars(carTypes.length - 1)}
                      className={stepCls}
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center text-sm text-eoe-ink">
                      {carTypes.length}
                    </span>
                    <button
                      type="button"
                      aria-label="More cars"
                      disabled={
                        carBusy || carTypes.length >= MAX_CARS_PER_SESSION
                      }
                      onClick={() => resizeCars(carTypes.length + 1)}
                      className={stepCls}
                    >
                      +
                    </button>
                    {carsDirty && (
                      <button
                        type="button"
                        onClick={saveCars}
                        disabled={carBusy}
                        className="ml-1 rounded-full bg-eoe-espresso px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-eoe-ivory disabled:opacity-40"
                      >
                        {carBusy ? "…" : "Save"}
                      </button>
                    )}
                  </dd>
                )}
              </div>
              {!cancelled && carTypes.length > 0 && (
                <div className="mt-3 space-y-2">
                  {carTypes.map((id, i) => (
                    <label key={i} className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-eoe-espresso/70">
                        Car {i + 1}
                      </span>
                      <select
                        value={id}
                        disabled={carBusy}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCarTypes((prev) =>
                            prev.map((x, j) => (j === i ? v : x))
                          );
                        }}
                        className={selectCls}
                      >
                        {CAR_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              {!cancelled && carTypes.length === 0 && (
                <p className="mt-2 text-right text-[11px] text-eoe-espresso/70">
                  No car wash on this booking. Use + to add one.
                </p>
              )}
              {carErr && (
                <p className="mt-2 text-right text-[11px] text-rose-600">
                  {carErr}
                </p>
              )}
            </div>
          )}

          {!cancelled && (
            <div className="border-b border-eoe-espresso/8 pb-3">
              <dt className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                Special request
              </dt>
              <dd>
                <textarea
                  value={requestVal}
                  onChange={(e) => setRequestVal(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Anniversary, birthday, flowers…"
                  className="w-full rounded-2xl border border-eoe-espresso/15 bg-white px-3.5 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
                />
                {requestDirty && (
                  <button
                    type="button"
                    onClick={saveRequest}
                    disabled={requestBusy}
                    className="mt-2 rounded-full bg-eoe-espresso px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-eoe-ivory disabled:opacity-40"
                  >
                    {requestBusy ? "…" : "Save request"}
                  </button>
                )}
                {requestErr && (
                  <p className="mt-2 text-[11px] text-rose-600">{requestErr}</p>
                )}
              </dd>
            </div>
          )}

          {b.notes && (
            <div className="border-b border-eoe-espresso/8 pb-3">
              <dt className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/75">
                Internal notes
              </dt>
              <dd className="whitespace-pre-line rounded-xl bg-eoe-ivory px-3 py-2 text-xs text-eoe-espresso/85">
                {b.notes}
              </dd>
            </div>
          )}
        </dl>

        {actionErr && (
          <p className="mt-4 text-sm text-rose-600">{actionErr}</p>
        )}

        {!cancelled && awaitingHold && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
            <p className="text-xs leading-relaxed text-amber-900/80">
              Website checkout hold. If the guest abandoned payment, release
              the hold to free this slot.
            </p>
            {releasing ? (
              <span className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={doRelease}
                  disabled={busy}
                  className="min-h-11 rounded-full bg-rose-100 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                >
                  {busy ? "…" : "Confirm release"}
                </button>
                <button
                  type="button"
                  onClick={() => setReleasing(false)}
                  className="min-h-11 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:text-eoe-espresso"
                >
                  Keep hold
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setReleasing(true)}
                className="mt-3 min-h-11 rounded-full border border-amber-300 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-amber-900 hover:bg-amber-100"
              >
                Release hold
              </button>
            )}
          </div>
        )}

        {rescheduling && !cancelled && (
          <RescheduleControl
            b={b}
            shared={shared}
            onReschedule={onReschedule}
            onDone={() => {
              setRescheduling(false);
              onClose();
            }}
          />
        )}
        </div>

        {!cancelled && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-eoe-espresso/10 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-7">
            <button
              type="button"
              onClick={() => setRescheduling((v) => !v)}
              className="min-h-11 flex-1 rounded-full border border-eoe-espresso/20 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso hover:bg-eoe-espresso/5 sm:flex-none"
            >
              {rescheduling ? "Hide move" : "Reschedule"}
            </button>
            {confirming ? (
              <span className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
                <button
                  type="button"
                  onClick={doCancel}
                  disabled={busy}
                  className="min-h-11 rounded-full bg-rose-100 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                >
                  {busy ? "…" : "Confirm cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-11 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:text-eoe-espresso"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="min-h-11 flex-1 rounded-full border border-eoe-espresso/20 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso hover:bg-eoe-espresso/5 sm:flex-none"
              >
                Cancel booking
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
