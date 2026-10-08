import type { Metadata, Viewport } from "next";
import { Anton, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { Theme } from "@/components/layout/theme-toggle";
import { getSessionUser } from "@/lib/auth";

import "./globals.css";

/**
 * Two typefaces, each with one job (see DESIGN.md).
 *
 * Plus Jakarta Sans is the reading face: body text, forms, chat, prices.
 * Anton is the title-card face: tall, condensed, used only for headlines. It
 * was chosen over Bebas Neue because Bebas has no lower-case letters at all,
 * which rules out using it anywhere a name or a sentence might appear.
 *
 * `next/font` downloads both at build time and serves them from this origin,
 * so there is no request to Google from a visitor's browser. `display: swap`
 * shows text immediately in a fallback and swaps when the font arrives.
 */
const appSans = Plus_Jakarta_Sans({
  variable: "--font-app-sans",
  subsets: ["latin"],
  display: "swap",
});

const appDisplay = Anton({
  variable: "--font-app-display",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nitte Mart",
  description:
    "Seniors leave. Their stuff doesn't have to. Buy and sell textbooks, calculators, lab coats and hostel essentials with other students, handed over on campus. A student project, not affiliated with NITTE.",
};

/**
 * The visitor's theme: dark unless they have chosen light.
 *
 * Read from a cookie on the server so the very first paint is in the right
 * theme. The alternative - deciding in the browser - shows the wrong theme for
 * a moment on every page load.
 */
async function readTheme(): Promise<Theme> {
  return (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
}

/**
 * Colours the browser's own chrome (the address bar on a phone) to match the
 * page, so there is no mismatched strip above it.
 */
export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await readTheme()) === "light" ? "#faf8f2" : "#0b0b12" };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here so the header can show the right links on every page. It is
  // the same verified, cookie-based read the pages do; with Cache Components
  // off, a session read in a layout does not block anything that could have
  // been static, because these routes are all rendered per request anyway.
  const [user, theme] = await Promise.all([getSessionUser(), readTheme()]);

  return (
    <html
      lang="en"
      data-theme={theme}
      // The theme toggle changes `data-theme` in the browser, so the attribute
      // can legitimately differ from what the server sent.
      suppressHydrationWarning
      className={`${appSans.variable} ${appDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Lets a keyboard user jump past the header on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-canvas focus:px-4 focus:py-2 focus:text-ink focus:shadow-float"
        >
          Skip to content
        </a>

        <SiteHeader user={user} theme={theme} />

        <div id="main" className="flex flex-1 flex-col">
          {children}
        </div>

        <SiteFooter theme={theme} />
      </body>
    </html>
  );
}
