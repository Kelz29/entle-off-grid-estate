import { Hero } from "@/components/sections/Hero";
import { Estate } from "@/components/sections/Estate";
import { Spaces } from "@/components/sections/Spaces";
import { Experiences } from "@/components/sections/Experiences";
import { Booking } from "@/components/sections/Booking";
import { Gallery } from "@/components/sections/Gallery";
import { Testimonials } from "@/components/sections/Testimonials";
import { Contact } from "@/components/sections/Contact";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CustomCursor } from "@/components/ui/CustomCursor";

export default function Home() {
  return (
    <div className="bg-eoe-ivory text-eoe-ink">
      <CustomCursor />
      <SiteHeader />
      <main className="relative">
        <Hero />
        <Estate />
        <Spaces />
        <Experiences />
        <Booking />
        <Gallery />
        <Testimonials />
        <Contact />
      </main>
    </div>
  );
}
