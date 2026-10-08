const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A number whose digits roll into place, like a mechanical counter.
 *
 * Each digit is a column of 0-9, one line tall, with the overflow hidden; the
 * column is slid up so the wanted digit shows. That final position is set
 * here, inline, so it is what the server sends and what anyone sees with no
 * script and no animation. The rolling is added on top by CSS: inside a
 * scroll-reveal container that is still hidden, every column is held at 0,
 * and it travels to its digit when the container is revealed (globals.css).
 *
 * The moving digits are hidden from assistive technology, which is given the
 * plain number once instead of ten digits per column.
 */
export function DigitRoller({ value }: { value: number }) {
  const digits = String(Math.max(0, Math.trunc(value))).split("").map(Number);

  return (
    <span className="inline-flex tabular-nums">
      <span className="sr-only">{value}</span>

      <span aria-hidden="true" className="inline-flex">
        {digits.map((digit, index) => (
          <span key={index} className="inline-block h-[1em] overflow-hidden leading-none">
            <span
              className="roller-digits flex flex-col"
              style={{
                transform: `translateY(-${digit}em)`,
                // Later digits start a touch later, so the number settles
                // from left to right.
                ["--roll-delay" as string]: `${index * 120}ms`,
              }}
            >
              {DIGITS.map((n) => (
                <span key={n} className="block h-[1em] leading-none">
                  {n}
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
