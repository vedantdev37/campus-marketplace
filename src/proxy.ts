import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

/**
 * Runs before every matched request: refreshes the Supabase session and gates
 * protected routes.
 *
 * NOTE ON THE FILENAME. In Next.js 16 the `middleware.ts` convention was
 * renamed to `proxy.ts`, and the exported function from `middleware` to
 * `proxy`. Every Supabase guide still says `middleware.ts` - a file by that
 * name would simply never run here, and the only symptom would be users being
 * mysteriously logged out, because nothing would refresh their tokens.
 *
 * Proxy runs on the Node.js runtime in Next 16 (the edge runtime is not
 * supported), which suits the Supabase client fine.
 */

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_ROUTES = new Set(["/", "/login", "/signup", "/security"]);

/** Prefixes reachable without a session (auth callbacks, error pages). */
const PUBLIC_PREFIXES = ["/auth/"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export async function proxy(request: NextRequest) {
  // Reassigned inside setAll when Supabase rotates tokens, so it must be `let`.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),

        setAll: (cookiesToSet, headers) => {
          // Update the request so anything rendering later in this same pass
          // sees the refreshed token rather than the stale one.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          // The second argument is easy to miss and must not be skipped.
          // @supabase/ssr supplies `Cache-Control: private, no-store` here, and
          // its own documentation is blunt about the consequence of dropping
          // it: a CDN or reverse proxy may cache a response carrying auth
          // cookies and then serve one user's session token to another user.
          // Vercel sits behind exactly such a CDN.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // This call is what triggers the refresh, and it must happen before any
  // response is committed - a refresh that completes afterwards cannot write
  // its cookies and is lost.
  //
  // getClaims() verifies the JWT's signature locally against the project's
  // public signing key, so it costs no network round trip per request, unlike
  // getUser(). The trade-off: it proves the token is authentic and unexpired,
  // but not that the account still exists this second. Over a short token
  // lifetime that is an acceptable exchange for not calling the auth server on
  // every single request - and RLS, not this check, is the real boundary.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;

  // Signed out, visiting something protected -> login, remembering where they
  // were headed so they land there after signing in.
  if (!isSignedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Signed in, visiting the auth pages -> straight to browsing.
  if (isSignedIn && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/listings";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Without a matcher this runs on every request including static assets,
  // which would put an auth check in front of the CSS.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
