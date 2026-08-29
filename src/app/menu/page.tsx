import type { Metadata } from "next";
import Link from "next/link";
import { SiteChrome, PageIntro } from "@/components/layout/SiteChrome";
import { CafeMenu } from "@/components/sections/CafeMenu";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSiteContent } from "@/lib/content/get-public-content";
import {
  breadcrumbJsonLd,
  menuJsonLd,
  pageMetadata,
} from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  const title = `${content.menu.title} | ${content.site.city} café`;
  return pageMetadata({
    content,
    path: "/menu",
    title,
    description: content.menu.intro,
  });
}

export default async function MenuPage() {
  const content = await getPublicSiteContent();
  const breadcrumbs = breadcrumbJsonLd([
    { name: content.site.name, path: "/" },
    { name: content.menu.title, path: "/menu" },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={menuJsonLd(content)} />
      <SiteChrome>
        <div className="pb-8">
          <PageIntro eyebrow={content.menu.eyebrow} title={content.menu.title}>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-eoe-ink/85 md:text-base">
              {content.menu.intro}
            </p>
          </PageIntro>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6 lg:px-8">
          <CafeMenu
            categories={content.menu.categories}
            footerNote={content.menu.footerNote}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={content.menu.reserveCta.href}
              className="inline-flex rounded-full bg-eoe-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-ivory hover:bg-eoe-espresso/90"
            >
              {content.menu.reserveCta.label}
            </Link>
            <Link
              href={content.menu.carWashCta.href}
              className="inline-flex rounded-full border border-eoe-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-eoe-espresso hover:bg-eoe-espresso/5"
            >
              {content.menu.carWashCta.label}
            </Link>
          </div>
        </div>
      </SiteChrome>
    </>
  );
}
