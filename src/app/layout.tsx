import type { Metadata, Viewport } from "next";

import { Providers } from "@/app/providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Restaurant Finder — Cafes & Restaurants by City",
    template: "%s · Restaurant Finder",
  },
  description:
    "Search any city for cafes, restaurants and fast-food outlets from OpenStreetMap, then " +
    "download the results as Excel, CSV or GeoJSON.",
  applicationName: "Restaurant Finder",
  keywords: ["restaurants", "cafes", "OpenStreetMap", "data export", "city search"],
  openGraph: {
    title: "Restaurant Finder",
    description: "Search any city for cafes, restaurants and fast food, and download the results.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <div className="flex min-h-svh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
