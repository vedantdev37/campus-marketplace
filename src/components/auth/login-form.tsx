"use client";

import { useActionState, useState, type FormEvent } from "react";

import { signInAction, type AuthFormState } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { fieldErrorsFrom, loginSchema } from "@/lib/validation/auth";

const INITIAL_STATE: AuthFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [serverState, formAction] = useActionState(signInAction, INITIAL_STATE);
  const [clientErrors, setClientErrors] = useState<Record<string, string | undefined>>({});

  const errorFor = (field: "email" | "password") =>
    clientErrors[field] ?? serverState.fieldErrors?.[field];

  /**
   * Login validates only on submit, not on blur.
   *
   * Nagging someone about the format of an email they have typed a hundred
   * times is friction without benefit - and unlike sign-up there is no policy
   * to teach them. The real answer comes from the server either way.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (parsed.success) {
      setClientErrors({});
      return;
    }

    event.preventDefault();
    setClientErrors(fieldErrorsFrom(parsed.error));
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {serverState.formError ? <Alert tone="error">{serverState.formError}</Alert> : null}

      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="you@nmit.ac.in…"
        spellCheck={false}
        defaultValue={serverState.values?.email ?? ""}
        error={errorFor("email")}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errorFor("password")}
      />

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
