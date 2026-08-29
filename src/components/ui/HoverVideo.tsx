"use client";

import { useRef, useState } from "react";
import { ContentImage } from "@/components/ui/ContentImage";
import { ContentVideo } from "@/components/ui/ContentVideo";

export function HoverVideo({
  src,
  poster,
  alt,
  className = "",
  children,
  onClick,
  fallbackSrc,
  posterFallback,
}: {
  src: string;
  poster: string;
  alt: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  fallbackSrc?: string;
  posterFallback?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.play()
      .then(() => setPlaying(true))
      .catch(() => {});
  };
  const stop = () => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={play}
      onMouseLeave={stop}
      onClick={onClick}
    >
      <ContentImage
        src={poster}
        fallbackSrc={posterFallback ?? poster}
        alt={alt}
        fill
        sizes="40vw"
        className="object-cover"
      />
      <ContentVideo
        ref={ref}
        src={src}
        fallbackSrc={fallbackSrc ?? src}
        muted
        loop
        playsInline
        preload="none"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
      />
      {children}
    </div>
  );
}
