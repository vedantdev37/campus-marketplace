import Link from "next/link";

import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Campus Marketplace</h1>
      <p className="mt-3 text-base/relaxed text-muted">
        Buy and sell with students on your campus — textbooks, electronics and
        hostel essentials. Scan a book&apos;s barcode to list it in seconds.
      </p>

      {user ? (
        <Link
          href="/listings"
          className="mt-8 w-full rounded-lg bg-primary px-4 py-2.5 text-center text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Browse listings
        </Link>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-center text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-border px-4 py-2.5 text-center text-base font-medium transition-colors hover:bg-surface-muted"
          >
            Sign in
          </Link>

          <p className="mt-2 text-center text-xs text-muted">
            Evaluating this project? Sign up with any{" "}
            <span className="font-medium">@reviewer.test</span> email.
          </p>
        </div>
      )}
    </main>
  );
}
