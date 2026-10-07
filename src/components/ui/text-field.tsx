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
          "w-full rounded-lg border bg-surface px-3 py-2.5 text-base",
          "placeholder:text-muted/60",
          // 16px text on mobile prevents iOS Safari from zooming on focus.
          error ? "border-danger" : "border-border",
          className,
        ].join(" ")}
      />

      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
