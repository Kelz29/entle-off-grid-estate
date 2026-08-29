"use client";

import { useState } from "react";
import useSWR from "swr";
import type { MediaAssetRow } from "@/lib/content/types";
import { formatBytes } from "@/lib/content/media-limits";

const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then((r) => r.json());

type MediaList = {
  collection: MediaAssetRow[];
  quota: { used: number; limit: number; remaining: number; label: string };
};

export function MediaLibrary() {
  const { data, error, isLoading, mutate } = useSWR<MediaList>(
    "/api/admin/media",
    fetcher
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const quota = data?.quota;
  const usedPct = quota
    ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
    : 0;

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.detail ?? "Upload failed");
        return;
      }
      setMsg("Uploaded ✓");
      await mutate();
    } catch {
      setMsg("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/media/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.detail ?? "Could not delete");
        return;
      }
      setConfirmId(null);
      setMsg("Deleted · slots reverted to the original file");
      await mutate();
    } catch {
      setMsg("Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-eoe-espresso/12 bg-white px-4 py-4 shadow-sm sm:px-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
          Media library
        </p>
        <p className="mt-1 text-xs leading-relaxed text-eoe-espresso/70">
          Uploads count toward a 150 MB cap (images up to 5 MB, videos up to 40 MB).
          Photos already on the website are free and stay in the picker.
        </p>
        {quota && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] uppercase tracking-[0.14em] text-eoe-espresso/70">
              <span>{quota.label}</span>
              <span>{formatBytes(quota.remaining)} free</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-eoe-espresso/10">
              <div
                className="h-full rounded-full bg-eoe-espresso"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        )}
        <label className="mt-4 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
            Upload JPEG, PNG, WebP, GIF, or MP4
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
            className="mt-2 block min-h-11 w-full text-sm text-eoe-espresso file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-eoe-espresso file:px-4 file:py-2 file:text-[10px] file:uppercase file:tracking-[0.16em] file:text-eoe-ivory"
          />
        </label>
        {msg && <p className="mt-3 text-xs text-eoe-espresso/80">{msg}</p>}
      </div>

      {isLoading && <p className="text-sm text-eoe-espresso/70">Loading…</p>}
      {error && <p className="text-sm text-red-700">Could not load media.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {(data?.collection ?? []).map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-eoe-espresso/12 bg-white"
          >
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${item.id}`}
                alt=""
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <video
                src={`/api/media/${item.id}`}
                className="aspect-[3/4] w-full object-cover"
                muted
                playsInline
              />
            )}
            <div className="p-3">
              <p className="truncate text-xs text-eoe-ink">{item.original_name}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-eoe-espresso/70">
                {formatBytes(item.byte_size)}
              </p>
              {confirmId === item.id ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(item.id)}
                    className="min-h-11 rounded-full bg-red-700 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-[10px] uppercase tracking-[0.14em] text-eoe-espresso"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(item.id)}
                  className="mt-2 min-h-11 text-[10px] uppercase tracking-[0.14em] text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
