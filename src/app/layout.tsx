import type { Metadata, Viewport } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSiteContent } from "@/lib/content/get-public-content";
import {
  graphJsonLd,
  homeSeoTitle,
  ogImageUrl,
  siteOrigin,
} from "@/lib/seo";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["500", "600"],
});

const gaId =
  process.env.NEXT_GA_MEASUREMENT_ID?.trim() || "G-JLL86E499S";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  const origin = siteOrigin();
  const title = homeSeoTitle(content);
  const description = content.site.description;
  const og = ogImageUrl(content, origin);
  return {
    metadataBase: new URL(origin),
    title: {
      default: title,
      template: `%s · ${content.site.name}`,
    },
    description,
    applicationName: content.site.name,
    alternates: { canonical: "/" },
    formatDetection: { telephone: true, email: false, address: false },
    openGraph: {
      type: "website",
      locale: "en_ZA",
      url: origin,
      siteName: content.site.name,
      title,
      description,
      images: [
        {
          url: og,
          width: 1200,
          height: 1600,
          alt: content.site.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [og],
    },
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: "/favicon.png", sizes: "48x48", type: "image/png" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: "/favicon.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = await getPublicSiteContent();
  const graphLd = graphJsonLd(content);

  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${cormorant.variable} antialiased bg-eoe-ivory text-eoe-ink`}
        suppressHydrationWarning
      >
        <JsonLd data={graphLd} />
        {children}
        <GoogleAnalytics gaId={gaId} />
        <SpeedInsights />
      </body>
    </html>
  );
}
