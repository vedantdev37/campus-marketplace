import Link from "next/link";

/**
 * Shared chrome for the sign-in and sign-up pages.
 *
 * `(auth)` is a route group: the parentheses keep these two pages together
 * under one layout without adding an `/auth` segment to their URLs, so the
 * routes stay `/login` and `/signup`.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col px-5 py-10 sm:justify-center">
      <div className="mx-auto w-full max-w-sm">
        <Link href="/" className="block text-center text-lg font-semibold tracking-tight">
          Campus Marketplace
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
