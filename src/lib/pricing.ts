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
