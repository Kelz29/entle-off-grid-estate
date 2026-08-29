"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BUNDLED_MEDIA } from "@/lib/content/bundled";
import type { MediaAssetRow, MediaRef, ResolvedMedia } from "@/lib/content/types";
import { formatBytes } from "@/lib/content/media-limits";

const fetcher = (url: string) =>
  fetch(url, { credentials: "same-origin" }).then((r) => r.json());

function previewSrc(ref: ResolvedMedia): string {
  return ref.src;
}

export function MediaPicker({
  label,
  value,
  kind = "image",
  onChange,
}: {
  label: string;
  value: ResolvedMedia;
  kind?: "image" | "video";
  onChange: (next: ResolvedMedia) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"site" | "uploads">("site");
  const { data } = useSWR<{ collection: MediaAssetRow[] }>(
    open ? "/api/admin/media" : null,
    fetcher
  );
  const bundled = BUNDLED_MEDIA.filter((m) => m.kind === kind);
  const uploads = (data?.collection ?? []).filter((m) => m.kind === kind);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pickDefault = (src: string) => {
    onChange({ source: "default", src, fallbackSrc: src });
    setOpen(false);
  };
  const pickUpload = (id: string) => {
    onChange({
      source: "upload",
      id,
      src: `/api/media/${id}`,
      fallbackSrc: value.fallbackSrc,
    });
    setOpen(false);
  };

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
        {label}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex min-h-14 w-full items-center gap-3 rounded-xl border border-eoe-espresso/15 bg-white p-2 text-left hover:border-eoe-gold"
      >
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc(value)}
            alt=""
            className="h-14 w-10 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-14 w-10 items-center justify-center rounded-lg bg-eoe-espresso/10 text-[10px] uppercase tracking-widest text-eoe-espresso">
            MP4
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-eoe-espresso/80">
          {value.source === "upload" ? `upload:${value.id}` : value.src}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-eoe-espresso">
          Change
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-eoe-ink/40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
          <div className="max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-eoe-espresso/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso">
                Choose {kind}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 px-3 text-[11px] uppercase tracking-[0.14em] text-eoe-espresso"
              >
                Close
              </button>
            </div>
            <div className="flex gap-2 px-4 pt-3">
              {(["site", "uploads"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${
                    tab === t
                      ? "bg-eoe-espresso text-eoe-ivory"
                      : "border border-eoe-espresso/20 text-eoe-espresso"
                  }`}
                >
                  {t === "site" ? "On the site" : "Uploads"}
                </button>
              ))}
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {tab === "site" && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {bundled.map((m) => (
                    <button
                      key={m.src}
                      type="button"
                      onClick={() => pickDefault(m.src)}
                      className="overflow-hidden rounded-xl border border-eoe-espresso/10 text-left hover:border-eoe-gold"
                    >
                      {m.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.src} alt="" className="aspect-[3/4] w-full object-cover" />
                      ) : (
                        <span className="flex aspect-[3/4] items-center justify-center bg-eoe-espresso/10 text-[10px]">
                          VIDEO
                        </span>
                      )}
                      <span className="block truncate px-2 py-1 text-[10px] text-eoe-espresso">
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {tab === "uploads" && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {uploads.length === 0 && (
                    <p className="col-span-full text-sm text-eoe-espresso/70">
                      No uploads yet. Use the Media tab to add files (counts toward 150 MB).
                    </p>
                  )}
                  {uploads.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pickUpload(m.id)}
                      className="overflow-hidden rounded-xl border border-eoe-espresso/10 text-left hover:border-eoe-gold"
                    >
                      {m.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/media/${m.id}`}
                          alt=""
                          className="aspect-[3/4] w-full object-cover"
                        />
                      ) : (
                        <span className="flex aspect-[3/4] items-center justify-center bg-eoe-espresso/10 text-[10px]">
                          VIDEO
                        </span>
                      )}
                      <span className="block truncate px-2 py-1 text-[10px] text-eoe-espresso">
                        {m.original_name} · {formatBytes(m.byte_size)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { MediaRef };
