"use client";

import { useEffect } from "react";

/**
 * Drives every scroll reveal on the page it is placed on. Renders nothing.
 *
 * Any element with a `data-reveal` attribute takes part. On load, the ones
 * still below the fold are marked `data-reveal="hidden"`; each becomes
 * `"in"` the first time it scrolls into view, and is then left alone. The
 * CSS in globals.css does the rest (fade and rise, digit rollers, the SOLD
 * stamp, the scan demo).
 *
 * WHY IT IS BUILT THIS WAY
 * - The server sends everything visible. Hiding is something this script
 *   does, so with JavaScript off, or slow, or broken, no content is missing.
 * - Elements already on screen are never hidden, so nothing flashes away and
 *   back as the page hydrates.
 * - One IntersectionObserver for the whole page, and no scroll listener: the
 *   browser tells us when something arrives instead of being asked on every
 *   frame.
 * - Under reduced motion it does nothing at all.
 */
export function RevealObserver() {
  useEffect(() => {
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = "in";
            observer.unobserve(entry.target);
          }
        }
      },
      // Fires a little before the element is fully in, so the movement is
      // seen arriving instead of having already finished.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
    );

    // Measure everything first, then change everything. Reading a position
    // after writing an attribute would make the browser lay the page out again
    // for every single element.
    const fold = window.innerHeight * 0.9;
    const belowFold = targets.filter((target) => target.getBoundingClientRect().top > fold);

    for (const target of belowFold) {
      target.dataset.reveal = "hidden";
      observer.observe(target);
    }

    return () => {
      observer.disconnect();

      // Leave nothing hidden behind if this unmounts mid-page.
      for (const target of targets) {
        if (target.dataset.reveal === "hidden") {
          target.dataset.reveal = "in";
        }
      }
    };
  }, []);

  return null;
}
