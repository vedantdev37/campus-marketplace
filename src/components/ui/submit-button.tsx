"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  /** Label shown while the action is in flight. */
  pendingLabel: string;
};

/**
 * Submit button that disables itself while its form's action is running.
 *
 * `useFormStatus` reads the pending state of the nearest enclosing form, which
 * is why this is a separate component: the hook only reports status for a form
 * *above* it in the tree, so it cannot live in the component that renders the
 * <form>.
 *
 * Disabling is what prevents a double submit creating two accounts from one
 * impatient double-click.
 */
export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-1 w-full rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
