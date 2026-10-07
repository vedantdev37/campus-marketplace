import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { isSafeNextPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Sign in · Campus Marketplace",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // `next` arrives from the URL, so it is attacker-controlled. It is checked
  // here before being written into the form, and checked again in the action
  // before being used - the value is never trusted because it round-tripped
  // through our own markup.
  const safeNext = isSafeNextPath(next) ? next : undefined;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        Welcome back. Pick up where you left off.
      </p>

      <LoginForm next={safeNext} />

      <p className="mt-5 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
