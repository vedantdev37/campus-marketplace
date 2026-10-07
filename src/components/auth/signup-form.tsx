"use client";

import { useActionState, useState, type FormEvent } from "react";

import { signUpAction, type AuthFormState } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import {
  authFieldSchemas,
  fieldErrorsFrom,
  signUpSchema,
  type AuthField,
} from "@/lib/validation/auth";

const INITIAL_STATE: AuthFormState = {};

export function SignUpForm({ next }: { next?: string }) {
  const [serverState, formAction] = useActionState(signUpAction, INITIAL_STATE);

  const [clientErrors, setClientErrors] = useState<Record<string, string | undefined>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * Once a field has been touched, its client-side result is what we show -
   * including "no error", which is how a stale server error disappears as soon
   * as the user fixes the field. Until then, the server's verdict stands.
   */
  const errorFor = (field: AuthField) =>
    touched[field] ? clientErrors[field] : serverState.fieldErrors?.[field];

  function validateOnBlur(field: AuthField, value: string) {
    const result = authFieldSchemas[field].safeParse(value);

    setTouched((previous) => ({ ...previous, [field]: true }));
    setClientErrors((previous) => ({
      ...previous,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
  }

  /**
   * Blocks the submit if anything is invalid, so an obviously-bad form never
   * costs a round trip. The Server Action parses the same schema again
   * regardless - this is convenience, not protection.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (!parsed.success) {
      event.preventDefault();
      setClientErrors(fieldErrorsFrom(parsed.error));
      setTouched({ fullName: true, email: true, password: true });
    }
  }

  if (serverState.notice) {
    return <Alert tone="success">{serverState.notice}</Alert>;
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {serverState.formError ? <Alert tone="error">{serverState.formError}</Alert> : null}

      <TextField
        label="Full name"
        name="fullName"
        type="text"
        autoComplete="name"
        required
        defaultValue={serverState.values?.fullName ?? ""}
        error={errorFor("fullName")}
        onBlur={(event) => validateOnBlur("fullName", event.currentTarget.value)}
      />

      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="you@nmit.ac.in"
        hint="Campus email only. Reviewers: use any @reviewer.test address."
        defaultValue={serverState.values?.email ?? ""}
        error={errorFor("email")}
        onBlur={(event) => validateOnBlur("email", event.currentTarget.value)}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errorFor("password")}
        onBlur={(event) => validateOnBlur("password", event.currentTarget.value)}
      />

      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
