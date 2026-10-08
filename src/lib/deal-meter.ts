/**
 * The deal meter: is this asking price a good one?
 *
 * ONE FUNCTION, NO IMPORTS
 * Everything the calculation needs is in this file, and it imports nothing at
 * run time. That is deliberate: `scripts/test-deal-meter.mjs` loads this file
 * directly with Node and checks the arithmetic, with no build step and no
 * framework in between. If the formula changes, that test says so.
 *
 * THE FORMULA
 *
 *   fair price = MRP x condition factor x category factor
 *   ratio      = asking price / fair price
 *
 *   ratio <= 0.85   Steal deal
 *   ratio <= 1.15   Fair price
 *   ratio <= 1.40   Bit high
 *   otherwise       Overpriced
 *
 * The factors are judgement, not data: there is no sales history to fit them
 * to. They are rough answers to "what fraction of its new price is a
 * second-hand one worth?", and the page says so next to every verdict.
 */

/** How much of its new price an item keeps, by condition. */
export const CONDITION_FACTOR = {
  new: 0.9,
  like_new: 0.8,
  good: 0.65,
  fair: 0.55,
  poor: 0.35,
} as const;

/**
 * A further adjustment by category. Electronics lose value fastest: a
 * calculator's battery, screen and buttons wear, and a newer model replaces
 * it. A textbook or a lab coat does the same job in its fourth year as its
 * first.
 */
export const CATEGORY_FACTOR = {
  books: 1,
  notes: 1,
  lab: 1,
  furniture: 0.9,
  hostel: 0.9,
  other: 0.9,
  electronics: 0.8,
} as const;

/** The condition as the meter words it. "Fair" would clash with "Fair price". */
export const CONDITION_WORD = {
  new: "new",
  like_new: "like new",
  good: "good",
  fair: "used",
  poor: "heavily used",
} as const;

export type DealVerdict = "steal" | "fair" | "bit_high" | "overpriced" | "free";

/**
 * Each verdict is a WORD first. The mark is a shape that repeats it, for a
 * quick glance; neither depends on colour.
 */
export const DEAL_LABEL: Record<DealVerdict, { label: string; mark: string }> = {
  steal: { label: "Steal deal", mark: "▼" },
  fair: { label: "Fair price", mark: "●" },
  bit_high: { label: "Bit high", mark: "▲" },
  overpriced: { label: "Overpriced", mark: "▲▲" },
  free: { label: "Can’t beat free", mark: "★" },
};

export type DealMeter = {
  verdict: DealVerdict;
  label: string;
  mark: string;
  /** The fair second-hand price, in whole rupees. Null for a free item. */
  fair: number | null;
  /** One line showing the working. Null for a free item. */
  reasoning: string | null;
};

export type DealInput = {
  type: string;
  price: number;
  originalPrice: number | null;
  condition: string;
  category: string;
};

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

/**
 * The verdict for a post, or null when there is nothing honest to say.
 *
 * - A free item: "Can't beat free", whatever else is known.
 * - A sale with an MRP: the four-step verdict above.
 * - A sale with no MRP: null. Without a price when new there is nothing to
 *   compare against, and a confident badge built on a guess would be worse
 *   than no badge.
 * - A rental, a skill, a team request or a found item: null. A per-day price
 *   is not comparable to an MRP, and the rest have no price at all.
 */
export function dealMeter(input: DealInput): DealMeter | null {
  if (input.type === "free") {
    return { verdict: "free", ...DEAL_LABEL.free, fair: null, reasoning: null };
  }

  if (input.type !== "sale") {
    return null;
  }

  const mrp = input.originalPrice;

  if (mrp === null || !Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(input.price) || input.price < 0) {
    return null;
  }

  const conditionFactor = CONDITION_FACTOR[input.condition as keyof typeof CONDITION_FACTOR];
  const categoryFactor = CATEGORY_FACTOR[input.category as keyof typeof CATEGORY_FACTOR];

  if (conditionFactor === undefined || categoryFactor === undefined) {
    return null;
  }

  const fair = Math.round(mrp * conditionFactor * categoryFactor);

  if (fair <= 0) {
    return null;
  }

  const ratio = input.price / fair;
  const verdict: DealVerdict =
    ratio <= 0.85 ? "steal" : ratio <= 1.15 ? "fair" : ratio <= 1.4 ? "bit_high" : "overpriced";

  const word = CONDITION_WORD[input.condition as keyof typeof CONDITION_WORD];

  return {
    verdict,
    ...DEAL_LABEL[verdict],
    fair,
    reasoning: `MRP ${rupees(mrp)} · ${word} · fair ≈ ${rupees(fair)} · asking ${rupees(input.price)} → ${DEAL_LABEL[verdict].label}`,
  };
}
