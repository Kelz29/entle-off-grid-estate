import type { ReactNode } from "react";

/**
 * Horizontal strip that bleeds to the section edges via negative margin.
 * Avoids `w-screen` / `100vw` full-bleed (those expand the page and clip the UI).
 */
const stripOuter =
  "relative -mx-4 overflow-x-auto overscroll-x-contain scroll-smooth pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0";

const stripTrack =
  "flex w-max snap-x snap-mandatory gap-4 pr-4 pb-4";

/** First card leaves a peek of the next on phones/tablets. Rem-based — no 100vw. */
export const mobileScrollSlide =
  "w-[17.5rem] shrink-0 snap-start max-md:flex-none sm:w-[19rem] md:w-auto";

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
