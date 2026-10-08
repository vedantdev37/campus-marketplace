import "server-only";

import { cookies } from "next/headers";

import type { Theme } from "@/components/layout/theme-toggle";

/**
 * The visitor's theme: dark unless they have chosen light.
 *
 * Read from a cookie on the server so the very first paint is in the right
 * theme. The alternative - deciding in the browser - shows the wrong theme for
 * a moment on every page load.
 */
export async function readTheme(): Promise<Theme> {
  return (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
}
