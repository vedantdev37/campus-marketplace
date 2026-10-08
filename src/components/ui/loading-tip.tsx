/**
 * A line of advice shown under a loading skeleton, in the manner of a game's
 * loading screen. Each one is true and useful on its own: the wait is the
 * excuse for saying it, not the reason it exists.
 *
 * Which tip appears is fixed per page, not random. A random choice made on the
 * server and again in the browser would disagree, and a tip that changes as
 * the page hydrates is worse than one that never changes.
 */
const TIPS = [
  "Meet at the library entrance. There’s always someone around.",
  "Scanning the barcode is faster than typing. Trust us.",
  "Seniors sell cheapest in the last week of semester.",
  "Need a drafter once? Rent it, don’t buy it.",
  "If a deal sounds too good, meet in daylight.",
] as const;

export function LoadingTip({ tip }: { tip: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <p className="mx-auto mt-6 w-full max-w-md px-4 text-center text-sm text-ink-muted">
      <span className="font-semibold text-ink-body">Tip:</span> {TIPS[tip]}
    </p>
  );
}
