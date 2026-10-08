import {
  CATEGORIES_WITH_SIZE,
  CONDITION_CHECKS,
  LAB_SIZES,
  type ConditionChecks,
  type ListingCategory,
} from "@/lib/types/listing";

/**
 * The condition checklist inputs on the listing form.
 *
 * Which items appear depends on the category, and the component is keyed by
 * category where it is used, so switching category starts the new checklist
 * blank rather than carrying ticks over to items that share nothing with the
 * old ones. The server re-derives the checklist from the submitted category
 * anyway, and the database rejects a key that does not belong.
 *
 * Plain checkboxes and radios with no state: they submit with the form as
 * `check_<key>` fields, and work before JavaScript has loaded.
 */
export function ConditionChecklist({
  category,
  defaults,
}: {
  category: ListingCategory;
  defaults?: ConditionChecks;
}) {
  const items = CONDITION_CHECKS[category] ?? [];
  const hasSize = CATEGORIES_WITH_SIZE.includes(category);

  if (items.length === 0 && !hasSize) {
    return null;
  }

  return (
    <fieldset className="rounded-[14px] border border-hairline p-4">
      <legend className="px-1 text-sm font-medium text-ink">Condition details (optional)</legend>
      <p className="mb-2 text-sm text-ink-muted">
        Tick what is true of your item. Buyers see these on the listing.
      </p>

      {hasSize ? (
        <div className="mb-3">
          <p id="check-size-label" className="mb-2 text-sm font-medium text-ink">
            Size
          </p>
          <div role="radiogroup" aria-labelledby="check-size-label" className="flex flex-wrap gap-2">
            {LAB_SIZES.map((size) => (
              <label key={size} className="cursor-pointer">
                <input
                  type="radio"
                  name="check_size"
                  value={size}
                  defaultChecked={defaults?.size === size}
                  className="peer sr-only"
                />
                {/* DESIGN.md `date-picker-day-selected`: ink fill, white text. */}
                <span className="flex h-11 min-w-12 items-center justify-center rounded-full border border-control-border px-4 text-sm font-medium text-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                  {size}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
        {items.map((item) => (
          // The whole 48px row is the label, so it is one large tap target.
          <label
            key={item.key}
            className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-ink"
          >
            <input
              type="checkbox"
              name={`check_${item.key}`}
              defaultChecked={defaults?.[item.key] === true}
              className="size-6 shrink-0 accent-(--ds-ink)"
            />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
