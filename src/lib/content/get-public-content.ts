import { unstable_cache } from "next/cache";
import { resolveSiteContent } from "./resolve";
import { getSiteContentOverlay } from "./repository";
import type { ResolvedSiteContent } from "./types";

const BUSINESS_ID = Number(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "1");
export const SITE_CONTENT_TAG = "site-content";

declare global {
  var __eoeLastGoodSiteContent: ResolvedSiteContent | undefined;
}

function remember(content: ResolvedSiteContent): ResolvedSiteContent {
  globalThis.__eoeLastGoodSiteContent = content;
  return content;
}

function fallbackContent(): ResolvedSiteContent {
  return globalThis.__eoeLastGoodSiteContent ?? resolveSiteContent({});
}

async function loadResolved(): Promise<ResolvedSiteContent> {
  try {
    const { overlay } = await getSiteContentOverlay(BUSINESS_ID);
    return remember(resolveSiteContent(overlay));
  } catch (err) {
    console.error("[site-content] falling back to last-good / defaults", err);
    return fallbackContent();
  }
}

const cached = unstable_cache(loadResolved, ["site-content"], {
  tags: [SITE_CONTENT_TAG],
  revalidate: 60,
});

export async function getPublicSiteContent(): Promise<ResolvedSiteContent> {
  try {
    return await cached();
  } catch (err) {
    console.error("[site-content] cache read failed", err);
    return fallbackContent();
  }
}
