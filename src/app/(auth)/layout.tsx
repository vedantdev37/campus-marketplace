/**
 * Shared frame for the sign-in and sign-up pages.
 *
 * `(auth)` is a route group: the parentheses keep these two pages together
 * under one layout without adding an `/auth` segment to their URLs, so the
 * routes stay `/login` and `/signup`.
 *
 * DESIGN.md account flows sit directly on the canvas, with no card around the
 * form - the site header already says where you are.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-canvas px-4 py-10 text-ink md:justify-center md:py-16">
      <div className="mx-auto w-full max-w-[400px]">{children}</div>
    </main>
  );
}
