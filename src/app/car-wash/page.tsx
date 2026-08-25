import type { Metadata } from "next";
import Link from "next/link";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { CarWash } from "@/components/sections/CarWash";

export const metadata: Metadata = {
  title: "Car Wash",
  description:
    "EOE car wash at Entle Off Grid Estate. Get your car cleaned while you enjoy your meal. Pre-book with a café reservation.",
};

export default function CarWashPage() {
  return (
    <SiteChrome>
      <div className="mx-auto max-w-6xl px-4 pb-6 md:px-6 lg:px-8">
        <Link
          href="/"
          className="text-[11px] uppercase tracking-[0.2em] text-eoe-espresso/75 hover:text-eoe-espresso"
        >
          ← Back to home
        </Link>
      </div>
      <CarWash asPage />
    </SiteChrome>
  );
}
