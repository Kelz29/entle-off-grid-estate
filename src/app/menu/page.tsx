import type { Metadata } from "next";
import Link from "next/link";
import { SiteChrome, PageIntro } from "@/components/layout/SiteChrome";
import { CafeMenu } from "@/components/sections/CafeMenu";

export const metadata: Metadata = {
  title: "Café Menu",
  description:
    "Breakfast, lunch, and beans & brews at Entle Off Grid Estate café, Bloemfontein.",
};

export default function MenuPage() {
  return (
    <SiteChrome>
      <div className="pb-8">
        <PageIntro eyebrow="THE TABLE" title="Café menu">
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-eoe-ink/85 md:text-base">
            Breakfast through lunch, coffee in between. Ask your host about
            today&apos;s specials.
          </p>
        </PageIntro>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 lg:px-8">
        <CafeMenu />
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/#booking"
            className="inline-flex rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
          >
            Reserve a table
          </Link>
          <Link
            href="/car-wash"
            className="inline-flex rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-espresso/5"
          >
            Car wash while you dine
          </Link>
        </div>
      </div>
    </SiteChrome>
  );
}
