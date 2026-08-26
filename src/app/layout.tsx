import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
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

const siteUrl =
  process.env.NEXT_LIVE_URL?.replace(/\/$/, "") ||
  process.env.APP_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

const gaId =
  process.env.NEXT_GA_MEASUREMENT_ID?.trim() || "G-JLL86E499S";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Entle Off Grid Estate",
    template: "%s · Entle Off Grid Estate",
  },
  description:
    "A refined off-grid café, event venue, and private estate in Bloemfontein, South Africa.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    url: siteUrl,
    siteName: "Entle Off Grid Estate",
    title: "Entle Off Grid Estate",
    description:
      "A refined off-grid café, event venue, and private estate in Bloemfontein, South Africa.",
    images: [
      {
        url: "/outdoor/eoe.jpg",
        width: 1200,
        height: 1600,
        alt: "Entle Off Grid Estate",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Entle Off Grid Estate",
    description:
      "A refined off-grid café, event venue, and private estate in Bloemfontein, South Africa.",
    images: ["/outdoor/eoe.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.png",
  },
  other: {
    "theme-color": "#ffffff",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Entle Off Grid Estate",
  description:
    "A refined off-grid café, event venue, and private estate in Bloemfontein, South Africa.",
  url: siteUrl,
  telephone: "+27673662302",
  address: {
    "@type": "PostalAddress",
    streetAddress: "183 Lakeview",
    addressLocality: "Bloemfontein",
    addressCountry: "ZA",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Friday", "Saturday", "Sunday"],
      opens: "11:00",
      closes: "18:00",
    },
  ],
  image: `${siteUrl}/outdoor/eoe.jpg`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${cormorant.variable} antialiased bg-eoe-ivory text-eoe-ink`}
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <GoogleAnalytics gaId={gaId} />
        <SpeedInsights />
      </body>
    </html>
  );
}
