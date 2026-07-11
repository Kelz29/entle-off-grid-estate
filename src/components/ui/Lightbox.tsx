"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
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
                  alt={item.caption ?? "Entle Off-Grid Estate"}
                  fill
                  sizes="90vw"
                  className="object-contain"
                />
              </div>
            )}
            {item.caption && (
              <p className="px-5 py-3 text-center text-xs uppercase tracking-[0.24em] text-eoe-ivory/70">
                {item.caption}
              </p>
            )}
          </motion.div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-eoe-ivory/25 text-eoe-ivory/80 hover:bg-eoe-ivory/10"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
