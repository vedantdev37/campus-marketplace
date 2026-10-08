/**
 * "Scan it. List it." - a picture of what the ISBN scanner does, in three
 * steps: a barcode is read, the form fills itself in, the listing appears with
 * a price verdict.
 *
 * It is an illustration, not the feature: nothing here calls the camera or the
 * book lookup. So the whole thing is one image to assistive technology, with a
 * sentence that says what it shows.
 *
 * MOTION
 * It plays once, when the section scrolls into view, and then stays on its
 * last frame. It does not loop, so there is nothing that keeps moving and
 * nothing that needs a pause button. All of it is CSS in globals.css, keyed to
 * the `data-reveal` attribute on the wrapper: with reduced motion, or without
 * JavaScript, the last frame is simply what is drawn.
 */
export function ScanDemo() {
  return (
    <div
      data-reveal
      role="img"
      aria-label="Example: a book's barcode is scanned, its title, author and cover are filled in, and the listing shows that 320 rupees is below the usual price."
      className="grid w-full max-w-md gap-3"
    >
      {/* 1. The barcode, with a line sweeping across it. */}
      <div className="rounded-[14px] border border-hairline bg-surface-soft p-4">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">1 · Scan</p>

        <div className="relative mt-3 h-16 overflow-hidden rounded-lg bg-white">
          <div
            className="absolute inset-x-3 inset-y-2"
            style={{
              // Stripes of uneven width, so it reads as a barcode and not a fence.
              backgroundImage:
                "repeating-linear-gradient(90deg,#111 0 3px,transparent 3px 5px,#111 5px 6px,transparent 6px 10px,#111 10px 14px,transparent 14px 16px,#111 16px 17px,transparent 17px 21px)",
            }}
          />
          <div className="scan-line absolute inset-0 border-r-[3px] border-accent bg-accent/15" />
        </div>

        <p className="mt-2 font-mono text-sm text-ink-body">978-81-933284-9-1</p>
      </div>

      {/* 2. The fields the lookup fills in, arriving one after another. */}
      <div className="rounded-[14px] border border-hairline bg-surface-soft p-4">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">2 · Autofill</p>

        <dl className="mt-3 flex flex-col gap-2 text-sm">
          {[
            ["Title", "Higher Engineering Mathematics", "1400ms"],
            ["Author", "B.S. Grewal", "1650ms"],
            ["Cover", "Found ✓", "1900ms"],
          ].map(([label, value, delay]) => (
            <div
              key={label}
              className="scan-fill flex gap-3"
              style={{ ["--fill-delay" as string]: delay }}
            >
              <dt className="w-14 shrink-0 text-ink-muted">{label}</dt>
              <dd className="font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 3. The result: a price, and whether it is a fair one. */}
      <div
        className="scan-fill rounded-[14px] border border-hairline bg-surface-soft p-4"
        style={{ ["--fill-delay" as string]: "2300ms" }}
      >
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">3 · Listed</p>

        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[26px] leading-none font-extrabold text-price tabular-nums">₹320</span>
          <span className="text-sm font-semibold text-ink">▼ Below the usual price</span>
        </p>
        <p className="mt-1 text-sm text-ink-muted">Good condition. New, it was ₹650.</p>
      </div>
    </div>
  );
}
