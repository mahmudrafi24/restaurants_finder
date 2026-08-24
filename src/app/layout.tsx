import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/app/providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// `globals.css` maps Tailwind's `font-sans`/`font-mono` onto these variable names, so the
// variable a font exposes must match what the stylesheet expects — `--font-sans`, not
// `--font-geist-sans`, or `html { @apply font-sans }` silently falls back to the system stack.
const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

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
    // `suppressHydrationWarning` is required by next-themes: it sets the `class` on <html>
    // before React hydrates, which would otherwise be reported as a mismatch.
    //
    // The font variables go on <html>, not <body>: `globals.css` applies `font-sans` to `html`,
    // and a custom property is only visible to the element that declares it and its descendants.
    // Declared on <body> the utility resolves to nothing and everything silently renders in Times.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="antialiased" suppressHydrationWarning>
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
