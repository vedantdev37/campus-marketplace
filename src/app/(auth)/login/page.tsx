import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { isSafeNextPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Sign in · Nitte Mart",
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
      <h1 className="text-[28px] leading-tight font-bold">Sign in</h1>
      <p className="mt-2 mb-6 text-base text-ink-body">
        Welcome back. Pick up where you left off.
      </p>

      <LoginForm next={safeNext} />

      <p className="mt-6 text-base text-ink-body">
        New here?{" "}
        <Link href="/signup" className="inline-flex min-h-11 items-center font-semibold text-ink underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
