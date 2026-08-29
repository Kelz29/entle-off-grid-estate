import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Contact } from "@/components/sections/Contact";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { getPublicSiteContent } from "@/lib/content/get-public-content";

export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const content = await getPublicSiteContent();
  return (
    <div className="overflow-x-clip bg-eoe-ivory text-eoe-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-eoe-espresso focus:px-4 focus:py-2 focus:text-sm focus:text-eoe-ivory"
      >
        Skip to content
      </a>
      <CustomCursor />
      <SiteHeader content={content.nav} />
      <main id="main-content" className="relative overflow-x-clip pt-24 md:pt-28">
        {children}
      </main>
      <Contact content={content.contact} site={content.site} />
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
      <p className="text-xs tracking-[0.3em] text-eoe-espresso">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl tracking-[0.12em] text-eoe-espresso md:text-5xl">
        {title}
      </h1>
      {children}
      <p className="mt-6">
        <Link
          href="/"
          className="text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/75 hover:text-eoe-espresso"
        >
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
