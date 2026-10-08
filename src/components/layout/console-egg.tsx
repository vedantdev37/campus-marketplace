"use client";

import { useEffect } from "react";

const BANNER = String.raw`
 _   _ ___ _____ _____ _____   __  __    _    ____ _____
| \ | |_ _|_   _|_   _| ____| |  \/  |  / \  |  _ \_   _|
|  \| || |  | |   | | |  _|   | |\/| | / _ \ | |_) || |
| |\  || |  | |   | | | |___  | |  | |/ ___ \|  _ < | |
|_| \_|___| |_|   |_| |_____| |_|  |_/_/   \_\_| \_\|_|
`;

const CREDITS = [
  ["Directed by", "Vedant Sharma"],
  ["Written and built by", "Vedant Sharma"],
  ["Produced for", "GDG NMIT, Round 2"],
  ["Stack", "Next.js, React, Tailwind, Supabase"],
  ["Stunts", "Postgres Row Level Security"],
  ["No service-role keys", "were used in the making of this site"],
  ["Receipts", "/security"],
  ["Commentary", "/commentary"],
] as const;

/**
 * A greeting for anyone who opens the browser console, and a `credits()`
 * function they can call from it.
 *
 * It prints text and defines one function that prints more text. It reads
 * nothing, sends nothing and changes nothing on the page - and it gives away
 * nothing a visitor could not already see, which matters on a site whose other
 * hidden corner is a page about security.
 */
export function ConsoleEgg() {
  useEffect(() => {
    console.log(`%c${BANNER}`, "color:#ffd60a;font-family:monospace;font-weight:bold");
    console.log(
      "%cHey, you opened DevTools. Respect. I'm Vedant. Type credits() to roll the credits.",
      "font-size:14px",
    );

    const credits = () => {
      console.log("%cNITTE MART", "color:#ffd60a;font-size:28px;font-weight:900;letter-spacing:2px");

      for (const [role, name] of CREDITS) {
        console.log(`%c${role.padStart(22)}  %c${name}`, "color:#9a99ab", "font-weight:bold");
      }

      console.log("%cA student project. Not affiliated with NITTE.", "color:#9a99ab;font-style:italic");
      return "Thanks for watching.";
    };

    Object.defineProperty(window, "credits", { value: credits, configurable: true });

    return () => {
      delete (window as unknown as { credits?: unknown }).credits;
    };
  }, []);

  return null;
}
