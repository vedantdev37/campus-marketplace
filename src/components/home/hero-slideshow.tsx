"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

/** How long each photo is shown before the next fades in. */
const SLIDE_MS = 7000;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The photographs behind the home page headline: each drifts slowly sideways
 * and crossfades into the next.
 *
 * REDUCED MOTION
 * Someone who has asked their system to reduce motion gets the first photo,
 * still, and nothing else: no drift, no crossfade, no timer. That is checked
 * two ways - `motion-safe:` in the class names stops the CSS animation, and the
 * media query below stops the JavaScript from changing slides at all, since a
 * crossfade is motion even when nothing is "animating" in the CSS sense.
 *
 * PAUSE CONTROL
 * Movement that starts on its own and runs for more than five seconds must be
 * stoppable by the person looking at it (WCAG 2.2.2), whatever their system
 * setting. The button in the corner does that: it stops the slide timer and
 * freezes the drift where it is.
 *
 * PERFORMANCE
 * Only the first photo is loaded eagerly (it is the page's largest element, so
 * it gets `priority`); the rest load lazily once the page is up. All of them go
 * through next/image, which serves a size suited to the screen.
 *
 * The images are decorative - the headline carries the meaning - so they have
 * empty alt text and the photo stack is hidden from assistive technology.
 */
export function HeroSlideshow({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const prefersReducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    // On the server, assume motion is NOT wanted: the page then starts still
    // and only begins to move once the browser has confirmed it may.
    () => true,
  );

  const isMoving = !prefersReducedMotion && !isPaused && images.length > 0;

  useEffect(() => {
    if (!isMoving || images.length < 2) {
      return;
    }

    const timer = setInterval(() => {
      setActive((current) => (current + 1) % images.length);
    }, SLIDE_MS);

    return () => clearInterval(timer);
  }, [isMoving, images.length]);

  const shown = prefersReducedMotion ? 0 : active;

  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#1b1b1f]">
        {images.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            sizes="100vw"
            priority={index === 0}
            // Paused by freezing the animation in place rather than removing
            // it, so the picture does not jump back to its starting position.
            style={{ animationPlayState: isPaused ? "paused" : "running" }}
            className={[
              "object-cover motion-safe:transition-opacity motion-safe:duration-[1500ms]",
              "motion-safe:animate-[hero-drift_24s_ease-in-out_infinite_alternate]",
              index === shown ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        ))}

        {/*
         * Darkens the photo, most of all at the bottom where the headline sits.
         * The text over it is literal white, and this gradient is what
         * guarantees its contrast whatever photograph ends up underneath.
         */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.4)_0%,rgba(0,0,0,0.3)_40%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      {/* Not offered when nothing is moving to begin with. */}
      {prefersReducedMotion || images.length === 0 ? null : (
        <button
          type="button"
          onClick={() => setIsPaused((paused) => !paused)}
          aria-pressed={isPaused}
          aria-label={isPaused ? "Play background motion" : "Pause background motion"}
          className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
            {isPaused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
          </svg>
        </button>
      )}
    </>
  );
}
