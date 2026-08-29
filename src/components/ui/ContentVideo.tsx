"use client";

import { useEffect, useState, type Ref, type VideoHTMLAttributes } from "react";
import type { ResolvedMedia } from "@/lib/content/types";

type Props = VideoHTMLAttributes<HTMLVideoElement> & {
  fallbackSrc?: string;
  media?: ResolvedMedia;
  ref?: Ref<HTMLVideoElement>;
};

export function ContentVideo({
  src,
  fallbackSrc,
  media,
  poster,
  onError,
  ref,
  ...rest
}: Props) {
  const primary = media?.src ?? (typeof src === "string" ? src : "");
  const fallback = media?.fallbackSrc ?? fallbackSrc ?? primary;
  const [current, setCurrent] = useState(primary);

  useEffect(() => {
    setCurrent(primary);
  }, [primary]);

  return (
    <video
      {...rest}
      ref={ref}
      src={current}
      poster={poster}
      onError={(e) => {
        onError?.(e);
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
