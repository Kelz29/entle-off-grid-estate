import type { Metadata } from "next";
import Link from "next/link";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { CarWash } from "@/components/sections/CarWash";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSiteContent } from "@/lib/content/get-public-content";
import {
  breadcrumbJsonLd,
  carWashServiceJsonLd,
  pageMetadata,
} from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  const title = `${content.carWash.title} | ${content.site.city}`;
  const description = `${content.carWash.tagline}. ${content.carWash.note}`;
  return pageMetadata({
    content,
    path: "/car-wash",
    title,
    description,
  });
}

export default async function CarWashPage() {
  const content = await getPublicSiteContent();
  const breadcrumbs = breadcrumbJsonLd([
    { name: content.site.name, path: "/" },
    { name: content.carWash.title, path: "/car-wash" },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <JsonLd data={carWashServiceJsonLd(content)} />
      <SiteChrome>
        <div className="mx-auto max-w-6xl px-4 pb-6 md:px-6 lg:px-8">
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/75 hover:text-eoe-espresso"
          >
            ← Back to home
          </Link>
        </div>
        <CarWash asPage content={content.carWash} />
      </SiteChrome>
    </>
  );
}
