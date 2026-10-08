"use server";

import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, loginSchema, signUpSchema } from "@/lib/validation/auth";

/**
 * State returned to the form. Note what is absent: the password is never echoed
 * back in `values`, so it cannot end up in a re-rendered input or a server log.
 */
export type AuthFormState = {
  formError?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
  values?: { fullName?: string; email?: string };
};

/**
 * Turns a Supabase auth error into something a user can act on.
 *
 * The default branch passes the message through, which is deliberate: that is
 * how the database-level domain gate's own message ("Sign-up is limited to
 * approved campus email domains.") reaches the form.
 */
const UNREACHABLE_MESSAGE =
  "Could not reach the sign-in service. Check your connection and try again.";

function describeSignUpError(error: AuthError): string {
  // A request that never got an answer is not a verdict on the user's input.
  if (isAuthRetryableFetchError(error)) {
    return UNREACHABLE_MESSAGE;
  }

  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return "An account with that email already exists - sign in instead.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    default:
      // A 4xx is the auth service refusing THIS request for a stated reason,
      // and its message is written for the person signing up - this is the
      // route by which the domain gate's own wording reaches the form. Anything
      // else (a 5xx, or no status at all) is an internal failure whose text
      // could describe the server rather than help the user, so it is replaced.
      return typeof error.status === "number" && error.status >= 400 && error.status < 500
        ? error.message
        : "Sign-up is not available right now. Please try again in a moment.";
  }
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submitted = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  // Re-validated here even though the form already checked: the client-side
  // pass is for feedback, this one is the gate.
  const parsed = signUpSchema.safeParse(submitted);

  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { fullName: submitted.fullName, email: submitted.email },
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the handle_new_user trigger to populate profiles.full_name.
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return {
      formError: describeSignUpError(error),
      values: { fullName: submitted.fullName, email: submitted.email },
    };
  }

  // No session means the project still requires email confirmation. Handled
  // rather than assumed, so the app behaves correctly either way.
  if (!data.session) {
    return {
      notice: `Almost there - confirm your email (${parsed.data.email}) to finish signing up.`,
    };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const submitted = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = loginSchema.safeParse(submitted);

  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { email: submitted.email },
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // A network failure must not be reported as a wrong password. It was, until
    // a dropped connection during testing showed "Email or password is
    // incorrect." for correct credentials - which sends a user off to reset a
    // password that was never wrong.
    if (isAuthRetryableFetchError(error)) {
      return { formError: UNREACHABLE_MESSAGE, values: { email: submitted.email } };
    }

    // Deliberately one message for both "no such account" and "wrong
    // password". Distinguishing them would let someone enumerate which campus
    // addresses are registered.
    return {
      formError:
        error.code === "over_request_rate_limit"
          ? "Too many attempts. Wait a minute and try again."
          : "Email or password is incorrect.",
      values: { email: submitted.email },
    };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/login");
}
