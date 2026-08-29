"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";
import type { ResolvedMedia } from "@/lib/content/types";

type Props = Omit<ImageProps, "src"> & {
  src: string;
  fallbackSrc?: string;
  media?: ResolvedMedia;
};

export function ContentImage({
  src,
  fallbackSrc,
  media,
  alt,
  onError,
  unoptimized,
  ...rest
}: Props) {
  const primary = media?.src ?? src;
  const fallback = media?.fallbackSrc ?? fallbackSrc ?? primary;
  const [current, setCurrent] = useState(primary);

  useEffect(() => {
    setCurrent(primary);
  }, [primary]);

  const isUpload = current.startsWith("/api/media/");

  return (
    <Image
      {...rest}
      src={current}
      alt={alt}
      unoptimized={unoptimized ?? isUpload}
      onError={(e) => {
        onError?.(e);
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
