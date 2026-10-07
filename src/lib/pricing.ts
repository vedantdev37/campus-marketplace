import { CONDITION_VALUE_FACTOR, type ItemCondition } from "@/lib/types/listing";

/**
 * Formats a rupee amount for display.
 *
 * `maximumFractionDigits: 0` because campus prices are whole rupees in
 * practice, and "₹320" reads better on a card than "₹320.00".
 */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export type FairPriceVerdict = "great" | "fair" | "high";

export type FairPriceHint = {
  /** What the item is roughly worth given its condition. */
  expected: number;
  /** Asking price as a percentage of the original. */
  percentOfOriginal: number;
  verdict: FairPriceVerdict;
  message: string;
};

/**
 * Compares an asking price against the book's original price, adjusted for
 * condition.
 *
 * Returns null when there is nothing to compare - no original price, or a
 * nonsensical one. A hint based on missing data would be worse than no hint,
 * because a confident-looking number invites trust it has not earned.
 *
 * The tolerance band is wide (±15% of the condition-adjusted value) on purpose:
 * this is a sanity check for a buyer, not a valuation, and a narrow band would
 * flag ordinary prices as wrong.
 */
export function fairPriceHint(
  price: number,
  originalPrice: number | null,
  condition: ItemCondition,
): FairPriceHint | null {
  if (originalPrice === null || originalPrice <= 0 || price < 0) {
    return null;
  }

  const expected = originalPrice * CONDITION_VALUE_FACTOR[condition];
  const percentOfOriginal = Math.round((price / originalPrice) * 100);

  if (price <= expected * 0.85) {
    return {
      expected,
      percentOfOriginal,
      verdict: "great",
      message: `Below the usual price for this condition — about ${percentOfOriginal}% of the original.`,
    };
  }

  if (price <= expected * 1.15) {
    return {
      expected,
      percentOfOriginal,
      verdict: "fair",
      message: `In line with the usual price for this condition — about ${percentOfOriginal}% of the original.`,
    };
  }

  return {
    expected,
    percentOfOriginal,
    verdict: "high",
    message: `Above the usual price for this condition — about ${percentOfOriginal}% of the original.`,
  };
}
