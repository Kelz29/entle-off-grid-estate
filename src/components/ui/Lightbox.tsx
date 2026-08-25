"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export type MediaItem = {
  type: "image" | "video";
  src: string;
  caption?: string;
};

// Fullscreen viewer for a portrait image or video. Escape / backdrop closes.
export function Lightbox({
  item,
  onClose,
}: {
  item: MediaItem | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!item) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        // Simple trap: keep focus on close button (single interactive control + media)
        const focusables = [
          closeRef.current,
          ...Array.from(
            document.querySelectorAll<HTMLElement>(
              '[data-lightbox-root] video, [data-lightbox-root] button'
            )
          ),
        ].filter(Boolean) as HTMLElement[];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [item, onClose]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          data-lightbox-root
          role="dialog"
          aria-modal="true"
          aria-label={item.caption ?? "Media viewer"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[88vh] w-auto max-w-[92vw] flex-col overflow-hidden rounded-3xl border border-eoe-ivory/15 bg-eoe-ink"
          >
            {item.type === "video" ? (
              <video
                src={item.src}
                controls
                autoPlay
                playsInline
                className="max-h-[82vh] w-auto max-w-[92vw] object-contain"
              />
            ) : (
              <div className="relative h-[82vh] w-[min(62vh,92vw)]">
                <Image
                  src={item.src}
                  alt={item.caption ?? "Entle Off Grid Estate"}
                  fill
                  sizes="90vw"
                  className="object-contain"
                />
              </div>
            )}
            {item.caption && (
              <p className="px-5 py-3 text-center text-xs uppercase tracking-[0.24em] text-eoe-ivory/90">
                {item.caption}
              </p>
            )}
          </motion.div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-eoe-ivory/25 text-eoe-ivory/95 hover:bg-eoe-ivory/10"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
