"use client";

import { useRef, useState } from "react";
import Image from "next/image";

// A portrait media surface that shows a poster image, and plays a muted preview
// of the video on hover (pointer devices). The parent sizes it (relative + h/w)
// and supplies overlay children (title) + an onClick (usually: open lightbox).
export function HoverVideo({
  src,
  poster,
  alt,
  className = "",
  children,
  onClick,
}: {
  src: string;
  poster: string;
  alt: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
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
      <Image src={poster} alt={alt} fill sizes="40vw" className="object-cover" />
      <video
        ref={ref}
        src={src}
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
