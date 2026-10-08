import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/signup-form";
import { isSafeNextPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Create account · Nitte Mart",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = isSafeNextPath(next) ? next : undefined;

  return (
    <>
      <h1 className="text-[28px] leading-tight font-bold">Create your account</h1>
      <p className="mt-2 mb-6 text-base text-ink-body">
        Buy and sell with students on your campus.
      </p>

      <SignUpForm next={safeNext} />

      <p className="mt-6 text-base text-ink-body">
        Already have an account?{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-ink underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
