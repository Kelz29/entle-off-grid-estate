"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "./fields";

const BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1";
const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then((r) => r.json());

type EventType = {
  uri: string;
  name: string;
  slug: string;
  duration: number;
  description_plain: string;
  price_cents: number;
  active: boolean;
  exclusive?: boolean;
  capacity?: number;
};

function serviceId(uri: string) {
  return uri.split("/").pop() ?? "";
}

export function ServicesEditor() {
  const { data, error, isLoading, mutate } = useSWR<{ collection: EventType[] }>(
    `/api/v1/calendly/event_types?business_id=${BUSINESS_ID}&count=50`,
    fetcher
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EventType>>({});

  const types = data?.collection ?? [];

  function draftOf(t: EventType): EventType {
    return drafts[t.uri] ?? t;
  }

  async function save(t: EventType) {
    const d = draftOf(t);
    const id = serviceId(t.uri);
    setBusyId(t.uri);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/calendly/event_types/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          description: d.description_plain,
          duration_minutes: d.duration,
          price_cents: d.price_cents,
          is_active: d.active,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(body.detail ?? "Could not save");
        return;
      }
      setMsg("Saved ✓");
      await mutate();
    } catch {
      setMsg("Could not save");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title="Bookable experiences"
      hint="Name, description, duration, and per-guest deposit. Capacity stays on the Seats panel. New experiences cannot be created here."
    >
      {isLoading && <p className="text-sm text-eoe-espresso/70">Loading…</p>}
      {error && <p className="text-sm text-red-700">Could not load experiences.</p>}
      {msg && <p className="text-xs text-eoe-espresso/80">{msg}</p>}
      <div className="space-y-5">
        {types.map((t) => {
          const d = draftOf(t);
          return (
            <div
              key={t.uri}
              className="space-y-3 rounded-xl border border-eoe-espresso/10 p-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-eoe-espresso/60">
                {t.slug}
              </p>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                  Name
                </span>
                <input
                  value={d.name}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [t.uri]: { ...d, name: e.target.value },
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-eoe-espresso/15 px-3 py-2.5 text-base text-eoe-espresso outline-none focus:border-eoe-gold sm:text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                  Description
                </span>
                <textarea
                  value={d.description_plain}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [t.uri]: { ...d, description_plain: e.target.value },
                    }))
                  }
                  rows={3}
                  className="mt-1 min-h-11 w-full rounded-xl border border-eoe-espresso/15 px-3 py-2.5 text-base text-eoe-espresso outline-none focus:border-eoe-gold sm:text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                    Duration (minutes)
                  </span>
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    value={d.duration}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [t.uri]: { ...d, duration: Number(e.target.value) },
                      }))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-eoe-espresso/15 px-3 py-2.5 text-base text-eoe-espresso outline-none focus:border-eoe-gold sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
                    Deposit per guest (R)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={Math.round(d.price_cents / 100)}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [t.uri]: {
                          ...d,
                          price_cents: Math.max(0, Math.round(Number(e.target.value) * 100)),
                        },
                      }))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-eoe-espresso/15 px-3 py-2.5 text-base text-eoe-espresso outline-none focus:border-eoe-gold sm:text-sm"
                  />
                </label>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm text-eoe-espresso">
                <input
                  type="checkbox"
                  checked={d.active}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [t.uri]: { ...d, active: e.target.checked },
                    }))
                  }
                  className="size-5 rounded border-eoe-espresso/30 sm:size-4"
                />
                Bookable on the website
              </label>
              <button
                type="button"
                disabled={busyId === t.uri}
                onClick={() => void save(t)}
                className="min-h-11 rounded-full bg-eoe-espresso px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:opacity-40"
              >
                {busyId === t.uri ? "Saving…" : "Save experience"}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
