import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/signup-form";
import { isSafeNextPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Create account · Campus Marketplace",
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
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        Buy and sell with students on your campus.
      </p>

      <SignUpForm next={safeNext} />

      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
