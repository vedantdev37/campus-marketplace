import "server-only";

import { cookies } from "next/headers";

import { isLanguage, type Language } from "@/lib/i18n";

/**
 * The visitor's language for the headline lines: English unless they chose
 * Hinglish or Kanglish. Read from a cookie on the server, like the theme, so
 * the page arrives already in that language.
 */
export async function readLanguage(): Promise<Language> {
  const value = (await cookies()).get("lang")?.value;
  return isLanguage(value) ? value : "en";
}
