/**
 * DESIGN.md `text-input`: white surface, 1px hairline, 8px radius, 56px tall.
 * On focus the border turns ink and thickens to 2px with no glow - done with an
 * inset shadow so the extra pixel does not shift the layout.
 */
export const INPUT_CLASS =
  "min-h-14 w-full rounded-lg border bg-canvas px-3.5 py-3 text-base text-ink placeholder:text-ink-muted focus-visible:border-ink focus-visible:shadow-[inset_0_0_0_1px_var(--ds-ink)] focus-visible:outline-none";

/** DESIGN.md `button-secondary`: white, 1px ink outline, 8px radius, 48px tall. */
export const SECONDARY_BUTTON_CLASS =
  "flex h-12 items-center justify-center rounded-lg border border-ink bg-canvas px-4 text-base font-medium whitespace-nowrap text-ink transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:border-hairline disabled:text-ink-muted";

export type FieldControlProps = {
  id: string;
  name: string;
  className: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

/**
 * Label, control, hint and error, wired together for assistive technology.
 *
 * The control is supplied as a render function so this works for <input>,
 * <textarea> and <select> alike: the wrapper computes the id and aria
 * attributes once and hands them over, rather than each control repeating them.
 */
export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>

      {children({
        id,
        name,
        className: `${INPUT_CLASS} ${error ? "border-error" : "border-control-border"}`,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
