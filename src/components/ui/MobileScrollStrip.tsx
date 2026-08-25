import type { ReactNode } from "react";

/** Full-bleed horizontal scroll; first slide aligns with section padding. */
const stripOuter =
  "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-auto overscroll-x-contain scroll-smooth pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const stripTrack = "flex w-max snap-x snap-mandatory gap-4 pr-4 pb-4";

/** ~4rem of the next slide visible on load (below md). */
export const mobileScrollSlide =
  "w-[calc(100vw-6.5rem)] shrink-0 snap-start max-md:flex-none md:w-auto";

export function MobileScrollStrip({
  children,
  trackClassName = "",
  outerClassName = "",
}: {
  children: ReactNode;
  trackClassName?: string;
  outerClassName?: string;
}) {
  return (
    <div className={`${stripOuter} ${outerClassName}`.trim()}>
      <div className={`${stripTrack} ${trackClassName}`.trim()}>{children}</div>
    </div>
  );
}
