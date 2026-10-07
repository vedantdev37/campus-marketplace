import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Browse · Campus Marketplace",
};

export default async function ListingsPage() {
  // proxy.ts already blocks unauthenticated requests to this route. This is the
  // second check, so the page stays safe if the proxy matcher is ever narrowed
  // or this route is moved outside it.
  const user = await requireSessionUser();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
          <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium">No listings yet</p>
        <p className="mt-1 text-sm text-muted">
          Listings, search and filters arrive in the next phase.
        </p>
      </div>
    </main>
  );
}
