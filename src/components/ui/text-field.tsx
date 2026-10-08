import type { ComponentProps } from "react";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  /** Validation message to show beneath the input, if any. */
  error?: string;
  /** Always-visible helper text, for explaining a rule before it is broken. */
  hint?: string;
};

/**
 * A labelled text input with its error and hint wired up for screen readers.
 *
 * `aria-describedby` points at whichever of hint/error exist, and
 * `aria-invalid` marks the field when it has an error - so the message is
 * announced rather than only shown. The error is `role="alert"` so it is read
 * when it appears after a failed submit.
 */
export function TextField({
  label,
  name,
  error,
  hint,
  className = "",
  ...inputProps
}: TextFieldProps) {
  const inputId = `field-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>

      <input
        {...inputProps}
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          "min-h-14 w-full rounded-lg border bg-canvas px-3.5 py-3 text-base text-ink",
          "placeholder:text-ink-muted",
          "focus-visible:border-ink focus-visible:shadow-[inset_0_0_0_1px_var(--ds-ink)] focus-visible:outline-none",
          // 16px text on mobile prevents iOS Safari from zooming on focus.
          error ? "border-error" : "border-control-border",
          className,
        ].join(" ")}
      />

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
