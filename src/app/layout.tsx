import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { SiteHeader } from "@/components/layout/site-header";
import { getSessionUser } from "@/lib/auth";

import "./globals.css";

/**
 * DESIGN.md specifies Airbnb Cereal, a proprietary typeface that cannot be
 * shipped here. Plus Jakarta Sans is the stand-in: a geometric sans with the
 * same friendly, rounded character, and - unlike a default system or Geist
 * stack - not the typeface every scaffolded Next.js project starts with.
 *
 * `next/font` downloads it at build time and serves it from this origin, so
 * there is no request to Google from a visitor's browser and no layout shift
 * while it loads.
 */
const appSans = Plus_Jakarta_Sans({
  variable: "--font-app-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campus Marketplace",
  description:
    "Buy and sell within NMIT - textbooks, calculators, lab coats and hostel essentials, handed over on campus.",
};

/**
 * Colours the browser's own chrome (the address bar on a phone) to match the
 * page in each theme, so there is no white strip above a dark page.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here so the header can show the right links on every page. It is
  // the same verified, cookie-based read the pages do; with Cache Components
  // off, a session read in a layout does not block anything that could have
  // been static, because these routes are all rendered per request anyway.
  const user = await getSessionUser();

  return (
    <html lang="en" className={`${appSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Lets a keyboard user jump past the header on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-canvas focus:px-4 focus:py-2 focus:text-ink focus:shadow-float"
        >
          Skip to content
        </a>

        <SiteHeader user={user} />

        <div id="main" className="flex flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
