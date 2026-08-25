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

export default function Home() {
  return (
    <div className="bg-eoe-ivory text-eoe-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-eoe-espresso focus:px-4 focus:py-2 focus:text-sm focus:text-eoe-ivory"
      >
        Skip to content
      </a>
      <CustomCursor />
      <SiteHeader />
      <main id="main-content" className="relative">
        <Hero />
        <Estate />
        <Spaces />
        <Experiences />
        <Food />
        <Booking />
        <Gallery />
        <Testimonials />
      </main>
      <Contact />
    </div>
  );
}
