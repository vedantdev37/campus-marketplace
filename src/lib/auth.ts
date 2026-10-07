import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side session access.
 *
 * Centralising it here is the Data Access Layer pattern: every route reads the
 * session the same way, through a function that returns a deliberately narrow
 * object rather than the raw JWT payload. Nothing downstream can accidentally
 * leak a token into a prop.
 */

export type SessionUser = {
  id: string;
  email: string;
};

/**
 * The signed-in user, or null.
 *
 * Uses `getClaims()` rather than `getUser()`: it verifies the token signature
 * locally against the project's public signing key instead of calling the auth
 * server on every render. It confirms the token is authentic and unexpired, not
 * that the account still exists this instant - acceptable over a short token
 * lifetime, and RLS remains the actual boundary on data access.
 *
 * Never use `getSession()` for an authorisation decision. It reads the cookie
 * without verifying the signature, so its contents are attacker-controlled.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  const claims = data?.claims;
  if (error || !claims?.sub) {
    return null;
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
  };
}

/**
 * The signed-in user, or a redirect to login.
 *
 * `redirect()` throws to unwind rendering, so nothing after a failed check can
 * execute - the caller cannot forget to return early.
 *
 * proxy.ts already gates protected routes. This is the second layer: a page or
 * action is still safe if the matcher is ever changed or a route is added
 * outside it.
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
