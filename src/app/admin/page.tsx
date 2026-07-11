"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
const VENUE_TZ = "Africa/Johannesburg";

// Gold used for fills / active states (readable on white as a fill, not as text).
const GOLD = "#9a6552";
const GOLD_TEXT = "#9a6552"; // clay, legible on white (4.8:1)

type ScheduledEvent = {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  end_time: string;
  event_type: string;
  invitee: { name: string; email: string; phone: string | null };
  guests: number;
  notes: string | null;
  payment_status: string;
  payment_provider: string;
  payment_amount_cents?: number | null;
  seen: boolean;
  created_at: string;
};

type EventType = {
  uri: string;
  name: string;
  color: string;
  exclusive?: boolean;
  capacity?: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ---------- helpers ----------
function bookingId(uri: string) {
  return uri.split("/").pop() ?? "";
}
function serviceId(uri: string) {
  return uri.split("/").pop() ?? "";
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

type StatusFilter = "upcoming" | "today" | "past" | "cancelled" | "all";
type View = "agenda" | "table";

// ---------- page ----------
export default function AdminPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [experience, setExperience] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("agenda");

  const today = venueTodayKey();

  const { data, error, isLoading, mutate } = useSWR<{
    collection: ScheduledEvent[];
  }>(
    ADMIN_TOKEN
      ? `/api/v1/calendly/scheduled_events?business_id=${BUSINESS_ID}&count=200`
      : null,
    fetcher,
    { refreshInterval: 20000 }
  );
  const { data: typesData, mutate: mutateTypes } = useSWR<{
    collection: EventType[];
  }>(
    ADMIN_TOKEN
      ? `/api/v1/calendly/event_types?business_id=${BUSINESS_ID}`
      : null,
    fetcher
  );
  const [showSeats, setShowSeats] = useState(false);

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

  const stats = useMemo(() => {
    let upcoming = 0,
      todayCount = 0,
      cancelled = 0,
      deposits = 0,
      awaiting = 0;
    for (const b of all) {
      const key = dayKey(b.start_time);
      if (b.status === "canceled") cancelled++;
      else {
        if (key >= today) upcoming++;
        if (key === today) todayCount++;
        if (b.payment_status === "paid") deposits += b.payment_amount_cents ?? 0;
        else awaiting++;
      }
    }
    return {
      total: all.length,
      upcoming,
      today: todayCount,
      cancelled,
      deposits,
      awaiting,
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((b) => {
      const key = dayKey(b.start_time);
      const cancelled = b.status === "canceled";
      if (statusFilter === "cancelled" && !cancelled) return false;
      if (statusFilter !== "cancelled" && statusFilter !== "all" && cancelled)
        return false;
      if (statusFilter === "upcoming" && key < today) return false;
      if (statusFilter === "today" && key !== today) return false;
      if (statusFilter === "past" && key >= today) return false;
      if (experience !== "all" && serviceId(b.event_type) !== experience)
        return false;
      if (!needle) return true;
      return (
        b.invitee.name.toLowerCase().includes(needle) ||
        b.invitee.email.toLowerCase().includes(needle) ||
        (b.invitee.phone ?? "").toLowerCase().includes(needle) ||
        b.name.toLowerCase().includes(needle)
      );
    });
  }, [all, statusFilter, experience, q, today]);

  const sorted = useMemo(() => {
    const asc = statusFilter === "upcoming" || statusFilter === "today";
    return [...filtered].sort((a, b) =>
      asc
        ? a.start_time.localeCompare(b.start_time)
        : b.start_time.localeCompare(a.start_time)
    );
  }, [filtered, statusFilter]);

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

  const cancel = async (uri: string) => {
    const id = bookingId(uri);
    await fetch(`/api/v1/calendly/scheduled_events/${id}?token=${ADMIN_TOKEN}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "canceled" }),
    });
    await mutate();
  };

  // Returns null on success, or an error message (e.g. slot full).
  const reschedule = async (uri: string, startIso: string) => {
    const id = bookingId(uri);
    const res = await fetch(
      `/api/v1/calendly/scheduled_events/${id}?token=${ADMIN_TOKEN}`,
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
  const editGuests = async (uri: string, guests: number) => {
    const id = bookingId(uri);
    const res = await fetch(
      `/api/v1/calendly/scheduled_events/${id}?token=${ADMIN_TOKEN}`,
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
  const toggleSeen = async (uri: string, seen: boolean) => {
    const id = bookingId(uri);
    await fetch(`/api/v1/calendly/scheduled_events/${id}?token=${ADMIN_TOKEN}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen }),
    });
    await mutate();
  };
  const markAllSeen = async () => {
    await fetch(`/api/v1/calendly/admin/seen?token=${ADMIN_TOKEN}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: true, business_id: Number(BUSINESS_ID) }),
    });
    await mutate();
  };

  return (
    <main className="min-h-screen bg-eoe-ivory px-4 py-12 text-eoe-espresso md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.3em]"
              style={{ color: GOLD_TEXT }}
            >
              Entle Off-Grid Estate
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-[0.12em] text-eoe-espresso">
              Bookings dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell
              items={notifications}
              unseenCount={unseenCount}
              onToggleSeen={toggleSeen}
              onMarkAll={markAllSeen}
            />
            <button
              onClick={() => setShowSeats((v) => !v)}
              className="rounded-full border border-eoe-espresso/20 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-eoe-espresso transition hover:bg-eoe-espresso/5"
            >
              Manage seats
            </button>
            <button
              onClick={() => mutate()}
              className="rounded-full border border-eoe-gold px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-eoe-espresso transition hover:bg-eoe-gold/15"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {showSeats && (
          <SeatSettings services={types} onSaved={() => mutateTypes()} />
        )}

        {!ADMIN_TOKEN && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            Set <code className="text-xs">NEXT_PUBLIC_ADMIN_TOKEN</code> to
            enable the admin view.
          </p>
        )}
        {error && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            Failed to load bookings.
          </p>
        )}

        {/* KPIs */}
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label="Upcoming" value={stats.upcoming} tone="primary" />
          <Kpi label="Today" value={stats.today} />
          <Kpi label="Deposits collected" value={money(stats.deposits)} />
          <Kpi label="Awaiting payment" value={stats.awaiting} tone="warn" />
          <Kpi label="Cancelled" value={stats.cancelled} tone="muted" />
        </section>

        {/* 14-day load */}
        <LoadStrip days={strip.days} max={strip.max} today={today} />

        {/* Controls */}
        <section className="mt-8 flex flex-wrap items-center gap-3">
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
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="rounded-full border border-eoe-espresso/15 bg-white px-4 py-2 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
          >
            <option value="all">All experiences</option>
            {types.map((t) => (
              <option key={t.uri} value={serviceId(t.uri)}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guest, email, phone…"
            className="min-w-[200px] flex-1 rounded-full border border-eoe-espresso/15 bg-white px-4 py-2 text-sm text-eoe-espresso outline-none placeholder:text-eoe-espresso/40 focus:border-eoe-gold"
          />
          <Toggle value={view} onChange={setView} />
        </section>

        {/* Results */}
        <p className="mt-5 text-xs uppercase tracking-[0.2em] text-eoe-espresso/45">
          {sorted.length} {sorted.length === 1 ? "booking" : "bookings"}
        </p>

        {isLoading && (
          <p className="mt-4 text-sm text-eoe-espresso/70">Loading bookings…</p>
        )}
        {!isLoading && sorted.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-eoe-espresso/15 bg-white/60 px-6 py-12 text-center text-sm text-eoe-espresso/60">
            No bookings match this view.
          </div>
        )}

        {view === "agenda" ? (
          <div className="mt-4 space-y-8">
            {grouped.map(([key, items]) => (
              <div key={key}>
                <div className="flex items-baseline justify-between border-b border-eoe-gold/40 pb-2">
                  <h2 className="font-display text-xl tracking-wide text-eoe-espresso">
                    {relativeDay(key, today)}
                  </h2>
                  <span className="text-xs text-eoe-espresso/50">
                    {items.length} · {items.reduce((s, b) => s + b.guests, 0)}{" "}
                    guests
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {items.map((b) => (
                    <BookingCard
                      key={b.uri}
                      b={b}
                      color={colorFor(b.event_type)}
                      shared={sharedFor(b.event_type)}
                      onCancel={cancel}
                      onReschedule={reschedule}
                      onEditGuests={editGuests}
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
            sharedFor={sharedFor}
            onCancel={cancel}
            onReschedule={reschedule}
          />
        )}
      </div>
    </main>
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
  onToggleSeen,
  onMarkAll,
}: {
  items: ScheduledEvent[];
  unseenCount: number;
  onToggleSeen: (uri: string, seen: boolean) => Promise<void>;
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
              <p className="text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/60">
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
                <p className="px-4 py-8 text-center text-sm text-eoe-espresso/50">
                  No bookings yet.
                </p>
              )}
              {items.map((b) => {
                const day = shortDay(dayKey(b.start_time));
                const time = timeOf(b.start_time);
                return (
                  <button
                    key={b.uri}
                    onClick={() => onToggleSeen(b.uri, !b.seen)}
                    title={b.seen ? "Mark unseen" : "Mark seen"}
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
                            ? "text-eoe-espresso/80"
                            : "font-medium text-eoe-espresso"
                        }`}
                      >
                        {b.invitee.name} · {b.name}
                      </span>
                      <span className="block text-xs text-eoe-espresso/55">
                        {day} · {time} · {b.guests}{" "}
                        {b.guests === 1 ? "guest" : "guests"}
                      </span>
                      <span className="block text-[11px] text-eoe-espresso/40">
                        {relTime(b.created_at)}
                        {b.status === "canceled" ? " · cancelled" : ""}
                        {b.payment_status === "paid" ? " · paid" : ""}
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
    <section className="mt-6 rounded-2xl border border-eoe-espresso/12 bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/55">
        Seats per time slot
      </p>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-eoe-espresso/55">
        How many guests can book the same café slot before it shows as full.
        Events stay one booking per slot and aren&apos;t listed here.
      </p>
      <div className="mt-4 space-y-3">
        {shared.length === 0 && (
          <p className="text-sm text-eoe-espresso/50">
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
  const [date, setDate] = useState(venueTodayKey());
  const [slots, setSlots] = useState<SlotUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const activeSid = sid || (services[0] ? serviceId(services[0].uri) : "");

  const load = useCallback(async () => {
    if (!activeSid || !date) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/calendly/admin/slots?event_type=${activeSid}&date=${date}&token=${ADMIN_TOKEN}`
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

  return (
    <div className="mt-5 border-t border-eoe-espresso/10 pt-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/55">
        Seats on a specific day
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
          onChange={(e) => setDate(e.target.value)}
          className="rounded-full border border-eoe-espresso/15 bg-white px-3 py-1.5 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
        />
      </div>
      <div className="mt-3 space-y-2">
        {loading && <p className="text-xs text-eoe-espresso/50">Loading…</p>}
        {!loading && slots.length === 0 && (
          <p className="text-xs text-eoe-espresso/50">
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
      await fetch(`/api/v1/calendly/admin/slots?token=${ADMIN_TOKEN}`, {
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
      <span className="text-xs text-eoe-espresso/55">
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
        <span className="text-[11px] text-eoe-espresso/45">seats left</span>
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
            className="text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/50 hover:text-eoe-espresso"
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
    const res = await fetch(
      `/api/v1/calendly/event_types/${serviceId(s.uri)}?token=${ADMIN_TOKEN}`,
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
      <span className="text-xs text-eoe-espresso/50">seats / slot</span>
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="rounded-full bg-eoe-espresso px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] text-eoe-ivory transition hover:bg-eoe-espresso/90 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {msg && <span className="text-[11px] text-eoe-espresso/60">{msg}</span>}
    </div>
  );
}

// ---------- KPI ----------
function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "warn" | "muted";
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
      ? "text-eoe-espresso/40"
      : "text-eoe-espresso";
  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${cardCls}`}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/55">
        {label}
      </p>
      <p className={`mt-2 font-display text-3xl ${valueCls}`} style={valueStyle}>
        {value}
      </p>
    </div>
  );
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
        <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/55">
          Next 14 days
        </p>
        <p className="text-[11px] text-eoe-espresso/40">bookings per day</p>
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
                  backgroundColor: d.count === 0 ? "rgba(154,101,82,0.08)" : GOLD,
                  opacity: hover === null || hover === i ? 1 : 0.55,
                }}
              />
              <span
                className={`mt-1.5 text-[10px] ${
                  isToday ? "font-semibold" : "text-eoe-espresso/40"
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
    <div className="flex flex-wrap rounded-full border border-eoe-espresso/15 bg-white p-1 text-[11px] uppercase tracking-[0.16em]">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
            value === v
              ? "bg-eoe-gold text-eoe-ivory"
              : "font-normal text-eoe-espresso/60 hover:text-eoe-espresso"
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
    <div className="flex rounded-full border border-eoe-espresso/15 bg-white p-1 text-[11px] uppercase tracking-[0.16em]">
      {(["agenda", "table"] as View[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
            value === v
              ? "bg-eoe-gold text-eoe-ivory"
              : "font-normal text-eoe-espresso/60 hover:text-eoe-espresso"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// ---------- status badge ----------
function statusOf(b: ScheduledEvent) {
  if (b.status === "canceled")
    return { label: "Cancelled", cls: "bg-eoe-espresso/8 text-eoe-espresso/50" };
  if (b.payment_status === "paid")
    return { label: "Paid", cls: "bg-emerald-100 text-emerald-700" };
  return { label: "Awaiting payment", cls: "bg-amber-100 text-amber-700" };
}

// ---------- agenda card ----------
function BookingCard({
  b,
  color,
  shared,
  onCancel,
  onReschedule,
  onEditGuests,
}: {
  b: ScheduledEvent;
  color: string;
  shared: boolean;
  onCancel: (uri: string) => Promise<void>;
  onReschedule: (uri: string, startIso: string) => Promise<string | null>;
  onEditGuests: (uri: string, guests: number) => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [editingGuests, setEditingGuests] = useState(false);
  const [guestVal, setGuestVal] = useState(String(b.guests));
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestErr, setGuestErr] = useState<string | null>(null);
  const st = statusOf(b);
  const cancelled = b.status === "canceled";

  const saveGuests = async () => {
    const n = Number(guestVal);
    if (!Number.isInteger(n) || n < 1) {
      setGuestErr("Enter a whole number ≥ 1");
      return;
    }
    setGuestBusy(true);
    setGuestErr(null);
    const err = await onEditGuests(b.uri, n);
    setGuestBusy(false);
    if (err) setGuestErr(err);
    else setEditingGuests(false);
  };

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
      } px-5 py-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="w-14 shrink-0 text-center">
            <p className="font-display text-lg text-eoe-espresso">
              {timeOf(b.start_time)}
            </p>
            <p className="text-[10px] text-eoe-espresso/45">
              {timeOf(b.end_time)}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-2 font-medium text-eoe-espresso">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {b.name}
              {editingGuests && !cancelled ? (
                <span className="ml-1 inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={guestVal}
                    onChange={(e) => setGuestVal(e.target.value)}
                    className="w-16 rounded-full border border-eoe-espresso/20 bg-white px-2 py-0.5 text-xs text-eoe-espresso outline-none focus:border-eoe-gold"
                  />
                  <button
                    onClick={saveGuests}
                    disabled={guestBusy}
                    className="rounded-full bg-eoe-espresso px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-eoe-ivory disabled:opacity-40"
                  >
                    {guestBusy ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingGuests(false);
                      setGuestVal(String(b.guests));
                      setGuestErr(null);
                    }}
                    className="text-[10px] uppercase tracking-wide text-eoe-espresso/50 hover:text-eoe-espresso"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => !cancelled && setEditingGuests(true)}
                  className="text-xs font-normal text-eoe-espresso/50 hover:text-eoe-espresso"
                >
                  · {b.guests} {b.guests === 1 ? "guest" : "guests"}
                  {!cancelled && " ✎"}
                </button>
              )}
            </p>
            {guestErr && (
              <p className="mt-1 text-[11px] text-rose-600">{guestErr}</p>
            )}
            <p className="mt-1 text-sm text-eoe-espresso/80">{b.invitee.name}</p>
            <p className="text-xs text-eoe-espresso/55">
              {b.invitee.email}
              {b.invitee.phone ? ` · ${b.invitee.phone}` : ""}
            </p>
            {b.notes && (
              <p className="mt-2 max-w-xl whitespace-pre-line rounded-lg bg-eoe-ivory px-3 py-2 text-xs text-eoe-espresso/70">
                {b.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <span
            className={`rounded-full px-3 py-1 font-semibold uppercase tracking-wide ${st.cls}`}
          >
            {st.label}
          </span>
          {b.payment_status === "paid" && (
            <span className="text-eoe-espresso/55">
              {money(b.payment_amount_cents)} deposit
            </span>
          )}
          {!cancelled &&
            (confirming ? (
              <span className="flex items-center gap-2">
                <button
                  onClick={doCancel}
                  disabled={busy}
                  className="rounded-full bg-rose-100 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-rose-700 hover:bg-rose-200 disabled:opacity-50"
                >
                  {busy ? "…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/50 hover:text-eoe-espresso"
                >
                  Keep
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <button
                  onClick={() => setRescheduling((v) => !v)}
                  className="rounded-full border border-eoe-espresso/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:bg-eoe-espresso/5"
                >
                  {rescheduling ? "Close" : "Reschedule"}
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-full border border-eoe-espresso/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-eoe-espresso/70 hover:bg-eoe-espresso/5"
                >
                  Cancel
                </button>
              </span>
            ))}
        </div>
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
        const r = await fetch(
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
    <div className="mt-4 rounded-xl border border-eoe-espresso/10 bg-eoe-ivory/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/55">
          Move to
        </span>
        <input
          type="date"
          value={date}
          min={todayKey}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-full border border-eoe-espresso/15 bg-white px-3 py-1.5 text-sm text-eoe-espresso outline-none focus:border-eoe-gold"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {loading && <p className="text-xs text-eoe-espresso/50">Loading…</p>}
        {!loading && times.length === 0 && (
          <p className="text-xs text-eoe-espresso/50">
            No open times on this day.
          </p>
        )}
        {times.map((t) => (
          <button
            key={t.start_time}
            disabled={busy}
            onClick={() => move(t.start_time)}
            className="flex flex-col items-center rounded-xl border border-eoe-espresso/20 px-3 py-1.5 text-sm text-eoe-espresso transition hover:border-eoe-gold hover:bg-white disabled:opacity-50"
          >
            {timeOf(t.start_time)}
            {shared && (
              <span className="text-[10px] text-eoe-espresso/45">
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

// ---------- table ----------
function TableView({
  rows,
  colorFor,
  today,
  sharedFor,
  onCancel,
  onReschedule,
}: {
  rows: ScheduledEvent[];
  colorFor: (uri: string) => string;
  today: string;
  sharedFor: (evUri: string) => boolean;
  onCancel: (uri: string) => Promise<void>;
  onReschedule: (uri: string, startIso: string) => Promise<string | null>;
}) {
  const [rescheduleUri, setRescheduleUri] = useState<string | null>(null);
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-eoe-espresso/10 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-eoe-ivory text-[10px] uppercase tracking-[0.18em] text-eoe-espresso/50">
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
            const open = rescheduleUri === b.uri;
            return (
              <Fragment key={b.uri}>
              <tr
                className={`border-t border-eoe-espresso/8 ${
                  cancelled ? "text-eoe-espresso/45" : "text-eoe-espresso/85"
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  {dayKey(b.start_time) === today ? (
                    <span className="font-semibold" style={{ color: GOLD_TEXT }}>
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
                  <div className="text-xs text-eoe-espresso/45">
                    {b.invitee.email}
                  </div>
                </td>
                <td className="px-4 py-3">{b.guests}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {b.payment_status === "paid"
                    ? money(b.payment_amount_cents)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${st.cls}`}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {!cancelled && (
                    <span className="flex justify-end gap-3 whitespace-nowrap">
                      <button
                        onClick={() =>
                          setRescheduleUri(open ? null : b.uri)
                        }
                        className="text-[11px] uppercase tracking-[0.14em] text-eoe-espresso/50 hover:text-eoe-espresso"
                      >
                        {open ? "Close" : "Reschedule"}
                      </button>
                      <RowCancel uri={b.uri} onCancel={onCancel} />
                    </span>
                  )}
                </td>
              </tr>
              {open && !cancelled && (
                <tr className="bg-eoe-ivory/50">
                  <td colSpan={8} className="px-4 pb-3">
                    <RescheduleControl
                      b={b}
                      shared={sharedFor(b.event_type)}
                      onReschedule={onReschedule}
                      onDone={() => setRescheduleUri(null)}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowCancel({
  uri,
  onCancel,
}: {
  uri: string;
  onCancel: (uri: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (confirming) {
    return (
      <span className="flex justify-end gap-2 whitespace-nowrap">
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await onCancel(uri);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="text-[11px] uppercase tracking-[0.14em] text-rose-600 hover:text-rose-700 disabled:opacity-50"
        >
          {busy ? "…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[11px] uppercase tracking-[0.14em] text-eoe-espresso/40 hover:text-eoe-espresso"
        >
          Keep
        </button>
      </span>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[11px] uppercase tracking-[0.14em] text-eoe-espresso/50 hover:text-eoe-espresso"
    >
      Cancel
    </button>
  );
}
