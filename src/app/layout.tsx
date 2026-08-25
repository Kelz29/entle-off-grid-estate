import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
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
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  process.env.APP_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

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
    images: [{ url: "/outdoor/eoe.jpg", width: 1200, height: 1600, alt: "Entle Off Grid Estate" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Entle Off Grid Estate",
    description:
      "A refined off-grid café, event venue, and private estate in Bloemfontein, South Africa.",
    images: ["/outdoor/eoe.jpg"],
  },
  icons: {
    icon: "/outdoor/eoe.jpg",
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
    <html lang="en-ZA">
      <body
        className={`${dmSans.variable} ${cormorant.variable} antialiased bg-eoe-ivory text-eoe-ink`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
