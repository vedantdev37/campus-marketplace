import {
  CATEGORIES_WITH_SIZE,
  CONDITION_CHECKS,
  LAB_SIZES,
  type ConditionChecks,
  type ListingCategory,
} from "@/lib/types/listing";

/**
 * The seller's condition checklist, as shown to a buyer.
 *
 * Confirmed items get a tick. Items the seller did not tick are listed
 * separately as "not stated", with an en dash - never a cross and never in the
 * error colour. An unticked box means the seller said nothing, which is
 * different from the item being bad, and a red cross would claim the latter.
 *
 * Labels are looked up from CONDITION_CHECKS by key. Nothing stored in the
 * database is rendered as text here except a size, and that only if it is one
 * of the known sizes - so even a row written straight through the API cannot
 * put arbitrary strings on this page.
 */
export function ConditionSummary({
  category,
  checks,
}: {
  category: ListingCategory;
  checks: ConditionChecks | null | undefined;
}) {
  const items = CONDITION_CHECKS[category] ?? [];
  const hasSize = CATEGORIES_WITH_SIZE.includes(category);

  if (items.length === 0 && !hasSize) {
    return null;
  }

  const stored = checks ?? {};
  const confirmed = items.filter((item) => stored[item.key] === true);
  const notStated = items.filter((item) => stored[item.key] !== true);

  const size =
    hasSize && typeof stored.size === "string" && (LAB_SIZES as readonly string[]).includes(stored.size)
      ? stored.size
      : null;

  // A listing made before checklists existed has nothing to say; showing three
  // rows of "not stated" under it would only be noise.
  if (confirmed.length === 0 && size === null) {
    return null;
  }

  return (
    <section aria-labelledby="condition-summary-heading" className="mt-5 border-t border-border pt-4">
      <h2 id="condition-summary-heading" className="text-sm font-semibold">
        Seller confirms
      </h2>

      <ul className="mt-2 flex flex-col gap-1.5 text-sm">
        {size ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-4 text-center font-semibold">
              ✓
            </span>
            Size {size}
          </li>
        ) : null}

        {confirmed.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="w-4 text-center font-semibold">
              ✓
            </span>
            {item.label}
          </li>
        ))}
      </ul>

      {notStated.length > 0 ? (
        <>
          <h3 className="mt-3 text-xs font-medium text-muted">Not stated — ask the seller</h3>
          <ul className="mt-1 flex flex-col gap-1 text-sm text-muted">
            {notStated.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <span aria-hidden="true" className="w-4 text-center">
                  –
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
