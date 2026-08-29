import { Hero } from "@/components/sections/Hero";
import { Estate } from "@/components/sections/Estate";
import { Spaces } from "@/components/sections/Spaces";
import { Experiences } from "@/components/sections/Experiences";
import { Food } from "@/components/sections/Food";
import { Booking } from "@/components/sections/Booking";
import { Gallery } from "@/components/sections/Gallery";
import { Testimonials } from "@/components/sections/Testimonials";
import { Contact } from "@/components/sections/Contact";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { CocktailSpecial } from "@/components/ui/CocktailSpecial";
import { getPublicSiteContent } from "@/lib/content/get-public-content";
import { carTypesFromContent } from "@/lib/content/car-wash-prices";

export default async function Home() {
  const content = await getPublicSiteContent();
  const carTypeCatalog = carTypesFromContent(content);

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
      <main id="main-content" className="relative overflow-x-clip">
        <Hero content={content.hero} />
        <Estate content={content.estate} />
        <Spaces content={content.spaces} />
        <Experiences content={content.experiences} />
        <Food content={content.food} />
        <Booking carTypeCatalog={carTypeCatalog} site={content.site} />
        <Gallery content={content.gallery} />
        <Testimonials content={content.testimonials} />
      </main>
      <Contact content={content.contact} site={content.site} />
      <CocktailSpecial />
    </div>
  );
}
